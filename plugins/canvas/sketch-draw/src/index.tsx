// 草图节点:在画布上手绘,支持笔色/笔宽,笔迹保存为 dataURL,
// 可作为图片资源输出给下游。
import { definePlugin, useEffect, useRef, useState } from "@infinite-canvas/plugin-sdk";
import type { CanvasNodeContentProps } from "@infinite-canvas/plugin-sdk";

function SketchContent({ ctx }: CanvasNodeContentProps) {
    const editing = Boolean(ctx.node.metadata?.editing);
    const saved = (ctx.node.metadata?.image as string | undefined) || "";
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const dirty = useRef(false);
    const [color, setColor] = useState((ctx.node.metadata?.brushColor as string | undefined) || ctx.theme.node.text);
    const [width, setWidth] = useState((ctx.node.metadata?.brushWidth as number | undefined) || 3);

    // 编辑态:把已保存的图绘制到画布上(仅一次)
    useEffect(() => {
        if (!editing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.max(1, Math.floor(rect.width));
        canvas.height = Math.max(1, Math.floor(rect.height));
        const c2d = canvas.getContext("2d");
        if (!c2d) return;
        if (saved) {
            const img = new Image();
            img.onload = () => c2d.drawImage(img, 0, 0, canvas.width, canvas.height);
            img.src = saved;
        }
    }, [editing, saved]);

    const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
        e.stopPropagation();
        const c2d = canvasRef.current?.getContext("2d");
        if (!c2d) return;
        drawing.current = true;
        const { x, y } = pos(e);
        c2d.strokeStyle = color;
        c2d.lineWidth = width;
        c2d.lineCap = "round";
        c2d.lineJoin = "round";
        c2d.beginPath();
        c2d.moveTo(x, y);
        c2d.lineTo(x + 0.01, y);
        c2d.stroke();
    };

    const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawing.current) return;
        e.stopPropagation();
        const c2d = canvasRef.current?.getContext("2d");
        if (!c2d) return;
        const { x, y } = pos(e);
        c2d.lineTo(x, y);
        c2d.stroke();
        dirty.current = true;
    };

    const end = () => {
        if (!drawing.current) return;
        drawing.current = false;
        const canvas = canvasRef.current;
        if (canvas && dirty.current) ctx.updateMetadata({ image: canvas.toDataURL("image/png") });
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const c2d = canvas?.getContext("2d");
        if (canvas && c2d) {
            c2d.clearRect(0, 0, canvas.width, canvas.height);
            ctx.updateMetadata({ image: "" });
        }
    };

    if (!editing) {
        return (
            <div data-canvas-no-zoom style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 8, boxSizing: "border-box" }}>
                {saved ? <img src={saved} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} draggable={false} /> : <span style={{ color: ctx.theme.node.placeholder, fontSize: 12 }}>点工具条「绘制」开始画草图</span>}
            </div>
        );
    }

    return (
        <div data-canvas-no-zoom onMouseDown={(e) => e.stopPropagation()} style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", gap: 8, padding: 12, boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {[ctx.theme.node.text, "#ef4444", "#f59e0b", "#22c55e", "#0ea5e9", "#a855f7"].map((c) => (
                    <button key={c} type="button" onClick={() => setColor(c)} style={{ width: 20, height: 20, borderRadius: "50%", background: c, border: `2px solid ${color === c ? ctx.theme.node.activeStroke : "transparent"}`, cursor: "pointer", padding: 0 }} />
                ))}
                <input type="range" min={1} max={20} value={width} onChange={(e) => setWidth(Number(e.target.value))} onMouseDown={(e) => e.stopPropagation()} style={{ marginLeft: 4, width: 90 }} />
                <span style={{ fontSize: 12, color: ctx.theme.node.muted }}>{width}px</span>
                <button type="button" onClick={clear} style={{ marginLeft: "auto", padding: "4px 10px", borderRadius: 8, border: `1px solid ${ctx.theme.node.stroke}`, background: ctx.theme.toolbar.panel, color: ctx.theme.node.text, cursor: "pointer", fontSize: 12 }}>
                    清空
                </button>
            </div>
            <canvas
                ref={canvasRef}
                onPointerDown={start}
                onPointerMove={move}
                onPointerUp={end}
                onPointerLeave={end}
                onWheel={(e) => e.stopPropagation()}
                style={{ flex: 1, minHeight: 0, width: "100%", borderRadius: 8, border: `1px dashed ${ctx.theme.node.stroke}`, background: ctx.theme.node.panel, touchAction: "none", cursor: "crosshair" }}
            />
        </div>
    );
}

export default definePlugin({
    id: "sketch-draw",
    name: "草图",
    version: "1.0.0",
    description: "在画布中手绘草图,笔迹保存为图片可输出",
    nodes: [
        {
            type: "sketch-draw:sketch",
            title: "草图",
            icon: "✏️",
            description: "手绘草图",
            defaultSize: { width: 360, height: 300 },
            defaultMetadata: { image: "", brushColor: "", brushWidth: 3 },
            minimapColor: "#f97316",
            hidePanel: true,
            interactionToggle: true,
            forceInteractive: (node) => Boolean(node.metadata?.editing),
            resource: (node) => (node.metadata?.image ? { kind: "image", url: node.metadata.image as string } : null),
            Content: SketchContent,
            toolbar: (ctx) => {
                const editing = Boolean(ctx.node.metadata?.editing);
                return [{ id: "sketch-toggle", title: editing ? "完成绘制" : "绘制草图", label: editing ? "完成" : "绘制", icon: editing ? "✓" : "✏️", active: editing, onClick: () => ctx.updateMetadata({ editing: !editing }) }];
            },
        },
    ],
});
