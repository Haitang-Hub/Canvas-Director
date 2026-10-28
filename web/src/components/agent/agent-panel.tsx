import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { LocalAgentPanel } from "./local-agent-panel";
import { AgentPanelShellContext } from "./agent-panel-shell";
import { canvasThemes } from "@/lib/canvas-theme";
import { AGENT_PANEL_FLOAT_WIDTH, savePanelLayout, useAgentStore, type AgentPageContext, type AgentPanelLayout } from "@/stores/use-agent-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { flushBrowserChat } from "@/services/agent-chat-storage";

const DOCK_SNAP_DISTANCE = 10;
const FLOAT_HEIGHT = Math.min(typeof window === "undefined" ? 680 : window.innerHeight * 0.72, 680);
const FLOAT_MIN_WIDTH = 320;
const FLOAT_MIN_HEIGHT = 320;

function defaultLayout(context: AgentPageContext): AgentPanelLayout {
    if (context === "director") {
        return { mode: "float", x: Math.max(8, window.innerWidth - AGENT_PANEL_FLOAT_WIDTH - 24), y: Math.max(8, Math.round(window.innerHeight * 0.16)) };
    }
    return { mode: "right", x: 0, y: 0 };
}

/** 统一 Agent 浮动面板：可停靠左右（磁性吸附）、拖动标题栏可自由拖拽/脱离停靠；画布页与导演台页共用。 */
export function AgentPanel({ context = "canvas" }: { context?: AgentPageContext }) {
    const { t } = useTranslation();
    const theme = context === "director" ? canvasThemes.dark : canvasThemes[useThemeStore((state) => state.theme)];
    const width = useAgentStore((state) => state.width);
    const panelOpen = useAgentStore((state) => state.panelOpen);
    const panelMounted = useAgentStore((state) => state.panelMounted);
    const panelClosing = useAgentStore((state) => state.panelClosing);
    const savedLayout = useAgentStore((state) => state.panelLayout);
    const glassOpacity = useAgentStore((state) => state.glassOpacity);
    const setAgentState = useAgentStore((state) => state.setAgentState);
    const [dragging, setDragging] = useState(false);
    const [resizing, setResizing] = useState(false);
    const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
    const layout = savedLayout ?? defaultLayout(context);
    const docked = layout.mode !== "float";
    const floatWidth = layout.width ?? AGENT_PANEL_FLOAT_WIDTH;
    const floatHeight = layout.height ?? FLOAT_HEIGHT;
    // 拖动中按松手判定规则实时预测停靠目标，遮罩尺寸与松手后的停靠面板完全一致（全高 × 停靠宽度）
    const dockPreview = dragging && !docked
        ? layout.x < DOCK_SNAP_DISTANCE ? "left" : layout.x + floatWidth > window.innerWidth - DOCK_SNAP_DISTANCE ? "right" : null
        : null;

    useEffect(() => {
        setAgentState({ pageContext: context });
        return () => flushBrowserChat(context);
    }, [context, setAgentState]);

    // 唤出保险：持久化的浮动位置若落在当前视口外（换窗口/屏幕尺寸后），自动拉回可见区域
    useEffect(() => {
        if (!panelOpen || docked) return;
        const x = Math.min(Math.max(layout.x, 8), Math.max(8, window.innerWidth - floatWidth - 8));
        const y = Math.min(Math.max(layout.y, 8), Math.max(8, window.innerHeight - floatHeight - 8));
        if (x === layout.x && y === layout.y) return;
        const next = { ...layout, x, y };
        setAgentState({ panelLayout: next });
        savePanelLayout(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [panelOpen]);

    function updateLayout(patch: Partial<AgentPanelLayout>) {
        const next = { ...layout, ...patch };
        setAgentState({ panelLayout: next });
        savePanelLayout(next);
    }

    const onHeaderPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
        if (event.button !== 0) return;
        const target = event.target as HTMLElement;
        if (target.closest("button")) return; // 标题栏上的按钮不触发拖动
        const rect = event.currentTarget.closest("[data-agent-panel-root]")?.getBoundingClientRect();
        if (!rect) return;
        dragRef.current = { pointerId: event.pointerId, offsetX: event.clientX - rect.x, offsetY: event.clientY - rect.y };
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
            // 某些环境的合成/无效 pointerId 不支持捕获，拖动仍可工作
        }
        setDragging(true);
        // 停靠态拖动标题：先脱离为浮动（位置保持原位），后续移动交给 pointermove
        if (docked) updateLayout({ mode: "float", x: rect.x, y: 0 });
    };

    const onHeaderPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const x = Math.min(Math.max(event.clientX - drag.offsetX, -floatWidth + 80), window.innerWidth - 80);
        const y = Math.min(Math.max(event.clientY - drag.offsetY, 0), window.innerHeight - 48);
        updateLayout({ mode: "float", x, y });
    };

    const onHeaderPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        // 直接由指针坐标计算最终位置：不读 DOM rect（React 异步刷帧时 rect 可能还是拖动前的）
        const left = event.clientX - drag.offsetX;
        const top = event.clientY - drag.offsetY;
        dragRef.current = null;
        setDragging(false);
        // 磁性吸附：接近左右边缘时停靠
        if (left < DOCK_SNAP_DISTANCE) updateLayout({ mode: "left", x: 0, y: 0 });
        else if (left + floatWidth > window.innerWidth - DOCK_SNAP_DISTANCE) updateLayout({ mode: "right", x: 0, y: 0 });
        else updateLayout({ mode: "float", x: Math.min(Math.max(left, 8), window.innerWidth - floatWidth - 8), y: Math.min(Math.max(top, 8), window.innerHeight - 56) });
    };

    const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = width;
        let nextWidth = startWidth;
        const onMove = (moveEvent: PointerEvent) => {
            nextWidth = Math.min(760, Math.max(360, startWidth + (layout.mode === "right" ? startX - moveEvent.clientX : moveEvent.clientX - startX)));
            setAgentState({ width: nextWidth });
        };
        const onUp = () => {
            localStorage.setItem("canvas-agent-panel-width", String(nextWidth));
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            setResizing(false);
        };
        setResizing(true);
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    };

    // 浮动态右下角手柄：等比自由调整宽高，左上角锚点不变
    const startCornerResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        const startX = event.clientX;
        const startY = event.clientY;
        const startWidth = floatWidth;
        const startHeight = floatHeight;
        let next: AgentPanelLayout | null = null;
        const onMove = (moveEvent: PointerEvent) => {
            const width = Math.min(window.innerWidth - layout.x - 8, Math.max(FLOAT_MIN_WIDTH, startWidth + moveEvent.clientX - startX));
            const height = Math.min(window.innerHeight - layout.y - 8, Math.max(FLOAT_MIN_HEIGHT, startHeight + moveEvent.clientY - startY));
            next = { ...layout, width, height };
            setAgentState({ panelLayout: next });
        };
        const onUp = () => {
            if (next) savePanelLayout(next);
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            setResizing(false);
        };
        setResizing(true);
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    };

    if (!panelMounted) return null;

    const shell = {
        dragHandlers: { onPointerDown: onHeaderPointerDown, onPointerMove: onHeaderPointerMove, onPointerUp: onHeaderPointerUp, onPointerCancel: onHeaderPointerUp },
    };

    const visible = panelOpen && !panelClosing;
    const translucent = glassOpacity < 100;
    const positionStyle: CSSProperties =
        layout.mode === "float"
            ? { left: layout.x, top: layout.y, width: floatWidth, height: floatHeight }
            : layout.mode === "left"
                ? { left: 0, top: 0, bottom: 0, width }
                : { right: 0, top: 0, bottom: 0, width };

    return (
        <AgentPanelShellContext.Provider value={shell}>
            {dockPreview ? (
                <div
                    aria-hidden
                    className={`pointer-events-none fixed inset-y-0 z-[69] border-2 border-dashed ${dockPreview === "left" ? "left-0" : "right-0"}`}
                    style={{ width, borderColor: theme.node.activeStroke, background: `color-mix(in srgb, ${theme.node.activeStroke} 14%, transparent)` }}
                />
            ) : null}
            <motion.div
                data-agent-panel-root
                data-canvas-shortcuts-ignore
                className={`fixed z-[70] overflow-hidden ${dragging ? "select-none" : ""}`}
                initial={false}
                animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 12 }}
                transition={{ duration: resizing || dragging ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
                style={{ ...positionStyle, pointerEvents: visible ? undefined : "none", borderRadius: docked ? 0 : 16, background: translucent ? `color-mix(in srgb, ${theme.node.panel} ${glassOpacity}%, transparent)` : theme.node.panel, backdropFilter: translucent ? "blur(20px)" : undefined, WebkitBackdropFilter: translucent ? "blur(20px)" : undefined, border: `1px solid ${theme.node.stroke}`, color: theme.node.text }}
                role="dialog"
                aria-label="Agent"
            >
                {docked ? (
                    <button
                        type="button"
                        className={`absolute inset-y-0 z-40 w-4 cursor-col-resize ${layout.mode === "right" ? "-left-2" : "-right-2"}`}
                        onPointerDown={startResize}
                        aria-label={t("agent.panel.resize")}
                    />
                ) : (
                    <button
                        type="button"
                        className="absolute bottom-0 right-0 z-40 flex size-5 cursor-nwse-resize items-end justify-end rounded-br-2xl p-0.5 opacity-50 transition-opacity hover:opacity-100"
                        style={{ color: theme.node.stroke }}
                        onPointerDown={startCornerResize}
                        aria-label={t("agent.panel.resizeCorner")}
                    >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                            <path d="M9 1L1 9M9 5L5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    </button>
                )}
                <div className="flex h-full min-h-0 flex-col">
                    <LocalAgentPanel embedded />
                </div>
            </motion.div>
        </AgentPanelShellContext.Provider>
    );
}
