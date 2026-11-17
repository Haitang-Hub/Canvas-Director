import { nanoid } from "nanoid";

export type PromptSourceMediaType = "image" | "video";

export type PromptSource = {
    id: string;
    name: string;
    url: string;
    homepage: string;
    mediaType: PromptSourceMediaType;
    enabled: boolean;
    builtIn: boolean;
};

export function createPromptSource(source?: Partial<PromptSource>): PromptSource {
    return {
        id: source?.id?.trim() || nanoid(),
        name: source?.name?.trim() || "",
        url: source?.url?.trim() || "",
        homepage: source?.homepage?.trim() || "",
        mediaType: source?.mediaType === "video" ? "video" : "image",
        enabled: source?.enabled ?? true,
        builtIn: source?.builtIn ?? false,
    };
}

// 不内置任何默认来源；提示词库通过「从 GitHub 选择」（默认组织 YouMind-OpenLab，含内置仓库兜底清单）或「自定义来源」按需添加。
// 历史上以内置身份持久化的来源会在 store merge 时自动清空（不在默认清单内即被丢弃）。
export const DEFAULT_PROMPT_SOURCES: PromptSource[] = [];
