import { Button, Popover, Slider, Tooltip } from "antd";
import { Droplets } from "lucide-react";
import { useTranslation } from "react-i18next";

import { canvasThemes } from "@/lib/canvas-theme";
import { useAgentStore } from "@/stores/use-agent-store";

/** 统一面板外观设置：调节毛玻璃效果的透明度（数值越小面板越透明、背景虚化越明显）。 */
export function AgentAppearanceButton({ theme }: { theme: (typeof canvasThemes)[keyof typeof canvasThemes] }) {
    const { t } = useTranslation();
    const glassOpacity = useAgentStore((state) => state.glassOpacity);
    const setAgentState = useAgentStore((state) => state.setAgentState);
    return (
        <Popover
            trigger="click"
            placement="topRight"
            content={
                <div className="w-60 p-1">
                    <div className="mb-2 text-sm font-medium">{t("agent.composer.appearanceTitle")}</div>
                    <div className="mb-1.5 flex items-center justify-between text-xs" style={{ color: theme.node.muted }}>
                        <span>{t("agent.composer.glassOpacityLabel")}</span>
                        <span className="tabular-nums">{glassOpacity}%</span>
                    </div>
                    <Slider
                        min={20}
                        max={100}
                        step={5}
                        value={glassOpacity}
                        onChange={(value) => {
                            localStorage.setItem("canvas-agent-glass-opacity", String(value));
                            setAgentState({ glassOpacity: value });
                        }}
                    />
                    <div className="mt-1 text-[11px] leading-4" style={{ color: theme.node.muted }}>
                        {t("agent.composer.glassOpacityHint")}
                    </div>
                </div>
            }
        >
            <Tooltip title={t("agent.composer.appearanceTitle")} placement="top">
                <Button type="text" shape="circle" className="!h-9 !w-9 !min-w-9" style={{ color: theme.node.text }} icon={<Droplets className="size-4" />} aria-label={t("agent.composer.appearanceTitle")} />
            </Tooltip>
        </Popover>
    );
}
