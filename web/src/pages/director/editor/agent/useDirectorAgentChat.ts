/**
 * 导演台内置 Agent 聊天状态：直连模型配置的 text 渠道，function calling 循环执行
 * 导演台工具（复用 SSE 桥的 runDirectorTool，与外部 MCP 工具行为一致）。
 */

import { create } from "zustand";

import { randomId } from "@/lib/utils";

import { DIRECTOR_AGENT_SYSTEM_PROMPT, DIRECTOR_AGENT_TOOLS } from "./agentTools";
import { callAgentLlm, parseAgentToolArguments, resolveAgentRequestConfig, type AgentLlmMessage } from "./agentLlm";
import { runDirectorTool } from "../hooks/use-director-agent-bridge";

const MAX_TOOL_ROUNDS = 12;

export type DirectorAgentChatRole = "user" | "assistant" | "tool" | "error";
export type DirectorAgentChatMessage = {
    id: string;
    role: DirectorAgentChatRole;
    text: string;
    toolName?: string;
    toolSummary?: string;
};

type DirectorAgentChatStore = {
    open: boolean;
    sending: boolean;
    messages: DirectorAgentChatMessage[];
    error: string;
    activity: string;
    toggle: () => void;
    setOpen: (open: boolean) => void;
    clear: () => void;
    send: (prompt: string) => Promise<void>;
};

/** 对话历史转 LLM 消息序列（原生 tool_calls 协议）。 */
function toLlmMessages(messages: DirectorAgentChatMessage[]): AgentLlmMessage[] {
    const llm: AgentLlmMessage[] = [{ role: "system", content: DIRECTOR_AGENT_SYSTEM_PROMPT }];
    for (const message of messages) {
        if (message.role === "user") llm.push({ role: "user", content: message.text });
        else if (message.role === "assistant") llm.push({ role: "assistant", content: message.text });
        else if (message.role === "error") llm.push({ role: "user", content: `[上一轮失败，请修正后重试] ${message.text}` });
        else if (message.role === "tool") llm.push({ role: "user", content: `[工具 ${message.toolName} 结果] ${message.toolSummary || "{}"}` });
    }
    return llm;
}

export const useDirectorAgentChat = create<DirectorAgentChatStore>((set, get) => ({
    open: false,
    sending: false,
    messages: [],
    error: "",
    activity: "",

    toggle: () => set((state) => ({ open: !state.open })),
    setOpen: (open) => set({ open }),
    clear: () => set({ messages: [], error: "", activity: "" }),

    async send(prompt) {
        const text = prompt.trim();
        if (!text || get().sending) return;

        set({ messages: [...get().messages, { id: randomId(), role: "user", text }], sending: true, error: "", activity: "思考中…" });
        try {
            // 渠道校验前置：没配渠道直接给出可操作的错误
            resolveAgentRequestConfig();
            const llmMessages = toLlmMessages(get().messages);
            const collected: DirectorAgentChatMessage[] = [];

            for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
                const { content, toolCalls } = await callAgentLlm(llmMessages, DIRECTOR_AGENT_TOOLS);
                const assistantText = content.trim();
                if (assistantText) collected.push({ id: randomId(), role: "assistant", text: assistantText });
                if (!toolCalls.length) break;

                // 原生回显：assistant(tool_calls) + role:"tool" 结果，成对追加
                llmMessages.push({
                    role: "assistant",
                    content: assistantText,
                    tool_calls: toolCalls.map((call) => ({ id: call.id, type: "function" as const, function: { name: call.name, arguments: call.arguments } })),
                });
                for (const call of toolCalls) {
                    set({ activity: `执行 ${call.name}…` });
                    let resultJson: string;
                    try {
                        const input = parseAgentToolArguments(call.arguments);
                        const result = await runDirectorTool(call.name, input);
                        resultJson = JSON.stringify(result ?? { ok: true });
                        collected.push({ id: randomId(), role: "tool", text: "ok", toolName: call.name, toolSummary: summarizeToolResult(result) });
                    } catch (error) {
                        const messageText = error instanceof Error ? error.message : String(error);
                        resultJson = JSON.stringify({ error: messageText });
                        collected.push({ id: randomId(), role: "tool", text: messageText, toolName: call.name, toolSummary: resultJson });
                    }
                    llmMessages.push({ role: "tool", tool_call_id: call.id, content: resultJson });
                }
                set({ activity: "继续思考…" });
            }

            set((state) => ({
                messages: [...state.messages, ...collected],
                sending: false,
                activity: "",
            }));
        } catch (error) {
            const messageText = error instanceof Error ? error.message : String(error);
            set((state) => ({
                messages: [...state.messages, { id: randomId(), role: "error", text: messageText }],
                sending: false,
                activity: "",
                error: messageText,
            }));
        }
    },
}));

/** 工具结果摘要：对象 ID/文件名/数量优先，长 JSON 截断。 */
function summarizeToolResult(result: unknown): string {
    let text: string;
    if (result && typeof result === "object") {
        const record = result as Record<string, unknown>;
        const parts = Object.entries(record)
            .filter(([, value]) => value !== undefined && value !== null)
            .slice(0, 6)
            .map(([key, value]) => `${key}=${typeof value === "object" ? JSON.stringify(value) : String(value)}`);
        text = parts.join(", ");
    } else {
        text = String(result);
    }
    return text.length > 300 ? `${text.slice(0, 300)}…` : text;
}
