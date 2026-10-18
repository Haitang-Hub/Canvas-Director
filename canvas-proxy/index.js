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
 * 剥离 tools 数组中 type === "namespace" 的条目。
 * Codex CLI 将内置工具（exec/wait 等）和 MCP 工具包裹在 namespace 容器中，
 * 但 Agnes API 只接受 function / web_search_preview / code_interpreter / mcp 类型。
 */
function stripNamespaceTools(bodyStr) {
    try {
        const obj = JSON.parse(bodyStr);
        if (Array.isArray(obj.tools)) {
            const before = obj.tools.length;
            obj.tools = obj.tools.filter((t) => t && t.type !== "namespace");
            if (obj.tools.length !== before) {
                logFile(`    [proxy] stripped ${before - obj.tools.length} namespace tool(s)`);
                console.log(`[${new Date().toLocaleTimeString()}] [proxy] stripped ${before - obj.tools.length} namespace tool(s)`);
            }
        }
        return JSON.stringify(obj);
    } catch {
        // Not JSON — return as-is
        return bodyStr;
    }
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

        // ── Codex /responses 特殊路由 ─────────────────────────────────────────
        // Codex CLI 发送 POST /responses 到 proxy；我们剥离 namespace 类型工具后
        // 转发到真实的 Agnes API。
        if (pathname === "/responses" || pathname.startsWith("/responses")) {
            try {
                const reqBodyBuf = await readBody(req);
                const reqBodyStr = reqBodyBuf.toString("utf8");
                const stripped = stripNamespaceTools(reqBodyStr);
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
                    const isStreamResp = contentType.includes("text/event-stream") || contentType.includes("streaming") || req.headers["accept"]?.includes("text/event-stream");

                    if (isStreamResp && upstream.body) {
                        logForward(method, upstreamUrl, `streaming`, startedAt, Buffer.byteLength(stripped));
                        logFile(`<<< STREAMING CODEX ${method} ${upstreamUrl}`);
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
