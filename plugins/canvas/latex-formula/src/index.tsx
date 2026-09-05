// LaTeX 公式节点:输入 TeX 源码,用 KaTeX 渲染。KaTeX 从 CDN 按需加载。
// AI 生成与文本节点同款:选中节点在下方生成面板输入提示词(上游图片/文本自动作为参考),结果写回本节点。
import { definePlugin, useEffect, useRef, useState } from "@infinite-canvas/plugin-sdk";
import type { CanvasNodeContentProps } from "@infinite-canvas/plugin-sdk";

type KatexApi = { render: (tex: string, el: HTMLElement, opts?: Record<string, unknown>) => void };

let katex: KatexApi | undefined;
let katexPromise: Promise<KatexApi> | undefined;
function loadKatex(): Promise<KatexApi> {
    if (katex) return Promise.resolve(katex);
    if (!katexPromise) katexPromise = import("https://esm.sh/katex@0.16").then((mod: { default: KatexApi }) => (katex = mod.default));
    return katexPromise;
}

// 兼容 AI 输出:只取首个完整公式块,丢弃围栏外 AI 解释文本与多行额外公式
function cleanTex(raw: string): string {
    let s = raw.trim();
    // 1) 从首个代码围栏中提取内容
    const fenceIdx = s.search(/```[a-zA-Z]*\s*\n/i);
    if (fenceIdx !== -1) {
        const afterStart = fenceIdx + "```".length;
        const langLineEnd = s.indexOf("\n", afterStart);
        const bodyStart = langLineEnd === -1 ? afterStart : langLineEnd + 1;
        const bodyEnd = s.indexOf("\n```", bodyStart);
        if (bodyEnd !== -1) s = s.slice(bodyStart, bodyEnd).trim();
    }
    // 2) 先尝试 \begin{...}\end{...} 环境(取第一个完整环境)
    const envMatch = s.match(/\\begin\{([a-zA-Z]+)\}([\s\S]*?)\\end\{\1\}/);
    if (envMatch) return envMatch[0].replace(/\n/g, " ").trim();
    // 3) 再尝试 $$...$$ (取第一个,并压平换行)
    const display = s.match(/^\$\$([\s\S]*?)\$\$$/);
    if (display) return display[1].replace(/\n/g, " ").trim();
    // 4) 最后尝试 $...$ (单行)
    const inline = s.match(/^\$([^$]+)\$$/);
    if (inline) return inline[1].trim();
    // 5) 取第一个换行前的单行内容
    const firstLine = s.split("\n")[0]?.trim();
    return firstLine || s.trim();
}

function FormulaPreview({ ctx }: CanvasNodeContentProps) {
    const tex = cleanTex((ctx.node.metadata?.content as string | undefined) || "");
    const ref = useRef<HTMLDivElement>(null);
    const [ready, setReady] = useState(Boolean(katex));

    useEffect(() => {
        if (ready) return;
        let alive = true;
        loadKatex().then(() => alive && setReady(true));
        return () => {
            alive = false;
        };
    }, [ready]);

    useEffect(() => {
        const el = ref.current;
        if (!el || !ready) return;
        el.innerHTML = "";
        if (!tex.trim()) return;
        try {
            katex!.render(tex, el, { throwOnError: false, displayMode: true });
        } catch {
            /* throwOnError:false 下基本不会走到这里 */
        }
    }, [tex, ready]);

    return (
        <div data-canvas-no-zoom onWheel={(e) => e.stopPropagation()} style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", padding: 12, boxSizing: "border-box" }}>
            {tex.trim() ? <div ref={ref} style={{ color: ctx.theme.node.text, fontSize: 18, textAlign: "center", width: "100%" }} /> : <span style={{ color: ctx.theme.node.placeholder, fontSize: 12 }}>选中节点,在下方面板输入提示词生成,或点工具条「编辑」输入公式</span>}
        </div>
    );
}

function FormulaEditor({ ctx }: CanvasNodeContentProps) {
    const value = (ctx.node.metadata?.content as string | undefined) || "";
    return (
        <textarea
            autoFocus
            value={value}
            placeholder={"c = \\pm\\sqrt{a^2 + b^2}"}
            onChange={(e) => ctx.updateMetadata({ content: e.target.value })}
            onMouseDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            style={{ height: "100%", width: "100%", display: "block", resize: "none", background: "transparent", boxSizing: "border-box", padding: 16, fontFamily: "monospace", fontSize: 14, outline: "none", border: "none", color: ctx.theme.node.text }}
        />
    );
}

function FormulaContent({ ctx }: CanvasNodeContentProps) {
    return ctx.node.metadata?.editing ? <FormulaEditor ctx={ctx} /> : <FormulaPreview ctx={ctx} />;
}

export default definePlugin({
    id: "latex-formula",
    name: "LaTeX 公式",
    version: "1.1.0",
    description: "渲染 LaTeX 数学公式,支持 AI 生成",
    nodes: [
        {
            type: "latex-formula:formula",
            title: "LaTeX 公式",
            icon: "📐",
            description: "渲染 LaTeX 数学公式",
            defaultSize: { width: 360, height: 240 },
            defaultMetadata: { content: "" },
            minimapColor: "#14b8a6",
            // AI 生成复用宿主内置文本生成面板:结果写回本节点,上游图片/文本自动作为参考
            useBuiltinPanel: { mode: "text", writeBackToSelf: true },
            resource: (node) => ({ kind: "text", text: node.metadata?.content as string | undefined }),
            Content: FormulaContent,
            toolbar: (ctx) => {
                const editing = Boolean(ctx.node.metadata?.editing);
                return [{ id: "latex-toggle", title: editing ? "预览渲染结果" : "编辑公式源码", label: editing ? "预览" : "编辑", icon: editing ? "👁" : "✎", active: editing, onClick: () => ctx.updateMetadata({ editing: !editing }) }];
            },
        },
    ],
});
