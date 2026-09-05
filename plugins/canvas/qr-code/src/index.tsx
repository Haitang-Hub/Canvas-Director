// 二维码节点:输入文本,用 qrcode(CDN)生成二维码图片。
import { definePlugin, useEffect, useState } from "@infinite-canvas/plugin-sdk";
import type { CanvasNodeContentProps } from "@infinite-canvas/plugin-sdk";

type QRCodeApi = { toDataURL: (text: string, opts?: Record<string, unknown>) => Promise<string> };

let qrcode: QRCodeApi | undefined;
let qrcodePromise: Promise<QRCodeApi> | undefined;
function loadQRCode(): Promise<QRCodeApi> {
    if (qrcode) return Promise.resolve(qrcode);
    if (!qrcodePromise) qrcodePromise = import("https://esm.sh/qrcode@1.5.4").then((mod: { default: QRCodeApi }) => (qrcode = mod.default));
    return qrcodePromise;
}

function QRContent({ ctx }: CanvasNodeContentProps) {
    const editing = Boolean(ctx.node.metadata?.editing);
    const text = (ctx.node.metadata?.content as string | undefined) || "";
    const [dataUrl, setDataUrl] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (editing || !text.trim()) {
            setDataUrl("");
            return;
        }
        let alive = true;
        loadQRCode()
            .then((qr) => qr.toDataURL(text, { margin: 1, width: 512 }))
            .then((url) => {
                if (!alive) return;
                setDataUrl(url);
                setError("");
                ctx.updateMetadata({ qrDataUrl: url }); // 缓存 dataURL 供下游 resource 使用
            })
            .catch((err: unknown) => alive && setError(err instanceof Error ? err.message : String(err)));
        return () => {
            alive = false;
        };
    }, [text, editing]);

    return (
        <div data-canvas-no-zoom style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", gap: 8, padding: 12, boxSizing: "border-box" }}>
            {editing ? (
                <textarea autoFocus value={text} placeholder="输入要编码的文本或链接…" onChange={(e) => ctx.updateMetadata({ content: e.target.value })} onMouseDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()} style={{ flex: 1, resize: "none", border: "none", outline: "none", background: "transparent", color: ctx.theme.node.text, fontSize: 13, lineHeight: 1.5 }} />
            ) : (
                <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto" }} onWheel={(e) => e.stopPropagation()}>
                    {error ? <span style={{ color: "#ef4444", fontSize: 12 }}>{error}</span> : dataUrl ? <img src={dataUrl} alt="二维码" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }} draggable={false} /> : <span style={{ color: ctx.theme.node.placeholder, fontSize: 12 }}>{text.trim() ? "生成中…" : "点工具条「编辑」输入内容"}</span>}
                </div>
            )}
        </div>
    );
}

export default definePlugin({
    id: "qr-code",
    name: "二维码",
    version: "1.0.0",
    description: "把文本/链接生成为二维码图片",
    nodes: [
        {
            type: "qr-code:qr",
            title: "二维码",
            icon: "🔗",
            description: "文本生成二维码",
            defaultSize: { width: 260, height: 280 },
            defaultMetadata: { content: "" },
            minimapColor: "#64748b",
            hidePanel: true,
            interactionToggle: true,
            forceInteractive: (node) => Boolean(node.metadata?.editing),
            resource: (node) => (node.metadata?.qrDataUrl ? { kind: "image", url: node.metadata.qrDataUrl as string } : null),
            Content: QRContent,
            toolbar: (ctx) => {
                const editing = Boolean(ctx.node.metadata?.editing);
                return [{ id: "qr-toggle", title: editing ? "生成二维码" : "编辑内容", label: editing ? "生成" : "编辑", icon: editing ? "👁" : "✎", active: editing, onClick: () => ctx.updateMetadata({ editing: !editing }) }];
            },
        },
    ],
});
