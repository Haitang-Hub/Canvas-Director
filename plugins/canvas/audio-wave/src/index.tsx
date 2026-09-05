// 音频波形裁剪节点:读取上游音频,画波形;编辑态用双滑块选起止百分比,
// 可试听片段并导出裁剪后的 WAV(16bit PCM,纯 JS 编码)。
import { definePlugin, useEffect, useRef, useState } from "@infinite-canvas/plugin-sdk";
import type { CanvasNodeContentProps } from "@infinite-canvas/plugin-sdk";

async function decodeAudio(src: string): Promise<AudioBuffer> {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`音频拉取失败(HTTP ${res.status})`);
    const buf = await res.arrayBuffer();
    const ac = new AudioContext();
    const decoded = await ac.decodeAudioData(buf);
    void ac.close();
    return decoded;
}

function encodeWav(buffer: AudioBuffer, from: number, to: number): string {
    const sr = buffer.sampleRate;
    const chs = Math.min(2, buffer.numberOfChannels);
    const start = Math.floor(from * buffer.length);
    const end = Math.min(buffer.length, Math.floor(to * buffer.length));
    const n = Math.max(0, end - start);
    const bytes = 44 + n * chs * 2;
    const ab = new ArrayBuffer(bytes);
    const view = new DataView(ab);
    let p = 0;
    const str = (s: string) => {
        for (let i = 0; i < s.length; i++) view.setUint8(p++, s.charCodeAt(i));
    };
    const u32 = (v: number) => {
        view.setUint32(p, v, true);
        p += 4;
    };
    const u16 = (v: number) => {
        view.setUint16(p, v, true);
        p += 2;
    };
    str("RIFF");
    u32(bytes - 8);
    str("WAVE");
    str("fmt ");
    u32(16);
    u16(1);
    u16(chs);
    u32(sr);
    u32(sr * chs * 2);
    u16(chs * 2);
    u16(16);
    str("data");
    u32(n * chs * 2);
    const channels: Float32Array[] = [];
    for (let c = 0; c < chs; c++) channels.push(buffer.getChannelData(c));
    for (let i = 0; i < n; i++) {
        for (let c = 0; c < chs; c++) {
            const v = Math.max(-1, Math.min(1, channels[c][start + i]));
            view.setInt16(p, v < 0 ? v * 0x8000 : v * 0x7fff, true);
            p += 2;
        }
    }
    // ArrayBuffer → base64
    let bin = "";
    const chunk = 0x8000;
    const arr = new Uint8Array(ab);
    for (let i = 0; i < arr.length; i += chunk) bin += String.fromCharCode(...arr.subarray(i, i + chunk));
    return "data:audio/wav;base64," + btoa(bin);
}

function WaveContent({ ctx }: CanvasNodeContentProps) {
    const editing = Boolean(ctx.node.metadata?.editing);
    const src = ctx.getUpstream().find((n) => n.type === "audio" && typeof n.metadata?.content === "string")?.metadata?.content as string | undefined;
    const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
    const [error, setError] = useState("");
    const [range, setRange] = useState<[number, number]>((ctx.node.metadata?.clipRange as [number, number] | undefined) || [0, 100]);
    const [playing, setPlaying] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sourceRef = useRef<AudioBufferSourceNode | null>(null);
    const acRef = useRef<AudioContext | null>(null);
    const bufferRef = useRef<AudioBuffer | null>(null);
    bufferRef.current = buffer;

    useEffect(() => {
        if (!src) {
            setBuffer(null);
            setError("");
            return;
        }
        let alive = true;
        decodeAudio(src)
            .then((buf) => alive && setBuffer(buf))
            .catch((err: unknown) => alive && setError(err instanceof Error ? err.message : String(err)));
        return () => {
            alive = false;
        };
    }, [src]);

    // 画波形(峰值包络,叠加选区)
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !buffer) return;
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.max(1, Math.floor(rect.width));
        canvas.height = Math.max(1, Math.floor(rect.height));
        const c2d = canvas.getContext("2d");
        if (!c2d) return;
        const w = canvas.width, h = canvas.height, mid = h / 2;
        const data = buffer.getChannelData(0);
        const step = Math.max(1, Math.floor(data.length / w));
        const a = range[0] / 100, b = range[1] / 100;
        c2d.clearRect(0, 0, w, h);
        for (let x = 0; x < w; x++) {
            let min = 1, max = -1;
            for (let i = 0; i < step; i++) {
                const v = data[x * step + i] || 0;
                if (v < min) min = v;
                if (v > max) max = v;
            }
            const inRange = x / w >= a && x / w <= b;
            c2d.fillStyle = inRange ? ctx.theme.toolbar.activeText : ctx.theme.node.faint;
            const y1 = mid - max * mid, y2 = mid - min * mid;
            c2d.fillRect(x, y1, 1, Math.max(1, y2 - y1));
        }
        c2d.fillStyle = ctx.theme.node.stroke;
        c2d.fillRect(0, mid - 0.5, w, 1);
    }, [buffer, range, ctx.theme]);

    const playClip = () => {
        if (!buffer) return;
        stopPlay();
        const ac = acRef.current || new AudioContext();
        acRef.current = ac;
        const s = ac.createBufferSource();
        s.buffer = buffer;
        s.connect(ac.destination);
        const dur = buffer.duration * ((range[1] - range[0]) / 100);
        s.start(0, buffer.duration * (range[0] / 100), Math.max(0.05, dur));
        sourceRef.current = s;
        setPlaying(true);
        s.onended = () => setPlaying(false);
    };
    const stopPlay = () => {
        try {
            sourceRef.current?.stop();
        } catch {
            /* 已停止 */
        }
        sourceRef.current = null;
        setPlaying(false);
    };
    useEffect(() => () => stopPlay(), []);

    const exportClip = () => {
        if (!buffer) return;
        try {
            const wav = encodeWav(buffer, range[0] / 100, range[1] / 100);
            const id = `audio-wave-clip-${ctx.node.id}`;
            const durMs = Math.round(buffer.duration * ((range[1] - range[0]) / 100) * 1000);
            ctx.applyOps([{ type: "add_node", id, nodeType: "audio", title: "裁剪音频", x: ctx.node.position.x, y: ctx.node.position.y + ctx.node.height + 40, metadata: { content: wav, mimeType: "audio/wav", durationMs: durMs, status: "success" } }]);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    const slider = (idx: 0 | 1) => (
        <input type="range" min={0} max={100} value={range[idx]} onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onChange={(e) => {
            const v = Number(e.target.value);
            setRange((cur) => {
                const next: [number, number] = [...cur];
                next[idx] = v;
                if (next[0] > next[1]) next[idx] = cur[1 - idx]; // 防交叉
                return next;
            });
        }} style={{ width: "100%" }} />
    );

    return (
        <div data-canvas-no-zoom style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", gap: 8, padding: 12, boxSizing: "border-box" }}>
            {error ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", fontSize: 12, whiteSpace: "pre-wrap" }}>{error}</div>
            ) : buffer ? (
                <>
                    <canvas ref={canvasRef} style={{ width: "100%", flex: 1, minHeight: 0, borderRadius: 8, border: `1px solid ${ctx.theme.node.stroke}`, background: ctx.theme.node.panel }} />
                    {editing && (
                        <>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }} onWheel={(e) => e.stopPropagation()}>
                                {slider(0)}
                                {slider(1)}
                                <div style={{ fontSize: 11, color: ctx.theme.node.muted, display: "flex", justifyContent: "space-between" }}>
                                    <span>起点 {range[0]}%</span>
                                    <span>选中 {(range[1] - range[0]).toFixed(0)}% · {((buffer.duration * (range[1] - range[0])) / 100).toFixed(1)}s</span>
                                    <span>终点 {range[1]}%</span>
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <button type="button" onClick={() => (playing ? stopPlay() : playClip())} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: `1px solid ${ctx.theme.node.stroke}`, background: ctx.theme.toolbar.panel, color: ctx.theme.node.text, cursor: "pointer", fontSize: 12 }}>
                                    {playing ? "■ 停止" : "▶ 试听片段"}
                                </button>
                                <button type="button" onClick={exportClip} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: `1px solid ${ctx.theme.node.stroke}`, background: ctx.theme.toolbar.panel, color: ctx.theme.node.text, cursor: "pointer", fontSize: 12 }}>
                                    导出裁剪音频
                                </button>
                            </div>
                        </>
                    )}
                </>
            ) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: src ? ctx.theme.node.muted : ctx.theme.node.placeholder, fontSize: 12 }}>{src ? "解码音频中…" : "连接一个上游音频节点"}</div>
            )}
        </div>
    );
}

export default definePlugin({
    id: "audio-wave",
    name: "音频波形裁剪",
    version: "1.0.0",
    description: "查看上游音频波形,框选片段试听并导出 WAV",
    nodes: [
        {
            type: "audio-wave:wave",
            title: "音频波形裁剪",
            icon: "〰️",
            description: "波形查看与片段裁剪",
            defaultSize: { width: 420, height: 260 },
            defaultMetadata: { clipRange: [0, 100] },
            minimapColor: "#10b981",
            hidePanel: true,
            interactionToggle: true,
            forceInteractive: (node) => Boolean(node.metadata?.editing),
            Content: WaveContent,
            toolbar: (ctx) => {
                const editing = Boolean(ctx.node.metadata?.editing);
                return [{ id: "wave-toggle", title: editing ? "完成裁剪" : "裁剪音频", label: editing ? "完成" : "裁剪", icon: editing ? "✓" : "✂", active: editing, onClick: () => ctx.updateMetadata({ editing: !editing }) }];
            },
        },
    ],
});
