/**
 * 内置 Agent 的模型调用：OpenAI 兼容 Chat Completions（非流式，带 function calling）。
 * 模型取自「模型配置」的 text 渠道（resolveModelRequestConfig），与图像/视频生成共用渠道配置。
 */

import { buildApiUrl, resolveModelRequestConfig, useConfigStore, type AiConfig } from "@/stores/use-config-store";

export type AgentLlmMessage =
    | { role: "system" | "user" | "assistant"; content: string; tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> }
    | { role: "tool"; tool_call_id: string; content: string };

type ChatCompletionResponse = {
    choices?: Array<{ message?: { content?: string | null; tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }> } }>;
    error?: { message?: string };
};

export function describeAgentModel(): string {
    try {
        const config = useConfigStore.getState().config;
        const requestConfig = resolveModelRequestConfig(config, config.textModel);
        return requestConfig.model || "未配置";
    } catch {
        return "未配置（先在模型配置里添加渠道）";
    }
}

/** 校验 text 渠道可用并返回请求配置；不可用时抛出带操作提示的错误。 */
export function resolveAgentRequestConfig(): ReturnType<typeof resolveModelRequestConfig> {
    const config = useConfigStore.getState().config;
    const requestConfig = resolveModelRequestConfig(config, config.textModel);
    if (!requestConfig.baseUrl.trim() || !requestConfig.apiKey.trim()) {
        throw new Error("还没有可用的 text 模型渠道：先在「模型配置」里添加渠道（baseUrl + apiKey + 模型）");
    }
    if (requestConfig.apiFormat !== "openai") {
        throw new Error(`内置 Agent 暂只支持 openai 格式的 text 渠道，当前渠道是 ${requestConfig.apiFormat} 格式`);
    }
    return requestConfig;
}

/** 调用一次 chat/completions；返回 assistant 消息（含文本与工具调用）。 */
export async function callAgentLlm(messages: AgentLlmMessage[], tools: unknown, signal?: AbortSignal): Promise<{ content: string; toolCalls: Array<{ id: string; name: string; arguments: string }> }> {
    const requestConfig = resolveAgentRequestConfig();
    const response = await fetch(buildApiUrl(requestConfig.baseUrl, "/chat/completions"), {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${requestConfig.apiKey.trim()}` },
        body: JSON.stringify({ model: requestConfig.model, messages, tools, tool_choice: "auto", temperature: 0.6 }),
        signal,
    });
    const payload = (await response.json().catch(() => null)) as ChatCompletionResponse | null;
    if (!response.ok || payload?.error?.message) {
        throw new Error(payload?.error?.message || `模型请求失败（HTTP ${response.status}）`);
    }
    const message = payload?.choices?.[0]?.message;
    const content = message?.content || "";
    const toolCalls = (message?.tool_calls || [])
        .filter((call) => call.type === "function" && call.function?.name)
        .map((call) => ({ id: call.id, name: call.function.name, arguments: call.function.arguments || "{}" }));
    return { content, toolCalls };
}

/** 解析工具调用参数；非法 JSON 报错交回模型重试。 */
export function parseAgentToolArguments(rawArguments: string): Record<string, unknown> {
    try {
        const parsed = JSON.parse(rawArguments || "{}");
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
        throw new Error(`工具参数不是合法 JSON：${rawArguments.slice(0, 120)}`);
    }
}

/** 导出渠道配置读取，供面板展示当前模型名。 */
export function agentChannelSummary(): string {
    const config = useConfigStore.getState().config as AiConfig;
    const channel = resolveModelRequestConfig(config, config.textModel);
    return channel.model || "";
}
