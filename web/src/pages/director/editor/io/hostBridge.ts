import { useDirectorStore } from "../store/directorStore";
import {
  DIRECTOR_EXTENSION_PROTOCOL_VERSION,
  DIRECTOR_EXTENSION_REQUEST_TYPE,
  DIRECTOR_EXTENSION_RESPONSE_TYPE,
  createDirectorExtensionResponse,
  isDirectorExtensionAction,
  parseDirectorExtensionRequest,
  type DirectorExtensionResponsePayload,
} from "./extensionProtocol";
import { requestCleanFrameExport } from "./cleanFrameExport";
import { requestReferenceVideoExport } from "./referenceVideoExport";
import { requestViewportCapture } from "./captureBridge";
import type { ScreenshotResult } from "./screenshotExport";
import type { DirectorProject } from "../schema/directorProject";
import { getDirectorProjectFingerprint } from "./projectDocument";
import { listDirectorPluginResults, submitDirectorPluginResult } from "./pluginResultRegistry";
import {
  initTauriDirectorHostTransport,
  postTauriDirectorHostMessage,
  type DirectorDeskTransportMessage,
} from "./tauriHostTransport";

interface HostPanoramaPayload {
  edgeId?: unknown;
  sourceNodeId?: unknown;
  imageUrl?: unknown;
  fileName?: unknown;
}

interface HostSessionPayload {
  instanceId?: unknown;
  theme?: unknown;
}

export interface HostCaptureItemPayload {
  dataUrl?: unknown;
  fileName?: unknown;
}

export interface HostCaptureBatchPayload {
  captures?: HostCaptureItemPayload[];
}

let initialized = false;
let activeExtensionExportRequestId: string | null = null;
let clearTauriTransport: (() => void) | null = null;
export const DIRECTOR_DESK_SESSION_OPENED_EVENT = "storyai:director-desk-session-opened";

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

const HOST_ORIGIN_QUERY_KEY = "hostOrigin";

function normalizeOrigin(value: unknown) {
  const text = normalizeString(value);
  if (!text) return null;

  try {
    return new URL(text).origin;
  } catch {
    return null;
  }
}

export function getDirectorDeskHostOrigin() {
  try {
    const params = new URLSearchParams(window.location.search);
    return normalizeOrigin(params.get(HOST_ORIGIN_QUERY_KEY)) ?? window.location.origin;
  } catch {
    return window.location.origin;
  }
}

function isAllowedHostEvent(event: MessageEvent) {
  const fromExpectedOrigin = event.origin === getDirectorDeskHostOrigin();
  const fromParentWindow = window.parent === window || event.source === window.parent;
  return fromExpectedOrigin && fromParentWindow;
}

function normalizeTheme(value: unknown): "dark" | "light" | null {
  return value === "light" || value === "dark" ? value : null;
}

function applyDirectorDeskTheme(theme: "dark" | "light") {
  const scopeRoot = document.querySelector(".director-desk-app") ?? document.documentElement;
  scopeRoot.setAttribute("data-theme", theme);
  scopeRoot.classList.toggle("dark", theme === "dark");
}

function getInitialHostTheme() {
  try {
    return normalizeTheme(new URLSearchParams(window.location.search).get("theme"));
  } catch {
    return null;
  }
}

function isSupportedHostImageUrl(value: string) {
  if (value.startsWith("data:image/")) {
    return true;
  }

  try {
    const url = new URL(value, window.location.href);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "blob:";
  } catch {
    return false;
  }
}

function importHostPanorama(payload: HostPanoramaPayload) {
  const edgeId = normalizeString(payload.edgeId);
  const sourceNodeId = normalizeString(payload.sourceNodeId);
  const imageUrl = normalizeString(payload.imageUrl);
  const fileName = normalizeString(payload.fileName);

  if (!edgeId || !sourceNodeId || !fileName || !imageUrl || !isSupportedHostImageUrl(imageUrl)) {
    return;
  }

  useDirectorStore.getState().setPanoramaAsset({
    name: fileName,
    fileName,
    url: imageUrl,
    projectionMode: "equirectangular",
  });
}

export function computeHasMotionTracks(): boolean {
  const project = useDirectorStore.getState().project;
  return (project.objects ?? []).some((o) => {
    const kfs = o.motionPath?.keyframes ?? [];
    return kfs.length >= 2;
  });
}

function openHostSession(payload: HostSessionPayload) {
  const instanceId = normalizeString(payload.instanceId);
  const theme = normalizeTheme(payload.theme);
  if (theme) {
    applyDirectorDeskTheme(theme);
  }
  if (instanceId) {
    useDirectorStore.getState().openScopedScene(instanceId);
    window.dispatchEvent(new CustomEvent(DIRECTOR_DESK_SESSION_OPENED_EVENT, { detail: { instanceId } }));
    postDirectorDeskMessageToHost({ type: "storyai:director-desk-ready", payload: { hasMotionTracks: computeHasMotionTracks() } });
  }
}

export function postDirectorDeskMessageToHost(message: DirectorDeskTransportMessage) {
  if (postTauriDirectorHostMessage(message)) return;
  const target = window.opener ?? window.parent;
  target?.postMessage(message, getDirectorDeskHostOrigin());
}

function postDirectorExtensionResponse(payload: DirectorExtensionResponsePayload) {
  postDirectorDeskMessageToHost({ type: DIRECTOR_EXTENSION_RESPONSE_TYPE, payload });
}

async function handleDirectorExtensionRequest(payload: unknown) {
  const request = parseDirectorExtensionRequest(payload);
  if (request) {
    if (request.action === "plugin.results.list") {
      const projectFingerprint = getDirectorProjectFingerprint(useDirectorStore.getState().project);
      postDirectorExtensionResponse({
        protocolVersion: DIRECTOR_EXTENSION_PROTOCOL_VERSION,
        requestId: request.requestId,
        action: request.action,
        ok: true,
        data: listDirectorPluginResults(projectFingerprint),
      });
      return;
    }
    if (request.action === "plugin.result.submit") {
      try {
        const project = useDirectorStore.getState().project;
        const result = submitDirectorPluginResult(
          request.options?.result,
          getDirectorProjectFingerprint(project)
        );
        postDirectorExtensionResponse({
          protocolVersion: DIRECTOR_EXTENSION_PROTOCOL_VERSION,
          requestId: request.requestId,
          action: request.action,
          ok: true,
          data: result,
        });
      } catch (error) {
        postDirectorExtensionResponse({
          protocolVersion: DIRECTOR_EXTENSION_PROTOCOL_VERSION,
          requestId: request.requestId,
          action: request.action,
          ok: false,
          error: {
            code: "invalid-plugin-result",
            message: error instanceof Error ? error.message : "插件结果无效",
          },
        });
      }
      return;
    }
    if (request.action === "export.frame" || request.action === "export.video") {
      if (activeExtensionExportRequestId) {
        postDirectorExtensionResponse({
          protocolVersion: DIRECTOR_EXTENSION_PROTOCOL_VERSION,
          requestId: request.requestId,
          action: request.action,
          ok: false,
          error: { code: "export-busy", message: "已有导出任务正在进行，请稍后再试" },
        });
        return;
      }
      activeExtensionExportRequestId = request.requestId;
      try {
        const result = request.action === "export.frame"
          ? await requestCleanFrameExport({
              fileName: request.options?.fileName ?? "current-frame.png",
              position: request.options?.position ?? "current",
              quality: request.options?.quality ?? "720p",
            })
          : await requestReferenceVideoExport({
              fileName: request.options?.fileName ?? "director-reference.mp4",
              fps: request.options?.fps ?? 30,
              quality: request.options?.quality ?? "720p",
            });
        postDirectorExtensionResponse({
          protocolVersion: DIRECTOR_EXTENSION_PROTOCOL_VERSION,
          requestId: request.requestId,
          action: request.action,
          ok: true,
          data: result,
        });
      } catch (error) {
        postDirectorExtensionResponse({
          protocolVersion: DIRECTOR_EXTENSION_PROTOCOL_VERSION,
          requestId: request.requestId,
          action: request.action,
          ok: false,
          error: {
            code: "export-failed",
            message: error instanceof Error ? error.message : "导出失败",
          },
        });
      } finally {
        activeExtensionExportRequestId = null;
      }
      return;
    }
    const state = useDirectorStore.getState();
    postDirectorExtensionResponse(createDirectorExtensionResponse(request, state));
    return;
  }

  const value = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const requestId = normalizeString(value.requestId).slice(0, 128) || "unknown";
  const action = normalizeString(value.action);
  const unsupportedAction = Boolean(action) && !isDirectorExtensionAction(action);
  postDirectorExtensionResponse({
    protocolVersion: DIRECTOR_EXTENSION_PROTOCOL_VERSION,
    requestId,
    action: "unknown",
    ok: false,
    error: {
      code: unsupportedAction ? "unsupported-action" : "invalid-request",
      message: unsupportedAction ? `不支持的二创接口操作：${action}` : "二创接口请求缺少有效的 requestId 或 action",
    },
  });
}

export function postDirectorDeskCapturesToHost(
  captures: Array<{
    dataUrl: string;
    fileName?: string;
  }>
) {
  const normalizedCaptures = captures
    .map((capture, index) => {
      const dataUrl = normalizeString(capture.dataUrl);
      if (!dataUrl) {
        return null;
      }

      return {
        dataUrl,
        fileName: normalizeString(capture.fileName) || `director-desk-capture-${index + 1}.png`,
      };
    })
    .filter((capture): capture is { dataUrl: string; fileName: string } => Boolean(capture));

  if (normalizedCaptures.length === 0) {
    return;
  }

  postDirectorDeskMessageToHost({
    type: "storyai:director-desk-captures-sent",
    payload: { captures: normalizedCaptures },
  });
}

function sendCanvasImportResponse(action: string, event: string, payload?: unknown) {
  window.parent?.postMessage(
    { type: "storyai:director-desk-canvas-import-response", action, event, payload },
    getDirectorDeskHostOrigin(),
  );
}

function handleCanvasImportRequest(payload: unknown) {
  const data = (payload || {}) as Record<string, unknown>;
  const action = data.action as string;

  if (action === "canvas.capture" || action === "canvas.screenshot") {
    requestViewportCapture({ preset: "current", source: "canvas-import" as const })
      .then((results: ScreenshotResult[]) => {
        if (!results.length) {
          sendCanvasImportResponse(action, "error", { message: "截图结果为空，导演台可能尚未完全加载" });
          return;
        }
        postDirectorDeskCapturesToHost(
          results.map((r, i) => ({
            dataUrl: r.dataUrl,
            fileName: `canvas-screenshot-${i + 1}.png`,
          }))
        );
        sendCanvasImportResponse(action, "done");
      })
      .catch((err: unknown) => {
        sendCanvasImportResponse(action, "error", { message: err instanceof Error ? err.message : "截图失败" });
      });
    return;
  }

  if (action === "canvas.characters") {
    const project = useDirectorStore.getState().project;
    const chars = (project.objects ?? []).filter(
      (o) => o.kind === "character"
    );
    const lines = chars.map((c) => {
      const pos = c.transform?.position ?? [0, 0, 0];
      return `- ${c.name}：位置 (${pos[0].toFixed(2)}, ${pos[1].toFixed(2)}, ${pos[2].toFixed(2)})`;
    });
    const text = chars.length
      ? `【人物站位描述】\n共 ${chars.length} 个角色：\n${lines.join("\n")}`
      : "当前导演台场景中暂无角色。";
    window.parent?.postMessage(
      { type: "storyai:director-desk-canvas-text", text },
      getDirectorDeskHostOrigin()
    );
    return;
  }

  if (action === "canvas.video") {
    const options = (data.options || {}) as Record<string, unknown>;
    requestReferenceVideoExport({
      fileName: (options.fileName as string) ?? "canvas-motion-video.mp4",
      fps: Number(options.fps) || 30,
      quality: (options.quality as "720p" | "1080p") ?? "720p",
    })
      .then((result) => {
        const url = URL.createObjectURL(result.blob);
        window.parent?.postMessage(
          {
            type: "storyai:director-desk-canvas-video",
            blobUrl: url,
            mimeType: result.mimeType,
            fileName: result.fileName,
          },
          getDirectorDeskHostOrigin()
        );
      })
      .catch((err: unknown) => {
        sendCanvasImportResponse("canvas.video", "error", {
          message: err instanceof Error ? err.message : "视频导出失败"
        });
      });
    return;
  }
}

function handleHostProtocolMessage(message: DirectorDeskTransportMessage) {
  if (message.type === "storyai:director-desk-session") {
    openHostSession((message.payload || {}) as HostSessionPayload);
    return;
  }

  if (message.type === "storyai:director-desk-panorama") {
    importHostPanorama((message.payload || {}) as HostPanoramaPayload);
    return;
  }

  if (message.type === DIRECTOR_EXTENSION_REQUEST_TYPE) {
    void handleDirectorExtensionRequest(message.payload);
    return;
  }

  // 画布导入快捷消息（由 infinite-canvas overlay 触发）
  if (message.type === "storyai:director-desk:canvas-import") {
    void handleCanvasImportRequest(message.payload);
    return;
  }
}

function handleHostMessage(event: MessageEvent) {
  if (!isAllowedHostEvent(event)) return;
  if (!event.data || typeof event.data !== "object" || typeof event.data.type !== "string") return;
  handleHostProtocolMessage(event.data as DirectorDeskTransportMessage);
}

export function initDirectorDeskHostBridge() {
  if (initialized) {
    return;
  }

  initialized = true;
  applyDirectorDeskTheme(getInitialHostTheme() ?? "dark");
  window.addEventListener("message", handleHostMessage);
  void initTauriDirectorHostTransport(handleHostProtocolMessage).then((cleanup) => {
    if (!cleanup) return;
    if (!initialized) {
      cleanup();
      return;
    }
    clearTauriTransport = cleanup;
  });
}

export function clearDirectorDeskHostBridge() {
  if (!initialized) {
    return;
  }

  initialized = false;
  activeExtensionExportRequestId = null;
  window.removeEventListener("message", handleHostMessage);
  clearTauriTransport?.();
  clearTauriTransport = null;
}
