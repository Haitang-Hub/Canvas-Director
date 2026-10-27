/**
 * 浏览器内置 Agent 引擎：直连「模型配置」text 渠道的 function calling 循环（非流式），
 * 供统一 Agent 面板在引擎切换为 browser 时使用。工具按页面上下文组装：
 * canvas → canvas_apply_ops + 站点工具；director → runDirectorTool（与 SSE 桥共用执行器）。
 * 消息写入 useAgentStore.browserMessages，并经 agent-chat-storage 持久化到 localforage。
 */

import type { NavigateFunction } from "react-router-dom";

import i18n from "@/i18n";
import { runDirectorTool, applyCanvasOpsFromDirector } from "@/pages/director/editor/hooks/use-director-agent-bridge";
import { randomId } from "@/lib/utils";
import type { AgentChatItem } from "@/stores/use-agent-store";
import { useAgentStore } from "@/stores/use-agent-store";
import { clearBrowserChat, saveBrowserChat } from "@/services/agent-chat-storage";

import { isSiteTool, runSiteTool, SITE_TOOL_LABELS } from "./agent-site-tools";
import { callAgentLlm, parseAgentToolArguments, type AgentLlmMessage } from "./agent-llm";
import { CANVAS_BROWSER_SYSTEM_PROMPT, CANVAS_BROWSER_TOOLS } from "./canvas-browser-tools";
import { DIRECTOR_AGENT_SYSTEM_PROMPT, DIRECTOR_AGENT_TOOLS } from "./director-agent-tools";

const MAX_TOOL_ROUNDS = 12;
const TOOL_OUTPUT_MAX_CHARS = 8000;

type AgentToolCall = { id: string; name: string; arguments: string };

let activeAbortController: AbortController | null = null;

function browserThreadId(context: "canvas" | "director") {
    return `browser:${context}`;
}

function toolLabel(name: string) {
    return isSiteTool(name) ? SITE_TOOL_LABELS[name] : name;
}

/** 从持久化的消息构建 LLM 消息序列（原生 tool_calls 协议）。 */
function toLlmMessages(history: AgentChatItem[], context: "canvas" | "director"): AgentLlmMessage[] {
    const llm: AgentLlmMessage[] = [{ role: "system", content: context === "director" ? DIRECTOR_AGENT_SYSTEM_PROMPT : CANVAS_BROWSER_SYSTEM_PROMPT }];
    for (const item of history) {
        const detail = item.detail as { toolCalls?: AgentToolCall[]; toolCallId?: string; output?: string } | undefined;
        if (item.role === "user") llm.push({ role: "user", content: item.text });
        else if (item.role === "assistant") llm.push({ role: "assistant", content: item.text, ...(detail?.toolCalls?.length ? { tool_calls: detail.toolCalls.map((call) => ({ id: call.id, type: "function" as const, function: { name: call.name, arguments: call.arguments } })) } : {}) });
        else if (item.role === "tool") llm.push({ role: "tool", tool_call_id: detail?.toolCallId || item.itemId || item.id, content: detail?.output || item.text || "{}" });
        else if (item.role === "error") llm.push({ role: "user", content: `[上一轮失败，请修正后重试] ${item.text}` });
    }
    return llm;
}

/** 导演台页上下文追加的跨页工具：读画布列表、写回画布、切换页面（复用画布上下文的工具定义）。 */
const DIRECTOR_CROSS_PAGE_TOOLS = CANVAS_BROWSER_TOOLS.filter((tool) => ["site_navigate", "canvas_apply_ops", "canvas_list_projects"].includes(tool.function.name));

async function runBrowserTool(name: string, input: Record<string, unknown>, context: "canvas" | "director", navigate: NavigateFunction): Promise<unknown> {
    if (context === "director") {
        // 跨页工具优先：导演台页上也能读画布列表、把 ops 写回来源画布（经宿主页应用）或切换页面。
        if (name === "canvas_apply_ops") return await applyCanvasOpsFromDirector(Array.isArray(input.ops) ? input.ops : []);
        if (name === "site_navigate") {
            const path = String(input.path || "/");
            navigate(path);
            return { ok: true, path };
        }
        if (isSiteTool(name)) return await runSiteTool(name, input, navigate, { canvasSnapshot: null });
        return await runDirectorTool(name, input);
    }
    if (name === "canvas_apply_ops") {
        const ops = Array.isArray(input.ops) ? (input.ops as never[]) : [];
        const contextRef = useAgentStore.getState().canvasContext;
        if (!contextRef) throw new Error(i18n.t("agent.siteTools.openCanvasFirst"));
        return contextRef.applyOps(ops);
    }
    if (name === "site_navigate") {
        const path = String(input.path || "/");
        navigate(path);
        return { ok: true, path };
    }
    if (isSiteTool(name)) return await runSiteTool(name, input, navigate, { canvasSnapshot: useAgentStore.getState().canvasContext?.snapshot || null });
    throw new Error(`未知工具：${name}`);
}

/** 发送一条消息并运行 function calling 循环，直到模型不再调用工具。 */
export async function sendBrowserPrompt(prompt: string, navigate: NavigateFunction) {
    const state = useAgentStore.getState();
    const text = prompt.trim();
    if (!text || state.sending) return;
    const context = state.pageContext;
    const threadId = browserThreadId(context);
    const turnId = randomId();

    const pushMessages = (items: AgentChatItem[]) => {
        const latest = useAgentStore.getState();
        const messages = [...latest.browserMessages, ...items];
        useAgentStore.setState({ browserMessages: messages });
        saveBrowserChat(context, messages);
    };
    const patchMessage = (id: string, patch: Partial<AgentChatItem>) => {
        const messages = useAgentStore.getState().browserMessages.map((item) => (item.id === id ? { ...item, ...patch } : item));
        useAgentStore.setState({ browserMessages: messages });
        saveBrowserChat(context, messages);
    };

    const userItem: AgentChatItem = { id: randomId(), itemId: randomId(), threadId, turnId, role: "user", text };
    useAgentStore.setState({ browserMessages: [...useAgentStore.getState().browserMessages, userItem] });
    saveBrowserChat(context, useAgentStore.getState().browserMessages);
    useAgentStore.setState({ prompt: "", canvasReferences: [], sending: true, activity: "思考中…" });

    activeAbortController = new AbortController();
    const signal = activeAbortController.signal;
    try {
        const llmMessages = toLlmMessages(useAgentStore.getState().browserMessages.filter((item) => item.threadId === threadId), context);
        for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
            const { content, toolCalls } = await callAgentLlm(llmMessages, context === "director" ? [...DIRECTOR_AGENT_TOOLS, ...DIRECTOR_CROSS_PAGE_TOOLS] : CANVAS_BROWSER_TOOLS, signal);
            const assistantText = content.trim();
            const assistantItem: AgentChatItem = {
                id: randomId(),
                itemId: randomId(),
                threadId,
                turnId,
                role: "assistant",
                text: assistantText,
                ...(toolCalls.length ? { detail: { toolCalls } } : {}),
            };
            pushMessages([assistantItem]);
            if (!toolCalls.length) break;
            llmMessages.push({
                role: "assistant",
                content: assistantText,
                tool_calls: toolCalls.map((call) => ({ id: call.id, type: "function" as const, function: { name: call.name, arguments: call.arguments } })),
            });
            for (const call of toolCalls) {
                useAgentStore.setState({ activity: `执行 ${toolLabel(call.name)}…` });
                let result: unknown;
                let runError: unknown;
                try {
                    result = await runBrowserTool(call.name, parseAgentToolArguments(call.arguments), context, navigate);
                } catch (error) {
                    runError = error;
                }
                const output = runError ? JSON.stringify({ error: runError instanceof Error ? runError.message : String(runError) }) : JSON.stringify(result ?? { ok: true });
                const toolItem: AgentChatItem = {
                    id: randomId(),
                    itemId: call.id,
                    threadId,
                    turnId,
                    role: "tool",
                    title: toolLabel(call.name),
                    text: runError ? (runError instanceof Error ? runError.message : String(runError)) : "",
                    detail: { kind: "tool", status: runError ? "error" : "completed", toolCallId: call.id, output: output.length > TOOL_OUTPUT_MAX_CHARS ? `${output.slice(0, TOOL_OUTPUT_MAX_CHARS)}…` : output },
                };
                pushMessages([toolItem]);
                llmMessages.push({ role: "tool", tool_call_id: call.id, content: output });
            }
            useAgentStore.setState({ activity: "继续思考…" });
        }
        useAgentStore.setState({ sending: false, activity: i18n.t("agent.events.completed") });
    } catch (error) {
        const aborted = signal.aborted;
        const messageText = error instanceof Error ? error.message : String(error);
        const stateAfter = useAgentStore.getState();
        const messages = aborted ? stateAfter.browserMessages : [...stateAfter.browserMessages, { id: randomId(), itemId: randomId(), threadId, turnId, role: "error", text: messageText } as AgentChatItem];
        useAgentStore.setState({ browserMessages: messages, sending: false, activity: aborted ? i18n.t("agent.message.stopped") : i18n.t("agent.runtime.processingFailed") });
        saveBrowserChat(context, messages);
    } finally {
        activeAbortController = null;
    }
}

/** 停止当前内置引擎循环（中断进行中的模型请求；已执行的工具结果保留）。 */
export function stopBrowserTurn() {
    activeAbortController?.abort();
}

/** 清空当前上下文的内置引擎会话（内存 + 持久化）。 */
export function clearBrowserConversation() {
    const context = useAgentStore.getState().pageContext;
    useAgentStore.setState({ browserMessages: [] });
    clearBrowserChat(context);
}
