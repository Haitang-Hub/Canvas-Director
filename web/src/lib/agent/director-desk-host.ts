import type { NavigateFunction } from "react-router-dom";

import { useCanvasStore } from "@/stores/canvas/use-canvas-store";

/**
 * 画布页内的隐藏导演台宿主：用一个透明但持续渲染的 iframe 承载 3D 导演台，
 * 让 Agent 的 stage/camera/preview 工具在不跳转当前页面的情况下静默执行。
 * iframe 必须保持真实渲染（opacity 0.01 而非 display:none），否则浏览器会节流渲染帧导致导出挂起。
 */

const HOST_FRAME_ID = "canvas-agent-director-host";
const NAVIGATE_MESSAGE_TYPE = "canvas-agent:navigate";
/** 宿主实现版本：桥代码更新后递增，使已存在的 iframe 强制重载到最新实现。 */
const HOST_VERSION = 5;

let currentDeskId = "";
let navigateRef: NavigateFunction | null = null;

/** 导演台弹窗写回画布后广播，宿主页据此刷新本地 store（跨窗口 localforage 不广播）。 */
const CANVAS_SYNC_CHANNEL = "canvas-director-sync";

/** 注册宿主页面的 SPA 导航函数，供 iframe 内的 site_navigate 转发回来使用。 */
export function setDirectorHostNavigate(navigate: NavigateFunction | null) {
    navigateRef = navigate;
}

if (typeof window !== "undefined") {
    const canvasSync = "BroadcastChannel" in window ? new BroadcastChannel(CANVAS_SYNC_CHANNEL) : null;
    canvasSync?.addEventListener("message", (event) => {
        const data = event.data as { type?: string } | null;
        if (data?.type !== "canvas-updated") return;
        void useCanvasStore.persist.rehydrate();
    });
    window.addEventListener("message", (event) => {
        if (event.origin !== window.location.origin) return;
        const data = event.data as { type?: string; path?: string } | null;
        if (data?.type !== NAVIGATE_MESSAGE_TYPE || typeof data.path !== "string" || !data.path.startsWith("/")) return;
        const frame = document.getElementById(HOST_FRAME_ID);
        // 只允许当前宿主 iframe 发起的导航，避免旧 iframe 残留消息。
        if (frame && (frame as HTMLIFrameElement).contentWindow === event.source) navigateRef?.(data.path);
    });
}

/** 打开（或切换）隐藏导演台 iframe；宿主版本或实例变化时重载。 */
export function openDirectorDeskFrame(deskId: string, fromCanvas: string, fromNode: string) {
    const src = `/director/editor?instanceId=${encodeURIComponent(deskId)}&fromCanvas=${encodeURIComponent(fromCanvas)}&fromNode=${encodeURIComponent(fromNode)}`;
    let frame = document.getElementById(HOST_FRAME_ID) as HTMLIFrameElement | null;
    if (!frame) {
        frame = document.createElement("iframe");
        frame.id = HOST_FRAME_ID;
        frame.title = "Canvas Agent 导演台（后台）";
        frame.setAttribute("aria-hidden", "true");
        // 固定全屏尺寸 + 近乎透明 + 穿透点击：保证合成器持续出帧（rAF 正常触发），又不遮挡、不拦截用户操作。
        frame.style.cssText = "position:fixed;inset:0;width:100%;height:100%;opacity:0.01;pointer-events:none;border:0;z-index:-1;";
        document.body.appendChild(frame);
        currentDeskId = "";
    }
    if (frame.dataset.hostVersion !== String(HOST_VERSION) || currentDeskId !== deskId) {
        frame.dataset.hostVersion = String(HOST_VERSION);
        currentDeskId = deskId;
        frame.src = src;
    }
    return { deskId, embedded: true, src };
}

/** 关闭隐藏导演台（切画布/卸载时释放 Three.js 资源）。 */
export function closeDirectorDeskFrame() {
    document.getElementById(HOST_FRAME_ID)?.remove();
    currentDeskId = "";
}
