// 思维导图节点:用缩进大纲(两空格=一层)描述层级,渲染为嵌套 pill 结构;
// 叶子节点可从工具条拆分为文本节点;AI 生成与文本节点同款(下方生成面板,结果写回本节点)。
import { definePlugin, useMemo } from "@infinite-canvas/plugin-sdk";
import type { CanvasNodeContentProps } from "@infinite-canvas/plugin-sdk";

type TreeNode = { text: string; children: TreeNode[] };

// 兼容 AI 输出:只取首个代码围栏内的内容,丢弃围栏外 AI 解释文本;再剥列表符号
function cleanOutline(raw: string): string {
    let s = raw.trim();
    const fenceIdx = s.search(/```[a-zA-Z]*\s*\n/i);
    if (fenceIdx !== -1) {
        const afterStart = fenceIdx + "```".length;
        const langLineEnd = s.indexOf("\n", afterStart);
        const bodyStart = langLineEnd === -1 ? afterStart : langLineEnd + 1;
        const bodyEnd = s.indexOf("\n```", bodyStart);
        if (bodyEnd !== -1) s = s.slice(bodyStart, bodyEnd).trim();
    }
    return s
        .split("\n")
        .map((line) => line.replace(/^[\s>]*[-*+]\s+/, "  ").replace(/^[\s>]*\d+[.)]\s+/, "  ").replace(/\r$/, ""))
        .join("\n");
}

function parseOutline(source: string): TreeNode[] {
    const roots: TreeNode[] = [];
    const stack: { level: number; node: TreeNode }[] = [];
    for (const line of cleanOutline(source).split("\n")) {
        if (!line.trim()) continue;
        const level = Math.floor((line.length - line.trimStart().length) / 2);
        const node: TreeNode = { text: line.trim(), children: [] };
        while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
        if (stack.length) stack[stack.length - 1].node.children.push(node);
        else roots.push(node);
        stack.push({ level, node });
    }
    return roots;
}

function PillTree({ nodes, theme, depth = 0 }: { nodes: TreeNode[]; theme: CanvasNodeContentProps["ctx"]["theme"]; depth?: number }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: depth ? 18 : 0, borderLeft: depth ? `1px solid ${theme.node.stroke}` : "none", paddingLeft: depth ? 10 : 0 }}>
            {nodes.map((n, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ padding: "3px 10px", borderRadius: 999, background: depth ? theme.node.panel : theme.toolbar.activeBg, color: depth ? theme.node.text : theme.toolbar.activeText, border: `1px solid ${theme.node.stroke}`, fontSize: 12, whiteSpace: "nowrap" }}>
                        {n.text}
                    </span>
                    {n.children.length > 0 && <PillTree nodes={n.children} theme={theme} depth={depth + 1} />}
                </div>
            ))}
        </div>
    );
}

function MindMapContent({ ctx }: CanvasNodeContentProps) {
    const editing = Boolean(ctx.node.metadata?.editing);
    const source = (ctx.node.metadata?.content as string | undefined) || "";
    const tree = useMemo(() => parseOutline(source), [source]);

    return editing ? (
        <textarea autoFocus value={source} placeholder={"中心主题\n  分支 A\n    叶子 A1\n  分支 B"} onChange={(e) => ctx.updateMetadata({ content: e.target.value })} onMouseDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()} spellCheck={false} style={{ height: "100%", width: "100%", display: "block", resize: "none", border: "none", outline: "none", background: "transparent", color: ctx.theme.node.text, fontFamily: "monospace", fontSize: 13, lineHeight: 1.6, padding: 12, boxSizing: "border-box" }} />
    ) : (
        <div data-canvas-no-zoom onWheel={(e) => e.stopPropagation()} style={{ height: "100%", width: "100%", overflow: "auto", padding: 12, boxSizing: "border-box" }}>
            {tree.length ? <PillTree nodes={tree} theme={ctx.theme} /> : <span style={{ color: ctx.theme.node.placeholder, fontSize: 12 }}>选中节点,在下方面板输入提示词生成,或点工具条「编辑」输入缩进大纲(两空格=一层)</span>}
        </div>
    );
}

export default definePlugin({
    id: "mind-map",
    name: "思维导图",
    version: "1.1.0",
    description: "用缩进大纲在画布中梳理思维导图,支持 AI 生成与叶子拆分",
    nodes: [
        {
            type: "mind-map:map",
            title: "思维导图",
            icon: "🗺️",
            description: "缩进大纲渲染思维导图",
            defaultSize: { width: 400, height: 300 },
            defaultMetadata: { content: "" },
            minimapColor: "#06b6d4",
            // AI 生成复用宿主内置文本生成面板:结果写回本节点,上游图片/文本自动作为参考
            useBuiltinPanel: { mode: "text", writeBackToSelf: true },
            resource: (node) => ({ kind: "text", text: node.metadata?.content as string | undefined }),
            Content: MindMapContent,
            toolbar: (ctx) => {
                const editing = Boolean(ctx.node.metadata?.editing);
                return [{ id: "mindmap-toggle", title: editing ? "预览导图" : "编辑大纲", label: editing ? "预览" : "编辑", icon: editing ? "👁" : "✎", active: editing, onClick: () => ctx.updateMetadata({ editing: !editing }) }];
            },
        },
    ],
});
