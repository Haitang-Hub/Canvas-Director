import { createContext, useContext, type PointerEventHandler } from "react";

/** 统一面板外壳：内嵌面板通过它把标题栏变成拖拽把手。 */
export type AgentPanelShell = {
    dragHandlers?: { onPointerDown: PointerEventHandler<HTMLElement>; onPointerMove: PointerEventHandler<HTMLElement>; onPointerUp: PointerEventHandler<HTMLElement>; onPointerCancel: PointerEventHandler<HTMLElement> };
};

export const AgentPanelShellContext = createContext<AgentPanelShell | null>(null);

export function useAgentPanelShell() {
    return useContext(AgentPanelShellContext);
}
