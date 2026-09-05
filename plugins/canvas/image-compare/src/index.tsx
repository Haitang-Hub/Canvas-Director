// 图片对比节点:取上游前两个图片节点,支持并排对比与滑动裁切对比。
import { definePlugin, useEffect, useRef, useState } from "@infinite-canvas/plugin-sdk";
import type { CanvasNodeContentProps } from "@infinite-canvas/plugin-sdk";

// 上游图片节点的内容惯例:metadata.content = dataURL/URL
function useUpstreamImages(ctx: CanvasNodeContentProps["ctx"], count = 2): string[] {
    const upstream = ctx.getUpstream();
    return upstream.filter((n) => typeof n.metadata?.content === "string" && n.type === "image").map((n) => n.metadata?.content as string).slice(0, count);
}

function CompareContent({ ctx }: CanvasNodeContentProps) {
    const images = useUpstreamImages(ctx);
    const mode = (ctx.node.metadata?.mode as string | undefined) || "side";
    const [ratio, setRatio] = useState(50);
    const wrapRef = useRef<HTMLDivElement>(null);
    const dragging = useRef(false);
    // containerW/H: 容器可用尺寸; imgNaturalW/H: 背景图原始尺寸
    const [containerInfo, setContainerInfo] = useState<{ w: number; h: number; nw: number; nh: number }>({ w: 0, h: 0, nw: 0, nh: 0 });

    // 用数学计算替代 getBoundingClientRect:
    // contain 模式下图片的实际显示区域 = min(containerW/naturalW, containerH/naturalH) * naturalW/naturalH
    const bgRenderPos = containerInfo.nw > 0 && containerInfo.nh > 0
        ? (() => {
            const scale = Math.min(containerInfo.w / containerInfo.nw, containerInfo.h / containerInfo.nh);
            const rw = containerInfo.nw * scale;
            const rh = containerInfo.nh * scale;
            return {
                top: (containerInfo.h - rh) / 2,
                left: (containerInfo.w - rw) / 2,
                width: rw,
                height: rh,
            };
        })()
        : null;

    // slider 模式:拖动覆盖层调整分割位置
    useEffect(() => {
        const move = (e: PointerEvent) => {
            if (!dragging.current || !wrapRef.current) return;
            const rect = wrapRef.current.getBoundingClientRect();
            setRatio(Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)));
        };
        const up = () => { dragging.current = false; };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        return () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
        };
    }, []);

    const frame = { flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 8, border: `1px solid ${ctx.theme.node.stroke}`, background: ctx.theme.node.panel } as const;
    const imgStyle = { maxWidth: "100%", maxHeight: "100%", objectFit: "contain" } as const;

    if (images.length < 2) {
        return (
            <div data-canvas-no-zoom style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, boxSizing: "border-box" }}>
                <span style={{ color: ctx.theme.node.placeholder, fontSize: 12 }}>连接两个上游图片节点进行对比</span>
            </div>
        );
    }

    return (
        <div data-canvas-no-zoom style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", gap: 8, padding: 12, boxSizing: "border-box" }}>
            <div style={{ display: "flex", gap: 6 }}>
                {[
                    { id: "side", label: "并排", icon: "⬒" },
                    { id: "slider", label: "滑动", icon: "⬓" },
                ].map((m) => (
                    <button key={m.id} type="button" onClick={() => ctx.updateMetadata({ mode: m.id })} style={{ padding: "4px 12px", borderRadius: 8, border: `1px solid ${mode === m.id ? ctx.theme.node.activeStroke : ctx.theme.node.stroke}`, background: mode === m.id ? ctx.theme.toolbar.activeBg : ctx.theme.toolbar.panel, color: mode === m.id ? ctx.theme.toolbar.activeText : ctx.theme.node.text, cursor: "pointer", fontSize: 12 }}>
                        {m.icon} {m.label}
                    </button>
                ))}
            </div>
            {mode === "side" ? (
                <div style={{ ...frame, gap: 4, padding: 4 }} onWheel={(e) => e.stopPropagation()}>
                    {images.map((src, i) => (
                        <img key={i} src={src} style={{ ...imgStyle, width: "50%" }} draggable={false} />
                    ))}
                </div>
            ) : (
                <div
                    ref={(el) => {
                        wrapRef.current = el;
                        if (el) {
                            const observer = new ResizeObserver((entries) => {
                                for (const entry of entries) {
                                    setContainerInfo(prev => ({ ...prev, w: entry.contentRect.width, h: entry.contentRect.height }));
                                }
                            });
                            observer.observe(el);
                            return () => observer.disconnect();
                        }
                    }}
                    style={{ ...frame, position: "relative", userSelect: "none", touchAction: "none" }}
                    onWheel={(e) => e.stopPropagation()}
                    onPointerDown={(e) => { dragging.current = true; e.stopPropagation(); }}
                >
                    {/* 背景图：被裁剪的参考图，渲染为原始比例 */}
                    <img
                        src={images[1]}
                        style={{ ...imgStyle, display: "block" }}
                        draggable={false}
                        onLoad={(e) => {
                            const img = e.currentTarget;
                            const wrapRect = wrapRef.current?.getBoundingClientRect() ?? { width: 0, height: 0 };
                            setContainerInfo({ w: wrapRect.width, h: wrapRect.height, nw: img.naturalWidth, nh: img.naturalHeight });
                        }}
                    />
                    {/* 前景图：数学计算后精确定位到背景图的实际渲染区域，保证完全对齐 */}
                    {bgRenderPos && bgRenderPos.width > 0 && (
                        <div
                            style={{
                                position: "absolute",
                                top: bgRenderPos.top,
                                left: bgRenderPos.left,
                                width: bgRenderPos.width,
                                height: bgRenderPos.height,
                                overflow: "hidden",
                                clipPath: `inset(0 ${100 - ratio}% 0 0)`,
                            }}
                        >
                            <img
                                src={images[0]}
                                style={{ width: bgRenderPos.width, height: bgRenderPos.height, objectFit: "contain", display: "block" }}
                                draggable={false}
                            />
                        </div>
                    )}
                    <div style={{ position: "absolute", top: 0, bottom: 0, left: `${ratio}%`, width: 2, background: ctx.theme.node.text, cursor: "ew-resize" }}>
                        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 22, height: 22, borderRadius: "50%", background: ctx.theme.node.text, color: ctx.theme.node.fill, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, pointerEvents: "none" }}>↔</div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default definePlugin({
    id: "image-compare",
    name: "图片对比",
    version: "1.0.0",
    description: "取上游两张图片,支持并排与滑动裁切对比",
    nodes: [
        {
            type: "image-compare:compare",
            title: "图片对比",
            icon: "🔀",
            description: "对比两张上游图片",
            defaultSize: { width: 400, height: 300 },
            defaultMetadata: { mode: "side" },
            minimapColor: "#a855f7",
            hidePanel: true,
            interactionToggle: true,
            forceInteractive: (node) => node.metadata?.mode === "slider",
            Content: CompareContent,
        },
    ],
});
