// Mermaid 图节点:输入 Mermaid 源码,实时渲染 SVG。mermaid 从 CDN 按需加载。
// AI 生成与文本节点同款:选中节点在下方生成面板输入提示词(上游图片/文本自动作为参考),结果写回本节点。
import { definePlugin, useEffect, useRef, useState } from "@infinite-canvas/plugin-sdk";
import type { CanvasNodeContentProps } from "@infinite-canvas/plugin-sdk";

type MermaidApi = { initialize: (opts: Record<string, unknown>) => void; render: (id: string, code: string) => Promise<{ svg: string }> };

let mermaid: MermaidApi | undefined;
let mermaidPromise: Promise<MermaidApi> | undefined;
function loadMermaid(): Promise<MermaidApi> {
    if (mermaid) return Promise.resolve(mermaid);
    if (!mermaidPromise) {
        mermaidPromise = import("https://esm.sh/mermaid@11").then((mod: { default: MermaidApi }) => {
            mermaid = mod.default;
            mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: "dark" });
            return mermaid;
        });
    }
    return mermaidPromise;
}

function cleanMermaid(raw: string): string {
    const merged = "\n" + raw.trim() + "\n";
    const idx1 = merged.search(/\n\s*```[a-zA-Z]*\s*\n/i);
    if (idx1 === -1) return "";  // 无围栏则丢弃(避免把纯文本误当作 Mermaid 渲染)
    const afterFence = idx1 + "```".length;
    const langLineEnd = merged.indexOf("\n", afterFence);
    const bodyStart = langLineEnd === -1 ? afterFence : langLineEnd + 1;
    const bodyEnd = merged.indexOf("\n```", bodyStart);
    if (bodyEnd === -1) return "";  // 只有开始没有结束,丢弃
    return merged.slice(bodyStart, bodyEnd).trim();
}

// 简单验证:是否像 Mermaid 源码(包含至少一个 Mermaid 关键字)
function isLikelyMermaid(s: string): boolean {
    return /(?:^|\b)(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|requirementDiagram|mindmap|timeline|xychart|architecture)\b/i.test(s);
}

function MermaidContent({ ctx }: CanvasNodeContentProps) {
    const editing = Boolean(ctx.node.metadata?.editing);
    const [error, setError] = useState("");
    const [ready, setReady] = useState(Boolean(mermaid));
    const code = (ctx.node.metadata?.content as string | undefined) || "";
    const ref = useRef<HTMLDivElement>(null);
    const seq = useRef(0);

    useEffect(() => {
        if (ready) return;
        let alive = true;
        loadMermaid().then(() => alive && setReady(true));
        return () => {
            alive = false;
        };
    }, [ready]);

    useEffect(() => {
        const el = ref.current;
        if (!el || !ready || editing) return;
        // 取首个代码围栏内的内容,无围栏或为空则清空
        const source = cleanMermaid(code);
        if (!source.trim()) {
            el.innerHTML = "";
            setError("");
            return;
        }
        // 预检:不含 Mermaid 关键字说明 AI 输出了非 Mermaid 内容
        if (!isLikelyMermaid(source)) {
            setError("AI 输出不包含 Mermaid 代码,请点「编辑」手动输入源码");
            el.innerHTML = "";
            return;
        }
        // 兼容旧 style 语法(新版已移除),自动转换为 classDef
        const merged = fixStyles(source);
        let alive = true;
        const id = `mermaid-svg-${++seq.current}`;
        loadMermaid()
            .then((m) => m.render(id, merged))
            .then((res) => {
                if (!alive || !ref.current) return;
                ref.current.innerHTML = res.svg;
                const svg = ref.current.querySelector("svg");
                if (svg) {
                    svg.style.maxWidth = "100%";
                    svg.style.height = "auto";
                }
                setError("");
            })
            .catch((err: unknown) => {
                if (!alive) return;
                setError(err instanceof Error ? err.message : String(err));
                if (ref.current) ref.current.innerHTML = "";
            });
        return () => {
            alive = false;
        };
    }, [code, ready, editing]);

    return editing ? (
        <textarea autoFocus value={code} placeholder={"flowchart TD\n  A --> B"} onChange={(e) => ctx.updateMetadata({ content: e.target.value })} onMouseDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()} spellCheck={false} style={{ height: "100%", width: "100%", display: "block", resize: "none", border: "none", outline: "none", background: "transparent", color: ctx.theme.node.text, fontFamily: "monospace", fontSize: 13, lineHeight: 1.5, padding: 12, boxSizing: "border-box" }} />
    ) : (
        <div data-canvas-no-zoom style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", padding: 12, boxSizing: "border-box" }} onWheel={(e) => e.stopPropagation()}>
            {error ? <div style={{ color: "#ef4444", fontSize: 12, whiteSpace: "pre-wrap" }}>{error}</div> : !ready ? <span style={{ color: ctx.theme.node.muted, fontSize: 12 }}>加载 mermaid…</span> : code.trim() ? null : <span style={{ color: ctx.theme.node.placeholder, fontSize: 12 }}>选中节点,在下方面板输入提示词生成,或点工具条「编辑」输入源码</span>}
            <div ref={ref} style={{ width: "100%", display: "flex", justifyContent: "center" }} />
        </div>
    );
}

export default definePlugin({
    id: "mermaid-chart",
    name: "Mermaid 图",
    version: "1.1.0",
    description: "渲染 Mermaid 流程图/时序图,支持 AI 生成",
    nodes: [
        {
            type: "mermaid-chart:diagram",
            title: "Mermaid 图",
            icon: "📝",
            description: "渲染 Mermaid 流程图/时序图等",
            defaultSize: { width: 360, height: 280 },
            defaultMetadata: { content: "" },
            minimapColor: "#ec4899",
            // AI 生成复用宿主内置文本生成面板:结果写回本节点,上游图片/文本自动作为参考
            useBuiltinPanel: { mode: "text", writeBackToSelf: true },
            resource: (node) => ({ kind: "text", text: node.metadata?.content as string | undefined }),
            Content: MermaidContent,
            toolbar: (ctx) => {
                const editing = Boolean(ctx.node.metadata?.editing);
                return [{ id: "mermaid-toggle", title: editing ? "预览渲染结果" : "编辑 Mermaid 源码", label: editing ? "预览" : "编辑", icon: editing ? "👁" : "✎", active: editing, onClick: () => ctx.updateMetadata({ editing: !editing }) }];
            },
        },
    ],
});
