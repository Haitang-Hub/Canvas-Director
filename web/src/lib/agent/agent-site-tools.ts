import type { NavigateFunction } from "react-router-dom";

import i18n from "@/i18n";
import { fetchPromptSourceStatuses, fetchPrompts, fetchSourcePrompts, refreshAllSources, refreshSource } from "@/services/api/prompts";
import { createPromptSource } from "@/services/api/prompt-source-presets";
import { uploadImage } from "@/services/image-storage";
import { uploadMediaFile } from "@/services/file-storage";
import { syncAppDataToWebdav } from "@/services/app-sync";
import { testWebdavConnection } from "@/services/webdav-sync";
import { exportCanvasProjects } from "@/lib/canvas/canvas-export";
import { getNodePluginId, listNodeDefinitions } from "@/lib/canvas/node-registry";
import { imageAspectOptions, imageQualityOptions, imageScaleOptions } from "@/components/image-settings-panel";
import { videoResolutionOptions, videoSecondsRange, videoSizeOptions } from "@/components/video-settings-panel";
import type { CanvasAgentSnapshot } from "@/lib/canvas/canvas-agent-ops";
import { clampVideoSeconds } from "@/lib/media-size";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import { usePluginStore } from "@/stores/canvas/use-plugin-store";
import { useAssetStore } from "@/stores/use-asset-store";
import { modelOptionLabel, modelOptionName, normalizeModelOptionValue, selectableModelsByCapability, useConfigStore } from "@/stores/use-config-store";
import { usePromptSourceStore } from "@/stores/use-prompt-source-store";
import { useWorkbenchAgentStore } from "@/stores/use-workbench-agent-store";
import { ensureDirectorDeskRecordForId, ensureDirectorDeskRecords, writeActiveDirectorDeskId } from "@/pages/director/editor/workspaces/directorDeskRegistry";
import { openDirectorDeskFrame, setDirectorHostNavigate } from "@/lib/agent/director-desk-host";
import { CanvasNodeType } from "@/types/canvas";

// Execute site-level Agent tools in the browser, including canvas lists, workbench generation, prompt search, and asset operations.
// Their data lives locally in the browser through localforage and Zustand, so this module accesses the relevant stores directly.

export const SITE_TOOL_NAMES = [
    "canvas_list_projects",
    "generation_get_status",
    "stage_open",
    "workbench_image_get_config",
    "workbench_image_generate",
    "workbench_video_get_config",
    "workbench_video_generate",
    "prompts_search",
    "assets_list",
    "assets_add",
    "assets_update",
    "assets_delete",
    "prompts_sources_list",
    "prompts_source_update",
    "prompts_source_save",
    "prompts_source_delete",
    "canvas_create_project",
    "canvas_rename_project",
    "canvas_delete_projects",
    "canvas_export_project",
    "config_get_channels",
    "config_set_default_models",
    "webdav_sync",
    "plugin_list",
    "plugin_set_enabled",
    "canvas_list_node_types",
] as const;

export type SiteToolName = (typeof SITE_TOOL_NAMES)[number];

export function isSiteTool(name: string): name is SiteToolName {
    return (SITE_TOOL_NAMES as readonly string[]).includes(name);
}

function siteText(key: string, options?: Record<string, unknown>) {
    return i18n.t(`agent.siteTools.${key}`, options);
}

export const SITE_TOOL_LABELS: Record<SiteToolName, string> = {
    get canvas_list_projects() { return siteText("canvasList"); },
    get stage_open() { return siteText("stageOpen"); },
    get generation_get_status() { return siteText("generationStatus"); },
    get workbench_image_get_config() { return siteText("imageConfig"); },
    get workbench_image_generate() { return siteText("imageGenerate"); },
    get workbench_video_get_config() { return siteText("videoConfig"); },
    get workbench_video_generate() { return siteText("videoGenerate"); },
    get prompts_search() { return siteText("promptSearch"); },
    get assets_list() { return siteText("assetList"); },
    get assets_add() { return siteText("assetAdd"); },
    get assets_update() { return siteText("assetUpdate"); },
    get assets_delete() { return siteText("assetDelete"); },
    get prompts_sources_list() { return siteText("promptSourcesList"); },
    get prompts_source_update() { return siteText("promptSourceUpdate"); },
    get prompts_source_save() { return siteText("promptSourceSave"); },
    get prompts_source_delete() { return siteText("promptSourceDelete"); },
    get canvas_create_project() { return siteText("canvasCreate"); },
    get canvas_rename_project() { return siteText("canvasRename"); },
    get canvas_delete_projects() { return siteText("canvasDelete"); },
    get canvas_export_project() { return siteText("canvasExport"); },
    get config_get_channels() { return siteText("channelConfig"); },
    get config_set_default_models() { return siteText("setDefaultModels"); },
    get webdav_sync() { return siteText("webdavSync"); },
    get plugin_list() { return siteText("pluginList"); },
    get plugin_set_enabled() { return siteText("pluginSetEnabled"); },
    get canvas_list_node_types() { return siteText("nodeTypesList"); },
};

type SiteToolInput = Record<string, unknown>;
type SiteToolContext = { canvasSnapshot?: CanvasAgentSnapshot | null };
type GenerationStatus = "idle" | "queued" | "running" | "succeeded" | "failed";
type GenerationStatusItem = { id: string; source: "canvas" | "image" | "video"; status: GenerationStatus; kind?: string; title?: string; prompt?: string; projectId?: string; createdAt?: string; updatedAt?: string; successCount?: number; failCount?: number; error?: string };

export async function runSiteTool(name: SiteToolName, input: SiteToolInput, navigate: NavigateFunction, context: SiteToolContext = {}): Promise<unknown> {
    switch (name) {
        case "canvas_list_projects":
            return listCanvasProjects(input);
        case "stage_open":
            return openDirectorStage(input, navigate, context.canvasSnapshot);
        case "generation_get_status":
            return getGenerationStatus(input, context.canvasSnapshot);
        case "workbench_image_get_config":
            return getImageConfig();
        case "workbench_image_generate":
            return runImageWorkbench(input, navigate);
        case "workbench_video_get_config":
            return getVideoConfig();
        case "workbench_video_generate":
            return runVideoWorkbench(input, navigate);
        case "prompts_search":
            return searchPrompts(input);
        case "assets_list":
            return listAssets(input);
        case "assets_add":
            return addAsset(input);
        case "assets_update":
            return updateAsset(input);
        case "assets_delete":
            return deleteAssets(input);
        case "prompts_sources_list":
            return listPromptSources();
        case "prompts_source_update":
            return updatePromptSource(input);
        case "prompts_source_save":
            return savePromptSource(input);
        case "prompts_source_delete":
            return deletePromptSource(input);
        case "canvas_create_project":
            return createCanvasProject(input);
        case "canvas_rename_project":
            return renameCanvasProject(input, context.canvasSnapshot);
        case "canvas_delete_projects":
            return deleteCanvasProjects(input);
        case "canvas_export_project":
            return exportCanvasProject(input, context.canvasSnapshot);
        case "config_get_channels":
            return getChannelConfig();
        case "config_set_default_models":
            return setDefaultModels(input);
        case "webdav_sync":
            return syncWebdav(input);
        case "plugin_list":
            return listPlugins();
        case "plugin_set_enabled":
            return setPluginEnabled(input);
        case "canvas_list_node_types":
            return listNodeTypes();
        default:
            throw new Error(siteText("unknownTool", { name }));
    }
}

function getGenerationStatus(input: SiteToolInput, canvasSnapshot?: CanvasAgentSnapshot | null) {
    const scope = input.scope === "canvas" || input.scope === "image" || input.scope === "video" ? input.scope : "all";
    const taskId = typeof input.taskId === "string" ? input.taskId : "";
    const nodeIds = new Set(Array.isArray(input.nodeIds) ? input.nodeIds.filter((id): id is string => typeof id === "string") : []);
    const limit = Math.max(1, Math.min(100, Math.floor(Number(input.limit)) || 20));
    const tasks: GenerationStatusItem[] = [];
    const includeCanvas = (scope === "all" || scope === "canvas") && (!taskId || nodeIds.size > 0);
    const includeWorkbench = !nodeIds.size || Boolean(taskId);

    if (includeCanvas && canvasSnapshot) {
        canvasSnapshot.nodes.forEach((node) => {
            const status = normalizeCanvasGenerationStatus(node.metadata?.status);
            if (!status || (nodeIds.size && !nodeIds.has(node.id))) return;
            const metadata = node.metadata || {};
            if (!nodeIds.size && node.type !== "config" && status !== "running" && status !== "failed" && !metadata.generationMode && !metadata.generationType && !metadata.model) return;
            tasks.push({ id: node.id, source: "canvas", status, kind: metadata.generationMode || node.type, title: node.title, prompt: compactPrompt(metadata.prompt || metadata.composerContent), projectId: canvasSnapshot.projectId, error: metadata.errorDetails });
        });
    }

    if (includeWorkbench) {
        useWorkbenchAgentStore.getState().tasks.forEach((task) => {
            if ((scope === "image" || scope === "video") && task.kind !== scope) return;
            if (scope === "canvas" || (taskId && task.id !== taskId)) return;
            tasks.push({ ...task, source: task.kind, prompt: compactPrompt(task.prompt) });
        });
    }

    tasks.sort((a, b) => generationStatusOrder(a.status) - generationStatusOrder(b.status) || (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    const summary: Record<GenerationStatus, number> = { idle: 0, queued: 0, running: 0, succeeded: 0, failed: 0 };
    tasks.forEach((task) => (summary[task.status] += 1));
    return { total: tasks.length, summary, tasks: tasks.slice(0, limit) };
}

function generationStatusOrder(status: GenerationStatus) {
    return status === "running" ? 0 : status === "queued" ? 1 : 2;
}

function normalizeCanvasGenerationStatus(status: unknown): GenerationStatus | null {
    if (status === "idle") return "idle";
    if (status === "loading") return "running";
    if (status === "success") return "succeeded";
    if (status === "error") return "failed";
    return null;
}

function compactPrompt(prompt: unknown) {
    const value = typeof prompt === "string" ? prompt.trim() : "";
    return value ? `${value.slice(0, 200)}${value.length > 200 ? "..." : ""}` : undefined;
}

/** 解析镜头/导演台节点；默认在当前页内嵌隐藏导演台静默执行（不跳转），mode=tab 时打开可见窗口（预览导出渲染可靠）。 */
function openDirectorStage(input: SiteToolInput, navigate: NavigateFunction, canvasSnapshot?: CanvasAgentSnapshot | null) {
    const snapshot = canvasSnapshot;
    if (!snapshot) throw new Error(siteText("openCanvasFirst"));
    setDirectorHostNavigate(navigate);

    const shotNode = typeof input.shotNodeId === "string" ? snapshot.nodes.find((node) => node.id === input.shotNodeId && node.type === CanvasNodeType.Shot) : undefined;
    if (input.shotNodeId && !shotNode) throw new Error(siteText("shotNodeMissing", { id: input.shotNodeId }));

    const deskId = (typeof input.deskId === "string" && input.deskId.trim()) || (shotNode?.metadata?.deskId as string | undefined) || "";
    // 兼容历史数据：部分导演台节点 type 被写成 text，仅靠顶层 nodeType 或 metadata.directorDeskId 标识。
    const isDirectorNode = (node: { type: string; metadata?: Record<string, unknown> }) => node.type === CanvasNodeType.Director || (node as { nodeType?: string }).nodeType === "director";
    let directorNode = snapshot.nodes.find((node) => isDirectorNode(node) && (!deskId || node.metadata?.directorDeskId === deskId));
    if (!directorNode && deskId) directorNode = snapshot.nodes.find((node) => isDirectorNode(node) || node.metadata?.directorDeskId === deskId);
    if (!deskId && !directorNode) throw new Error(siteText("stageNoDirectorNode"));
    const resolvedDeskId = deskId || (directorNode?.metadata?.directorDeskId as string | undefined) || "";
    if (!resolvedDeskId) throw new Error(siteText("stageNoDirectorNode"));

    ensureDirectorDeskRecordForId(ensureDirectorDeskRecords(), resolvedDeskId);
    writeActiveDirectorDeskId(resolvedDeskId);

    const fromNode = directorNode?.id || shotNode?.id || "";
    if (input.mode === "tab") {
        const src = `/director/editor?instanceId=${encodeURIComponent(resolvedDeskId)}&fromCanvas=${encodeURIComponent(snapshot.projectId)}${fromNode ? `&fromNode=${encodeURIComponent(fromNode)}` : ""}`;
        window.open(src, "_blank", "noopener");
        return { ok: true, deskId: resolvedDeskId, fromNodeId: fromNode, shotNodeId: shotNode?.id, mode: "tab", note: siteText("stageTabNote") };
    }
    const opened = openDirectorDeskFrame(resolvedDeskId, snapshot.projectId, fromNode);
    return { ok: true, deskId: resolvedDeskId, fromNodeId: fromNode, shotNodeId: shotNode?.id, mode: "silent", embedded: opened.embedded, note: siteText("stageEmbeddedNote") };
}

function listCanvasProjects(input: SiteToolInput) {
    const { projects, hydrated } = useCanvasStore.getState();
    if (!hydrated) throw new Error(siteText("canvasLoading"));
    const keyword = String(input.keyword || "").trim().toLowerCase();
    const filtered = keyword ? projects.filter((project) => project.title.toLowerCase().includes(keyword)) : projects;
    const { page, pageSize, start, end } = paginate(input, filtered.length, 20);
    const items = filtered.slice(start, end).map((project) => ({
        id: project.id,
        title: project.title,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        nodeCount: project.nodes.length,
        connectionCount: project.connections.length,
    }));
    return { total: filtered.length, page, pageSize, items, hint: siteText("canvasHint") };
}

function getImageConfig() {
    const { config } = useConfigStore.getState();
    const model = config.imageModel || config.model;
    return {
        current: { model, modelName: modelOptionName(model), quality: config.quality || "auto", size: config.size || "1:1", count: config.count || "1" },
        models: selectableModelsByCapability(config, "image").map((value) => ({ value, label: modelOptionLabel(config, value) })),
        qualityOptions: imageQualityOptions,
        scaleOptions: imageScaleOptions,
        sizeOptions: imageAspectOptions,
        countRange: { min: 1, max: 15 },
    };
}

function runImageWorkbench(input: SiteToolInput, navigate: NavigateFunction) {
    const configStore = useConfigStore.getState();
    const applied: Record<string, unknown> = {};
    if (typeof input.model === "string" && input.model.trim()) {
        const value = normalizeModelOptionValue(input.model, configStore.config.channels) || input.model;
        configStore.updateConfig("imageModel", value);
        applied.model = value;
    }
    if (typeof input.quality === "string" && input.quality.trim()) {
        configStore.updateConfig("quality", input.quality);
        applied.quality = input.quality;
    }
    if (typeof input.size === "string" && input.size.trim()) {
        configStore.updateConfig("size", input.size);
        applied.size = input.size;
    }
    if (input.count != null) {
        const count = String(Math.max(1, Math.min(15, Math.floor(Number(input.count)) || 1)));
        configStore.updateConfig("count", count);
        applied.count = count;
    }
    const prompt = typeof input.prompt === "string" ? input.prompt : undefined;
    const run = input.run !== false;
    navigate("/image");
    const taskId = useWorkbenchAgentStore.getState().dispatchImage({ prompt, run });
    return { ok: true, navigated: "/image", prompt, run, taskId, applied, note: siteText(run ? "imageGenerationStarted" : "imageConfigApplied") };
}

function getVideoConfig() {
    const { config } = useConfigStore.getState();
    const model = config.videoModel || config.model;
    return {
        current: {
            model,
            modelName: modelOptionName(model),
            size: config.size || "1280x720",
            seconds: config.videoSeconds || "6",
            resolution: config.vquality || "720",
            generateAudio: config.videoGenerateAudio !== "false",
            watermark: config.videoWatermark === "true",
            mode: config.videoMode === "reference" ? "reference" : "frames",
        },
        models: selectableModelsByCapability(config, "video").map((value) => ({ value, label: modelOptionLabel(config, value) })),
        sizeOptions: videoSizeOptions,
        secondsRange: videoSecondsRange,
        resolutionOptions: videoResolutionOptions,
        modeOptions: [
            { value: "frames", label: i18n.t("settingsPanels.video.modes.frames") },
            { value: "reference", label: i18n.t("settingsPanels.video.modes.reference") },
        ],
    };
}

function runVideoWorkbench(input: SiteToolInput, navigate: NavigateFunction) {
    const configStore = useConfigStore.getState();
    const applied: Record<string, unknown> = {};
    if (typeof input.model === "string" && input.model.trim()) {
        const value = normalizeModelOptionValue(input.model, configStore.config.channels) || input.model;
        configStore.updateConfig("videoModel", value);
        applied.model = value;
    }
    if (typeof input.size === "string" && input.size.trim()) {
        configStore.updateConfig("size", input.size);
        applied.size = input.size;
    }
    if (input.seconds != null && String(input.seconds).trim()) {
        const seconds = clampVideoSeconds(String(input.seconds));
        configStore.updateConfig("videoSeconds", seconds);
        applied.seconds = seconds;
    }
    if (typeof input.resolution === "string" && input.resolution.trim()) {
        configStore.updateConfig("vquality", input.resolution);
        applied.resolution = input.resolution;
    }
    if (typeof input.generateAudio === "boolean") {
        configStore.updateConfig("videoGenerateAudio", String(input.generateAudio));
        applied.generateAudio = input.generateAudio;
    }
    if (typeof input.watermark === "boolean") {
        configStore.updateConfig("videoWatermark", String(input.watermark));
        applied.watermark = input.watermark;
    }
    if (input.mode === "frames" || input.mode === "reference") {
        configStore.updateConfig("videoMode", input.mode);
        applied.mode = input.mode;
    }
    const prompt = typeof input.prompt === "string" ? input.prompt : undefined;
    const run = input.run !== false;
    navigate("/video");
    const taskId = useWorkbenchAgentStore.getState().dispatchVideo({ prompt, run });
    return { ok: true, navigated: "/video", prompt, run, taskId, applied, note: siteText(run ? "videoGenerationStarted" : "videoConfigApplied") };
}

async function searchPrompts(input: SiteToolInput) {
    const page = Math.max(1, Math.floor(Number(input.page)) || 1);
    const pageSize = Math.max(1, Math.min(50, Math.floor(Number(input.pageSize)) || 20));
    const tags = Array.isArray(input.tags) ? input.tags.filter((tag): tag is string => typeof tag === "string") : [];
    const result = await fetchPrompts({
        keyword: String(input.keyword || ""),
        category: String(input.category || i18n.t("common.all")),
        tag: tags,
        page,
        pageSize,
        sourceId: typeof input.sourceId === "string" ? input.sourceId : undefined,
        mediaType: input.mediaType === "image" || input.mediaType === "video" ? input.mediaType : undefined,
    });
    return {
        total: result.total,
        page,
        pageSize,
        categories: result.categories,
        tags: result.tags.slice(0, 60),
        items: result.items.map((prompt) => ({ id: prompt.id, title: prompt.title, prompt: prompt.prompt, category: prompt.category, tags: prompt.tags, coverUrl: prompt.coverUrl, githubUrl: prompt.githubUrl })),
    };
}

function listAssets(input: SiteToolInput) {
    const { assets, hydrated } = useAssetStore.getState();
    if (!hydrated) throw new Error(siteText("assetsLoading"));
    const kind = input.kind === "text" || input.kind === "image" || input.kind === "video" ? input.kind : "all";
    const keyword = String(input.keyword || "").trim().toLowerCase();
    const filtered = assets.filter((asset) => {
        if (kind !== "all" && asset.kind !== kind) return false;
        if (!keyword) return true;
        return [asset.title, asset.note, asset.source, ...asset.tags].filter(Boolean).join(" ").toLowerCase().includes(keyword);
    });
    const { page, pageSize, start, end } = paginate(input, filtered.length, 20);
    const items = filtered.slice(start, end).map((asset) => ({
        id: asset.id,
        kind: asset.kind,
        title: asset.title,
        tags: asset.tags,
        source: asset.source,
        note: asset.note,
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
        coverUrl: asset.coverUrl || undefined,
        content: asset.kind === "text" ? asset.data.content : undefined,
    }));
    return { total: filtered.length, page, pageSize, items };
}

async function addAsset(input: SiteToolInput) {
    const kind = input.kind;
    const title = String(input.title || "").trim();
    if (!title) throw new Error(siteText("assetTitleRequired"));
    const tags = Array.isArray(input.tags) ? input.tags.filter((tag): tag is string => typeof tag === "string") : [];
    const source = typeof input.source === "string" ? input.source : "Agent";
    const note = typeof input.note === "string" ? input.note : undefined;
    const store = useAssetStore.getState();
    if (kind === "text") {
        const content = String(input.content || "").trim();
        if (!content) throw new Error(siteText("textContentRequired"));
        const id = store.addAsset({ kind: "text", title, coverUrl: "", tags, source, note, data: { content } });
        return { ok: true, id, kind: "text" };
    }
    if (kind === "image") {
        const imageUrl = String(input.imageUrl || "").trim();
        if (!imageUrl) throw new Error(siteText("imageUrlRequired"));
        let stored;
        try {
            stored = await uploadImage(imageUrl);
        } catch {
            throw new Error(siteText("imageReadFailed"));
        }
        const id = store.addAsset({ kind: "image", title, coverUrl: stored.url, tags, source, note, data: { dataUrl: stored.url, storageKey: stored.storageKey, width: stored.width, height: stored.height, bytes: stored.bytes, mimeType: stored.mimeType } });
        return { ok: true, id, kind: "image" };
    }
    if (kind === "video") {
        const videoUrl = String(input.videoUrl || "").trim();
        if (!videoUrl) throw new Error(siteText("videoUrlRequired"));
        let stored;
        try {
            stored = await uploadMediaFile(videoUrl, "video");
        } catch {
            throw new Error(siteText("videoReadFailed"));
        }
        const id = store.addAsset({ kind: "video", title, coverUrl: "", tags, source, note, data: { url: stored.url, storageKey: stored.storageKey, width: stored.width || 0, height: stored.height || 0, bytes: stored.bytes, mimeType: stored.mimeType } });
        return { ok: true, id, kind: "video" };
    }
    throw new Error(siteText("assetKindUnsupported"));
}

function updateAsset(input: SiteToolInput) {
    const store = useAssetStore.getState();
    if (!store.hydrated) throw new Error(siteText("assetsLoading"));
    const id = String(input.id || "");
    const asset = store.assets.find((item) => item.id === id);
    if (!asset) throw new Error(siteText("assetMissing", { id }));
    const patch: Record<string, unknown> = {};
    if (typeof input.title === "string" && input.title.trim()) patch.title = input.title.trim();
    if (typeof input.note === "string") patch.note = input.note;
    if (Array.isArray(input.tags)) patch.tags = input.tags.filter((tag): tag is string => typeof tag === "string");
    if (typeof input.content === "string") {
        if (asset.kind !== "text") throw new Error(siteText("assetContentTextOnly"));
        patch.data = { content: input.content };
    }
    if (!Object.keys(patch).length) throw new Error(siteText("assetNothingToUpdate"));
    store.updateAsset(id, patch as Parameters<typeof store.updateAsset>[1]);
    return { ok: true, id, updated: Object.keys(patch) };
}

function deleteAssets(input: SiteToolInput) {
    const store = useAssetStore.getState();
    if (!store.hydrated) throw new Error(siteText("assetsLoading"));
    const ids = Array.isArray(input.ids) ? input.ids.filter((id): id is string => typeof id === "string") : [];
    const missing = ids.filter((id) => !store.assets.some((asset) => asset.id === id));
    if (missing.length) throw new Error(siteText("assetMissing", { id: missing.join(", ") }));
    ids.forEach((id) => store.removeAsset(id));
    return { ok: true, ids, count: ids.length };
}

async function listPromptSources() {
    const { sources, schedule } = usePromptSourceStore.getState();
    const statuses = await fetchPromptSourceStatuses();
    return {
        schedule: { intervalMinutes: schedule.intervalMinutes, lastFetchedAt: schedule.lastFetchedAt },
        sources: sources.map((source) => ({
            id: source.id,
            name: source.name,
            url: source.url,
            homepage: source.homepage,
            mediaType: source.mediaType,
            enabled: source.enabled,
            builtIn: source.builtIn,
            count: statuses[source.id]?.count ?? 0,
            lastSuccessAt: statuses[source.id]?.lastSuccessAt || "",
            lastError: statuses[source.id]?.lastError || "",
        })),
    };
}

async function updatePromptSource(input: SiteToolInput) {
    const store = usePromptSourceStore.getState();
    if (input.refreshAll) {
        const summary = await refreshAllSources();
        return { ok: true, refreshAll: true, successCount: summary.successCount, failureCount: summary.failureCount, results: summary.results.map((item) => ({ sourceId: item.sourceId, sourceName: item.sourceName, success: item.success, count: item.count, lastError: item.lastError || undefined })) };
    }
    const id = String(input.id || "");
    const source = store.sources.find((item) => item.id === id);
    if (!source) throw new Error(siteText("promptSourceMissing", { id }));
    if (typeof input.enabled === "boolean") store.toggleSource(id, input.enabled);
    if (input.refresh) {
        const result = await refreshSource(id);
        return { ok: true, id, refresh: { success: result.success, count: result.count, lastError: result.lastError || undefined } };
    }
    return { ok: true, id, enabled: typeof input.enabled === "boolean" ? input.enabled : source.enabled };
}

function savePromptSource(input: SiteToolInput) {
    const store = usePromptSourceStore.getState();
    const id = typeof input.id === "string" ? input.id : "";
    if (id) {
        const existing = store.sources.find((item) => item.id === id);
        if (!existing) throw new Error(siteText("promptSourceMissing", { id }));
        if (existing.builtIn) throw new Error(siteText("promptSourceBuiltInProtected"));
    }
    const source = createPromptSource({
        id: id || undefined,
        name: String(input.name || ""),
        url: String(input.url || ""),
        homepage: typeof input.homepage === "string" ? input.homepage : "",
        mediaType: input.mediaType === "video" ? "video" : "image",
        enabled: input.enabled !== false,
        builtIn: false,
    });
    if (!source.name || !source.url) throw new Error(siteText("promptSourceFieldsRequired"));
    store.saveSource(source);
    return { ok: true, id: source.id, name: source.name, mediaType: source.mediaType };
}

function deletePromptSource(input: SiteToolInput) {
    const store = usePromptSourceStore.getState();
    const id = String(input.id || "");
    const source = store.sources.find((item) => item.id === id);
    if (!source) throw new Error(siteText("promptSourceMissing", { id }));
    if (source.builtIn) throw new Error(siteText("promptSourceBuiltInProtected"));
    store.removeSource(id);
    return { ok: true, id };
}

function createCanvasProject(input: SiteToolInput) {
    const title = String(input.title || "").trim() || undefined;
    const id = useCanvasStore.getState().createProject(title);
    return { ok: true, id, title, hint: siteText("canvasCreateHint") };
}

function renameCanvasProject(input: SiteToolInput, snapshot?: CanvasAgentSnapshot | null) {
    const store = useCanvasStore.getState();
    if (!store.hydrated) throw new Error(siteText("canvasLoading"));
    const id = String(input.projectId || snapshot?.projectId || "");
    const title = String(input.title || "").trim();
    if (!title) throw new Error(siteText("canvasTitleRequired"));
    if (!id || !store.projects.some((project) => project.id === id)) throw new Error(siteText("canvasProjectMissing", { id }));
    store.renameProject(id, title);
    return { ok: true, id, title };
}

function deleteCanvasProjects(input: SiteToolInput) {
    const store = useCanvasStore.getState();
    if (!store.hydrated) throw new Error(siteText("canvasLoading"));
    const ids = Array.isArray(input.ids) ? input.ids.filter((id): id is string => typeof id === "string") : [];
    const missing = ids.filter((id) => !store.projects.some((project) => project.id === id));
    if (missing.length) throw new Error(siteText("canvasProjectMissing", { id: missing.join(", ") }));
    store.deleteProjects(ids);
    return { ok: true, ids, count: ids.length, note: siteText("canvasDeleteNote") };
}

async function exportCanvasProject(input: SiteToolInput, snapshot?: CanvasAgentSnapshot | null) {
    const store = useCanvasStore.getState();
    if (!store.hydrated) throw new Error(siteText("canvasLoading"));
    const id = String(input.projectId || snapshot?.projectId || "");
    const project = store.projects.find((item) => item.id === id);
    if (!project) throw new Error(siteText("canvasProjectMissing", { id }));
    await exportCanvasProjects([project], project.title);
    return { ok: true, id, title: project.title, nodeCount: project.nodes.length, connectionCount: project.connections.length, note: siteText("canvasExportNote") };
}

function getChannelConfig() {
    const { config } = useConfigStore.getState();
    return {
        defaultModels: {
            text: config.textModel || config.model,
            image: config.imageModel || config.model,
            video: config.videoModel || config.model,
            audio: config.audioModel || config.model,
        },
        channels: config.channels.map((channel) => ({
            id: channel.id,
            name: channel.name,
            baseUrl: channel.baseUrl,
            apiFormat: channel.apiFormat,
            models: channel.models.map((model) => ({ name: model.name, capability: model.capability })),
        })),
        note: siteText("channelConfigNote"),
    };
}

function setDefaultModels(input: SiteToolInput) {
    const store = useConfigStore.getState();
    const applied: Record<string, string> = {};
    (["textModel", "imageModel", "videoModel", "audioModel"] as const).forEach((field) => {
        const value = typeof input[field] === "string" ? (input[field] as string).trim() : "";
        if (!value) return;
        const normalized = normalizeModelOptionValue(value, store.config.channels) || value;
        store.updateConfig(field, normalized);
        applied[field] = normalized;
    });
    if (!Object.keys(applied).length) throw new Error(siteText("modelNothingToUpdate"));
    return { ok: true, applied };
}

async function syncWebdav(input: SiteToolInput) {
    const { webdav } = useConfigStore.getState();
    if (!webdav.url?.trim()) throw new Error(siteText("webdavNotConfigured"));
    if (input.action === "test") {
        await testWebdavConnection(webdav);
        return { ok: true, action: "test" };
    }
    const result = await syncAppDataToWebdav(webdav);
    return { ok: true, action: "sync", projects: result.projects, assets: result.assets, imageLogs: result.imageLogs, videoLogs: result.videoLogs, files: result.files, uploadedFiles: result.uploadedFiles, syncedAt: result.syncedAt };
}

function listPlugins() {
    const { plugins } = usePluginStore.getState();
    return {
        total: plugins.length,
        items: plugins.map((plugin) => ({ id: plugin.id, name: plugin.name, version: plugin.version, description: plugin.description, url: plugin.url, enabled: plugin.enabled, local: plugin.local, official: plugin.official, installedAt: plugin.installedAt })),
    };
}

function setPluginEnabled(input: SiteToolInput) {
    const store = usePluginStore.getState();
    const id = String(input.id || "");
    const plugin = store.plugins.find((item) => item.id === id);
    if (!plugin) throw new Error(siteText("pluginMissing", { id }));
    const enabled = input.enabled !== false;
    store.setEnabled(id, enabled);
    return { ok: true, id, name: plugin.name, enabled, note: siteText("pluginToggleNote") };
}

function listNodeTypes() {
    const definitions = listNodeDefinitions();
    return {
        total: definitions.length,
        items: definitions.map((definition) => ({
            type: definition.type,
            title: definition.title,
            pluginId: getNodePluginId(definition.type),
            width: definition.defaultSize.width,
            height: definition.defaultSize.height,
        })),
        hint: siteText("nodeTypesHint"),
    };
}

function paginate(input: SiteToolInput, total: number, defaultSize: number) {
    const pageSize = Math.max(1, Math.min(100, Math.floor(Number(input.pageSize)) || defaultSize));
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(maxPage, Math.max(1, Math.floor(Number(input.page)) || 1));
    const start = (page - 1) * pageSize;
    return { page, pageSize, start, end: start + pageSize };
}
