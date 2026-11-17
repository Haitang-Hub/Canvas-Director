import { useAgentStore, type AgentPageContext } from "@/stores/use-agent-store";

/** Agent 面板停靠左右侧且可见时，页面内容需要让出的宽度（悬浮或隐藏时两侧均为 0）。 */
export function useAgentDockReserve(context: AgentPageContext = "canvas") {
    const panelOpen = useAgentStore((state) => state.panelOpen);
    const panelClosing = useAgentStore((state) => state.panelClosing);
    const panelMounted = useAgentStore((state) => state.panelMounted);
    const width = useAgentStore((state) => state.width);
    const savedLayout = useAgentStore((state) => state.panelLayout);
    // 与 AgentPanel 的 savedLayout ?? defaultLayout 对齐，持久化旧数据可能没有 panelLayout。
    const mode = savedLayout?.mode ?? (context === "director" ? "float" : "right");
    if (!panelMounted || (!panelOpen && !panelClosing) || mode === "float") return { left: 0, right: 0 };
    return mode === "left" ? { left: width, right: 0 } : { left: 0, right: width };
}
