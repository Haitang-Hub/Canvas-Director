import "./styles/index.css";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Route, X } from "lucide-react";
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
import { DIRECTOR_DESK_VERSION } from "./version";
import { useDirectorStore } from "./editor/store/directorStore";
import {
  ensureDirectorDeskRecordForId,
  ensureDirectorDeskRecords,
  getInitialDirectorDeskId,
  touchDirectorDeskRecord,
  writeActiveDirectorDeskId,
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

// 3D 导演台编辑器：全屏独立页面（不含无限画布顶部导航），URL 参数 instanceId 是导演台的唯一入口。
export default function DirectorEditorPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const benchmarkMode = getPerformanceBenchmarkMode(window.location.search);
  const urlInstanceId = searchParams.get("instanceId")?.trim() || null;
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

  function backToHome() {
    navigate("/director");
  }

  function handleBack() {
    window.history.back();
  }

  return (
    <div className="h-dvh w-full overflow-hidden">
      <div className="director-desk-app" data-theme="dark">
        <div className="app-shell">
          <header className="top-bar">
            <div className="top-bar-left">
              <button className="top-bar-title top-bar-home-button" type="button" onClick={backToHome}>
                3D导演台
              </button>
              <span className="top-bar-version" aria-label={`当前版本 v${DIRECTOR_DESK_VERSION}`}>v{DIRECTOR_DESK_VERSION}</span>
              <div className="director-desk-switcher" aria-label="导演台选择器">
                <select
                  className="director-desk-select"
                  aria-label="选择导演台"
                  value={activeDeskId}
                  onChange={(event) => {
                    const next = new URLSearchParams(searchParams);
                    next.set("instanceId", event.currentTarget.value);
                    setSearchParams(next, { replace: true });
                  }}
                >
                  {directorDesks.map((desk) => (
                    <option key={desk.id} value={desk.id}>
                      {desk.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
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
            {motionStudioOpen ? null : (
              <button className="director-close-button" type="button" title="关闭" onClick={(e) => { e.stopPropagation(); handleBack(); }}>
                <X aria-hidden="true" size={18} strokeWidth={2} />
              </button>
            )}
          </header>
          <DirectorDeskShell>
            <DirectorCanvas />
          </DirectorDeskShell>
        </div>
      </div>
    </div>
  );
}
