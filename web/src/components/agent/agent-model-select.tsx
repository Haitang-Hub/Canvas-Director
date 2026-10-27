import { ChevronUp } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { canvasThemes } from "@/lib/canvas-theme";
import { encodeChannelModel, resolveModelRequestConfig, useConfigStore } from "@/stores/use-config-store";
import { useAgentStore } from "@/stores/use-agent-store";

/** 浏览器内置 Agent 的对话模型选择：模型名后附「（渠道名）」平铺列出，写入全局 textModel。 */
export function AgentTextModelSelect({ theme }: { theme: (typeof canvasThemes)[keyof typeof canvasThemes] }) {
    const config = useConfigStore((state) => state.config);
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const popover = useAgentStore((state) => state.composerPopover);
    const setAgentState = useAgentStore((state) => state.setAgentState);
    const options = config.channels.flatMap((channel) => {
        // 优先列 text 类模型；渠道里没有标注 text 时整渠道兜底（capability 猜测可能不准）
        const models = channel.models.filter((model) => model.capability === "text");
        const suffix = channel.name ? `（${channel.name}）` : "";
        return (models.length ? models : channel.models).map((model) => ({ value: encodeChannelModel(channel.id, model.name), label: `${model.name}${suffix}` }));
    });
    let currentLabel = "";
    try {
        currentLabel = resolveModelRequestConfig(config, config.textModel).model || "";
    } catch {
        currentLabel = "";
    }
    if (!options.length) {
        return (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium" style={{ color: theme.node.muted }} title="先在「模型配置」里添加 text 渠道">
                <span className="truncate">未配置 text 渠道</span>
            </span>
        );
    }
    return (
        <Select value={config.textModel} open={popover === "model"} onOpenChange={(next) => setAgentState({ composerPopover: next ? "model" : "" })} onValueChange={(value) => updateConfig("textModel", value)}>
            <SelectTrigger
                hideChevron
                className="h-9 w-auto min-w-36 max-w-36 justify-start gap-1.5 rounded-full border-0 bg-transparent px-2.5 text-xs font-medium shadow-none hover:bg-black/5 focus:ring-0 dark:bg-transparent dark:hover:bg-white/10"
                aria-label="选择对话模型"
            >
                <span className="min-w-0 flex-1 truncate text-left">{currentLabel || "选择对话模型"}</span>
                <ChevronUp className="size-3 shrink-0 opacity-50" />
            </SelectTrigger>
            <SelectContent data-canvas-no-zoom position="popper" side="top" align="start" sideOffset={6} className="z-[1200] max-h-[min(var(--radix-select-content-available-height),24rem)] w-64 rounded-xl border border-border/70 bg-popover p-1 shadow-xl">
                {options.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="py-2.5 text-xs">
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
