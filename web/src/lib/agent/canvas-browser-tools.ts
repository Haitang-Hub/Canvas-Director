/**
 * 画布页浏览器内置 Agent 的工具表（OpenAI function calling 形态）：
 * canvas_apply_ops 走 useAgentStore.canvasContext，站点工具走 agent-site-tools 的 runSiteTool。
 * 与 canvas-agent 服务端 schemas.ts 的工具语义保持一致（服务端为 zod 版本）。
 */

import type { AgentToolParameterSchema } from "./director-agent-tools";

export const CANVAS_BROWSER_SYSTEM_PROMPT = [
    "你是无限画布的内置 AI 助手，通过工具直接操作画布与站点：增删改节点、连线、调整视口、触发节点生成，以及查询画布项目、生成任务、打开导演台、管理素材和搜索提示词。",
    "工作流：先通过 canvas_apply_ops 的 select_nodes 之外先了解画布——工具没有单独的读接口，需要结构信息时可用画布快照（每轮工具结果会返回最新快照摘要）；",
    "然后按需 add_node / update_node / delete_node / connect_nodes；需要生成图片/视频/文本时，先 add_node 建配置节点，再对该节点 run_generation；",
    "节点 ID 从工具结果返回的快照中获取，不要凭空编造；position 单位是画布坐标，新增节点默认放在当前视口附近。",
    "site_navigate 可跳转页面；stage_open 可打开导演台（静默嵌入或独立窗口）；workbench_* 驱动生图/视频工作台；assets_* / prompts_search 管理素材与提示词。",
    "破坏性操作（delete_node、delete_connections）执行前先向用户确认。",
    "回答用中文、简洁；汇报结果时引用节点 ID 与文件名，方便用户在界面上对照。",
].join("\n");

const position = { x: { type: "number", description: "画布坐标 X" }, y: { type: "number", description: "画布坐标 Y" } };

export const CANVAS_BROWSER_TOOLS: Array<{ type: "function"; function: { name: string; description: string; parameters: AgentToolParameterSchema } }> = [
    {
        type: "function",
        function: {
            name: "canvas_apply_ops",
            description: "对当前画布批量执行操作，返回最新画布快照摘要（含全部节点 ID）。支持：add_node（nodeType 如 text/image/video/audio/config/director，metadata 可带 prompt 等字段）、update_node（patch 改 title 等）、delete_node（id 或 ids）、delete_connections、connect_nodes（fromNodeId/toNodeId）、set_viewport（{x,y,zoom}）、select_nodes、run_generation（nodeId + mode: text/image/video/audio + prompt）。",
            parameters: {
                type: "object",
                properties: {
                    ops: {
                        type: "array",
                        description: "操作列表，按顺序执行",
                        items: {
                            type: "object",
                            properties: {
                                type: { type: "string", enum: ["add_node", "update_node", "delete_node", "delete_connections", "connect_nodes", "set_viewport", "select_nodes", "run_generation"], description: "操作类型" },
                                id: { type: "string", description: "节点/操作 ID（delete_node 删除单个时用）" },
                                ids: { type: "array", items: { type: "string" }, description: "批量节点 ID（delete_node/delete_connections/select_nodes）" },
                                nodeType: { type: "string", description: "add_node 的节点类型：text/image/video/audio/config/director 等" },
                                title: { type: "string", description: "add_node 的节点标题" },
                                position: { type: "object", properties: position, description: "add_node 位置" },
                                width: { type: "number", description: "节点宽度（可省略，默认按类型）" },
                                height: { type: "number", description: "节点高度（可省略）" },
                                metadata: { type: "object", description: "节点元数据，如 { prompt: \"...\" }、{ content: \"...\" }" },
                                patch: { type: "object", description: "update_node 的字段补丁，如 { title: \"...\" }" },
                                fromNodeId: { type: "string", description: "connect_nodes 起点" },
                                toNodeId: { type: "string", description: "connect_nodes 终点" },
                                all: { type: "boolean", description: "delete_connections 清空全部连线" },
                                viewport: { type: "object", properties: { x: { type: "number" }, y: { type: "number" }, zoom: { type: "number" } }, description: "set_viewport 的视口变换" },
                                mode: { type: "string", enum: ["text", "image", "video", "audio"], description: "run_generation 的生成类型" },
                                prompt: { type: "string", description: "run_generation 的提示词（可省略，默认用节点配置）" },
                            },
                            required: ["type"],
                        },
                    },
                },
                required: ["ops"],
            },
        },
    },
    { type: "function", function: { name: "site_navigate", description: "在站内跳转页面，如 /canvas/{projectId}、/image、/video、/assets。", parameters: { type: "object", properties: { path: { type: "string", description: "站内路径" } }, required: ["path"] } } },
    {
        type: "function",
        function: {
            name: "canvas_list_projects",
            description: "分页列出本地画布项目（标题、节点数、更新时间）。",
            parameters: { type: "object", properties: { keyword: { type: "string", description: "按标题过滤" }, page: { type: "number" }, pageSize: { type: "number" } } },
        },
    },
    {
        type: "function",
        function: {
            name: "generation_get_status",
            description: "查询画布节点与生图/视频工作台的生成任务状态汇总。",
            parameters: { type: "object", properties: { scope: { type: "string", enum: ["all", "canvas", "image", "video"], description: "范围，默认 all" }, taskId: { type: "string", description: "按任务 ID 过滤" }, nodeIds: { type: "array", items: { type: "string" }, description: "按画布节点 ID 过滤" }, limit: { type: "number" } } },
        },
    },
    {
        type: "function",
        function: {
            name: "stage_open",
            description: "打开某个导演台节点对应的 3D 导演台：默认在当前页内嵌静默开启（不跳转），mode=tab 打开可见窗口。之后导演台工具（stage_*/camera_*/preview_*）才会在线。",
            parameters: { type: "object", properties: { deskId: { type: "string", description: "导演台实例 ID（缺省取画布里的导演台节点）" }, shotNodeId: { type: "string", description: "镜头节点 ID" }, mode: { type: "string", enum: ["silent", "tab"], description: "默认 silent" } } },
        },
    },
    { type: "function", function: { name: "workbench_image_get_config", description: "读取生图工作台当前配置与可选模型/参数。", parameters: { type: "object", properties: {} } } },
    {
        type: "function",
        function: {
            name: "workbench_image_generate",
            description: "跳转生图工作台并应用参数；run=false 只填参数不生成。",
            parameters: { type: "object", properties: { prompt: { type: "string" }, model: { type: "string", description: "渠道模型编码" }, quality: { type: "string" }, size: { type: "string", description: "比例，如 1:1" }, count: { type: "number" }, run: { type: "boolean" } } },
        },
    },
    { type: "function", function: { name: "workbench_video_get_config", description: "读取视频创作台当前配置与可选模型/参数。", parameters: { type: "object", properties: {} } } },
    {
        type: "function",
        function: {
            name: "workbench_video_generate",
            description: "跳转视频创作台并应用参数；run=false 只填参数不生成。",
            parameters: { type: "object", properties: { prompt: { type: "string" }, model: { type: "string" }, size: { type: "string", description: "分辨率如 1280x720" }, seconds: { type: "string", description: "时长秒数" }, resolution: { type: "string", enum: ["480", "720", "1080"] }, generateAudio: { type: "boolean" }, watermark: { type: "boolean" }, mode: { type: "string", enum: ["frames", "reference"] }, run: { type: "boolean" } } },
        },
    },
    {
        type: "function",
        function: {
            name: "prompts_search",
            description: "搜索提示词库（标题/正文/分类/标签）。",
            parameters: { type: "object", properties: { keyword: { type: "string" }, category: { type: "string" }, tags: { type: "array", items: { type: "string" } }, page: { type: "number" }, pageSize: { type: "number" } } },
        },
    },
    {
        type: "function",
        function: {
            name: "assets_list",
            description: "分页列出「我的素材」（文本/图片）。",
            parameters: { type: "object", properties: { kind: { type: "string", enum: ["all", "text", "image", "video"] }, keyword: { type: "string" }, page: { type: "number" }, pageSize: { type: "number" } } },
        },
    },
    {
        type: "function",
        function: {
            name: "assets_add",
            description: "新增素材；kind=text 需要 content，kind=image 需要 imageUrl（图片地址或 dataURL）。",
            parameters: {
                type: "object",
                properties: { kind: { type: "string", enum: ["text", "image"], description: "素材类型" }, title: { type: "string", description: "标题" }, content: { type: "string", description: "kind=text 的正文" }, imageUrl: { type: "string", description: "kind=image 的图片地址" }, tags: { type: "array", items: { type: "string" } }, source: { type: "string" }, note: { type: "string" } },
                required: ["kind", "title"],
            },
        },
    },
];
