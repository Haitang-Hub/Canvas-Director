import { ChevronUp, Cpu } from "lucide-react";

import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger } from "@/components/ui/select";
import { canvasThemes } from "@/lib/canvas-theme";
import { encodeChannelModel, resolveModelRequestConfig, useConfigStore } from "@/stores/use-config-store";

/** 浏览器内置 Agent 的对话模型选择：按渠道分组列出 text 模型，写入全局 textModel。 */
export function AgentTextModelSelect({ theme }: { theme: (typeof canvasThemes)[keyof typeof canvasThemes] }) {
    const config = useConfigStore((state) => state.config);
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const options = config.channels.flatMap((channel) => {
        // 优先列 text 类模型；渠道里没有标注 text 时整渠道兜底（capability 猜测可能不准）
        const models = channel.models.filter((model) => model.capability === "text");
        const list = (models.length ? models : channel.models).map((model) => ({ value: encodeChannelModel(channel.id, model.name), label: model.name }));
        return list.length ? [{ channel, list }] : [];
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
                <Cpu className="size-3.5 shrink-0 opacity-70" />
                <span className="truncate">未配置 text 渠道</span>
            </span>
        );
    }
    return (
        <Select value={config.textModel} onValueChange={(value) => updateConfig("textModel", value)}>
            <SelectTrigger
                hideChevron
                className="h-9 max-w-48 justify-start gap-1.5 rounded-full border-0 bg-transparent px-2.5 text-xs font-medium shadow-none hover:bg-black/5 focus:ring-0 dark:bg-transparent dark:hover:bg-white/10"
                aria-label="选择对话模型"
                title={currentLabel ? `对话模型：${currentLabel}` : "选择对话模型"}
            >
                <Cpu className="size-3.5 shrink-0 opacity-70" />
                <span className="min-w-0 flex-1 truncate text-left">{currentLabel || "选择对话模型"}</span>
                <ChevronUp className="size-3 shrink-0 opacity-50" />
            </SelectTrigger>
            <SelectContent data-canvas-no-zoom position="popper" side="top" align="start" sideOffset={6} className="z-[1200] w-64 rounded-xl border border-border/70 bg-popover p-1 shadow-xl">
                {options.map(({ channel, list }) => (
                    <SelectGroup key={channel.id}>
                        <SelectLabel>{channel.name || "未命名渠道"}</SelectLabel>
                        {list.map((option) => (
                            <SelectItem key={option.value} value={option.value} className="text-xs">
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                ))}
            </SelectContent>
        </Select>
    );
}
