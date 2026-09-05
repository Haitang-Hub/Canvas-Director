// 字数统计节点:统计上游文本(或自身 content)的字符/汉字/英文单词/行数/Tokens。
// 纯展示节点,无交互。
import { definePlugin, useMemo } from "@infinite-canvas/plugin-sdk";
import type { CanvasNodeContentProps } from "@infinite-canvas/plugin-sdk";

function stats(text: string) {
    const chars = text.length;
    const han = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const words = (text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length;
    const lines = text ? text.split("\n").length : 0;
    const tokens = Math.round(han + words * 1.3);
    return { chars, han, words, lines, tokens };
}

function TextStatsContent({ ctx }: CanvasNodeContentProps) {
    const upstreamText = useMemo(() => ctx.getUpstream().map((n) => (typeof n.metadata?.content === "string" ? n.metadata.content : "")).filter(Boolean).join("\n"), [ctx]);
    const text = upstreamText || (ctx.node.metadata?.content as string | undefined) || "";
    const s = useMemo(() => stats(text), [text]);

    const items = [
        { label: "字符数", value: s.chars },
        { label: "汉字", value: s.han },
        { label: "英文单词", value: s.words },
        { label: "行数", value: s.lines },
        { label: "Tokens(约)", value: s.tokens },
    ];

    return (
        <div data-canvas-no-zoom style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 10, padding: 20, boxSizing: "border-box" }}>
            {items.map((it) => (
                <div key={it.label} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "8px 12px", borderRadius: 10, border: `1px solid ${ctx.theme.node.stroke}`, background: ctx.theme.node.panel }}>
                    <span style={{ fontSize: 12, color: ctx.theme.node.muted }}>{it.label}</span>
                    <span style={{ fontSize: 18, color: ctx.theme.node.text, fontVariantNumeric: "tabular-nums" }}>{it.value}</span>
                </div>
            ))}
            {!upstreamText && <div style={{ fontSize: 11, color: ctx.theme.node.placeholder, textAlign: "center" }}>连接上游文本节点统计,或在本节点 metadata.content 中写内容</div>}
        </div>
    );
}

export default definePlugin({
    id: "text-stats",
    name: "字数统计",
    version: "1.0.0",
    description: "统计上游文本的字符数、汉字数、词数与估算 Tokens",
    nodes: [
        {
            type: "text-stats:stats",
            title: "字数统计",
            icon: "📊",
            description: "文本统计信息",
            defaultSize: { width: 280, height: 280 },
            defaultMetadata: {},
            minimapColor: "#3b82f6",
            hidePanel: true,
            resource: (node) => ({ kind: "text", text: JSON.stringify(stats((node.metadata?.content as string | undefined) || "")) }),
            Content: TextStatsContent,
        },
    ],
});
