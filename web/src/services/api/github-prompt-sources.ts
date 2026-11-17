import type { PromptSourceMediaType } from "./prompt-source-presets";

export type GithubPromptRepo = {
    name: string;
    description: string;
    stars: number;
    topics: string[];
    mediaType: PromptSourceMediaType;
};

export const GITHUB_PROMPT_ORG = "YouMind-OpenLab";

const VIDEO_REPO_KEYWORDS = ["seedance", "grok-imagine", "sora", "veo", "video"];

// api.github.com 被网络封锁或限流时，选择器回退到这份 YouMind-OpenLab 内置仓库清单。
export const FALLBACK_GITHUB_PROMPT_REPOS: GithubPromptRepo[] = [
    { name: "awesome-nano-banana-pro-prompts", stars: 13778, mediaType: "image", description: "🍌 World's largest Nano Banana Pro prompt library — 10,000+ curated prompts with preview images, 16 languages. Google Gemini AI image generation. Free & open source.", topics: ["ai-image-generation", "ai-prompts", "awesome", "awesome-list", "gemini", "google-gemini", "nano-banana-pro", "prompts"] },
    { name: "awesome-gpt-image-2", stars: 10283, mediaType: "image", description: "🚀 World's largest GPT Image 2 prompt library, updated daily — 2000+ curated prompts with preview images, 16 languages. OpenAI's next-gen image model with pixel-perfect text rendering.", topics: ["ai-image-generation", "ai-prompts", "awesome", "awesome-list", "gpt-image", "gpt-image-2", "image-generation", "openai", "prompts"] },
    { name: "awesome-seedance-2-prompts", stars: 2218, mediaType: "video", description: "🎬 2000+ curated Seedance 2.0 video generation prompts — cinematic, anime, UGC, ads, meme styles. Includes Seedance API guides, character consistency tips, and a prompt engineering library.", topics: ["ai-video", "awesome", "awesome-list", "prompt-engineering", "seedance", "seedance-2", "video-generation", "video-prompt"] },
    { name: "awesome-gemini-3-prompts", stars: 522, mediaType: "image", description: "♊ 50+ selected Gemini prompts with images, multilingual support, and instant gallery preview. Open-source prompt engineering library", topics: ["ai", "awesome-list", "gemini-ai", "prompts"] },
    { name: "awesome-seedream-4.5", stars: 64, mediaType: "image", description: "🍌 100+ hand-picked Seedream 4.5 prompts with images, multilingual support, and instant gallery preview. The best Nano Banana Pro alternative — only 1/3 the cost. Open-source prompt engineering library.", topics: ["awesome", "bytedance", "nano-banana-2", "nano-banana-pro", "prompt-engineering"] },
    { name: "awesome-grok-imagine-prompts", stars: 61, mediaType: "video", description: "🎬 Curated Grok Imagine (xAI) video generation prompts — cinematic, action, anime, product, meme styles. Includes prompt engineering tips, style guides, and community contributions.", topics: ["ai", "ai-video", "awesome", "grok", "grok-imagine", "prompts", "text-to-video", "video-generation", "xai"] },
    { name: "awesome-gpt-image-1.5", stars: 26, mediaType: "image", description: "🎨 100+ selected GPT Image 1.5 prompts with images, multilingual support, and instant gallery preview. Open-source prompt engineering library", topics: ["awesome", "gpt-image", "gpt-image-1-5", "prompt", "prompt-engineering"] },
    { name: "awesome-christmas-card-prompts", stars: 6, mediaType: "image", description: "🍌 A curated collection of high-quality Christmas card prompts designed for Nano Banana Pro and modern image generation models.", topics: ["awesome", "awesome-list", "christmas", "christmas-card", "image-generation", "nano-banana-pro", "prompts"] },
];

export function githubRepoUrl(org: string, repo: string) {
    return `https://github.com/${org}/${repo}`;
}

export function githubReadmeUrl(org: string, repo: string, language: string) {
    return `https://raw.githubusercontent.com/${org}/${repo}/main/${readmeFileName(language)}`;
}

// README 语言跟随界面语言；本地化 README 404 时由运行时回退 README.md。
export function readmeFileName(language: string) {
    const lang = language.toLowerCase();
    if (lang.startsWith("zh-tw") || lang.startsWith("zh-hant") || lang.startsWith("zh-hk")) return "README_zh-TW.md";
    if (lang.startsWith("zh")) return "README_zh.md";
    return "README.md";
}

export function inferPromptMediaType(name: string, topics: string[] = []): PromptSourceMediaType {
    const value = `${name} ${topics.join(" ")}`.toLowerCase();
    return VIDEO_REPO_KEYWORDS.some((keyword) => value.includes(keyword)) ? "video" : "image";
}

export async function fetchGithubPromptRepos(org: string): Promise<GithubPromptRepo[]> {
    const response = await fetch(`https://api.github.com/orgs/${encodeURIComponent(org)}/repos?per_page=100&sort=updated`, { headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) throw new Error(`GitHub API ${response.status}`);
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error("GitHub API response is not a list");
    const repos = data.flatMap((item) => {
        const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        const name = typeof record.name === "string" ? record.name : "";
        const topics = Array.isArray(record.topics) ? record.topics.filter((topic): topic is string => typeof topic === "string") : [];
        if (!name || !isPromptRepo(name, topics)) return [];
        return [{
            name,
            description: typeof record.description === "string" ? record.description : "",
            stars: typeof record.stargazers_count === "number" ? record.stargazers_count : 0,
            topics,
            mediaType: inferPromptMediaType(name, topics),
        }];
    });
    return repos.sort((a, b) => b.stars - a.stars);
}

function isPromptRepo(name: string, topics: string[]) {
    const value = `${name} ${topics.join(" ")}`.toLowerCase();
    return value.includes("prompt");
}
