import { useEffect, useRef, useState } from "react";
import { FileText, Image as ImageIcon, Upload, Video, X } from "lucide-react";
import { requestViewportCapture } from "../io/captureBridge";
import { requestReferenceVideoExport, type ReferenceVideoExportQuality } from "../io/referenceVideoExport";
import { getCameraMotionPath } from "../schema/cameraMotion";
import type { DirectorObject, DirectorCameraShot } from "../schema/directorProject";
import { useDirectorStore } from "../store/directorStore";
import { readActiveDirectorDeskId, ensureDirectorDeskRecords } from "../workspaces/directorDeskRegistry";
import { createCanvasNode, imageMetadata, videoMetadata } from "@/lib/canvas/canvas-node-factory";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import { uploadImage } from "@/services/image-storage";
import { uploadMediaFile } from "@/services/file-storage";
import { nanoid } from "nanoid";

export type DirectorImportTarget = { projectId: string; nodeId: string };

function getDeskLabel() {
  const activeId = readActiveDirectorDeskId() ?? "";
  const record = ensureDirectorDeskRecords().find((item) => item.id === activeId);
  return record?.name || "导演台";
}

function vec3Normalize(v: number[]): number[] | null {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (len < 1e-8) return null;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function vec3Dot(a: number[], b: number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function vec3Cross(a: number[], b: number[]): number[] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function vec3Sub(a: number[], b: number[]): number[] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/**
 * 将世界坐标转换为以相机为中心的归一化屏幕坐标。
 * X: -1（左边缘）~ 1（右边缘），0 为中心
 * Y: -1（底部）~ 1（顶部），0 为水平中线
 * 深度 = 物体到相机的距离（正值表示在相机前方）
 */
function worldToScreenNorm(
  objPos: number[],
  cameraPos: number[],
  cameraTarget: number[],
  fov: number,
  aspectRatio: number,
): { x: number; y: number; depth: number } | null {
  const forward = vec3Normalize(vec3Sub(cameraTarget, cameraPos));
  if (!forward) return null;

  const worldUp: number[] = [0, 1, 0];
  const right = vec3Normalize(vec3Cross(forward, worldUp));
  if (!right) return null;
  const up = vec3Cross(right, forward);

  const toObj = vec3Sub(objPos, cameraPos);
  const depth = vec3Dot(forward, toObj);
  if (depth <= 0.01) return null;

  const halfFovRad = (fov * Math.PI / 180) / 2;
  const tanHalf = Math.tan(halfFovRad);
  if (!isFinite(tanHalf) || tanHalf === 0) return null;
  const scale = 1 / tanHalf;
  const normX = (vec3Dot(toObj, right) * scale) / aspectRatio;
  const normY = vec3Dot(toObj, up) * scale;
  return { x: normX, y: normY, depth };
}

function formatNormCoord(value: number): string {
  if (!isFinite(value)) return "NaN";
  return String(Math.round(value * 100) / 100);
}

function toNumArr(v: [number, number, number]): number[] {
  return [v[0], v[1], v[2]];
}

function getCameraAspect(activeCamera: DirectorCameraShot | null): number {
  if (!activeCamera) return 16 / 9;
  const canvasEl = document.querySelector<HTMLCanvasElement>('canvas');
  if (canvasEl) return Math.max(canvasEl.width / canvasEl.height, 0.5);
  return 16 / 9;
}

function buildSceneCompositionText(objects: DirectorObject[], activeCamera: DirectorCameraShot | null) {
  if (!objects.length) return null;

  const camPos = activeCamera ? toNumArr(activeCamera.transform.position) : [0, 1.6, 5];
  const camTarget = activeCamera ? toNumArr(activeCamera.target) : [0, 1.5, 0];
  const fov = activeCamera ? activeCamera.fov : 45;
  const aspect = getCameraAspect(activeCamera);

  // 从 target 向量推导当前镜头的朝向角（俯仰/偏航）
  const forward = vec3Normalize(vec3Sub(camTarget, camPos));
  const pitchDeg = forward ? Math.round(Math.asin(forward[1]) * 180 / Math.PI) : 0;
  const yawDeg = forward ? Math.round(Math.atan2(forward[0], -forward[2]) * 180 / Math.PI) : 0;

  const cameraX = Math.round(camPos[0] * 100) / 100;
  const cameraY = Math.round(camPos[1] * 100) / 100;
  const cameraZ = Math.round(camPos[2] * 100) / 100;

  const lines: string[] = [];
  lines.push(`【画面文本描述】`);
  lines.push("");

  // 镜头视角描述
  lines.push("▎镜头视角");
  lines.push(`    位置 (世界坐标): (${cameraX}, ${cameraY}, ${cameraZ})`);
  lines.push(`    俯仰角: ${pitchDeg}°  偏航角: ${yawDeg}°`);
  lines.push(`    焦距: ${fov.toFixed(1)}° FOV`);
  lines.push("");

  // 场景对象（排除机位本身）
  const allObjects = objects.filter((o) => o.visible && o.kind !== "camera");
  if (!allObjects.length) {
    lines.push("    场景中没有任何可见元素。");
    return lines.join("\n");
  }

  lines.push("▎画面元素分布");
  lines.push("    （画面坐标：(0,0)=画面中心，X轴左-1~右1，Y轴下-1~上1，深度=距相机距离）");
  allObjects.forEach((object, index) => {
    const objPos = toNumArr(object.transform.position);
    const screen = worldToScreenNorm(objPos, camPos, camTarget, fov, aspect);

    const depthStr = screen ? `深度=${formatNormCoord(screen.depth)}` : "（位于相机背面，不可见）";
    const screenStr = screen
      ? `画面坐标 (${formatNormCoord(screen.x)}, ${formatNormCoord(screen.y)})`
      : "画面坐标 (背面不可见)";

    const label = `${index + 1}. ${object.name}`;
    lines.push(`    ${label}`);
    lines.push(`        ${screenStr}，${depthStr}`);
  });

  return lines.join("\n");
}

// 把文本描述、截图与动作视频导入到打开它的那个画布，并连线到对应的导演台节点。
export function CanvasImportPanel({ importTarget }: { importTarget: DirectorImportTarget | null }) {
  const project = useDirectorStore((state) => state.project);
  const hydrated = useCanvasStore((state) => state.hydrated);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<null | "text" | "image" | "fourImage" | "video">(null);
  const [status, setStatus] = useState<string | null>(null);
  const [exportFps, setExportFps] = useState(30);
  const [exportQuality, setExportQuality] = useState<ReferenceVideoExportQuality>("720p");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    if (!hydrated) void useCanvasStore.persist.rehydrate();
  }, [hydrated, open]);

  useEffect(() => {
    if (!open) return;

    function closeOutside(event: PointerEvent) {
      if (!(event.target instanceof Node) || wrapperRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [open]);

  const activeCamera = project.cameras.find((camera) => camera.id === project.activeCameraId) ?? project.cameras[0] ?? null;
  const motionPath = activeCamera ? getCameraMotionPath(activeCamera) : null;
  const hasEnoughKeyframes = (motionPath?.keyframes.length ?? 0) >= 2;
  const hasObjects = project.objects.some((object) => object.visible);
  const importing = busy !== null;
  const canImport = Boolean(importTarget);

  // 新节点放在导演台节点右侧，多次导入依次横向排列，并自动连线到导演台节点。
  async function appendNodeToCanvas(buildNode: () => CanvasNodeData) {
    if (!importTarget) throw new Error("请从画布中的导演台节点打开后再导入");
    const store = useCanvasStore.getState();
    const target = store.projects.find((item) => item.id === importTarget.projectId);
    if (!target) throw new Error("来源画布不存在，请重新从画布打开导演台");

    const directorNode = target.nodes.find((node) => node.id === importTarget.nodeId);
    const startX = directorNode ? directorNode.position.x + directorNode.width + 96 : 0;
    const startY = directorNode ? directorNode.position.y + directorNode.height / 2 : 0;
    const importedCount = target.nodes.filter((node) => node.metadata?.sourceDirectorNodeId === importTarget.nodeId).length;

    const node = buildNode();
    const placedNode: CanvasNodeData = {
      ...node,
      position: { x: startX + importedCount * (node.width + 40), y: startY - node.height / 2 },
      metadata: { ...node.metadata, sourceDirectorNodeId: importTarget.nodeId },
    };
    const connection = { id: nanoid(), fromNodeId: importTarget.nodeId, toNodeId: placedNode.id };
    store.updateProject(importTarget.projectId, {
      nodes: [...target.nodes, placedNode],
      connections: [...target.connections, connection],
    });
    const targetTitle = useCanvasStore.getState().projects.find((item) => item.id === importTarget.projectId)?.title || "画布";
    return `已导入画布「${targetTitle}」`;
  }

  async function handleImportText() {
    if (busy || !canImport) return;
    setBusy("text");
    setStatus(null);
    try {
      const text = buildSceneCompositionText(project.objects, activeCamera);
      if (!text) {
        setStatus("场景中没有任何可见元素，无法导入画面文本描述");
        return;
      }
      setStatus(await appendNodeToCanvas(() => ({ ...createCanvasNode(CanvasNodeType.Text, { x: 0, y: 0 }, { content: text, status: "success", fontSize: 14 }), title: "画面文本描述" })));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "导入画面文本描述失败");
    } finally {
      setBusy(null);
    }
  }

  async function handleImportScreenshot() {
    if (busy || !canImport) return;
    setBusy("image");
    setStatus(null);
    try {
      const results = await requestViewportCapture({ preset: "current", source: "canvas-import" });
      const shot = results[0];
      if (!shot) throw new Error("截图失败，请重试");
      const uploaded = await uploadImage(shot.dataUrl);
      setStatus(await appendNodeToCanvas(() => ({ ...createCanvasNode(CanvasNodeType.Image, { x: 0, y: 0 }, imageMetadata(uploaded)), title: "导演台截图" })));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "导入截图失败");
    } finally {
      setBusy(null);
    }
  }

/** 将多张截图拼成一张 2x2 网格图，返回合并后的 dataUrl */
async function mergeFourScreenshotsToGrid(
  results: Awaited<ReturnType<typeof requestViewportCapture>>
): Promise<string | null> {
  const shots = results.filter((s): s is NonNullable<typeof s> => s != null);
  if (!shots.length) return Promise.resolve(null);

  // 以第一张的尺寸为基准，其余等比缩放
  const img = new Image();
  img.src = shots[0].dataUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("截图加载失败"));
  });

  const cellW = img.naturalWidth;
  const cellH = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = cellW * 2;
  canvas.height = cellH * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);

  const positions: [number, number][] = [[0, 0], [cellW, 0], [0, cellH], [cellW, cellH]];
  for (let i = 0; i < shots.length; i++) {
    const s = new Image();
    s.src = shots[i].dataUrl;
    await new Promise<void>((resolve, reject) => {
      s.onload = () => {
        ctx.drawImage(s, positions[i][0], positions[i][1], cellW, cellH);
        resolve();
      };
      s.onerror = () => reject(new Error("截图加载失败"));
    });
  }

  return canvas.toDataURL("image/png");
}

  async function handleImportFourViewScreenshot() {
    if (busy || !canImport) return;
    setBusy("fourImage");
    setStatus(null);
    try {
      const results = await requestViewportCapture({ preset: "four", source: "canvas-import" });
      const mergedDataUrl = await mergeFourScreenshotsToGrid(results);
      if (!mergedDataUrl) throw new Error("四方位截图合并失败");
      const uploaded = await uploadImage(mergedDataUrl);
      setStatus(await appendNodeToCanvas(() => ({ ...createCanvasNode(CanvasNodeType.Image, { x: 0, y: 0 }, imageMetadata(uploaded)), title: "导演台四方位截图" })));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "导入四方位截图失败");
    } finally {
      setBusy(null);
    }
  }

  async function handleImportVideo() {
    if (busy || !canImport || !hasEnoughKeyframes) return;
    setBusy("video");
    setStatus("正在录制动作视频…");
    try {
      const result = await requestReferenceVideoExport({
        fileName: `${getDeskLabel()}-动作视频.mp4`,
        fps: exportFps,
        quality: exportQuality,
      });
      const uploaded = await uploadMediaFile(result.blob, "video");
      setStatus(await appendNodeToCanvas(() => ({ ...createCanvasNode(CanvasNodeType.Video, { x: 0, y: 0 }, videoMetadata(uploaded)), title: "导演台动作视频" })));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "导入动作视频失败");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="export-panel" ref={wrapperRef}>
      <button
        ref={triggerRef}
        aria-label="导入画布"
        aria-controls="canvas-import-panel-popover"
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`export-trigger${open ? " is-active" : ""}`}
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <Upload aria-hidden="true" size={15} strokeWidth={1.9} />
        <span>导入画布</span>
      </button>

      {open ? (
        <section
          id="canvas-import-panel-popover"
          className="export-popover"
          role="dialog"
          aria-label="导入画布"
        >
          <header className="export-popover-header">
            <div>
              <strong>导入画布</strong>
              <small>把画面文本描述、截图与动作视频导入画布</small>
            </div>
            <button aria-label="关闭导入画布面板" type="button" onClick={() => setOpen(false)}>
              <X aria-hidden="true" size={15} />
            </button>
          </header>

          {!canImport ? (
            <p className="export-status">请在无限画布中从导演台节点打开本页面，导入内容才会自动写回对应画布。</p>
          ) : null}

          <div className="export-section">
            <span className="export-section-label">文本描述</span>
            <div className="export-actions">
              <button
                className="export-action-button"
                type="button"
                disabled={importing || !canImport || !hasObjects}
                onClick={() => void handleImportText()}
              >
                <FileText aria-hidden="true" size={14} strokeWidth={1.8} />
                <span>{busy === "text" ? "导入中…" : hasObjects ? "导入画面文本描述" : "场景中没有任何可见元素"}</span>
              </button>
            </div>
          </div>

          <div className="export-section">
            <span className="export-section-label">截图</span>
            <div className="export-actions">
              <button
                className="export-action-button"
                type="button"
                disabled={importing || !canImport}
                onClick={() => void handleImportScreenshot()}
              >
                <ImageIcon aria-hidden="true" size={14} strokeWidth={1.8} />
                <span>{busy === "image" ? "导入中…" : "导入当前视角截图"}</span>
              </button>
              <button
                className="export-action-button"
                type="button"
                disabled={importing || !canImport}
                onClick={() => void handleImportFourViewScreenshot()}
              >
                <ImageIcon aria-hidden="true" size={14} strokeWidth={1.8} />
                <span>{busy === "fourImage" ? "导入中…" : "导入四方位截图"}</span>
              </button>
            </div>
          </div>

          <div className="export-section export-video-section">
            <span className="export-section-label">动作视频</span>
            <div className="export-video-row">
              <label className="export-video-label">
                <span>画质</span>
                <select value={exportQuality} onChange={(event) => setExportQuality(event.currentTarget.value as ReferenceVideoExportQuality)} disabled={importing || !canImport}>
                  <option value="720p">720p</option>
                  <option value="1080p">1080p</option>
                </select>
              </label>
              <label className="export-video-label">
                <span>帧率</span>
                <select value={exportFps} onChange={(event) => setExportFps(Number(event.currentTarget.value))} disabled={importing || !canImport}>
                  <option value="24">24 FPS</option>
                  <option value="30">30 FPS</option>
                  <option value="60">60 FPS</option>
                </select>
              </label>
            </div>
            <button
              className="export-action-button export-video-export-btn"
              type="button"
              disabled={importing || !canImport || !hasEnoughKeyframes}
              onClick={() => void handleImportVideo()}
            >
              <Video aria-hidden="true" size={14} strokeWidth={1.8} />
              <span>{busy === "video" ? "正在录制…" : hasEnoughKeyframes ? "导入 MP4 动作视频" : "至少需要 2 个轨迹点"}</span>
            </button>
          </div>

          {status ? <p className="export-status" role="status">{status}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
