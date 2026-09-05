// 切图节点:把上游图片按行列切块,生成到源节点右侧(网格排布,不连线)。
import { definePlugin, useEffect, useState } from "@infinite-canvas/plugin-sdk";
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

function SplitPanel({ ctx, onClose }: CanvasNodePanelProps) {
    const [cols, setCols] = useState((ctx.node.metadata?.cols as number | undefined) || 3);
    const [rows, setRows] = useState((ctx.node.metadata?.rows as number | undefined) || 3);
    const [msg, setMsg] = useState("");
    const [busy, setBusy] = useState(false);

    const src = ctx.getUpstream().find((n) => n.type === "image" && typeof n.metadata?.content === "string")?.metadata?.content as string | undefined;

    const doSplit = async () => {
        if (!src || busy) return;
        setBusy(true);
        setMsg("");
        try {
            const img = await loadImage(src);
            const w = Math.floor(img.naturalWidth / cols);
            const h = Math.floor(img.naturalHeight / rows);
            if (w < 1 || h < 1) throw new Error("图片太小,无法按该行列切分");
            const baseX = ctx.node.position.x + ctx.node.width + 60;
            const scale = ctx.node.width / w; // 让切块显示尺寸与源节点协调
            const ops = [];
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const canvas = document.createElement("canvas");
                    canvas.width = w;
                    canvas.height = h;
                    const c2d = canvas.getContext("2d");
                    if (!c2d) throw new Error("无法创建画布上下文");
                    c2d.drawImage(img, c * w, r * h, w, h, 0, 0, w, h);
                    const dataUrl = canvas.toDataURL("image/png");
                    ops.push({
                        type: "add_node" as const,
                        id: `image-split-${ctx.node.id}-${r}-${c}`,
                        nodeType: "image",
                        title: `切块 ${r + 1}-${c + 1}`,
                        x: baseX + c * (w * scale + 20),
                        y: ctx.node.position.y + r * (h * scale + 20),
                        width: Math.round(w * scale),
                        height: Math.round(h * scale),
                        metadata: { content: dataUrl, naturalWidth: w, naturalHeight: h, mimeType: "image/png", status: "success" as const },
                    });
                }
            }
            ctx.applyOps(ops);
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
            <button type="button" style={{ ...btn, opacity: src ? 1 : 0.5 }} disabled={!src || busy} onClick={() => void doSplit()}>
                {busy ? "切图中…" : `切图(${cols}×${rows})`}
            </button>
            {!src && <div style={{ color: ctx.theme.node.muted }}>需要连接一个上游图片节点</div>}
            {msg && <div style={{ color: "#ef4444" }}>{msg}</div>}
        </div>
    );
}

function SplitContent({ ctx }: CanvasNodeContentProps) {
    const cols = (ctx.node.metadata?.cols as number | undefined) || 3;
    const rows = (ctx.node.metadata?.rows as number | undefined) || 3;
    const src = ctx.getUpstream().find((n) => n.type === "image" && typeof n.metadata?.content === "string")?.metadata?.content as string | undefined;
    return (
        <div data-canvas-no-zoom style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", paddingTop: 16, paddingBottom: 16, boxSizing: "border-box", gap: 8 }}>
            {src ? <img src={src} style={{ maxWidth: "100%", maxHeight: "55%", objectFit: "contain", borderRadius: 8 }} draggable={false} /> : <span style={{ color: ctx.theme.node.placeholder, fontSize: 12 }}>连接一个上游图片节点</span>}
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, gap: 3, width: "85%", aspectRatio: "1" }}>
                {Array.from({ length: cols * rows }, (_, i) => (
                    <div key={i} style={{ border: `1px dashed ${ctx.theme.node.stroke}`, borderRadius: 4, opacity: 0.6 }} />
                ))}
            </div>
        </div>
    );
}

export default definePlugin({
    id: "image-split",
    name: "切图",
    version: "1.0.0",
    description: "把上游图片按行列切块,生成图片节点",
    nodes: [
        {
            type: "image-split:split",
            title: "切图",
            icon: "🪓",
            description: "按行列切分上游图片",
            defaultSize: { width: 320, height: 300 },
            defaultMetadata: { cols: 3, rows: 3 },
            minimapColor: "#eab308",
            Panel: SplitPanel,
            Content: SplitContent,
            toolbar: (ctx) => [{ id: "split-panel", title: "打开切图面板", label: "切图", icon: "🪓", onClick: () => ctx.openPanel() }],
        },
    ],
});
