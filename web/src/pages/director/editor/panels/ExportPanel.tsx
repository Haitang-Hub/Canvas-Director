import { useEffect, useRef, useState } from "react";
import { Download, Image as ImageIcon, LayoutGrid, Video, X } from "lucide-react";
import { requestViewportCapture } from "../io/captureBridge";
import { serializeProject } from "../io/exportProjectJson";
import { downloadDataUrl } from "../io/screenshotExport";
import type { ScreenshotResult } from "../io/screenshotExport";
import {
  downloadReferenceVideo,
  requestReferenceVideoExport,
  type ReferenceVideoExportQuality,
} from "../io/referenceVideoExport";
import { parseProject } from "../io/importProjectJson";
import { getCameraMotionPath } from "../schema/cameraMotion";
import { useDirectorStore } from "../store/directorStore";

function composeFourViewsToSingleImage(results: ScreenshotResult[]): Promise<string | null> {
  return new Promise((resolve) => {
    const images: HTMLImageElement[] = [];
    let loaded = 0;
    let failed = false;

    results.forEach((result) => {
      const img = new globalThis.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        images.push(img);
        loaded += 1;
        if (loaded === results.length && !failed) {
          const cellW = img.naturalWidth;
          const cellH = img.naturalHeight;
          const canvas = document.createElement("canvas");
          canvas.width = cellW * 2;
          canvas.height = cellH * 2;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            failed = true;
            resolve(null);
            return;
          }
          const positions: [number, number][] = [
            [0, 0],
            [cellW, 0],
            [0, cellH],
            [cellW, cellH],
          ];
          images.forEach((imgEl, i) => {
            const [x, y] = positions[i] ?? [0, 0];
            ctx.drawImage(imgEl, x, y, cellW, cellH);
          });
          resolve(canvas.toDataURL("image/png"));
        }
      };
      img.onerror = () => {
        failed = true;
        resolve(null);
      };
      img.src = result.dataUrl;
    });
  });
}

function downloadComposedFourView(results: ScreenshotResult[]) {
  composeFourViewsToSingleImage(results).then((dataUrl) => {
    if (!dataUrl) {
      throw new Error("四方位截图合成失败");
    }
    const baseName = results[0]?.meta.mode === "camera" ? "camera" : "director";
    downloadDataUrl(dataUrl, `storyai-director-desk-four-view-${baseName}.png`);
  });
}

export function ExportPanel() {
  const project = useDirectorStore((state) => state.project);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportFps, setExportFps] = useState(30);
  const [exportQuality, setExportQuality] = useState<ReferenceVideoExportQuality>("720p");
  const [videoExporting, setVideoExporting] = useState(false);
  const [videoExportStatus, setVideoExportStatus] = useState<string | null>(null);

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

  async function handleExportProjectJson() {
    const json = serializeProject(project);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "导演台场景.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleCapture(preset: "current" | "four") {
    setBusy(true);
    setStatus(null);
    try {
      const results = await requestViewportCapture({
        preset,
        source: "capture-panel",
      });
      if (preset === "four") {
        downloadComposedFourView(results);
        setStatus(`已导出 1 张四方位拼图`);
      } else {
        results.forEach((result: ScreenshotResult, index: number) => {
          downloadDataUrl(result.dataUrl, `storyai-director-desk-${result.meta.mode}-view-${index + 1}.png`);
        });
        setStatus(`已导出 ${results.length} 张截图`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "截图失败");
    } finally {
      setBusy(false);
    }
  }

  function handleImportProjectJson(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = parseProject(reader.result as string);
        useDirectorStore.getState().replaceProject(imported);
        setOpen(false);
        setStatus("工程已导入");
      } catch {
        setStatus("工程文件解析失败");
      }
    };
    reader.readAsText(file);
    event.currentTarget.value = "";
  }

  const activeCamera = project.cameras.find((c) => c.id === project.activeCameraId) ?? project.cameras[0] ?? null;
  const motionPath = activeCamera ? getCameraMotionPath(activeCamera) : null;
  const hasEnoughKeyframes = (motionPath?.keyframes.length ?? 0) >= 2;

  async function handleExportVideo() {
    if (!hasEnoughKeyframes || videoExporting) return;
    setVideoExporting(true);
    setVideoExportStatus("正在录制参考视频…");
    try {
      const result = await requestReferenceVideoExport({
        fileName: `${activeCamera?.name || "运镜"}-参考视频.mp4`,
        fps: exportFps,
        quality: exportQuality,
      });
      downloadReferenceVideo(result);
      setVideoExportStatus("MP4 参考视频已下载");
    } catch (error) {
      setVideoExportStatus(error instanceof Error ? error.message : "参考视频导出失败");
    } finally {
      setVideoExporting(false);
    }
  }

  return (
    <div className="export-panel" ref={wrapperRef}>
      <button
        ref={triggerRef}
        aria-label="导出"
        aria-controls="export-panel-popover"
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`export-trigger${open ? " is-active" : ""}`}
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <Download aria-hidden="true" size={15} strokeWidth={1.9} />
        <span>导出</span>
      </button>

      {open ? (
        <section
          id="export-panel-popover"
          className="export-popover"
          role="dialog"
          aria-label="导出选项"
        >
          <header className="export-popover-header">
            <div>
              <strong>导出</strong>
              <small>工程文件、截图与参考视频</small>
            </div>
            <button aria-label="关闭导出面板" type="button" onClick={() => setOpen(false)}>
              <X aria-hidden="true" size={15} />
            </button>
          </header>

          <div className="export-section">
            <span className="export-section-label">工程文件</span>
            <div className="export-actions">
              <button className="export-action-button" type="button" onClick={handleExportProjectJson}>
                <Download aria-hidden="true" size={14} strokeWidth={1.8} />
                <span>导出工程 JSON</span>
              </button>
              <button
                className="export-action-button"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon aria-hidden="true" size={14} strokeWidth={1.8} />
                <span>导入工程 JSON</span>
              </button>
              <input
                ref={fileInputRef}
                className="hidden-file-input"
                accept="application/json"
                tabIndex={-1}
                type="file"
                onChange={handleImportProjectJson}
              />
            </div>
          </div>

          <div className="export-section">
            <span className="export-section-label">截图</span>
            <div className="export-actions">
              <button
                className="export-action-button"
                type="button"
                disabled={busy}
                onClick={() => void handleCapture("current")}
              >
                <ImageIcon aria-hidden="true" size={14} strokeWidth={1.8} />
                <span>{busy ? "处理中…" : "当前视角截图"}</span>
              </button>
              <button
                className="export-action-button"
                type="button"
                disabled={busy}
                onClick={() => void handleCapture("four")}
              >
                <LayoutGrid aria-hidden="true" size={14} strokeWidth={1.8} />
                <span>{busy ? "处理中…" : "四方位截图"}</span>
              </button>
            </div>
          </div>

          <div className="export-section export-video-section">
            <span className="export-section-label">参考视频</span>
            <div className="export-video-row">
              <label className="export-video-label">
                <span>画质</span>
                <select value={exportQuality} onChange={(e) => setExportQuality(e.target.value as ReferenceVideoExportQuality)} disabled={videoExporting}>
                  <option value="720p">720p</option>
                  <option value="1080p">1080p</option>
                </select>
              </label>
              <label className="export-video-label">
                <span>帧率</span>
                <select value={exportFps} onChange={(e) => setExportFps(Number(e.target.value))} disabled={videoExporting}>
                  <option value="24">24 FPS</option>
                  <option value="30">30 FPS</option>
                  <option value="60">60 FPS</option>
                </select>
              </label>
            </div>
            <button
              className="export-action-button export-video-export-btn"
              type="button"
              disabled={!hasEnoughKeyframes || videoExporting}
              onClick={() => void handleExportVideo()}
            >
              <Video aria-hidden="true" size={14} strokeWidth={1.8} />
              <span>{videoExporting ? "正在录制…" : hasEnoughKeyframes ? "导出 MP4" : "至少需要 2 个轨迹点"}</span>
            </button>
            {videoExportStatus ? <p className="export-video-status">{videoExportStatus}</p> : null}
          </div>

          {status ? <p className="export-status" role="status">{status}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
