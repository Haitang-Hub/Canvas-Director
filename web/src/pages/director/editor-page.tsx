import "./styles/index.css";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { App, ConfigProvider } from "antd";
import type { ThemeConfig } from "antd";
import { ArrowLeft, Bot, Route, Settings2 } from "lucide-react";
import { AgentPanel } from "@/components/agent/agent-panel";
import { useAgentStore } from "@/stores/use-agent-store";
import { AppConfigModal } from "@/components/layout/app-config-modal";
import { getAntThemeConfig } from "@/lib/app-theme";
import { useConfigStore } from "@/stores/use-config-store";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import type { CanvasNodeData } from "@/types/canvas";
import { DirectorDeskShell } from "./app/layout/DirectorDeskShell";
import { DirectorCanvas } from "./editor/canvas/DirectorCanvas";
import { ViewportSensitivitySettings } from "./editor/canvas/ViewportSensitivitySettings";
import { ExportPanel } from "./editor/panels/ExportPanel";
import { CanvasImportPanel } from "./editor/panels/CanvasImportPanel";
import {
  clearDirectorDeskHostBridge,
  initDirectorDeskHostBridge,
  postDirectorDeskMessageToHost,
  computeHasMotionTracks,
} from "./editor/io/hostBridge";
import { useDirectorStore } from "./editor/store/directorStore";
import { DirectorAgentBridge } from "./editor/hooks/use-director-agent-bridge";
import {
  ensureDirectorDeskRecordForId,
  ensureDirectorDeskRecords,
  getInitialDirectorDeskId,
  touchDirectorDeskRecord,
  writeActiveDirectorDeskId,
  writeDirectorDeskRecords,
  type DirectorDeskRecord,
} from "./editor/workspaces/directorDeskRegistry";
import {
  createPerformanceBenchmarkProject,
  getPerformanceBenchmarkMode,
  getPerformanceBenchmarkPlayback,
  getPerformanceBenchmarkSceneConfig,
} from "./editor/performance/performanceBenchmark";
import { getBenchmarkPerformanceProfile } from "./editor/performance/performanceProfiles";
import { PerformanceSettings } from "./editor/performance/PerformanceSettings";

function createInitialEditorViewState(urlInstanceId: string | null) {
  const records = ensureDirectorDeskRecords();
  const benchmarkMode = getPerformanceBenchmarkMode(window.location.search);
  if (benchmarkMode) {
    const timestamp = new Date().toISOString();
    const benchmarkId = urlInstanceId ?? "benchmark_standard";
    const benchmarkRecord: DirectorDeskRecord = {
      id: benchmarkId,
      name: `${getPerformanceBenchmarkSceneConfig(benchmarkMode).label}性能基准（临时）`,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    return {
      records: [...records.filter((record) => record.id !== benchmarkId), benchmarkRecord],
      activeDeskId: benchmarkId,
    };
  }
  return {
    records,
    activeDeskId: urlInstanceId ?? getInitialDirectorDeskId(records) ?? records[0]?.id ?? "",
  };
}

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

// 导演台内的配置弹窗与无限画布保持一致：因页面恒为深色，仅强制深色主题，不再替换主色调
const directorConfigTheme: ThemeConfig = getAntThemeConfig(true);

/** 导演台改名后同步来源画布：更新绑定导演台节点的标题与 directorDeskName。 */
async function syncDeskNameToCanvas(deskId: string, name: string) {
  const params = new URLSearchParams(window.location.search);
  const fromCanvasId = params.get("fromCanvas")?.trim() || "";
  const fromNodeId = params.get("fromNode")?.trim() || "";
  const store = useCanvasStore.getState();
  if (!store.hydrated) await useCanvasStore.persist.rehydrate();
  const projects = useCanvasStore.getState().projects;
  // 优先按实例 ID 绑定匹配；历史节点缺 directorDeskId 时用 fromNode 参数兜底。
  const matchNode = (nodes: CanvasNodeData[]) =>
    nodes.find((node) => node.metadata?.directorDeskId === deskId) ||
    nodes.find((node) => node.id === fromNodeId && (node as { nodeType?: string }).nodeType === "director");
  const project = fromCanvasId ? projects.find((item) => item.id === fromCanvasId && matchNode(item.nodes)) : projects.find((item) => matchNode(item.nodes));
  const node = project ? matchNode(project.nodes) : null;
  if (!project || !node) return;
  const patch = { title: name, metadata: { directorDeskName: name } };
  const host = window.self !== window.top ? window.parent : window.opener;
  if (host) {
    // 静默 iframe / 弹窗：宿主画布页仍在运行，走 apply-ops 让实时状态同步，直写会被宿主覆盖。
    try {
      await requestHostApplyOps(project.id, [{ type: "update_node", id: node.id, patch }]);
      return;
    } catch {
      // 宿主不可用（已关闭等），退回直写本地 store。
    }
  }
  useCanvasStore.getState().updateProject(project.id, { nodes: project.nodes.map((item) => (item.id === node.id ? { ...item, ...patch, metadata: { ...item.metadata, ...patch.metadata } } : item)) });
}

/** 把画布 ops 发给宿主页应用（与导演台产物写回同一通道）；无宿主或超时reject。 */
function requestHostApplyOps(projectId: string, ops: unknown[]) {
  return new Promise<void>((resolve, reject) => {
    const target = window.self !== window.top ? window.parent : window.opener;
    if (!target) return reject(new Error("no host"));
    const requestId = crypto.randomUUID();
    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("宿主页未响应"));
    }, 3000);
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; requestId?: string; error?: string } | null;
      if (data?.type !== "canvas-agent:apply-ops-result" || data.requestId !== requestId) return;
      cleanup();
      data.error ? reject(new Error(data.error)) : resolve();
    };
    window.addEventListener("message", onMessage);
    target.postMessage({ type: "canvas-agent:apply-ops", requestId, projectId, ops }, window.location.origin);
  });
}

/** 顶栏导演台名称:双击进入编辑,回车/失焦保存,Esc 取消。 */
function DirectorDeskNameField({ desks, activeDeskId, onChange }: { desks: DirectorDeskRecord[]; activeDeskId: string; onChange: (records: DirectorDeskRecord[]) => void }) {
  const active = desks.find((desk) => desk.id === activeDeskId);
  const [editing, setEditing] = useState(false);

  function commit(value: string) {
    const name = value.trim();
    if (name && active && name !== active.name) {
      const records = desks.map((desk) => (desk.id === active.id ? { ...desk, name, updatedAt: new Date().toISOString() } : desk));
      writeDirectorDeskRecords(records);
      onChange(records);
      void syncDeskNameToCanvas(active.id, name);
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        className="director-desk-name-input"
        aria-label="导演台名称"
        autoFocus
        defaultValue={active?.name || ""}
        onBlur={(event) => commit(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit(event.currentTarget.value);
          if (event.key === "Escape") setEditing(false);
        }}
      />
    );
  }
  return (
    <span className="director-desk-name" title="双击修改导演台名称" onDoubleClick={() => setEditing(true)}>
      {active?.name || "未命名导演台"}
    </span>
  );
}

// 顶栏「Agent」开关：统一 Agent 面板（与无限画布共用），驱动全局 useAgentStore。
function DirectorAgentToggle() {
  const open = useAgentStore((state) => state.panelOpen);
  const togglePanel = useAgentStore((state) => state.togglePanel);
  return (
    <button
      className={`top-bar-motion-button${open ? " is-active" : ""}`}
      type="button"
      aria-label={open ? "关闭 Agent" : "打开 Agent"}
      aria-pressed={open}
      onClick={togglePanel}
    >
      <Bot aria-hidden="true" size={15} />
      Agent
    </button>
  );
}

// 3D 导演台编辑器:全屏独立页面：全屏独立页面（不含无限画布顶部导航），URL 参数 instanceId 是导演台的唯一入口。
export default function DirectorEditorPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const benchmarkMode = getPerformanceBenchmarkMode(window.location.search);
  const urlInstanceId = searchParams.get("instanceId")?.trim() || null;
  const fromCanvasId = searchParams.get("fromCanvas")?.trim() || null;
  const importTarget = (() => {
    const projectId = searchParams.get("fromCanvas")?.trim() || null;
    const nodeId = searchParams.get("fromNode")?.trim() || null;
    return projectId && nodeId ? { projectId, nodeId } : null;
  })();
  const [directorDeskView, setDirectorDeskView] = useState(() => createInitialEditorViewState(urlInstanceId));
  const { records: directorDesks, activeDeskId } = directorDeskView;
  const viewMode = useDirectorStore((state) => state.viewMode);
  const setViewMode = useDirectorStore((state) => state.setViewMode);
  const motionStudioOpen = useDirectorStore((state) => state.motionStudioOpen);
  const setMotionStudioOpen = useDirectorStore((state) => state.setMotionStudioOpen);

  // 场景加载：首次进入、顶栏切换导演台、浏览器前进后退都经由 URL 参数驱动
  useEffect(() => {
    if (benchmarkMode) return;
    const id = urlInstanceId ?? activeDeskId ?? "";
    if (!id) return;
    if (urlInstanceId !== id) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("instanceId", id);
      setSearchParams(nextParams, { replace: true });
      return;
    }
    const ensured = ensureDirectorDeskRecordForId(directorDesks, id);
    const nextRecords = touchDirectorDeskRecord(ensured.records, id);
    setDirectorDeskView({ records: nextRecords, activeDeskId: id });
    writeActiveDirectorDeskId(id);
    useDirectorStore.getState().openScopedScene(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlInstanceId, benchmarkMode]);

  useEffect(() => {
    initDirectorDeskHostBridge();
    postDirectorDeskMessageToHost({ type: "storyai:director-desk-ready", payload: { hasMotionTracks: computeHasMotionTracks() } });
    return () => clearDirectorDeskHostBridge();
  }, []);

  useEffect(() => {
    if (!benchmarkMode) return;

    const state = useDirectorStore.getState();
    const benchmarkProfile = getBenchmarkPerformanceProfile(window.location.search);
    const benchmarkPlayback = getPerformanceBenchmarkPlayback(window.location.search);
    const benchmarkScene = getPerformanceBenchmarkSceneConfig(benchmarkMode);
    useDirectorStore.setState({
      ...state,
      project: createPerformanceBenchmarkProject(benchmarkMode),
      viewMode: "director",
      selectedObjectId: null,
      selectedObjectIds: [],
      selectedCrowdId: null,
      selectedCameraKeyframeId: null,
      selectedCameraKeyframeIds: [],
      selectedObjectMotionKeyframeId: null,
      showCharacterRoutes: false,
      motionStudioOpen: benchmarkScene.monitorEnabled,
      cameraMotionProgress: benchmarkPlayback.progress,
      cameraMotionPlaying: benchmarkPlayback.playing,
      ...(benchmarkProfile ? { performanceProfile: benchmarkProfile } : {}),
    });
  }, [benchmarkMode]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || isEditableShortcutTarget(event.target)) return;
      if (!event.metaKey && !event.ctrlKey) return;
      if (event.repeat) return;

      const key = event.key.toLowerCase();
      if (key === "c") {
        event.preventDefault();
        useDirectorStore.getState().copySelectedObjects();
        return;
      }

      if (key === "v") {
        event.preventDefault();
        useDirectorStore.getState().pasteClipboardObjects();
        return;
      }

      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        useDirectorStore.getState().undo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // 从哪里来回哪里去：从无限画布进入时返回该画布，其余情况回导演台首页
  function backToSource() {
    if (fromCanvasId) navigate(`/canvas/${fromCanvasId}`);
    else navigate("/director");
  }

  const openConfigDialog = useConfigStore((state) => state.openConfigDialog);


  return (
    <div className="h-dvh w-full overflow-hidden">
      <ConfigProvider theme={directorConfigTheme}>
        <App>
          <AppConfigModal rootClassName="dark" />
        </App>
      </ConfigProvider>
      <DirectorAgentBridge />
      <AgentPanel context="director" />
      <div className="director-desk-app" data-theme="dark">
        <div className="app-shell">
          <header className="top-bar">
            <div className="top-bar-left">
              <button className="top-bar-exit-button" type="button" title="退出导演台" aria-label="退出导演台" onClick={backToSource}>
                <ArrowLeft aria-hidden="true" size={15} />
              </button>
              <DirectorDeskNameField
                desks={directorDesks}
                activeDeskId={activeDeskId}
                onChange={(records) => setDirectorDeskView({ records, activeDeskId })}
              />            </div>
            <div className="top-bar-center">
              <div className="mode-toggle ui-segmented" role="group" aria-label="视角切换">
                <button
                  className={`mode-toggle-button ui-segmented-item ${viewMode === "director" ? "ui-segmented-item-active" : ""}`}
                  aria-pressed={viewMode === "director"}
                  type="button"
                  onClick={() => setViewMode("director")}
                >
                  导演视角
                </button>
                <button
                  className={`mode-toggle-button ui-segmented-item ${viewMode === "camera" ? "ui-segmented-item-active" : ""}`}
                  aria-label="第一视角"
                  aria-pressed={viewMode === "camera"}
                  title="查看摄影机最终画面"
                  type="button"
                  onClick={() => setViewMode("camera")}
                >
                  第一视角
                </button>
              </div>
              <button
                className={`top-bar-motion-button${motionStudioOpen ? " is-active" : ""}`}
                type="button"
                aria-label={motionStudioOpen ? "关闭运镜工作台" : "打开运镜工作台"}
                aria-pressed={motionStudioOpen}
                onClick={() => {
                  setViewMode("director");
                  setMotionStudioOpen(!motionStudioOpen);
                }}
              >
                <Route aria-hidden="true" size={15} />
                运镜
              </button>
              <ViewportSensitivitySettings />
              <PerformanceSettings />
              <CanvasImportPanel importTarget={importTarget} />
              <ExportPanel />
            </div>
            <div className="top-bar-right">
              <DirectorAgentToggle />
              <button className="top-bar-exit-button" type="button" title="模型配置" aria-label="模型配置" onClick={() => openConfigDialog(false, "channels")}>
                <Settings2 aria-hidden="true" size={15} />
              </button>
            </div>
          </header>
          <DirectorDeskShell>
            <DirectorCanvas />
          </DirectorDeskShell>
        </div>
      </div>
    </div>
  );
}
