#!/usr/bin/env node
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const pkg = createRequire(import.meta.url)("./package.json");
const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = `${__dirname}/logs`;
const LOG_FILE = `${LOG_DIR}/proxy.log`;
mkdirSync(LOG_DIR, { recursive: true });
logFile(`[proxy] v${pkg.version} starting on port ${process.env.PROXY_PORT || 23210}`);

function logFile(msg) {
    appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
}

const CORS_HEADERS = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "*",
    "access-control-allow-headers": "*",
    "access-control-expose-headers": "*",
    "access-control-max-age": "86400",
};

/** Headers that describe the hop to this proxy rather than the upstream request. */
const SKIP_REQUEST_HEADERS = new Set(["host", "connection", "content-length", "accept-encoding", "origin", "referer", "sec-fetch-dest", "sec-fetch-mode", "sec-fetch-site"]);
/** fetch() already decoded and re-framed the body, so the upstream framing headers no longer apply. */
const SKIP_RESPONSE_HEADERS = new Set(["content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive"]);

// ── Codex /responses upstream base URL ──────────────────────────────────────
// Codex sends POST /responses to the proxy; we rewrite the path and forward
// to the real API after stripping namespace-type tools that some providers
// (e.g. Agnes) do not understand.
const CODEX_UPSTREAM_BASE = "https://apihub.agnes-ai.com/v1";

function readArg(args, name, fallback) {
    const index = args.indexOf(`--${name}`);
    return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
    });
}

function readTarget(url) {
    const raw = url.slice(1);
    // decodeURI undoes the escaping browsers apply to the path while keeping intentional encodeURIComponent escapes.
    let target = raw;
    try {
        target = decodeURI(raw);
    } catch {
        // Malformed escape sequence: forward the raw form instead of failing.
    }
    // Some clients collapse the "//" in the embedded target URL, so restore it before parsing.
    target = target.replace(/^(https?:)\/*/i, "$1//");
    return /^https?:\/\/[^/]/i.test(target) ? target : "";
}

function requestHeaders(req) {
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
        if (SKIP_REQUEST_HEADERS.has(key) || value === undefined) continue;
        headers[key] = Array.isArray(value) ? value.join(", ") : value;
    }
    return headers;
}

function responseHeaders(upstream) {
    const headers = { ...CORS_HEADERS };
    upstream.headers.forEach((value, key) => {
        if (SKIP_RESPONSE_HEADERS.has(key) || key.startsWith("access-control-")) return;
        headers[key] = value;
    });
    return headers;
}

/** 流式响应透传全部头（保留 Connection/Keep-Alive/Cache-Control 让客户端认为流是活的），只去 content-length。 */
function streamResponseHeaders(upstream) {
    const headers = { ...CORS_HEADERS };
    upstream.headers.forEach((value, key) => {
        if (key === "content-length" || key.startsWith("access-control-")) return;
        headers[key] = value;
    });
    return headers;
}

function sendJson(res, status, payload) {
    res.writeHead(status, { ...CORS_HEADERS, "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(payload));
}

function logForward(method, target, outcome, startedAt, requestBodySize) {
    const extra = requestBodySize != null ? ` reqBody=${requestBodySize}B` : "";
    console.log(`[${new Date().toLocaleTimeString()}] ${method} ${target} -> ${outcome} ${((Date.now() - startedAt) / 1000).toFixed(1)}s${extra}`);
}

async function collectBody(stream) {
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

/**
 * 将字符串中的换行转为 \n 转义符，避免日志多行显示。
 */
function unline(str) {
    return typeof str === "string" ? str.replace(/\r?\n/g, "\\n") : str;
}

/**
 * 展平 tools 数组中 type === "namespace" 的条目。
 * Codex CLI 将 MCP 工具包裹在 namespace 容器中（如 mcp__infinite_canvas），
 * 但 Agnes API 只接受 function / web_search_preview / code_interpreter / mcp 类型。
 * 直接丢弃会令模型看不到任何画布工具，因此把容器内的 function 工具展开为
 * 带命名空间前缀的普通 function 工具（mcp__server__tool）。
 */
let flattenedNamespaces = [];
let flattenedInnerNames = new Map();

function stripNamespaceTools(bodyStr) {
    if (process.env.CANVAS_PROXY_KEEP_NAMESPACE === "1") return bodyStr;
    try {
        const obj = JSON.parse(bodyStr);
        if (Array.isArray(obj.tools)) {
            flattenedNamespaces = [];
            flattenedInnerNames = new Map();
            logFile(`    [proxy] tools: ${obj.tools.map((t) => `${t?.type || "?"}:${t?.name || "?"}${t?.type === "namespace" ? `(${(t.tools || []).length})` : ""}`).join(", ")}`);
            const flattened = [];
            let namespaceCount = 0;
            let expandedCount = 0;
            for (const tool of obj.tools) {
                if (!tool || tool.type !== "namespace") {
                    flattened.push(tool);
                    continue;
                }
                namespaceCount++;
                if (tool.name) flattenedNamespaces.push(tool.name);
                for (const inner of tool.tools || []) {
                    if (!inner || inner.type !== "function" || !inner.name) continue;
                    if (tool.name && !flattenedInnerNames.has(inner.name)) flattenedInnerNames.set(inner.name, tool.name);
                    flattened.push({
                        type: "function",
                        name: tool.name ? `${tool.name}__${inner.name}` : inner.name,
                        description: inner.description ?? "",
                        parameters: inner.parameters ?? { type: "object", properties: {} },
                        ...(inner.strict != null ? { strict: inner.strict } : {}),
                    });
                    expandedCount++;
                }
            }
            obj.tools = flattened;
            if (namespaceCount) {
                logFile(`    [proxy] expanded ${namespaceCount} namespace tool(s) into ${expandedCount} function tool(s)`);
                console.log(`[${new Date().toLocaleTimeString()}] [proxy] expanded ${namespaceCount} namespace tool(s) into ${expandedCount} function tool(s)`);
            }
        }
        return JSON.stringify(obj);
    } catch {
        // Not JSON — return as-is
        return bodyStr;
    }
}

/**
 * 把展平后的工具名（namespace__tool）还原成 Codex 期望的命名空间调用：
 * 清空 namespace 字段并把 name 改回 inner name。
 * Codex 的 MCP 工具注册表只认「namespace + name」形式，模型直接调用扁平名会报 unsupported call。
 * 模型有时会丢掉前缀直接调裸名（尤其续跑旧会话时），裸名同样映射回所属 namespace。
 */
function rewriteNamespacedCalls(text, namespaces, innerNames) {
    if (!namespaces || namespaces.length === 0) return text;
    const rewriteItem = (item) => {
        if (!item || typeof item !== "object" || item.type !== "function_call" || typeof item.name !== "string") return false;
        for (const ns of namespaces) {
            const prefix = `${ns}__`;
            if (item.name.startsWith(prefix) && item.name.length > prefix.length) {
                item.namespace = ns;
                item.name = item.name.slice(prefix.length);
                return true;
            }
        }
        const bareOwner = innerNames?.get(item.name);
        if (bareOwner) {
            item.namespace = bareOwner;
            logFile(`    [proxy] rewrote bare tool call -> namespace=${bareOwner} name=${item.name}`);
            return true;
        }
        return false;
    };
    const rewriteEvent = (evt) => {
        let changed = false;
        if (rewriteItem(evt.item)) changed = true;
        const lists = [evt.output, evt.response?.output];
        for (const list of lists) {
            if (Array.isArray(list)) for (const item of list) if (rewriteItem(item)) changed = true;
        }
        return changed;
    };
    return text
        .split("\n")
        .map((line) => {
            const match = /^data:\s*(\{.*\})\s*$/.exec(line);
            if (!match) return line;
            let evt;
            try {
                evt = JSON.parse(match[1]);
            } catch {
                return line;
            }
            return rewriteEvent(evt) ? `data: ${JSON.stringify(evt)}` : line;
        })
        .join("\n");
}

/**
 * Agnes 的 /v1/responses 处理不了 input_image content part（内部转换会抛出
 * 几十条 ChatCompletionRequest 校验错误），但 /v1/chat/completions 支持图片。
 * 因此含图片的 Responses 请求改写成 Chat Completions 请求发出，
 * 再把流式响应转换成 Codex 期望的 Responses SSE 事件。
 */

/** 检测 Responses 请求 input 中是否含图片 part。 */
function hasImageParts(body) {
    let found = false;
    const walk = (node) => {
        if (found || !node || typeof node !== "object") return;
        if (Array.isArray(node)) {
            for (const child of node) walk(child);
            return;
        }
        if (node.type === "input_image" || node.type === "image_url" || node.type === "image") {
            const raw = node.image_url ?? node.url;
            const url = typeof raw === "string" ? raw : raw?.url;
            if (url) {
                found = true;
                return;
            }
        }
        for (const value of Object.values(node)) walk(value);
    };
    walk(body?.input);
    return found;
}

/** 把 Responses content 转成 Chat Completions content；纯文本折叠成字符串。 */
function toChatContent(content) {
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    const parts = [];
    let hasImage = false;
    for (const part of content) {
        if (!part || typeof part !== "object") continue;
        if (part.type === "input_text" || part.type === "text" || part.type === "output_text") {
            parts.push({ type: "text", text: String(part.text ?? "") });
        } else if (part.type === "input_image" || part.type === "image_url" || part.type === "image") {
            const raw = part.image_url ?? part.url;
            const url = typeof raw === "string" ? raw : raw?.url;
            if (url) {
                parts.push({ type: "image_url", image_url: { url } });
                hasImage = true;
            }
        }
    }
    return hasImage ? parts : parts.map((part) => part.text).join("");
}

/** 把 Responses 请求体转换成 Chat Completions 请求体。 */
function toChatRequest(body) {
    const chat = { model: body.model, stream: true };
    if (body.temperature != null) chat.temperature = body.temperature;
    if (body.top_p != null) chat.top_p = body.top_p;
    if (body.max_output_tokens != null) chat.max_tokens = body.max_output_tokens;
    if (body.reasoning?.effort) chat.reasoning_effort = body.reasoning.effort;

    if (Array.isArray(body.tools)) {
        const tools = body.tools
            .filter((tool) => tool && tool.type === "function" && tool.name)
            .map((tool) => ({
                type: "function",
                function: {
                    name: tool.name,
                    description: tool.description || "",
                    parameters: tool.parameters || { type: "object", properties: {} },
                    ...(tool.strict != null ? { strict: tool.strict } : {}),
                },
            }));
        if (tools.length) chat.tools = tools;
    }
    if (chat.tools && body.tool_choice) {
        if (typeof body.tool_choice === "string") chat.tool_choice = body.tool_choice;
        else if (body.tool_choice.type === "function" && body.tool_choice.name) {
            chat.tool_choice = { type: "function", function: { name: body.tool_choice.name } };
        }
    }

    const messages = [];
    if (body.instructions) messages.push({ role: "system", content: body.instructions });
    for (const item of Array.isArray(body.input) ? body.input : []) {
        if (!item || typeof item !== "object") continue;
        if (item.type === "function_call") {
            const call = {
                id: item.call_id || item.id || `call_${messages.length}`,
                type: "function",
                function: {
                    name: item.name,
                    arguments: typeof item.arguments === "string" ? item.arguments : JSON.stringify(item.arguments ?? {}),
                },
            };
            const prev = messages[messages.length - 1];
            if (prev && prev.role === "assistant") (prev.tool_calls = prev.tool_calls || []).push(call);
            else messages.push({ role: "assistant", content: "", tool_calls: [call] });
            continue;
        }
        if (item.type === "function_call_output") {
            messages.push({
                role: "tool",
                tool_call_id: item.call_id,
                content: typeof item.output === "string" ? item.output : JSON.stringify(item.output ?? ""),
            });
            continue;
        }
        if (item.type === "reasoning" || item.type === "item_reference" || !item.role) continue;
        const content = toChatContent(item.content);
        if (content === "" || (Array.isArray(content) && content.length === 0)) continue;
        messages.push({ role: item.role === "developer" ? "system" : item.role, content });
    }
    chat.messages = messages;
    return chat;
}

/** 把 Chat Completions 流式响应转换成 Responses SSE，并处理工具名还原。 */
function createResponsesStreamWriter(res, model, namespaces, innerNames) {
    const rid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    const responseId = `resp_${rid()}`;
    const createdAt = Math.floor(Date.now() / 1000);
    const items = new Map();
    let nextIndex = 0;
    let sequence = 0;
    let reasoning = null;
    let message = null;
    const calls = new Map();
    let usage = null;

    const write = (type, payload) => {
        res.write(`event: ${type}\ndata: ${JSON.stringify({ type, sequence_number: sequence++, model, ...payload })}\n\n`);
    };

    const normalizeName = (name) => {
        for (const ns of namespaces || []) {
            const prefix = `${ns}__`;
            if (typeof name === "string" && name.startsWith(prefix) && name.length > prefix.length) {
                return { name: name.slice(prefix.length), namespace: ns };
            }
        }
        const owner = innerNames?.get(name);
        return owner ? { name, namespace: owner } : { name };
    };

    const start = () => {
        const base = { id: responseId, object: "response", created_at: createdAt, model, status: "in_progress", output: [] };
        res.write(`event: response.created\ndata: ${JSON.stringify({ type: "response.created", response: base })}\n\n`);
        res.write(`event: response.in_progress\ndata: ${JSON.stringify({ type: "response.in_progress", response: base })}\n\n`);
    };

    const closeReasoning = () => {
        if (!reasoning) return;
        write("response.reasoning_text.done", { content_index: 0, item_id: reasoning.id, output_index: reasoning.index, text: reasoning.text });
        const item = { id: reasoning.id, summary: [], type: "reasoning", content: [{ text: reasoning.text, type: "reasoning_text" }], status: "completed" };
        write("response.output_item.done", { output_index: reasoning.index, item });
        items.set(reasoning.index, item);
        reasoning = null;
    };

    const closeMessage = () => {
        if (!message) return;
        write("response.output_text.done", { item_id: message.id, output_index: message.index, content_index: 0, text: message.text, logprobs: [] });
        const part = { type: "output_text", text: message.text, annotations: [] };
        write("response.content_part.done", { item_id: message.id, output_index: message.index, content_index: 0, part });
        const item = { id: message.id, content: [part], role: "assistant", status: "completed", type: "message" };
        write("response.output_item.done", { output_index: message.index, item });
        items.set(message.index, item);
        message = null;
    };

    const openCall = (state) => {
        if (state.opened) return;
        state.opened = true;
        write("response.output_item.added", {
            output_index: state.index,
            item: {
                arguments: "",
                call_id: state.callId,
                name: state.name,
                type: "function_call",
                id: state.id,
                status: "in_progress",
                ...(state.namespace ? { namespace: state.namespace } : {}),
            },
        });
    };

    const closeCalls = () => {
        for (const state of [...calls.values()].sort((a, b) => a.index - b.index)) {
            openCall(state);
            write("response.function_call_arguments.done", { item_id: state.id, output_index: state.index, arguments: state.args, name: state.name });
            const item = {
                arguments: state.args,
                call_id: state.callId,
                name: state.name,
                type: "function_call",
                id: state.id,
                status: "completed",
                ...(state.namespace ? { namespace: state.namespace } : {}),
            };
            write("response.output_item.done", { output_index: state.index, item });
            items.set(state.index, item);
        }
        calls.clear();
    };

    const push = (chunk) => {
        if (chunk?.usage) usage = chunk.usage;
        const delta = chunk?.choices?.[0]?.delta;
        if (!delta) return;

        if (typeof delta.reasoning_content === "string" && delta.reasoning_content) {
            if (!reasoning) {
                reasoning = { id: `rs_${rid()}`, index: nextIndex++, text: "" };
                write("response.output_item.added", { output_index: reasoning.index, item: { id: reasoning.id, summary: [], type: "reasoning", content: [], status: "in_progress" } });
            }
            reasoning.text += delta.reasoning_content;
            write("response.reasoning_text.delta", { content_index: 0, delta: delta.reasoning_content, item_id: reasoning.id, output_index: reasoning.index });
        }

        if (delta.content || delta.tool_calls) closeReasoning();

        if (typeof delta.content === "string" && delta.content) {
            if (!message) {
                message = { id: `msg_${rid()}`, index: nextIndex++, text: "" };
                write("response.output_item.added", { output_index: message.index, item: { id: message.id, content: [], role: "assistant", status: "in_progress", type: "message" } });
                write("response.content_part.added", { item_id: message.id, output_index: message.index, content_index: 0, part: { annotations: [], text: "", type: "output_text" } });
            }
            message.text += delta.content;
            write("response.output_text.delta", { item_id: message.id, output_index: message.index, content_index: 0, delta: delta.content, logprobs: [] });
        }

        if (Array.isArray(delta.tool_calls)) {
            for (const toolCall of delta.tool_calls) {
                const index = toolCall.index ?? 0;
                let state = calls.get(index);
                if (!state) {
                    const normalized = normalizeName(toolCall.function?.name || "");
                    state = {
                        id: `fc_${rid()}`,
                        callId: toolCall.id || `call_${rid()}`,
                        index: nextIndex++,
                        name: normalized.name || "",
                        namespace: normalized.namespace,
                        args: "",
                        opened: false,
                    };
                    calls.set(index, state);
                }
                if (toolCall.function?.name && !state.name) state.name = toolCall.function.name;
                if (toolCall.function?.arguments) {
                    if (state.name) openCall(state);
                    state.args += toolCall.function.arguments;
                    if (state.opened) {
                        write("response.function_call_arguments.delta", { item_id: state.id, output_index: state.index, delta: toolCall.function.arguments });
                    }
                }
            }
        }
    };

    const finish = (errorMessage) => {
        closeReasoning();
        closeMessage();
        closeCalls();
        const output = [...items.entries()].sort((a, b) => a[0] - b[0]).map(([, item]) => item);
        const u = {
            input_tokens: usage?.prompt_tokens ?? 0,
            input_tokens_details: { cached_tokens: usage?.prompt_tokens_details?.cached_tokens ?? 0 },
            output_tokens: usage?.completion_tokens ?? 0,
            output_tokens_details: { reasoning_tokens: usage?.completion_tokens_details?.reasoning_tokens ?? 0 },
            total_tokens: usage?.total_tokens ?? 0,
        };
        const response = {
            id: responseId,
            created_at: createdAt,
            metadata: {},
            model,
            object: "response",
            output,
            parallel_tool_calls: true,
            temperature: 1,
            tool_choice: "auto",
            tools: [],
            top_p: 1,
            max_output_tokens: null,
            reasoning: { effort: null, summary: null },
            status: errorMessage ? "incomplete" : "completed",
            truncation: "disabled",
            usage: u,
            store: false,
        };
        const payload = { type: "response.completed", response };
        if (errorMessage) payload.error = { type: "api_error", message: errorMessage };
        res.write(`event: response.completed\ndata: ${JSON.stringify(payload)}\n\n`);
        res.end();
    };

    return { start, push, finish };
}

/** 取 JSON 前 200 字符，并将换行转为 \n，确保单行输出。 */
function jsonSlice(bodyStr, len = 200) {
    return unline(bodyStr.slice(0, len)) + (bodyStr.length > len ? "..." : "");
}

/**
 * 带 429 重试的 forward：遇到上游 429 时指数退避后重新请求，最多重试 MAX_429_RETRIES 次。
 */
const MAX_429_RETRIES = 5;
const MAX_429_WAIT_MS = 30_000;

async function forwardWithRetry(req, res, target, startedAt, bodyOverride) {
    const reqBody = bodyOverride !== undefined
        ? Buffer.from(bodyOverride, "utf8")
        : (req.method === "GET" || req.method === "HEAD" ? null : await readBody(req));
    if (reqBody) {
        const bodyStr = reqBody.toString("utf8");
        logFile(`>>> ${req.method} ${target}`);
        logFile(`    body: ${jsonSlice(bodyStr)}`);
        console.log(`[${new Date().toLocaleTimeString()}] >>> ${req.method} ${target} reqBody=${reqBody.length}B ${jsonSlice(bodyStr)}`);
    }
    // Node.js v18/v20 中 headersTimeout:0 不能真正禁用内部 300s 超时，
    // 改用 AbortController 统一控制；图片生成最多给 15 分钟
    const controller = new AbortController();
    const proxyTimeout = setTimeout(() => controller.abort(), 900_000);
    let lastStatus = null;
    let lastBody = null;
    let retryCount = 0;

    while (true) {
        try {
            const upstream = await fetch(target, { method: req.method, headers: requestHeaders(req), body: reqBody ?? undefined, redirect: "follow", signal: controller.signal });
            clearTimeout(proxyTimeout);
            const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
            const contentType = upstream.headers.get("content-type") || "";

            // 对 SSE / streaming 响应直接管道转发，避免缓冲导致 stream disconnected
            const isStreamResp = contentType.includes("text/event-stream") || contentType.includes("streaming") || req.headers["accept"]?.includes("text/event-stream");
            if (isStreamResp && upstream.body) {
                logForward(req.method, target, `streaming`, startedAt, reqBody?.length);
                logFile(`<<< STREAMING ${req.method} ${target}`);
                res.writeHead(upstream.status, streamResponseHeaders(upstream));
                const reader = upstream.body.getReader();
                ;(async () => {
                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            res.write(value);
                        }
                        res.end();
                    } catch (err) {
                        console.error(`[${new Date().toLocaleTimeString()}] <<< stream error: ${err.message}`);
                        if (!res.writableEnded) res.destroy();
                    }
                })();
                return upstream.status;
            }

            const respBody = await collectBody(upstream.body);
            const isBinary = respBody.length > 1_000_000 || contentType.startsWith("video/") || contentType.startsWith("image/") || contentType.startsWith("application/octet-stream");
            const respStr = isBinary ? null : respBody.toString("utf8");

            if (upstream.status === 429 && retryCount < MAX_429_RETRIES) {
                lastStatus = upstream.status;
                lastBody = respBody;
                retryCount++;
                const waitMs = Math.min(1000 * (2 ** (retryCount - 1)), MAX_429_WAIT_MS);
                console.log(`[${new Date().toLocaleTimeString()}] ⚠️ 429 限流，等待 ${(waitMs / 1000).toFixed(1)}s 后重试 (${retryCount}/${MAX_429_RETRIES})`);
                logFile(`⚠️ 429 retry ${retryCount}/${MAX_429_RETRIES}, wait ${waitMs}ms`);
                await new Promise((r) => setTimeout(r, waitMs));
                continue;
            }

            logForward(req.method, target, upstream.status, startedAt, reqBody?.length);
            logFile(`<<< ${upstream.status} ${duration}s body=${respBody.length}B${contentType ? " contentType=" + contentType : ""}${isBinary ? " [binary, skipped]" : ""}`);
            if (!isBinary) {
                logFile(`    body: ${jsonSlice(respStr)}`);
                console.log(`[${new Date().toLocaleTimeString()}] <<< ${upstream.status} ${duration}s body=${respBody.length}B ${jsonSlice(respStr)}`);
            } else {
                console.log(`[${new Date().toLocaleTimeString()}] <<< ${upstream.status} ${duration}s body=${respBody.length}B [binary, skipped]`);
            }
            res.writeHead(upstream.status, responseHeaders(upstream));
            res.end(respBody);
            return upstream.status;
        } catch (error) {
            clearTimeout(proxyTimeout);
            throw error;
        }
    }
}

async function forward(req, res, target, startedAt, bodyOverride) {
    return forwardWithRetry(req, res, target, startedAt, bodyOverride);
}

/** 含图片的 Responses 请求：改写为 Chat Completions 请求并把流式结果转回 Responses SSE。 */
async function forwardResponsesWithImages(req, res, body, namespaces, innerNames, startedAt) {
    const chatBody = JSON.stringify(toChatRequest(body));
    const target = `${CODEX_UPSTREAM_BASE}/chat/completions`;
    const headers = requestHeaders(req);
    headers["content-type"] = "application/json";
    headers["content-length"] = String(Buffer.byteLength(chatBody));

    logFile(`>>> CODEX(image) POST ${target} reqBody=${Buffer.byteLength(chatBody)}B`);
    console.log(`[${new Date().toLocaleTimeString()}] >>> CODEX(image) POST ${target} reqBody=${Buffer.byteLength(chatBody)}B`);

    const controller = new AbortController();
    const proxyTimeout = setTimeout(() => controller.abort(), 900_000);
    try {
        const upstream = await fetch(target, { method: "POST", headers, body: chatBody, redirect: "follow", signal: controller.signal });
        clearTimeout(proxyTimeout);

        if (!upstream.ok || !upstream.body) {
            const errBody = await collectBody(upstream.body);
            logForward("POST", target, upstream.status, startedAt, Buffer.byteLength(chatBody));
            logFile(`<<< ${upstream.status} chat body=${errBody.length}B ${jsonSlice(errBody.toString("utf8"), 400)}`);
            res.writeHead(upstream.status, responseHeaders(upstream));
            res.end(errBody);
            return;
        }

        logForward("POST", target, "streaming", startedAt, Buffer.byteLength(chatBody));
        logFile(`<<< STREAMING CODEX(image) ${upstream.status}`);
        res.writeHead(200, {
            ...CORS_HEADERS,
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache",
            "x-accel-buffering": "no",
        });

        const writer = createResponsesStreamWriter(res, body.model, namespaces, innerNames);
        writer.start();

        const reader = upstream.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let sawDone = false;
        while (!sawDone) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let newline;
            while ((newline = buffer.indexOf("\n")) >= 0) {
                const line = buffer.slice(0, newline).trim();
                buffer = buffer.slice(newline + 1);
                if (!line.startsWith("data:")) continue;
                const payload = line.slice(5).trim();
                if (!payload) continue;
                if (payload === "[DONE]") {
                    sawDone = true;
                    break;
                }
                try {
                    writer.push(JSON.parse(payload));
                } catch {
                    // 忽略无法解析的零星片段
                }
            }
        }
        writer.finish(sawDone ? undefined : "上游流在完成事件前断开");
    } catch (error) {
        clearTimeout(proxyTimeout);
        const reason = error instanceof Error ? error.message : String(error);
        logFile(`!!! CODEX(image) FAILED: ${reason}`);
        if (!res.headersSent) sendJson(res, 502, { error: reason });
        else if (!res.writableEnded) res.end();
    }
}

export function createProxyServer() {
    // 禁用 Node.js HTTP 服务器的内部 headers 和 keep-alive 超时，避免 undici fetch
    // 的 300s 默认 headersTimeout 截断长时间图片生成请求。
    const server = createServer(async (req, res) => {
        if (req.method === "OPTIONS") {
            res.writeHead(204, CORS_HEADERS);
            res.end();
            return;
        }

        const pathname = req.url || "/";
        const startedAt = Date.now();
        const method = req.method || "GET";

        // ── Codex /chat/completions 特殊路由 ──────────────────────────────────
        // wire_api="chat" 时 Codex 发送标准 Chat Completions 请求；
        // 剥离 namespace 类型工具后转发到 Agnes API。
        if (pathname === "/chat/completions" || pathname.startsWith("/chat/completions?")) {
            try {
                const reqBodyBuf = await readBody(req);
                const stripped = stripNamespaceTools(reqBodyBuf.toString("utf8"));
                const target = `${CODEX_UPSTREAM_BASE}/chat/completions`;
                logFile(`>>> CODEX ${method} ${target} reqBody=${reqBodyBuf.length}B -> stripped body=${Buffer.byteLength(stripped)}B`);
                console.log(`[${new Date().toLocaleTimeString()}] >>> CODEX ${method} ${target} reqBody=${reqBodyBuf.length}B stripped=${Buffer.byteLength(stripped)}B`);
                await forward(req, res, target, startedAt, stripped);
            } catch (err) {
                const reason = err instanceof Error ? err.message : String(err);
                logFile(`!!! CODEX chat readBody failed: ${reason}`);
                if (!res.headersSent) sendJson(res, 502, { error: reason });
            }
            return;
        }

        // ── Codex /responses 特殊路由 ─────────────────────────────────────────
        // Codex CLI 发送 POST /responses 到 proxy；我们剥离 namespace 类型工具后
        // 转发到真实的 Agnes API。
        if (pathname === "/responses" || pathname.startsWith("/responses")) {
            try {
                const reqBodyBuf = await readBody(req);
                const reqBodyStr = reqBodyBuf.toString("utf8");
                const stripped = stripNamespaceTools(reqBodyStr);
                const toolNamespaces = flattenedNamespaces.slice();
                const toolInnerNames = new Map(flattenedInnerNames);

                // Agnes 的 /responses 不支持图片，含图片的请求改走 chat/completions
                let parsedBody = null;
                try {
                    parsedBody = JSON.parse(stripped);
                } catch {}
                if (parsedBody && hasImageParts(parsedBody)) {
                    await forwardResponsesWithImages(req, res, parsedBody, toolNamespaces, toolInnerNames, startedAt);
                    return;
                }

                const upstreamUrl = `${CODEX_UPSTREAM_BASE}/responses`;
                const contentLength = Buffer.byteLength(stripped);
                const headers = requestHeaders(req);
                headers["content-length"] = String(contentLength);
                // 保留原始 content-type
                if (req.headers["content-type"]) headers["content-type"] = req.headers["content-type"];

                logFile(`>>> CODEX ${method} ${upstreamUrl} reqBody=${reqBodyBuf.length}B -> stripped body=${Buffer.byteLength(stripped)}B`);
                console.log(`[${new Date().toLocaleTimeString()}] >>> CODEX ${method} ${upstreamUrl} reqBody=${reqBodyBuf.length}B stripped=${Buffer.byteLength(stripped)}B`);

                const controller = new AbortController();
                const proxyTimeout = setTimeout(() => controller.abort(), 900_000);

                try {
                    const upstream = await fetch(upstreamUrl, {
                        method,
                        headers,
                        body: stripped,
                        redirect: "follow",
                        signal: controller.signal,
                    });
                    clearTimeout(proxyTimeout);
                    const contentType = upstream.headers.get("content-type") || "";
                    // 只有成功响应才走流式转发，错误响应（400/500）直接返回 JSON body
                    const isStreamResp = upstream.ok && (contentType.includes("text/event-stream") || contentType.includes("streaming") || req.headers["accept"]?.includes("text/event-stream"));

                    if (isStreamResp && upstream.body) {
                        logForward(method, upstreamUrl, `streaming`, startedAt, Buffer.byteLength(stripped));
                        logFile(`<<< STREAMING CODEX ${method} ${upstreamUrl}`);
                        res.writeHead(upstream.status, streamResponseHeaders(upstream));
                        const reader = upstream.body.getReader();
                        const chunks = [];
                        let hasCompletion = false;
                        let eventCount = 0;
                        let lineCarry = "";
                        const decoder = new TextDecoder("utf-8");
                        ;(async () => {
                            try {
                                while (true) {
                                    const { done, value } = await reader.read();
                                    if (done) break;
                                    chunks.push(value);
                                    eventCount++;
                                    const text = decoder.decode(value, { stream: true });
                                    // 检测是否收到 response.completed 事件（SSE 事件文本中包含该字段）
                                    if (text.includes('"type":"response.completed"') || text.includes('"event":"response.completed"')) {
                                        hasCompletion = true;
                                    }
                                    // 按行缓冲，把展平工具名的 function_call 还原为 Codex 需要的 namespace 形式后再转发
                                    lineCarry += text;
                                    const lastNewline = lineCarry.lastIndexOf("\n");
                                    if (lastNewline >= 0) {
                                        const complete = lineCarry.slice(0, lastNewline + 1);
                                        lineCarry = lineCarry.slice(lastNewline + 1);
                                        res.write(rewriteNamespacedCalls(complete, toolNamespaces, toolInnerNames));
                                    }
                                }
                                const tailText = decoder.decode();
                                if (tailText) lineCarry += tailText;
                                if (lineCarry) {
                                    res.write(rewriteNamespacedCalls(lineCarry, toolNamespaces, toolInnerNames));
                                    lineCarry = "";
                                }
                                if (!hasCompletion) {
                                    // 流在 response.completed 之前关闭，注入合成完成事件避免 Codex app-server 报 stream disconnected
                                    const lastChunk = chunks.length > 0 ? chunks[chunks.length - 1].toString("utf8").slice(-500) : "(no chunks)";
                                    console.error(`[${new Date().toLocaleTimeString()}] <<< stream ended without response.completed (events=${eventCount}, bytes=${chunks.reduce((a, c) => a + c.length, 0)})，注入合成错误完成事件`);
                                    logFile(`!!! stream incomplete: ${eventCount} events, ${chunks.reduce((a, c) => a + c.length, 0)}B, last_chunk_tail: ${jsonSlice(lastChunk)}`);
                                    // 尝试从首个事件中提取 response id
                                    const allText = chunks.map(c => c.toString("utf8")).join("");
                                    const errorMatches = allText.match(/"type":"error"/g);
                                    if (errorMatches) {
                                        console.error(`[${new Date().toLocaleTimeString()}] <<< found ${errorMatches.length} error event(s) in stream`);
                                        logFile(`!!! error events found: ${errorMatches.length}`);
                                    }
                                    // 提取 response id（从 response.created 事件中取 id 字段）
                                    let responseId = "";
                                    try {
                                        const createdMatch = allText.match(/"type"\s*:\s*"response\.created"[^}]*"id"\s*:\s*"([^"]+)"/);
                                        if (createdMatch) responseId = createdMatch[1];
                                    } catch {}
                                    logFile(`>>> INJECTING synthetic response.completed (responseId=${responseId || "none"})`);
                                    // 写入合成的 response.completed 事件（SSE data: 格式），让 Codex app-server 正常结束 turn
                                    const syntheticDone = `\ndata: {"type":"response.completed","response":{"id":"${responseId}","object":"response","model":"","status":"incomplete","incomplete_details":{"reason":"upstream_stream_ended_before_completion"},"usage":{"input_tokens":0,"output_tokens":0,"total_tokens":0}},"error":{"type":"api_error","message":"上游流在 response.completed 前意外断开，请检查模型服务状态"}}\n\n`;
                                    res.write(syntheticDone);
                                    console.error(`[${new Date().toLocaleTimeString()}] >>> injected synthetic response.completed (responseId=${responseId || "none"})`);
                                    logFile(`>>> INJECTED OK responseId=${responseId || "none"}`);
                                }
                                res.end();
                            } catch (err) {
                                console.error(`[${new Date().toLocaleTimeString()}] <<< stream error: ${err.message}`);
                                logFile(`!!! stream error: ${err.message}`);
                                if (!res.writableEnded) res.destroy();
                            }
                        })();
                        return;
                    }

                    const respBody = await collectBody(upstream.body);
                    logForward(method, upstreamUrl, upstream.status, startedAt, Buffer.byteLength(stripped));
                    logFile(`<<< ${upstream.status} body=${respBody.length}B${contentType ? " contentType=" + contentType : ""}`);
                    if (respBody.length < 1_000_000) {
                        logFile(`    body: ${jsonSlice(respBody.toString("utf8"))}`);
                        console.log(`[${new Date().toLocaleTimeString()}] <<< ${upstream.status} body=${respBody.length}B ${jsonSlice(respBody.toString("utf8"))}`);
                    }
                    res.writeHead(upstream.status, responseHeaders(upstream));
                    res.end(respBody);
                } catch (error) {
                    clearTimeout(proxyTimeout);
                    const reason = error instanceof Error ? error.message : String(error);
                    logForward(method, upstreamUrl, `failed (${reason})`, startedAt, null);
                    logFile(`!!! CODEX ${method} ${upstreamUrl} FAILED: ${reason}`);
                    if (!res.headersSent) {
                        sendJson(res, 502, { error: reason });
                    } else {
                        res.destroy();
                    }
                }
                return;
            } catch (err) {
                const reason = err instanceof Error ? err.message : String(err);
                logFile(`!!! CODEX readBody failed: ${reason}`);
                if (!res.headersSent) sendJson(res, 502, { error: reason });
                return;
            }
        }

        // ── 默认代理路由 ───────────────────────────────────────────────────────
        const target = readTarget(pathname);
        if (!target) {
            sendJson(res, 200, { app: "infinite-canvas", proxy: pkg.name, version: pkg.version, usage: "/<full-target-url>" });
            return;
        }
        forward(req, res, target, startedAt)
            .catch((error) => {
                const reason = error instanceof Error ? error.message : String(error);
                const cause = error.cause;
                const detail = cause ? `${reason} [code=${cause.code || ""}, errno=${cause.errno || ""}, syscall=${cause.syscall || ""}]` : reason;
                logForward(method, target, `failed (${detail})`, startedAt, req.headers["content-length"]);
                logFile(`!!! ${method} ${target} FAILED: ${detail}`);
                if (res.headersSent) {
                    res.destroy();
                    return;
                }
                sendJson(res, 502, { error: reason, cause });
            });
    });
    server.headersTimeout = 0;
    server.keepAliveTimeout = 0;
    return server;
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
    console.log(`${pkg.name} v${pkg.version}\n\nUsage: npx ${pkg.name}@latest [--port 23210] [--host 127.0.0.1]\n\nForwards http://<host>:<port>/<full-target-url> to <full-target-url> with permissive CORS headers.`);
    process.exit(0);
}

const port = Number(readArg(args, "port", process.env.PORT || 23210));
const host = readArg(args, "host", process.env.HOST || "127.0.0.1");

createProxyServer().listen(port, host, () => {
    console.log(`${pkg.name} v${pkg.version} listening on http://${host}:${port}`);
    console.log(`Fill this address into Infinite Canvas → 配置 → 本地代理: http://${host}:${port}`);
});
