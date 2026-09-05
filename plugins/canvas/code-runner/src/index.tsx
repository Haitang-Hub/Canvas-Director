// 代码运行节点:在节点内运行 JavaScript(new Function 沙箱,仅拦截 console.log),
// 输出显示在下方,并作为文本资源输出给下游。
import { definePlugin, useEffect, useRef, useState } from "@infinite-canvas/plugin-sdk";
import type { CanvasNodeContentProps } from "@infinite-canvas/plugin-sdk";

function CodeRunnerContent({ ctx }: CanvasNodeContentProps) {
    const code = (ctx.node.metadata?.content as string | undefined) || "";
    const [logs, setLogs] = useState<string[]>((ctx.node.metadata?.logs as string[] | undefined) || []);
    const running = useRef(false);
    const runRef = useRef<() => void>(() => {});

    const run = () => {
        if (running.current) return;
        running.current = true;
        const out: string[] = [];
        const fmt = (args: unknown[]) =>
            args
                .map((a) => {
                    if (typeof a === "string") return a;
                    try {
                        return JSON.stringify(a);
                    } catch {
                        return String(a);
                    }
                })
                .join(" ");
        const sandboxConsole = { log: (...args: unknown[]) => out.push(fmt(args)), error: (...args: unknown[]) => out.push("[error] " + fmt(args)), warn: (...args: unknown[]) => out.push("[warn] " + fmt(args)), info: (...args: unknown[]) => out.push(fmt(args)) };
        try {
            const fn = new Function("console", `"use strict";\n${code}`);
            const ret = fn(sandboxConsole);
            if (ret !== undefined) out.push("⇒ " + fmt([ret]));
        } catch (err) {
            out.push("[异常] " + (err instanceof Error ? err.message : String(err)));
        }
        running.current = false;
        setLogs(out);
        ctx.updateMetadata({ logs: out });
    };
    runRef.current = run;

    // 工具条「运行」按钮通过事件触发,这里订阅并始终调用最新的 run
    useEffect(() => ctx.on("code-runner:run", () => runRef.current()), []);

    const btn = { padding: "4px 12px", borderRadius: 8, border: `1px solid ${ctx.theme.node.stroke}`, background: ctx.theme.toolbar.panel, color: ctx.theme.node.text, cursor: "pointer", fontSize: 12 } as const;

    return (
        <div data-canvas-no-zoom style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", gap: 8, padding: 12, boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button type="button" style={btn} onClick={run}>
                    ▶ 运行
                </button>
                <button type="button" style={{ ...btn, opacity: 0.7 }} onClick={() => { setLogs([]); ctx.updateMetadata({ logs: [] }); }}>
                    清空
                </button>
            </div>
            <textarea value={code} placeholder="// 输入 JavaScript 代码,用 console.log 输出" onChange={(e) => ctx.updateMetadata({ content: e.target.value })} onMouseDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()} spellCheck={false} style={{ flex: 1, minHeight: 0, resize: "none", borderRadius: 8, border: `1px solid ${ctx.theme.node.stroke}`, outline: "none", background: ctx.theme.node.panel, color: ctx.theme.node.text, fontFamily: "monospace", fontSize: 13, lineHeight: 1.5, padding: 10, boxSizing: "border-box" }} />
            <div onWheel={(e) => e.stopPropagation()} style={{ flex: 1, minHeight: 0, overflow: "auto", borderRadius: 8, border: `1px solid ${ctx.theme.node.stroke}`, background: ctx.theme.node.panel, padding: 10, fontFamily: "monospace", fontSize: 12, whiteSpace: "pre-wrap", color: ctx.theme.node.muted }}>
                {logs.length ? logs.join("\n") : <span style={{ color: ctx.theme.node.placeholder }}>输出会显示在这里</span>}
            </div>
        </div>
    );
}

export default definePlugin({
    id: "code-runner",
    name: "代码运行",
    version: "1.0.0",
    description: "在画布中直接运行 JavaScript 代码并查看输出",
    nodes: [
        {
            type: "code-runner:js",
            title: "代码运行",
            icon: "⚙️",
            description: "运行 JavaScript 并捕获输出",
            defaultSize: { width: 400, height: 300 },
            defaultMetadata: { content: "", logs: [] },
            minimapColor: "#f59e0b",
            hidePanel: true,
            interactionToggle: true,
            resource: (node) => ({ kind: "text", text: ((node.metadata?.logs as string[] | undefined) || []).join("\n") }),
            Content: CodeRunnerContent,
            toolbar: (ctx) => [{ id: "code-run", title: "运行代码", label: "运行", icon: "▶", onClick: () => ctx.emit("code-runner:run") }],
        },
    ],
});
