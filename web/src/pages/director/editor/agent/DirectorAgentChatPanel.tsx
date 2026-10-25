import { useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, ChevronUp, Magnet, Send, X } from "lucide-react";

import { encodeChannelModel, useConfigStore } from "@/stores/use-config-store";

import { useDirectorAgentChat } from "./useDirectorAgentChat";

/** 面板布局：停靠（左/右，磁性吸附）或自由浮动；位置持久化。 */
type PanelLayout = { mode: "left" | "right" | "float"; x: number; y: number; collapsed: boolean };

const LAYOUT_STORAGE_KEY = "director-agent-panel-layout-v1";
const DOCK_SNAP_DISTANCE = 56;
const FLOAT_WIDTH = 344;

function loadLayout(): PanelLayout {
    try {
        const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as Partial<PanelLayout>;
            if (parsed.mode === "left" || parsed.mode === "right" || parsed.mode === "float") {
                return { mode: parsed.mode, x: Number(parsed.x) || 80, y: Number(parsed.y) || 80, collapsed: Boolean(parsed.collapsed) };
            }
        }
    } catch {
        // 布局损坏时用默认值
    }
    return { mode: "right", x: 0, y: 0, collapsed: false };
}

function saveLayout(layout: PanelLayout) {
    try {
        localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    } catch {
        // 存储不可用时忽略
    }
}

/** 渲染一行工具执行记录（默认折叠为单行 chip，点击展开）。 */
function ToolChip({ name, summary, failed }: { name?: string; summary?: string; failed?: boolean }) {
    const [expanded, setExpanded] = useState(false);
    if (!name) return null;
    return (
        <button
            type="button"
            className={`director-agent-panel-tool${failed ? " is-error" : ""}${expanded ? " is-expanded" : ""}`}
            onClick={() => setExpanded((value) => !value)}
            title={summary}
        >
            {expanded ? summary : `⚙ ${name} · ${summary?.slice(0, 90) || "已执行"}`}
        </button>
    );
}

/** 底部对话模型选择：列出所有渠道的 text 模型，写入全局 textModel。 */
function AgentModelSelect() {
    const config = useConfigStore((state) => state.config);
    const updateConfig = useConfigStore((state) => state.updateConfig);
    return (
        <select
            className="director-agent-panel-model"
            value={config.textModel}
            onChange={(event) => updateConfig("textModel", event.target.value)}
            aria-label="选择对话模型"
            title="对话模型"
        >
            {config.channels.flatMap((channel) => {
                // 优先列 text 类模型；渠道里没有标注 text 时整渠道兜底（capability 猜测可能不准）
                const models = channel.models.filter((model) => model.capability === "text");
                const list = models.length ? models : channel.models;
                return list.length ? (
                    <optgroup key={channel.id} label={channel.name || "未命名渠道"}>
                        {list.map((model) => (
                            <option key={model.name} value={encodeChannelModel(channel.id, model.name)}>
                                {model.name}
                            </option>
                        ))}
                    </optgroup>
                ) : [];
            })}
        </select>
    );
}

/** 导演台内置 Agent 聊天面板：自由拖拽 + 左右磁性吸附的浮动窗口。 */
export function DirectorAgentChatPanel() {
    const open = useDirectorAgentChat((state) => state.open);
    const sending = useDirectorAgentChat((state) => state.sending);
    const messages = useDirectorAgentChat((state) => state.messages);
    const activity = useDirectorAgentChat((state) => state.activity);
    const setOpen = useDirectorAgentChat((state) => state.setOpen);
    const send = useDirectorAgentChat((state) => state.send);

    const [layout, setLayout] = useState<PanelLayout>(loadLayout);
    const [dragging, setDragging] = useState(false);
    const [draft, setDraft] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
    const panelRef = useRef<HTMLElement>(null);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [messages.length, activity, sending]);

    // 唤出保险：持久化的浮动位置若落在当前视口外（换窗口/屏幕尺寸后），自动拉回可见区域
    useEffect(() => {
        if (!open) return;
        setLayout((current) => {
            if (current.mode !== "float") return current;
            // 面板高度是 min(72vh, 680px)，钳制 top 使整个面板落在视口内
            const panelHeight = Math.min(window.innerHeight * 0.72, 680);
            const x = Math.min(Math.max(current.x, 8), Math.max(8, window.innerWidth - FLOAT_WIDTH - 8));
            const y = Math.min(Math.max(current.y, 8), Math.max(8, window.innerHeight - panelHeight - 8));
            if (x === current.x && y === current.y) return current;
            const next = { ...current, x, y };
            saveLayout(next);
            return next;
        });
    }, [open]);

    if (!open) return null;

    function updateLayout(patch: Partial<PanelLayout>) {
        setLayout((current) => {
            const next = { ...current, ...patch };
            saveLayout(next);
            return next;
        });
    }

    function onHeaderPointerDown(event: React.PointerEvent) {
        if (event.button !== 0) return;
        const target = event.target as HTMLElement;
        if (target.closest("button")) return; // 标题栏上的按钮不触发拖动
        const rect = panelRef.current?.getBoundingClientRect();
        if (!rect) return;
        dragRef.current = { pointerId: event.pointerId, offsetX: event.clientX - rect.x, offsetY: event.clientY - rect.y };
        try {
            (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        } catch {
            // 某些环境的合成/无效 pointerId 不支持捕获，拖动仍可工作
        }
        setDragging(true);
    }

    function onHeaderPointerMove(event: React.PointerEvent) {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const x = event.clientX - drag.offsetX;
        const y = event.clientY - drag.offsetY;
        const maxX = window.innerWidth - 80;
        const maxY = window.innerHeight - 48;
        setLayout((current) => ({ ...current, mode: "float", x: Math.min(Math.max(x, -FLOAT_WIDTH + 80), maxX), y: Math.min(Math.max(y, 0), maxY) }));
    }

    function onHeaderPointerUp(event: React.PointerEvent) {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        // 直接由指针坐标计算最终位置：不读 DOM rect（React 异步刷帧时 rect 可能还是拖动前的）
        const left = event.clientX - drag.offsetX;
        const top = event.clientY - drag.offsetY;
        dragRef.current = null;
        setDragging(false);
        // 磁性吸附：接近左右边缘时停靠
        setLayout((current) => {
            const right = left + FLOAT_WIDTH;
            let mode: PanelLayout["mode"];
            let x = 0;
            let y = 0;
            if (left < DOCK_SNAP_DISTANCE) {
                mode = "left";
            } else if (right > window.innerWidth - DOCK_SNAP_DISTANCE) {
                mode = "right";
            } else {
                mode = "float";
                x = Math.min(Math.max(left, 8), window.innerWidth - FLOAT_WIDTH - 8);
                y = Math.min(Math.max(top, 8), window.innerHeight - 56);
            }
            const next = { ...current, mode, x, y };
            saveLayout(next);
            return next;
        });
    }

    function submit() {
        const text = draft.trim();
        if (!text || sending) return;
        setDraft("");
        void send(text);
    }

    const docked = layout.mode !== "float";
    const floatStyle = layout.mode === "float" ? { left: layout.x, top: layout.y } : undefined;
    const showBody = !layout.collapsed;

    return (
        <aside
            ref={panelRef}
            className={`director-agent-panel ${docked ? "is-docked" : "is-floating"} ${layout.collapsed ? "is-collapsed" : ""} ${dragging ? "is-dragging" : ""}`}
            data-dock={docked ? layout.mode : undefined}
            style={floatStyle}
            role="dialog"
            aria-label="Agent"
        >
            <header
                className="director-agent-panel-header"
                title="拖动移动 · 靠近屏幕左右边缘自动吸附"
                onPointerDown={onHeaderPointerDown}
                onPointerMove={onHeaderPointerMove}
                onPointerUp={onHeaderPointerUp}
                onPointerCancel={onHeaderPointerUp}
            >
                <span className="director-agent-panel-title">
                    <Bot aria-hidden="true" size={15} className={docked ? "director-agent-panel-dock-hint" : ""} />
                    <span>Agent</span>
                </span>
                <button type="button" className="director-agent-panel-icon-button" aria-label={layout.collapsed ? "展开面板" : "折叠面板"} title={layout.collapsed ? "展开" : "折叠"} onClick={() => updateLayout({ collapsed: !layout.collapsed })}>
                    {layout.collapsed ? <ChevronUp aria-hidden="true" size={14} /> : <ChevronDown aria-hidden="true" size={14} />}
                </button>
                <button type="button" className="director-agent-panel-icon-button" aria-label="切换停靠位置" title={docked ? "拖离边缘切换为自由浮动" : "拖到屏幕边缘吸附停靠"} onClick={() => updateLayout(docked ? { mode: "float", x: Math.max(60, window.innerWidth / 2 - FLOAT_WIDTH / 2), y: 90 } : { mode: "right" })}>
                    <Magnet aria-hidden="true" size={14} className={docked ? "director-agent-panel-dock-hint" : ""} />
                </button>
                <button type="button" className="director-agent-panel-icon-button" aria-label="关闭 Agent" title="关闭" onClick={() => setOpen(false)}>
                    <X aria-hidden="true" size={15} />
                </button>
            </header>

            {showBody ? (
                <div className="director-agent-panel-body">
                    <div ref={scrollRef} className="director-agent-panel-messages">
                        {messages.length === 0 ? (
                            <div className="director-agent-panel-hint">
                                让我来帮你摆场景和运镜。试试：
                                <ul>
                                    <li>放两个角色面对面对话，再摆一个箱子</li>
                                    <li>给活动机位加一个环绕运镜</li>
                                    <li>渲染一帧看看现在的构图</li>
                                </ul>
                                拖动标题栏可把面板放到任意位置，靠近屏幕左右边缘会自动吸附停靠。
                            </div>
                        ) : (
                            messages.map((message) => {
                                if (message.role === "tool") return <ToolChip key={message.id} name={message.toolName} summary={message.toolSummary} failed={message.text !== "ok"} />;
                                if (message.role === "error") {
                                    return (
                                        <div key={message.id} className="director-agent-panel-bubble is-error">
                                            {message.text}
                                        </div>
                                    );
                                }
                                return (
                                    <div key={message.id} className={`director-agent-panel-bubble ${message.role === "user" ? "is-user" : "is-assistant"}`}>
                                        {message.text}
                                    </div>
                                );
                            })
                        )}
                    </div>
                    {sending ? <div className="director-agent-panel-activity">{activity || "处理中…"}</div> : null}
                    <div className="director-agent-panel-composer">
                        <div className="director-agent-panel-composer-row">
                            <textarea
                                className="director-agent-panel-input"
                                placeholder="描述想要的场景或镜头…"
                                rows={3}
                                value={draft}
                                onChange={(event) => setDraft(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                                        event.preventDefault();
                                        submit();
                                    }
                                }}
                            />
                            <button type="button" className="director-agent-panel-send" aria-label="发送" disabled={sending || !draft.trim()} onClick={submit}>
                                <Send aria-hidden="true" size={15} />
                            </button>
                        </div>
                        <AgentModelSelect />
                    </div>
                </div>
            ) : null}
        </aside>
    );
}

/** 顶栏「Agent」开关按钮。 */
export function DirectorAgentChatToggle() {
    const open = useDirectorAgentChat((state) => state.open);
    const toggle = useDirectorAgentChat((state) => state.toggle);
    return (
        <button
            className={`top-bar-motion-button${open ? " is-active" : ""}`}
            type="button"
            aria-label={open ? "关闭 Agent" : "打开 Agent"}
            aria-pressed={open}
            onClick={toggle}
        >
            <Bot aria-hidden="true" size={15} />
            Agent
        </button>
    );
}
