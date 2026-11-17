import i18n from "@/i18n";
import type { PromptSource } from "./prompt-source-presets";

export type RawPrompt = {
    id: string;
    title: string;
    prompt: string;
    description: string;
    coverUrl: string;
    referenceImageUrls: string[];
    tags: string[];
    preview: string;
    createdAt: string;
    updatedAt: string;
    author?: string;
    sourceUrl?: string;
    imageMode?: string;
    imageModel?: string;
    imageSize?: string;
    imageCount?: number;
};

type RunOptions = { signal?: AbortSignal };

class PromptSourceHttpError extends Error {
    constructor(readonly status: number) {
        super(`HTTP ${status}`);
    }
}

async function fetchSourceText(url: string, options?: RunOptions) {
    const response = await fetch(url, { cache: "no-store", signal: options?.signal });
    if (!response.ok) throw new PromptSourceHttpError(response.status);
    return response.text();
}

// README_zh.md 这类本地化文件 404 时回退 README.md。
function readmeFallbackUrl(url: string) {
    const match = /\/(README[^/]*?)\.md($|[?#])/.exec(url);
    return match && match[1] !== "README" ? url.replace(/\/README[^/]*?\.md/, "/README.md") : "";
}

async function loadSourceText(source: PromptSource, options?: RunOptions) {
    try {
        return await fetchSourceText(source.url, options);
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        const fallbackUrl = error instanceof PromptSourceHttpError && error.status === 404 ? readmeFallbackUrl(source.url) : "";
        if (!fallbackUrl) throw wrapFetchError(source, error);
        try {
            return await fetchSourceText(fallbackUrl, options);
        } catch (fallbackError) {
            if (fallbackError instanceof DOMException && fallbackError.name === "AbortError") throw fallbackError;
            throw wrapFetchError(source, fallbackError);
        }
    }
}

function wrapFetchError(source: PromptSource, error: unknown) {
    return new Error(i18n.t("config.promptSources.runtime.fetchFailed", { name: source.name, error: error instanceof Error ? error.message : String(error) }));
}

export async function runPromptSource(source: PromptSource, options?: RunOptions): Promise<RawPrompt[]> {
    if (!source.url.trim()) throw new Error(i18n.t("config.promptSources.runtime.urlRequired"));
    const text = await loadSourceText(source, options);
    const items = parseSourceText(text, source);
    if (!items.length) throw new Error(i18n.t("config.promptSources.runtime.noPrompts", { name: source.name }));
    return items;
}

// 先按 JSON 数组解析（URL 指向 .json 时），解析失败自动落到 README 条目解析。
function parseSourceText(text: string, source: PromptSource): RawPrompt[] {
    const trimmed = text.trim();
    if (trimmed.startsWith("[")) {
        try {
            const data = JSON.parse(trimmed) as unknown;
            if (Array.isArray(data)) return normalizeItems(data, source);
        } catch {
            // 非 JSON 数组，按 README 解析
        }
    }
    return parseReadmeSource(text, source);
}

// README 按「### No. N: 标题」切条（到下一个任意 ### 标题为止），条目内按 emoji 定位段落（📝 提示词 / 📖 描述 / 🖼️ 图片 / 🎬 视频）。
function parseReadmeSource(text: string, source: PromptSource): RawPrompt[] {
    const headingRe = /^###\s+(.+?)\s*$/gm;
    const headings = [...text.matchAll(headingRe)];
    const items: RawPrompt[] = [];
    headings.forEach((heading, position) => {
        const numbered = /^No\.\s*(\d+)\s*[:：]\s*(.+)$/.exec(heading[1]);
        if (!numbered) return;
        const start = (heading.index || 0) + heading[0].length;
        const body = text.slice(start, position + 1 < headings.length ? headings[position + 1].index : undefined);
        const title = numbered[2].trim();
        const prompt = readmePrompt(body);
        if (!title || !prompt) return;
        items.push({
            id: `${source.id}-${numbered[1]}`,
            title,
            prompt,
            description: readmeSection(body, "📖"),
            coverUrl: absoluteUrl(source.url, readmeCover(body)),
            referenceImageUrls: [],
            tags: readmeBadges(body),
            preview: "",
            createdAt: "",
            updatedAt: "",
            author: readmeAuthor(body),
        });
    });
    return items;
}

function readmeSection(body: string, emoji: string) {
    const start = body.indexOf(`#### ${emoji}`);
    if (start < 0) return "";
    const rest = body.slice(start + `#### ${emoji}`.length).replace(/^[^\n]*\n/, "");
    const end = rest.indexOf("\n#### ");
    return (end >= 0 ? rest.slice(0, end) : rest).trim();
}

function readmePrompt(body: string) {
    const section = readmeSection(body, "📝");
    const fence = /```[^\n]*\n([\s\S]*?)```/.exec(section);
    return (fence ? fence[1] : section).trim();
}

function readmeCover(body: string) {
    const section = readmeSection(body, "🖼") || readmeSection(body, "🎬");
    const urls = readmeImageUrls(section || body);
    return urls[0] || "";
}

function readmeImageUrls(markdown: string) {
    return [...markdown.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)/g)].map((match) => match[1]).filter((url) => !/img\.shields\.io|awesome\.re|star-history/.test(url));
}

function readmeBadges(body: string) {
    const tags = new Set<string>();
    for (const match of body.matchAll(/!\[([^\]]*)\]\(https?:\/\/img\.shields\.io[^)]*\)/g)) {
        const label = match[1].trim();
        if (label) tags.add(label);
    }
    return [...tags].slice(0, 6);
}

function readmeAuthor(body: string) {
    const match = /\*\*(?:作者|Author)\s*:?\*\*\s*\[([^\]]+)\]/.exec(body);
    return match?.[1]?.trim() || "";
}

function normalizeItems(values: unknown[], source: PromptSource) {
    const seen = new Set<string>();
    const items: RawPrompt[] = [];
    values.forEach((value, index) => {
        const record = asRecord(value);
        const title = stringValue(record.title).trim();
        const prompt = stringValue(record.prompt).trim();
        if (!title || !prompt) return;
        const id = stringValue(record.id).trim() || `${source.id}-${leftPad(index + 1)}`;
        if (seen.has(id)) return;
        seen.add(id);
        const referenceImageUrls = stringArray(record.referenceImageUrls).map((url) => absoluteUrl(source.url, url));
        const coverUrl = absoluteUrl(source.url, stringValue(record.coverUrl)) || referenceImageUrls[0] || "";
        items.push({
            id,
            title,
            prompt,
            description: stringValue(record.description),
            coverUrl,
            referenceImageUrls,
            tags: stringArray(record.tags),
            preview: stringValue(record.preview),
            createdAt: stringValue(record.createdAt),
            updatedAt: stringValue(record.updatedAt),
            author: stringValue(record.author),
            sourceUrl: absoluteUrl(source.url, stringValue(record.sourceUrl)),
            imageMode: optionalString(record.imageMode),
            imageModel: optionalString(record.imageModel),
            imageSize: optionalString(record.imageSize),
            imageCount: optionalNumber(record.imageCount),
        });
    });
    return items;
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown) {
    return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function stringArray(value: unknown) {
    return Array.isArray(value) ? value.map(stringValue).map((item) => item.trim()).filter(Boolean) : [];
}

function optionalString(value: unknown) {
    const result = stringValue(value).trim();
    return result || undefined;
}

function optionalNumber(value: unknown) {
    const result = Number(value);
    return Number.isFinite(result) && result > 0 ? result : undefined;
}

function absoluteUrl(baseUrl: string, path: string) {
    if (!path) return "";
    try {
        return new URL(path, baseUrl).toString();
    } catch {
        return path;
    }
}

function leftPad(value: number) {
    return String(value).padStart(4, "0");
}
