/**
 * 内置 Agent 的工具表（OpenAI function calling 形态）。
 * 与 director-mcp/src/schema/tools.js 保持对齐（双份实现，改名/改参需同步并递增协议版本）。
 * 执行器复用 use-director-agent-bridge 的 runDirectorTool，与 SSE 桥行为完全一致。
 */

export type AgentToolParameterSchema = { type: "object"; properties: Record<string, unknown>; required?: string[] };

const placement = {
    name: { type: "string", description: "对象显示名" },
    x: { type: "number", description: "世界坐标 X" },
    y: { type: "number", description: "世界坐标 Y（高度）" },
    z: { type: "number", description: "世界坐标 Z" },
    rotation: { type: "number", description: "绕 Y 轴朝向角（度）" },
    scale: { type: "number", description: "等比缩放倍数（0.05 起）" },
};

export const DIRECTOR_AGENT_SYSTEM_PROMPT = [
    "你是 3D 导演台的内置 AI 助手，通过工具直接驱动导演台：摆角色/道具、设运镜、渲染单帧、导出预演成片。用户在编辑器里能实时看到你的每一步操作。",
    "工作流：先用 stage_get_state 了解场景、用 stage_list_presets 查可用预设（姿势/动作/几何体/模型库/运镜模板/节奏）——不要凭空编造预设 ID；",
    "然后 stage_place_character / stage_place_prop / stage_add_model 摆场（坐标系：x 右、y 上、z 前，rotation 为绕 Y 轴角度；两人对话让朝向相差约 180°、间距 1.5~2.5）；",
    "运镜可 camera_apply_preset 快捷生成，或 camera_set_pose 调视角后 camera_set_keyframe 逐帧记录（至少 2 个关键帧才能出片）；",
    "需要确认构图时 preview_render_frame 出单帧；最终成片用 preview_export_animatic（耗时可达数分钟）。",
    "破坏性操作（stage_clear_scene、stage_remove_object、camera_delete_keyframe）执行前先向用户确认或先 stage_get_state 核对。",
    "回答用中文、简洁；汇报结果时引用返回的对象 ID 与文件名，方便用户在界面上对照。",
].join("\n");

export const DIRECTOR_AGENT_TOOLS: Array<{ type: "function"; function: { name: string; description: string; parameters: AgentToolParameterSchema } }> = [
    { type: "function", function: { name: "stage_get_state", description: "读取当前场景状态：对象列表（含位置）、机位列表（含关键帧数）、活动机位。", parameters: { type: "object", properties: {} } } },
    {
        type: "function",
        function: {
            name: "stage_add_model",
            description: "从模型库添加模型到场景，可同时指定摆放位置与朝向。",
            parameters: { type: "object", properties: { ...placement, assetId: { type: "string", description: "模型库资产 ID（stage_list_presets 查询 library）；name 也可用于模糊匹配模型库" } } },
        },
    },
    { type: "function", function: { name: "stage_clear_scene", description: "清空场景：删除全部角色与道具（机位默认保留）。破坏性操作。", parameters: { type: "object", properties: { keepCameras: { type: "boolean", description: "是否保留机位，默认 true" } } } } },
    { type: "function", function: { name: "stage_list_presets", description: "列出可用预设：姿势、动作、几何体、模型库、运镜模板、运镜节奏、可跟踪身体部位。", parameters: { type: "object", properties: {} } } },
    {
        type: "function",
        function: {
            name: "stage_place_character",
            description: "放置一个角色（人模），可指定姿势预设与摆放位置。",
            parameters: { type: "object", properties: { bodyType: { type: "string", description: "体型（缺省默认）" }, pose: { type: "string", description: "姿势预设 ID" }, ...placement } },
        },
    },
    {
        type: "function",
        function: {
            name: "stage_place_prop",
            description: "放置一个几何体道具。",
            parameters: { type: "object", properties: { geometryType: { type: "string", enum: ["box", "sphere", "cylinder", "torus", "cone", "pyramid"], description: "几何体类型" }, ...placement }, required: ["geometryType"] },
        },
    },
    {
        type: "function",
        function: {
            name: "stage_update_object",
            description: "更新场景对象：位置/朝向/缩放、名称、颜色、可见性、锁定、姿势、动作或姿势细调。",
            parameters: {
                type: "object",
                properties: {
                    objectId: { type: "string", description: "目标对象 ID" },
                    color: { type: "string", description: "CSS 颜色值" },
                    visible: { type: "boolean", description: "是否可见" },
                    locked: { type: "boolean", description: "是否锁定" },
                    pose: { type: "string", description: "姿势预设 ID" },
                    action: { type: ["string", "null"], description: "动作预设 ID；null 清除" },
                    poseControls: { type: "object", additionalProperties: { type: "number" }, description: "姿势细调参数" },
                    ...placement,
                },
                required: ["objectId"],
            },
        },
    },
    { type: "function", function: { name: "stage_remove_object", description: "从场景删除一个对象。破坏性操作。", parameters: { type: "object", properties: { objectId: { type: "string", description: "要删除的对象 ID" } }, required: ["objectId"] } } },
    { type: "function", function: { name: "camera_set_keyframe", description: "在机位运动路径上追加一个相机关键帧，可指定时间点。", parameters: { type: "object", properties: { cameraId: { type: "string", description: "机位 ID；缺省活动机位" }, time: { type: "number", description: "时间点（秒）" } } } } },
    {
        type: "function",
        function: {
            name: "camera_update_keyframe",
            description: "修改相机关键帧：位置、注视目标、FOV、时间、缓动、停留或跟踪主体。",
            parameters: {
                type: "object",
                properties: {
                    cameraId: { type: "string", description: "机位 ID" },
                    keyframeId: { type: "string", description: "关键帧 ID（camera_get_trajectory 查询）" },
                    targetX: { type: "number", description: "注视目标 X" },
                    targetY: { type: "number", description: "注视目标 Y" },
                    targetZ: { type: "number", description: "注视目标 Z" },
                    fov: { type: "number", description: "视场角" },
                    time: { type: "number", description: "时间点（秒）" },
                    easing: { type: "string", enum: ["linear", "ease-in-out"], description: "缓动" },
                    pointBehavior: { type: "string", enum: ["pass", "hold"], description: "经过或停留" },
                    holdSeconds: { type: "number", description: "停留秒数" },
                    targetMode: { type: "string", enum: ["manual", "object"], description: "手动坐标或跟踪对象" },
                    subjectObjectId: { type: "string", description: "跟踪对象 ID" },
                    targetBodyPart: { type: "string", description: "跟踪身体部位" },
                    targetFollowMode: { type: "string", enum: ["immediate", "smooth"], description: "跟踪响应方式" },
                },
                required: ["cameraId", "keyframeId"],
            },
        },
    },
    { type: "function", function: { name: "camera_delete_keyframe", description: "删除机位上的一个相机关键帧。破坏性操作。", parameters: { type: "object", properties: { cameraId: { type: "string", description: "机位 ID" }, keyframeId: { type: "string", description: "关键帧 ID" } }, required: ["cameraId", "keyframeId"] } } },
    {
        type: "function",
        function: {
            name: "camera_apply_preset",
            description: "对机位应用运镜模板（推拉摇移等），可围绕跟踪主体自动生成关键帧。会覆盖该机位现有轨迹。",
            parameters: {
                type: "object",
                properties: {
                    cameraId: { type: "string", description: "机位 ID；缺省活动机位" },
                    templateId: { type: "string", description: "运镜模板 ID" },
                    subjectObjectId: { type: "string", description: "跟踪主体对象 ID" },
                    range: { type: "number", description: "轨迹幅度缩放（0.25-3）" },
                    targetBodyPart: { type: "string", description: "跟踪身体部位" },
                    targetFollowMode: { type: "string", enum: ["immediate", "smooth"], description: "跟踪响应方式" },
                },
                required: ["templateId"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "camera_set_pacing",
            description: "调整机位轨迹节奏：总时长、插值、缓动或预设节奏。",
            parameters: {
                type: "object",
                properties: {
                    cameraId: { type: "string", description: "机位 ID；缺省活动机位" },
                    presetId: { type: "string", description: "节奏预设 ID" },
                    duration: { type: "number", description: "总时长（秒）" },
                    interpolation: { type: "string", enum: ["linear", "smooth"], description: "插值方式" },
                    easing: { type: "string", enum: ["linear", "ease-in-out"], description: "缓动" },
                    speedMode: { type: "string", enum: ["uniform", "soft", "custom"], description: "速度模式" },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "camera_set_pose",
            description: "直接设置机位位姿（位置/注视目标/FOV）并设为活动机位；未给的字段沿用当前值。",
            parameters: {
                type: "object",
                properties: {
                    cameraId: { type: "string", description: "机位 ID；缺省活动机位" },
                    targetX: { type: "number", description: "注视目标 X" },
                    targetY: { type: "number", description: "注视目标 Y" },
                    targetZ: { type: "number", description: "注视目标 Z" },
                    fov: { type: "number", description: "视场角" },
                },
            },
        },
    },
    { type: "function", function: { name: "camera_get_trajectory", description: "读取全部机位的运动轨迹（关键帧位置/目标/时间），用于查 keyframeId。", parameters: { type: "object", properties: {} } } },
    {
        type: "function",
        function: {
            name: "preview_render_frame",
            description: "渲染指定机位当前时刻的干净单帧并保存 PNG，返回文件名与尺寸。需要导演台页面在线。",
            parameters: {
                type: "object",
                properties: {
                    position: { type: "string", enum: ["current", "first", "last"], description: "取哪个机位视角，默认 current" },
                    quality: { type: "string", enum: ["720p", "1080p"], description: "分辨率，默认 1080p" },
                    fileName: { type: "string", description: "保存文件名" },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "preview_export_animatic",
            description: "导出预演成片 MP4（沿活动机位轨迹渲染），耗时可达数分钟；活动机位至少 2 个关键帧。需要导演台页面在线。",
            parameters: {
                type: "object",
                properties: {
                    fileName: { type: "string", description: "导出文件名" },
                    fps: { type: "number", enum: [24, 30, 60], description: "帧率，默认 30" },
                    quality: { type: "string", enum: ["720p", "1080p"], description: "分辨率，默认 720p" },
                },
            },
        },
    },
];
