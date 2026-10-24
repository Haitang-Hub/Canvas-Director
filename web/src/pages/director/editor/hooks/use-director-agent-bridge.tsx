import { useEffect, useRef } from "react";

import { createCanvasNode, imageMetadata, videoMetadata } from "@/lib/canvas/canvas-node-factory";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import { uploadMediaFile } from "@/services/file-storage";
import { uploadImage } from "@/services/image-storage";
import { CanvasNodeType } from "@/types/canvas";
import { nanoid } from "nanoid";

import { requestCleanFrameExport } from "../io/cleanFrameExport";
import { requestReferenceVideoExport } from "../io/referenceVideoExport";
import { getCameraMotionPath } from "../schema/cameraMotion";
import { getObjectMotionSnapshot } from "../schema/objectMotion";
import { getDirectorObjectFocusTarget } from "../schema/cameraTarget";
import { DIRECTOR_CAMERA_TARGET_BODY_PART_OPTIONS, type DirectorCameraTargetBodyPart } from "../schema/semanticBody";
import { GEOMETRY_PRIMITIVE_OPTIONS } from "../schema/directorProject";
import { MANNEQUIN_POSE_PRESETS } from "../presets/mannequinPosePresets";
import { CHARACTER_ACTION_PRESETS } from "../presets/characterActionPresets";
import { CAMERA_PATH_TEMPLATES, createCameraPathTemplate } from "../motion/cameraPathTemplates";
import { BUILTIN_LIFE_MODELS } from "../modelLibrary/modelLibraryCatalog";
import { CAMERA_MOTION_PRESETS, getCameraMotionPresetPatch } from "../motion/cameraMotionPresets";
import { useDirectorStore } from "../store/directorStore";
import { readActiveDirectorDeskId } from "../workspaces/directorDeskRegistry";

type DirectorToolInput = {
    bodyType?: string;
    geometryType?: "box" | "sphere" | "cylinder" | "torus" | "cone" | "pyramid";
    objectId?: string;
    assetId?: string;
    cameraId?: string;
    keyframeId?: string;
    name?: string;
    pose?: string;
    action?: string | null;
    poseControls?: Record<string, number>;
    color?: string;
    rotation?: number;
    scale?: number;
    visible?: boolean;
    locked?: boolean;
    x?: number;
    y?: number;
    z?: number;
    targetX?: number;
    targetY?: number;
    targetZ?: number;
    fov?: number;
    time?: number;
    easing?: "linear" | "ease-in-out";
    pointBehavior?: "pass" | "hold";
    holdSeconds?: number;
    targetMode?: "manual" | "object";
    subjectObjectId?: string;
    targetBodyPart?: DirectorCameraTargetBodyPart;
    targetFollowMode?: "immediate" | "smooth";
    templateId?: string;
    range?: number;
    duration?: number;
    interpolation?: "linear" | "smooth";
    speedMode?: "uniform" | "soft" | "custom";
    presetId?: string;
    position?: "current" | "first" | "last";
    quality?: "720p" | "1080p";
    fps?: 24 | 30 | 60;
    fileName?: string;
    includeData?: boolean;
    returnToCanvas?: boolean;
};

const DIRECTOR_AGENT_PROTOCOL_VERSION = 7;
/** 桥实现版本：服务端在多个导演台页面同时连接时优先路由到最新版本。 */
const DIRECTOR_BRIDGE_VERSION = 6;

/**
 * 导演台页面与本机 Canvas Agent 的无界面桥：以 director 角色接入 SSE，
 * 接收 stage / camera / preview 工具调用，直接驱动导演台 store 与导出器执行。
 */
export function DirectorAgentBridge() {
    const clientIdRef = useRef(`director-${Math.random().toString(36).slice(2, 10)}`);

    useEffect(() => {
        const endpoint = (localStorage.getItem("canvas-agent-url") || "").replace(/\/$/, "");
        const token = localStorage.getItem("canvas-agent-token") || "";
        if (!endpoint || !token) return;

        const clientId = clientIdRef.current;
        let disposed = false;
        const source = new EventSource(`${endpoint}/events?token=${encodeURIComponent(token)}&clientId=${encodeURIComponent(clientId)}&role=director&dv=${DIRECTOR_BRIDGE_VERSION}&desk=${encodeURIComponent(new URLSearchParams(window.location.search).get("instanceId") || "")}`);

        // 编辑器完全加载后上报就绪；未就绪的窗口不参与导演台工具路由。
        const reportReady = () => {
            const deskId = new URLSearchParams(window.location.search).get("instanceId") || "";
            void fetch(endpoint + "/director/ready?token=" + encodeURIComponent(token), {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ clientId, deskId }),
            }).catch(() => undefined);
        };
        reportReady();
        source.addEventListener("hello", (event) => {
            const hello = parseData(event);
            if (!hello || disposed) return;
            if (Number(hello.protocolVersion) !== DIRECTOR_AGENT_PROTOCOL_VERSION) source.close();
        });
        source.addEventListener("tool_call", (event) => {
            const payload = parseData(event) as { requestId?: string; name?: string; input?: DirectorToolInput } | null;
            if (!payload?.requestId || !payload.name) return;
            void runDirectorTool(payload.name, payload.input || {})
                .then((result) => postResult(endpoint, token, clientId, payload.requestId!, { result }))
                .catch((error) => postResult(endpoint, token, clientId, payload.requestId!, { error: error instanceof Error ? error.message : String(error) }));
        });

        return () => {
            disposed = true;
            source.close();
        };
    }, []);

    return null;
}

/** 统一应用位置/朝向/缩放：rotation 为绕 Y 轴角度（度），scale 为等比倍数，未给的字段沿用当前值。 */
function applyObjectPlacement(objectId: string, input: DirectorToolInput) {
    if (input.x === undefined && input.y === undefined && input.z === undefined && input.rotation === undefined && input.scale === undefined) return;
    const object = useDirectorStore.getState().project.objects.find((item) => item.id === objectId);
    if (!object) throw new Error(`找不到对象：${objectId}`);
    const position = [
        input.x ?? object.transform.position[0],
        input.y ?? object.transform.position[1],
        input.z ?? object.transform.position[2],
    ] as [number, number, number];
    const rotation = input.rotation !== undefined ? [object.transform.rotation[0], (input.rotation * Math.PI) / 180, object.transform.rotation[2]] as [number, number, number] : object.transform.rotation;
    const scale = input.scale !== undefined ? (() => {
        const factor = Math.max(0.05, input.scale);
        return [object.transform.scale[0] * factor, object.transform.scale[1] * factor, object.transform.scale[2] * factor] as [number, number, number];
    })() : object.transform.scale;
    useDirectorStore.getState().updateObjectTransform(objectId, { position, rotation, scale });
}

async function runDirectorTool(name: string, input: DirectorToolInput) {
    // 导演台页面上没有画布客户端时，site_navigate 兜底路由到这里：
    // 独立页直接导航；隐藏 iframe 中则转发给宿主页处理，保持"画布不跳转"的静默约定。
    if (name === "site_navigate") {
        const path = typeof (input as Record<string, unknown>).path === "string" ? (input as { path: string }).path : "";
        if (!path.startsWith("/")) throw new Error("无效的站点路径");
        if (window.self !== window.top) {
            window.parent.postMessage({ type: "canvas-agent:navigate", path }, window.location.origin);
            return { ok: true, path, forwardedToHost: true };
        }
        window.location.assign(path);
        return { ok: true, path, navigated: true };
    }
    const store = useDirectorStore.getState();
    switch (name) {
        case "stage_get_state": {
            const project = store.project;
            return {
                deskId: readActiveDirectorDeskId() || "",
                objects: project.objects.map((object) => ({ id: object.id, name: object.name, kind: object.kind, visible: object.visible, geometryType: object.geometryType ?? null, position: object.transform.position })),
                cameras: project.cameras.map((camera) => ({ id: camera.id, name: camera.name, fov: camera.fov, keyframeCount: getCameraMotionPath(camera).keyframes.length })),
                activeCameraId: project.activeCameraId,
            };
        }
        case "stage_add_model": {
            // 从模型库放置模型：按 assetId/name 匹配内置模型库条目，注册资产并创建场景对象。
            const project = useDirectorStore.getState().project;
            const known = new Map((project.assets || []).filter((asset) => asset.sourceType === "model" && asset.kind !== "panorama").map((asset) => [asset.id, asset]));
            const wanted = input.assetId || input.name || "";
            const libraryItem = BUILTIN_LIFE_MODELS.find((item) => item.id === wanted || item.name === wanted || item.name.includes(wanted) || wanted.includes(item.name));
            if (!libraryItem && !known.has(wanted)) throw new Error(`模型库中找不到模型：${wanted}，用 stage_list_presets 查询 library`);
            let objectId: string | null = null;
            if (libraryItem && !known.has(libraryItem.id)) {
                store.addImportedAsset({
                    kind: (libraryItem as { kind?: string }).kind ?? "prop",
                    assetSource: "library",
                    fileName: libraryItem.fileName,
                    name: libraryItem.name,
                    url: libraryItem.url,
                    modelFormat: libraryItem.fileName.toLowerCase().endsWith(".glb") ? "glb" : libraryItem.fileName.toLowerCase().endsWith(".fbx") ? "fbx" : undefined,
                });
                objectId = useDirectorStore.getState().selectedObjectId;
            } else {
                objectId = store.addObjectFromAsset(libraryItem ? libraryItem.id : wanted);
            }
            if (!objectId) throw new Error(`添加模型失败：${wanted}`);
            applyObjectPlacement(objectId, input);
            if (input.name) store.updateObjectName(objectId, input.name);
            return { objectId, assetId: libraryItem?.id || wanted, name: input.name || libraryItem?.name };
        }
        case "stage_clear_scene": {
            // 清空场景：删除全部角色与道具；keepCameras 默认 true 时机位对象一并保留。
            const keepCameras = input.keepCameras !== false;
            const project = useDirectorStore.getState().project;
            const removed = project.objects
                .filter((object) => (keepCameras ? object.kind !== "camera" : true))
                .map((object) => {
                    store.deleteObject(object.id);
                    return { id: object.id, name: object.name, kind: object.kind };
                });
            return { removed, remaining: useDirectorStore.getState().project.objects.length };
        }
        case "stage_list_presets": {
            return {
                poses: MANNEQUIN_POSE_PRESETS.map((preset) => ({ id: preset.id, label: preset.label })),
                actions: CHARACTER_ACTION_PRESETS.map((preset) => ({ id: preset.id, label: preset.label })),
                geometries: GEOMETRY_PRIMITIVE_OPTIONS.map((option) => ({ id: option.type, label: option.label })),
                library: useDirectorStore.getState().project.assets.filter((asset) => asset.sourceType === "model" && asset.kind !== "panorama").map((asset) => ({ id: asset.id, label: asset.name })),
                motionTemplates: {
                    official: CAMERA_PATH_TEMPLATES.filter((template) => template.group === "official").map((template) => ({ id: template.id, label: template.label, description: template.description })),
                    community: CAMERA_PATH_TEMPLATES.filter((template) => template.group === "community").map((template) => ({ id: template.id, label: template.label, description: template.description })),
                },
                motionTiming: CAMERA_MOTION_PRESETS.map((preset) => ({ id: preset.id, label: preset.label, ...preset.patch })),
                cameraBodyParts: DIRECTOR_CAMERA_TARGET_BODY_PART_OPTIONS.map((option) => ({ id: option.value, label: option.label })),
            };
        }
        case "stage_place_character": {
            store.addPresetCharacter((input.bodyType || undefined) as Parameters<typeof store.addPresetCharacter>[0]);
            const objectId = useDirectorStore.getState().selectedObjectId;
            if (!objectId) throw new Error("放置角色失败");
            applyObjectPlacement(objectId, input);
            if (input.pose) {
                if (!MANNEQUIN_POSE_PRESETS.some((preset) => preset.id === input.pose)) throw new Error(`未知姿势预设：${input.pose}，用 stage_list_presets 查询可用值`);
                store.applyPosePreset(objectId, input.pose as Parameters<typeof store.applyPosePreset>[1]);
            }
            if (input.name) store.updateObjectName(objectId, input.name);
            return { objectId };
        }
        case "stage_place_prop": {
            if (!input.geometryType) throw new Error("缺少 geometryType");
            store.addGeometryPrimitive(input.geometryType);
            const objectId = useDirectorStore.getState().selectedObjectId;
            if (!objectId) throw new Error("放置道具失败");
            applyObjectPlacement(objectId, input);
            return { objectId };
        }
        case "stage_update_object": {
            if (!input.objectId) throw new Error("缺少 objectId");
            const object = useDirectorStore.getState().project.objects.find((item) => item.id === input.objectId);
            if (!object) throw new Error(`找不到对象：${input.objectId}`);
            applyObjectPlacement(input.objectId, input);
            if (input.name) store.updateObjectName(input.objectId, input.name);
            if (input.color) store.updateObjectColor(input.objectId, input.color);
            if (input.visible !== undefined && object.visible !== input.visible) store.toggleObjectVisible(input.objectId);
            if (input.locked !== undefined && object.locked !== input.locked) store.toggleObjectLocked(input.objectId);
            if (input.pose) {
                if (!MANNEQUIN_POSE_PRESETS.some((preset) => preset.id === input.pose)) throw new Error(`未知姿势预设：${input.pose}，用 stage_list_presets 查询可用值`);
                store.applyPosePreset(input.objectId, input.pose as Parameters<typeof store.applyPosePreset>[1]);
            }
            if (input.action !== undefined) {
                if (input.action && !CHARACTER_ACTION_PRESETS.some((preset) => preset.id === input.action)) throw new Error(`未知动作预设：${input.action}，用 stage_list_presets 查询可用值`);
                store.applyCharacterActionPreset(input.objectId, input.action || null);
            }
            if (input.poseControls) {
                Object.entries(input.poseControls).forEach(([key, value]) => store.updatePoseControl(input.objectId!, key, Number(value)));
            }
            return { objectId: input.objectId, applied: true };
        }
        case "stage_remove_object": {
            if (!input.objectId) throw new Error("缺少 objectId");
            store.deleteObject(input.objectId);
            return { ok: true };
        }
        case "camera_set_keyframe": {
            // 在指定机位（缺省为活动机位）的运动路径上追加一个关键帧；需要新建机位时用 stage_place_prop 的 camera 语义或手动创建。
            const project = useDirectorStore.getState().project;
            const cameraId = input.cameraId || project.activeCameraId || project.cameras[0]?.id || "";
            if (!cameraId) throw new Error("导演台没有任何机位，无法添加关键帧");
            const keyframeId = store.addCameraMotionKeyframe(cameraId);
            if (!keyframeId) throw new Error(`找不到机位：${cameraId}`);
            if (input.time !== undefined) store.updateCameraMotionKeyframe(cameraId, keyframeId, { time: input.time });
            const path = getCameraMotionPath(useDirectorStore.getState().project.cameras.find((camera) => camera.id === cameraId)!);
            return { cameraId, keyframeId, keyframeCount: path.keyframes.length };
        }
        case "camera_update_keyframe": {
            if (!input.cameraId || !input.keyframeId) throw new Error("缺少 cameraId 或 keyframeId");
            const camera = useDirectorStore.getState().project.cameras.find((item) => item.id === input.cameraId);
            if (!camera) throw new Error(`找不到机位：${input.cameraId}`);
            const keyframe = getCameraMotionPath(camera).keyframes.find((item) => item.id === input.keyframeId);
            if (!keyframe) throw new Error(`机位 ${input.cameraId} 上找不到关键帧：${input.keyframeId}，用 camera_get_trajectory 查询`);
            const patch: Record<string, unknown> = {};
            if (input.x !== undefined || input.y !== undefined || input.z !== undefined) {
                patch.position = [input.x ?? keyframe.position[0], input.y ?? keyframe.position[1], input.z ?? keyframe.position[2]];
            }
            if (input.targetX !== undefined || input.targetY !== undefined || input.targetZ !== undefined) {
                patch.target = [input.targetX ?? keyframe.target[0], input.targetY ?? keyframe.target[1], input.targetZ ?? keyframe.target[2]];
            }
            if (input.fov !== undefined) patch.fov = input.fov;
            if (input.time !== undefined) patch.time = input.time;
            if (input.easing !== undefined) patch.easing = input.easing;
            if (input.pointBehavior !== undefined) patch.pointBehavior = input.pointBehavior;
            if (input.holdSeconds !== undefined) patch.holdSeconds = input.holdSeconds;
            if (input.targetMode !== undefined) patch.targetMode = input.targetMode;
            if (input.subjectObjectId !== undefined) patch.targetObjectId = input.subjectObjectId;
            if (input.targetBodyPart !== undefined) patch.targetBodyPart = input.targetBodyPart;
            if (input.targetFollowMode !== undefined) patch.targetFollowMode = input.targetFollowMode;
            store.updateCameraMotionKeyframe(input.cameraId, input.keyframeId, patch);
            return { cameraId: input.cameraId, keyframeId: input.keyframeId, updated: Object.keys(patch) };
        }
        case "camera_delete_keyframe": {
            if (!input.cameraId || !input.keyframeId) throw new Error("缺少 cameraId 或 keyframeId");
            store.deleteCameraMotionKeyframe(input.cameraId, input.keyframeId);
            return { cameraId: input.cameraId, keyframeId: input.keyframeId, deleted: true };
        }
        case "camera_apply_preset": {
            if (!input.templateId) throw new Error("缺少 templateId，用 stage_list_presets 查询 motionTemplates");
            const project = useDirectorStore.getState().project;
            const cameraId = input.cameraId || project.activeCameraId || project.cameras[0]?.id || "";
            const camera = project.cameras.find((item) => item.id === cameraId);
            if (!camera) throw new Error(`找不到机位：${cameraId || "(无机位)"}`);
            const targetObject = input.subjectObjectId ? project.objects.find((item) => item.id === input.subjectObjectId) : null;
            if (input.subjectObjectId && !targetObject) throw new Error(`找不到跟踪主体：${input.subjectObjectId}，用 stage_get_state 查询对象 ID`);
            const duration = getCameraMotionPath(camera).duration || 6;
            const focusAt = targetObject
                ? (progress: number) => getDirectorObjectFocusTarget({ ...targetObject, transform: getObjectMotionSnapshot(targetObject, progress, duration) })
                : () => [...camera.target] as [number, number, number];
            const generated = createCameraPathTemplate({
                cameraId,
                focusAt,
                scale: Math.min(3, Math.max(0.25, input.range ?? 1)),
                snapshot: { fov: camera.fov, position: camera.transform.position, target: camera.target },
                targetObjectId: targetObject?.id ?? null,
                targetBodyPart: input.targetBodyPart ?? (targetObject?.kind === "character" ? "chest" : "center"),
                targetFollowMode: input.targetFollowMode ?? "smooth",
                templateId: input.templateId as Parameters<typeof createCameraPathTemplate>[0]["templateId"],
            });
            store.updateCameraMotionPath(cameraId, generated);
            useDirectorStore.getState().setActiveCamera(cameraId);
            return { cameraId, templateId: input.templateId, keyframeCount: generated.keyframes.length, duration: generated.duration, subject: targetObject?.name ?? null };
        }
        case "camera_set_pacing": {
            const project = useDirectorStore.getState().project;
            const cameraId = input.cameraId || project.activeCameraId || project.cameras[0]?.id || "";
            if (!cameraId) throw new Error("导演台没有任何机位");
            const patch: Record<string, unknown> = {};
            if (input.presetId) {
                const presetPatch = getCameraMotionPresetPatch(input.presetId);
                if (!presetPatch) throw new Error(`未知节奏预设：${input.presetId}，用 stage_list_presets 查询 motionTiming`);
                Object.assign(patch, presetPatch);
            }
            if (input.duration !== undefined) patch.duration = input.duration;
            if (input.interpolation !== undefined) patch.interpolation = input.interpolation;
            if (input.easing !== undefined) patch.easing = input.easing;
            if (input.speedMode !== undefined) patch.speedMode = input.speedMode;
            store.updateCameraMotionPath(cameraId, patch);
            return { cameraId, applied: Object.keys(patch) };
        }
        case "camera_set_pose": {
            // 设置机位位姿：缺省作用于活动机位；未指定 y/target 时沿用机位当前值。
            const project = useDirectorStore.getState().project;
            const cameraId = input.cameraId || project.activeCameraId || project.cameras[0]?.id || "";
            const camera = project.cameras.find((item) => item.id === cameraId);
            if (!camera) throw new Error(`找不到机位：${cameraId || "(无机位)"}`);
            const position = [
                input.x ?? camera.transform.position[0],
                input.y ?? camera.transform.position[1],
                input.z ?? camera.transform.position[2],
            ] as [number, number, number];
            const target = [
                input.targetX ?? camera.target[0],
                input.targetY ?? camera.target[1],
                input.targetZ ?? camera.target[2],
            ] as [number, number, number];
            const fov = input.fov ?? camera.fov;
            useDirectorStore.getState().updateCamera(cameraId, { transform: { ...camera.transform, position }, target, fov });
            useDirectorStore.getState().setActiveCamera(cameraId);
            return { cameraId, position, target, fov, active: true };
        }
        case "camera_get_trajectory": {
            const project = useDirectorStore.getState().project;
            return {
                activeCameraId: project.activeCameraId,
                cameras: project.cameras.map((camera) => ({ id: camera.id, name: camera.name, fov: camera.fov, path: getCameraMotionPath(camera) })),
            };
        }
        case "preview_render_frame": {
            const result = await requestCleanFrameExport({
                fileName: `director-frame-${Date.now()}.png`,
                position: input.position || "current",
                quality: input.quality || "1080p",
            });
            const summary = {
                fileName: result.fileName,
                width: result.width,
                height: result.height,
                mimeType: result.mimeType,
                ...(input.includeData ? { dataUrl: result.dataUrl } : {}),
                returnedToCanvas: false,
            };
            if (input.returnToCanvas === false) return summary;
            const canvasNodeId = await appendFrameToCanvas(result.dataUrl, input.fileName || result.fileName);
            return canvasNodeId ? { ...summary, returnedToCanvas: true, canvasNodeId } : summary;
        }
        case "preview_export_animatic": {
            // 预检活动机位关键帧数，给出可操作的错误而不是笼统的导出失败。
            const activeCamera = useDirectorStore.getState().project.cameras.find((camera) => camera.id === useDirectorStore.getState().project.activeCameraId);
            const keyframeCount = activeCamera ? getCameraMotionPath(activeCamera).keyframes.length : 0;
            if (keyframeCount < 2) throw new Error(`当前活动机位轨迹只有 ${keyframeCount} 个关键帧，导出预演至少需要 2 个：先用 camera_set_pose 调整机位视角，再用 camera_set_keyframe 逐个记录关键帧`);
            const result = await requestReferenceVideoExport({
                fileName: input.fileName || `director-animatic-${Date.now()}.mp4`,
                fps: input.fps || 30,
                quality: input.quality || "720p",
            });
            const summary = { fileName: result.fileName, width: result.width, height: result.height, durationSeconds: result.durationSeconds, mimeType: result.mimeType, returnedToCanvas: false };
            if (input.returnToCanvas === false) return summary;
            const canvasNodeId = await appendAnimaticToCanvas(result.blob);
            return canvasNodeId ? { ...summary, returnedToCanvas: true, canvasNodeId } : summary;
        }
        default:
            throw new Error(`未知导演台工具：${name}`);
    }
}

/** 从画布 URL 参数解析导演台来源节点；没有来源时返回空。 */
async function readImportTarget() {
    // 弹窗/iframe 里 store 可能尚未完成异步加载，先等待水合以获得精确的摆放位置。
    const storeState = useCanvasStore.getState();
    if (!storeState.hydrated) await useCanvasStore.persist.rehydrate();
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get("fromCanvas")?.trim() || "";
    // fromNode 缺失时按导演台实例 ID 反查来源节点，兜底历史 stage_open 打开的窗口。
    let directorNodeId = params.get("fromNode")?.trim() || "";
    const instanceId = params.get("instanceId")?.trim() || "";
    if (!projectId) return null;
    const project = useCanvasStore.getState().projects.find((item) => item.id === projectId);
    if (!project) return null;
    if (!directorNodeId && instanceId) {
        directorNodeId = project.nodes.find((node) => node.metadata?.directorDeskId === instanceId || (node as { nodeType?: string }).nodeType === "director")?.id || "";
    }
    const directorNode = project.nodes.find((node) => node.id === directorNodeId);
    if (!directorNode) return null;
    return { projectId, directorNodeId, project, directorNode };
}

/** 把产物作为画布 ops 发给宿主页应用（与 Agent 画布操作同一路径，React 状态/撤销/快照一致）。 */
function requestHostApplyOps(projectId: string, ops: unknown[]): Promise<{ canvasNodeId?: string }> {
    return new Promise((resolve, reject) => {
        const requestId = crypto.randomUUID();
        const target = window.self !== window.top ? window.parent : window.opener;
        if (!target) throw new Error("写回画布失败：当前窗口没有宿主页（请从画布的导演台节点重新 stage_open）");
        const timer = window.setTimeout(() => {
            window.removeEventListener("message", onMessage);
            reject(new Error("写回画布超时：宿主页未响应"));
        }, 15000);
        const onMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            const data = event.data as { type?: string; requestId?: string; result?: { canvasNodeId?: string }; error?: string } | null;
            if (data?.type !== "canvas-agent:apply-ops-result" || data.requestId !== requestId) return;
            window.clearTimeout(timer);
            window.removeEventListener("message", onMessage);
            data.error ? reject(new Error(data.error)) : resolve(data.result || {});
        };
        window.addEventListener("message", onMessage);
        target.postMessage({ type: "canvas-agent:apply-ops", requestId, projectId, ops }, window.location.origin);
    });
}

/** 构造产物节点（放在导演台节点右侧并连线）；content 由宿主按 storageKey 重解析。 */
function buildCaptureOps(target: { projectId: string; directorNodeId: string; project: { nodes: import("@/types/canvas").CanvasNodeData[] } }, node: import("@/types/canvas").CanvasNodeData) {
    const directorNode = target.project.nodes.find((item) => item.id === target.directorNodeId)!;
    const importedCount = target.project.nodes.filter((item) => item.metadata?.sourceDirectorNodeId === target.directorNodeId).length;
    const placedNode: import("@/types/canvas").CanvasNodeData = {
        ...node,
        position: { x: directorNode.position.x + directorNode.width + 96 + importedCount * (node.width + 40), y: directorNode.position.y + directorNode.height / 2 - node.height / 2 },
        metadata: { ...node.metadata, sourceDirectorNodeId: target.directorNodeId },
    };
    return [
        { type: "add_node", id: placedNode.id, nodeType: placedNode.type, title: placedNode.title, position: placedNode.position, width: placedNode.width, height: placedNode.height, metadata: placedNode.metadata },
        { type: "connect_nodes", fromNodeId: target.directorNodeId, toNodeId: placedNode.id },
    ];
}

/** 把预演视频写回来源画布并连线到导演台节点。 */
async function appendAnimaticToCanvas(blob: Blob) {
    const target = await readImportTarget();
    if (!target) throw new Error("写回画布失败：找不到来源画布或导演台节点，请从画布的导演台节点重新 stage_open 后再导出");
    const uploaded = await uploadMediaFile(blob, "video");
    const node = { ...createCanvasNode(CanvasNodeType.Video, { x: 0, y: 0 }, videoMetadata(uploaded)), title: "导演台预演", id: "video-" + crypto.randomUUID() };
    const result = await requestHostApplyOps(target.projectId, buildCaptureOps(target, node as import("@/types/canvas").CanvasNodeData));
    return result.canvasNodeId || node.id;
}

/** 把当前视角截图写回来源画布并连线到导演台节点。 */
async function appendFrameToCanvas(dataUrl: string, fileName: string) {
    const target = await readImportTarget();
    if (!target) throw new Error("写回画布失败：找不到来源画布或导演台节点，请从画布的导演台节点重新 stage_open 后再导出");
    const uploaded = await uploadImage(dataUrl, { fileName });
    const node = { ...createCanvasNode(CanvasNodeType.Image, { x: 0, y: 0 }, imageMetadata(uploaded)), title: "导演台参考帧", id: "image-" + crypto.randomUUID() };
    const result = await requestHostApplyOps(target.projectId, buildCaptureOps(target, node as import("@/types/canvas").CanvasNodeData));
    return result.canvasNodeId || node.id;
}

async function postResult(endpoint: string, token: string, clientId: string, requestId: string, body: { result?: unknown; error?: string }) {
    await fetch(`${endpoint}/canvas/result?token=${encodeURIComponent(token)}&clientId=${encodeURIComponent(clientId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId, ...body }),
    });
}

function parseData(event: MessageEvent) {
    try {
        return JSON.parse(event.data as string) as Record<string, unknown>;
    } catch {
        return null;
    }
}
