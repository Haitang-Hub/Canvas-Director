// 合图节点:将多个上游图片拼合成一张完整图片,行列按连接顺序排列。
import { definePlugin, useState } from "@infinite-canvas/plugin-sdk";
import type { CanvasNodeContentProps, CanvasNodePanelProps } from "@infinite-canvas/plugin-sdk";

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("图片加载失败(可能跨域受限)"));
        img.src = src;
    });
}

function CombinePanel({ ctx, onClose }: CanvasNodePanelProps) {
    const [cols, setCols] = useState((ctx.node.metadata?.cols as number | undefined) || 3);
    const [rows, setRows] = useState((ctx.node.metadata?.rows as number | undefined) || 3);
    const [msg, setMsg] = useState("");
    const [busy, setBusy] = useState(false);

    const upstreamImages = ctx.getUpstream().filter((n) => n.type === "image" && typeof n.metadata?.content === "string").map((n) => ({
        id: n.id,
        content: n.metadata?.content as string,
        x: n.position.x,
        y: n.position.y,
        naturalWidth: n.metadata?.naturalWidth as number | undefined,
        naturalHeight: n.metadata?.naturalHeight as number | undefined,
    }));

    const doCombine = async () => {
        if (upstreamImages.length < 1 || busy) return;
        setBusy(true);
        setMsg("");
        try {
            const loaded = await Promise.all(upstreamImages.map((img) => loadImage(img.content)));
            const widths = loaded.map((img) => img.naturalWidth);
            const heights = loaded.map((img) => img.naturalHeight);
            const avgW = Math.round(widths.reduce((a, b) => a + b, 0) / widths.length);
            const avgH = Math.round(heights.reduce((a, b) => a + b, 0) / heights.length);
            if (avgW < 1 || avgH < 1) throw new Error("图片太小,无法合图");

            const totalW = avgW * cols;
            const totalH = avgH * rows;
            const canvas = document.createElement("canvas");
            canvas.width = totalW;
            canvas.height = totalH;
            const c2d = canvas.getContext("2d");
            if (!c2d) throw new Error("无法创建画布上下文");

            // 按位置排序:先按 y 排序(行),再按 x 排序(列)
            const sorted = [...upstreamImages].sort((a, b) => {
                const rowA = Math.round(a.y / avgH);
                const rowB = Math.round(b.y / avgH);
                if (rowA !== rowB) return rowA - rowB;
                return Math.round(a.x / avgW) - Math.round(b.x / avgW);
            });

            for (let i = 0; i < sorted.length; i++) {
                const r = Math.floor(i / cols);
                const c = i % cols;
                if (r >= rows) break;
                c2d.drawImage(loaded[i], c * avgW, r * avgH, avgW, avgH, c * avgW, r * avgH, avgW, avgH);
            }

            const dataUrl = canvas.toDataURL("image/png");
            ctx.applyOps([
                {
                    type: "add_node" as const,
                    id: `image-combine-${ctx.node.id}`,
                    nodeType: "image" as const,
                    title: "合图",
                    x: ctx.node.position.x + ctx.node.width + 60,
                    y: ctx.node.position.y,
                    width: 256,
                    height: 256,
                    metadata: { content: dataUrl, naturalWidth: totalW, naturalHeight: totalH, mimeType: "image/png", status: "success" as const },
                },
            ]);
            onClose();
        } catch (err) {
            setMsg(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    };

    const input = (value: number, set: (n: number) => void, label: string) => (
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {label}
            <input type="number" min={1} max={10} value={value} onChange={(e) => set(Math.min(10, Math.max(1, Number(e.target.value) || 1)))} onMouseDown={(e) => e.stopPropagation()} style={{ width: 52, border: `1px solid ${ctx.theme.node.stroke}`, borderRadius: 6, background: ctx.theme.node.panel, color: ctx.theme.node.text, padding: "4px 6px", fontSize: 12, outline: "none" }} />
        </label>
    );

    const btn = { padding: "6px 14px", borderRadius: 8, border: `1px solid ${ctx.theme.node.stroke}`, background: ctx.theme.toolbar.panel, color: ctx.theme.node.text, cursor: "pointer", fontSize: 12 } as const;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12, color: ctx.theme.node.text, fontSize: 12 }}>
            <div style={{ display: "flex", gap: 14 }}>
                {input(cols, (n) => { setCols(n); ctx.updateMetadata({ cols: n }); }, "列数")}
                {input(rows, (n) => { setRows(n); ctx.updateMetadata({ rows: n }); }, "行数")}
            </div>
            <button type="button" style={{ ...btn, opacity: upstreamImages.length > 0 ? 1 : 0.5 }} disabled={upstreamImages.length < 1 || busy} onClick={() => void doCombine()}>
                {busy ? "合图中…" : `合图(${cols}×${rows})`}
            </button>
            {upstreamImages.length < 1 && <div style={{ color: ctx.theme.node.muted }}>需要连接上游图片节点(切图产物)</div>}
            {upstreamImages.length > 0 && <div style={{ color: ctx.theme.node.muted }}>已连接 {upstreamImages.length} 张图片</div>}
            {msg && <div style={{ color: "#ef4444" }}>{msg}</div>}
        </div>
    );
}

function CombineContent({ ctx }: CanvasNodeContentProps) {
    const cols = (ctx.node.metadata?.cols as number | undefined) || 3;
    const rows = (ctx.node.metadata?.rows as number | undefined) || 3;
    const upstreamImages = ctx.getUpstream().filter((n) => n.type === "image" && typeof n.metadata?.content === "string").map((n) => n.metadata?.content as string);

    return (
        <div data-canvas-no-zoom style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", paddingTop: 16, paddingBottom: 16, boxSizing: "border-box", gap: 6 }}>
            {upstreamImages.length > 0 ? (
                <>
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, gap: 2, width: "100%", aspectRatio: "1" }}>
                        {upstreamImages.slice(0, cols * rows).map((src, i) => (
                            <img key={i} src={src} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 3, display: "block" }} draggable={false} />
                        ))}
                    </div>
                    <span style={{ color: ctx.theme.node.muted, fontSize: 11 }}>预览 {upstreamImages.length} 张图片 → 合图为 1 张</span>
                </>
            ) : (
                <span style={{ color: ctx.theme.node.placeholder, fontSize: 12 }}>连接上游切图节点</span>
            )}
        </div>
    );
}

export default definePlugin({
    id: "image-combine",
    name: "合图",
    version: "1.0.0",
    description: "将多个上游切图拼合为完整图片",
    nodes: [
        {
            type: "image-combine:combine",
            title: "合图",
            icon: "🧩",
            description: "将切分后的图片拼合还原",
            defaultSize: { width: 320, height: 300 },
            defaultMetadata: { cols: 3, rows: 3 },
            minimapColor: "#22c55e",
            Panel: CombinePanel,
            Content: CombineContent,
            toolbar: (ctx) => [{ id: "combine-panel", title: "打开合图面板", label: "合图", icon: "🧩", onClick: () => ctx.openPanel() }],
        },
    ],
});
