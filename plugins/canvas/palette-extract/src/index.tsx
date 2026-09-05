// 取色板节点:从上游图片量化提取主色,色块可点击复制 HEX,
// 可输出配色文本节点。CORS 失败时给出提示。
import { definePlugin, useEffect, useState } from "@infinite-canvas/plugin-sdk";
import type { CanvasNodeContentProps } from "@infinite-canvas/plugin-sdk";

type Swatch = { hex: string; ratio: number };

// 采样缩图后按 RGB 桶量化,取出现最多的前 N 色
function extractColors(img: HTMLImageElement, max = 8): Swatch[] {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const c2d = canvas.getContext("2d");
    if (!c2d) return [];
    c2d.drawImage(img, 0, 0, size, size);
    const data = c2d.getImageData(0, 0, size, size).data;
    const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
        const cur = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
        cur.r += r; cur.g += g; cur.b += b; cur.n += 1;
        buckets.set(key, cur);
    }
    const total = [...buckets.values()].reduce((s, v) => s + v.n, 0) || 1;
    return [...buckets.values()]
        .sort((a, b) => b.n - a.n)
        .slice(0, max)
        .map((v) => {
            const r = Math.round(v.r / v.n), g = Math.round(v.g / v.n), b = Math.round(v.b / v.n);
            return { hex: "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join(""), ratio: v.n / total };
        });
}

function usePalette(ctx: CanvasNodeContentProps["ctx"]): { colors: Swatch[]; error: string } {
    const [colors, setColors] = useState<Swatch[]>([]);
    const [error, setError] = useState("");
    const src = ctx.getUpstream().find((n) => n.type === "image" && typeof n.metadata?.content === "string")?.metadata?.content as string | undefined;

    useEffect(() => {
        if (!src) {
            setColors([]);
            setError("");
            return;
        }
        let alive = true;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            if (!alive) return;
            try {
                const swatches = extractColors(img);
                setColors(swatches);
                setError("");
                // 缓存纯文本结果,供「复制全部」与下游 resource 使用
                ctx.updateMetadata({ paletteText: swatches.map((c) => c.hex).join(", ") });
            } catch {
                setColors([]);
                setError("读取像素失败:图片跨域受限(CORS)");
            }
        };
        img.onerror = () => alive && setError("图片加载失败");
        img.src = src;
        return () => {
            alive = false;
        };
    }, [src]);

    return { colors, error };
}

function PaletteContent({ ctx }: CanvasNodeContentProps) {
    const { colors, error } = usePalette(ctx);
    const [copied, setCopied] = useState("");

    const copy = async (hex: string) => {
        try {
            await navigator.clipboard.writeText(hex);
            setCopied(hex);
            setTimeout(() => setCopied(""), 1200);
        } catch {
            /* 剪贴板不可用时静默 */
        }
    };

    const outputText = colors.map((c) => c.hex).join(", ");
    const spawnText = () => {
        const id = `palette-text-${ctx.node.id}`;
        ctx.applyOps([
            { type: "add_node", id, nodeType: "text", title: "配色", x: ctx.node.position.x, y: ctx.node.position.y + ctx.node.height + 40, metadata: { content: outputText, status: "success" } },
            { type: "connect_nodes", fromNodeId: ctx.node.id, toNodeId: id },
        ]);
    };

    return (
        <div data-canvas-no-zoom style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", gap: 12, padding: 12, boxSizing: "border-box" }}>
            {error ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", fontSize: 12 }}>{error}</div>
            ) : colors.length ? (
                <>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, overflow: "auto" }} onWheel={(e) => e.stopPropagation()}>
                        {colors.map((c) => (
                            <button key={c.hex} type="button" onClick={() => copy(c.hex)} title={`点击复制 ${c.hex}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: 6, borderRadius: 10, border: `1px solid ${ctx.theme.node.stroke}`, background: ctx.theme.node.panel, cursor: "pointer", fontSize: 12, color: ctx.theme.node.text }}>
                                <span style={{ width: 32, height: 32, borderRadius: 8, background: c.hex, flexShrink: 0 }} />
                                <span style={{ fontFamily: "monospace" }}>{c.hex}</span>
                                <span style={{ marginLeft: "auto", color: ctx.theme.node.muted }}>{Math.round(c.ratio * 100)}%</span>
                                {copied === c.hex && <span style={{ color: ctx.theme.toolbar.activeText }}>已复制</span>}
                            </button>
                        ))}
                    </div>
                    <button type="button" onClick={spawnText} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${ctx.theme.node.stroke}`, background: ctx.theme.toolbar.panel, color: ctx.theme.node.text, cursor: "pointer", fontSize: 12 }}>
                        输出配色文本节点
                    </button>
                </>
            ) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: ctx.theme.node.placeholder, fontSize: 12 }}>连接一个上游图片节点提取主色</div>
            )}
        </div>
    );
}

export default definePlugin({
    id: "palette-extract",
    name: "取色板",
    version: "1.0.0",
    description: "从上游图片提取主色调色板,点击色块复制 HEX",
    nodes: [
        {
            type: "palette-extract:palette",
            title: "取色板",
            icon: "🎨",
            description: "提取图片主色",
            defaultSize: { width: 280, height: 340 },
            defaultMetadata: {},
            minimapColor: "#22c55e",
            hidePanel: true,
            interactionToggle: true,
            resource: (node) => (node.metadata?.paletteText ? { kind: "text", text: node.metadata.paletteText as string } : null),
            Content: PaletteContent,
            toolbar: (ctx) => [
                { id: "palette-copy", title: "复制全部 HEX", label: "复制全部", icon: "⧉", onClick: () => void navigator.clipboard.writeText((ctx.node.metadata?.paletteText as string) || "") },
            ],
        },
    ],
});
