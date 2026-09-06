# Canvas Director

![版本](https://img.shields.io/badge/版本-v0.17.0-2da44e)
![许可证](https://img.shields.io/badge/许可证-MIT-d4a72c)
![React](https://img.shields.io/badge/React-19-0969da)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)
![Vite](https://img.shields.io/badge/Vite-7-2da44e)
![Three.js](https://img.shields.io/badge/Three.js-0.184-6e7781)

**Canvas Director** 是一款基于浏览器的 AI 辅助视觉创作工具，通过 iframe 将**无限画布**与**3D导演台**深度整合。在画布上编写剧本、提示词与角色设定，在 3D 导演台中完成分镜摆位、机位设置与运镜录制，再把预演素材交给 AI 生成最终图片与视频——一站式完成短剧 / 短视频创作全流程。

无需后端服务，浏览器直连你自己配置的 OpenAI 兼容 AI 接口。

---

## 功能特性

### 无限画布

画布是整个创作的画板，支持节点化编排与自由编辑。

- **无限画布**：拖拽平移、滚轮缩放、重置视图；支持小地图导航、缩放滑杆与视角回退，适合大型项目。
- **背景样式**：点阵、网格线背景，配合浅色 / 深色主题，视觉层次清晰。
- **节点操作**：拖拽移动、四角缩放、连线关联；框选、多选、一键打组与解散组；复制粘贴、批量导出。
- **撤销重做**：节点、连线、视口、背景、助手会话均支持完整的撤销与重做。
- **双击创建**：双击画布空白区域快速打开节点菜单，在点击位置创建节点。
- **文件拖入**：支持将本地图片、视频、音频文件直接拖入画布，自动创建对应资源节点。
- **导出画布**：可将整个画布或选中元素连同其引用的资源一起导出为压缩包。

### AI 创作

接入任意 OpenAI 兼容渠道，覆盖文生图、图生图、生视频、音频生成与多模型 LLM 对话。

- **图像生成**：文生图、图生图 / 参考图编辑、遮罩标注式局部重绘；生成过程保留原图比例，支持透明背景。
- **视频生成**：文生视频、图生视频、关键帧动画；支持首尾帧模式与全能参考模式；时长 4–30 秒可调，分辨率 480p / 720p / 1080p。
- **音频生成**：文本驱动音频生成，可插入画布作为独立节点。
- **LLM 对话**：支持多模型切换与推理强度设置；对话具备图片理解能力，可接收画布中的参考图。
- **自定义调用脚本**：可通过 JavaScript 脚本灵活对接中转站与自建服务，脚本支持图片质量、背景、参考素材等完整参数配置。
- **`@` 引用资源**：输入框内 `@` 符号可引用已连接的图片 / 视频节点，图片直接显示真实缩略图；多张参考图按规范提交，避免兼容接口报错。
- **批量生成**：支持多图叠卡预览与备选结果；失败项可单独重试或删除，成功项可下载或设为新的主图。
- **断点续传**：视频任务保存远端任务 ID，刷新页面后自动继续轮询状态，也可手动查询任务状态。

### Canvas Agent

本地 Codex CLI 通过 MCP 协议接入，直接在浏览器侧操作画布，无需暴露浏览器状态给外部服务器。

- **画布感知**：Agent 可读取当前画布状态、选中节点、连线关系、生成进度，并执行结构化编辑操作。
- **流式对话**：回复以流式输出，支持 Markdown 渲染、代码块显示与外链确认。
- **审批与权限**：三档权限控制，Agent 执行敏感操作前需用户确认；`--debug` 日志按日期保存，便于排查。
- **Skill 管理**：支持查看、创建、编辑、删除、启停和显式调用本地 Codex Skill；可从当前对话或画布自动生成 Skill 草稿。
- **会话隔离**：多标签页下的活跃画布与 turn 相互独立，互不干扰；刷新后保留附件、Skill 引用与本地缩略图。
- **凭据安全**：连接 Token 经 URL fragment 传递并在读取后立即清除，敏感信息不写入服务器日志和浏览器历史。

### 3D 导演台

嵌入画布的独立 3D 场景导演工具，支持多角色、多运镜轨迹的短片制作。

- **场景摆位**：内置人物与道具模型库（本地 Guo / Mixamo 资源），可快速搭建初始场景。
- **外部模型导入**：支持 FBX / GLB 格式角色模型，内置骨骼识别，自动映射 15 个语义骨骼区域；导入后自动直立、缩放至合适高度、吸附地面。
- **全景背景**：支持 JPG / PNG / WEBP 格式全景图导入，本地 IndexedDB 存储；支持替换、删除、左右旋转、亮度调节，五种视图共享同一资源。
- **地面材质**：提供工作室、水泥、沥青、木地板、草地五种地面材质，支持网格对齐与移动吸附。
- **多视图同步**：主视图、监视器窗口与第一人称视角共享同一时间轴，动画姿态、机位、全景背景在所有视图中完全一致。
- **运镜轨迹**：支持平滑 / 直线两种路径类型，各段可使用匀速、缓入、缓出、柔缓四种缓动曲线；轨迹点可设置为"穿过"或"停留"，停留可指定持续时长与动作。
- **双时间轴**：底部双轨时间轴同时展示摄影机运动与角色动作，方便精确定位关键帧。
- **身体部位追踪**：每个机位点可独立选择追踪目标和身体部位（全身、头部、胸部、腰部、四肢，共 16 个语义区域），支持即时跟随与柔和跟随两种模式。
- **社区预设**：内置 dolly in/out、pan left/right、tilt up/down、轨道镜头、摇臂弧线、手持抖动、平行跟拍等常用运镜预设。
- **性能配置**：提供自动 / 流畅 / 画质三档性能 profile，统一控制 DPR、抗锯齿与播放刷新率；720p / 1080p 导出不受编辑预览设置影响。
- **导出**：支持导出干净的参考截图（PNG）与 H.264 MP4 参考视频，通过 `postMessage` 回传到画布节点。
- **扩展协议**：提供 `capabilities.get`、`project.get`、`timeline.get`、`export.frame`、`export.video` 等稳定接口，供第三方插件开发使用。

### 插件系统

画布节点插件机制，支持通过 URL 动态安装与更新，并提供 TypeScript SDK 自定义开发。

- **内置 18+ 插件**：Markdown、SVG、HTML、360° 全景、便利贴、Mermaid 图、LaTeX 公式、代码运行、JSON 表格、思维导图、二维码、取色板、草图、切图 / 合图 / 图片对比、字数统计、音频波形裁剪等。
- **AI 生成能力**：Mermaid 图、LaTeX 公式、JSON 表格、思维导图节点支持 AI 文本生成，结果流式写回节点并自动剥离代码围栏。
- **远程插件**：支持通过 URL 动态安装、更新、卸载远程插件；官方插件注册表可一键安装。
- **开发 SDK**：提供 TypeScript 插件开发 SDK，可自定义节点类型、渲染逻辑、检查面板、序列化与迁移；内置生成面板支持 `text` 模式将结果写回自身。

### 提示词与素材库

- **提示词来源**：内置七种提示词来源（含 ImagePrompts、BananaPromptQuicker、Freestylefly 等），支持独立启用、手动刷新与定时刷新；新增自定义标准 JSON 来源，刷新失败时保留上次成功缓存。
- **提示词中心**：跨来源全局搜索，支持按标签筛选，查看提示词详情，一键复制并插入画布节点。
- **素材资产**：将常用图片、视频、音频和提示词保存为可复用资产，支持上传添加、卡片移除、批量导出。

### 配置与同步

- **渠道配置**：支持多模型渠道管理，可分别设置默认文本、图片和视频模型；支持火山方舟、Gemini 等格式的协议适配。
- **导入导出**：配置（渠道、模型、生成参数、提示词源、WebDAV）支持 JSON 文件导入导出，方便备份与迁移。
- **WebDAV 同步**：可选开启 WebDAV，实现跨设备的画布项目与素材同步；支持测试连接、手动同步与冲突处理。
- **本地代理**：开启后可将模型列表查询、生图、生视频、文本生成、音频生成等请求统一经本机代理转发，解决 CORS 限制。

---

## 典型工作流

1. 在画布节点中编写剧本、提示词与角色设定，按剧情节点排列。
2. 打开嵌入的 3D 导演台，摆放人物、道具与场景站位，设置全景背景与地面材质。
3. 配置摄影机运镜轨迹，录制镜头运动，导出参考截图与 H.264 视频。
4. 通过 `postMessage` 将预演素材回传到画布对应节点。
5. 画布将参考图链接到生成节点，交给 AI 模型完成最终生图 / 生视频。
6. 生成结果回到画布，继续迭代、分组与整理，进入下一镜头创作。

---

## 项目截图

**无限画布**

<p>
  <img src="docs/assets/canvas_1.png" width="49%">
  <img src="docs/assets/canvas_2.png" width="49%">
</p>
<p>
  <img src="docs/assets/canvas_3.png" width="49%">
  <img src="docs/assets/canvas_4.png" width="49%">
</p>

**3D 导演台**

<p>
  <img src="docs/assets/director_1.png" width="49%">
  <img src="docs/assets/director_2.png" width="49%">
</p>
<p>
  <img src="docs/assets/director_3.png" width="49%">
  <img src="docs/assets/director_4.png" width="49%">
</p>

---

## 快速开始

### 在线部署

项目自带 `vercel.json` / `render.yaml`，可一键部署到 [Vercel](https://vercel.com) 或 [Render](https://render.com)。无需后端服务，浏览器直连 AI 接口。

GitHub Pages 静态站点自动发布：[点击查看在线文档](https://haitang-hub.github.io/Canvas-Director)。

### 本地开发

```bash
# 克隆项目
git clone https://github.com/Haitang-Hub/Canvas-Director.git
cd Canvas-Director

# 启动前端（http://localhost:5070）
cd web && npm install && npm run dev

# 启动文档站点（可选，http://localhost:3000）
cd ../docs && npm install && npm run dev
```

### 启动本地 Canvas Agent（可选）

在本地运行 Codex CLI，通过 MCP 协议操作画布：

```bash
npx -y @basketikun/canvas-agent@latest
# http://localhost:17371
```

### 启动本地代理（可选）

纯转发代理，用于解决浏览器 CORS 限制：

```bash
npx @basketikun/canvas-proxy@latest --port 23210
# http://localhost:23210
```

### Docker 部署（可选）

```bash
docker-compose up -d
```

---

## 技术栈

| 类别 | 技术 |
| --- | --- |
| 前端框架 | React 19 + TypeScript 5 |
| 构建工具 | Vite 7 |
| UI 组件 | Ant Design 6 + Tailwind CSS v4 |
| 状态管理 | Zustand 5（localforage 持久化） |
| 3D 渲染 | Three.js 0.184 + React Three Fiber 9 |
| Agent 运行时 | Node.js ≥ 18 + @openai/codex |
| 本地代理 | 纯 Node.js（CORS 转发） |
| 插件协议 | MCP（Model Context Protocol） |

---

## 文档

完整文档索引见 [docs/index.md](docs/index.md)，常用文档如下：

| 文档 | 说明 |
| --- | --- |
| [快速开始](docs/content/docs/overview/quick-start.mdx) | 安装配置与上手指南 |
| [功能介绍](docs/content/docs/overview/features.mdx) | 全部功能详细说明 |
| [画布节点指南](docs/content/docs/canvas/canvas-node-manual.mdx) | 各节点类型用法参考 |
| [画布快捷键](docs/content/docs/canvas/canvas-shortcuts.mdx) | 快捷键一览 |
| [本地开发](docs/content/docs/development/local-development.mdx) | 本地调试与构建说明 |
| [Docker 部署](docs/content/docs/overview/docker.mdx) | 容器化部署方案 |
| [Agent 连接说明](docs/content/docs/development/local-codex-canvas.mdx) | Codex Agent 集成方式 |
| [安全说明](docs/content/docs/support/security.mdx) | 安全模型与漏洞反馈 |

---

## 数据与安全

- **本地存储**：画布项目和「我的素材」主要保存在浏览器本地（IndexedDB via localforage），项目本身不提供云账户或云存储；可自行配置 WebDAV 实现跨设备同步。
- **API 密钥**：AI API Key 保存在浏览器本地，由前端直接请求你配置的 OpenAI 兼容接口，请使用可信渠道的密钥；不建议将密钥填入来源不明的中转站。
- **本地代理**：开启本地代理后，所有模型请求经本机转发，可规避 CORS 限制，代理本身不记录敏感内容。
- **Agent 安全**：Canvas Agent 在你自己的本机运行，连接 Token 经 URL fragment 传递并在读取后立即清除；MCP 初始化期间禁用按钮防止提前发送；调试日志中的常见凭据自动脱敏。
- **生产部署**：Docker 静态资源路径为待验证项，生产环境的完整部署验证建议自行测试。

---

## 致谢

Canvas Director 为二次开发项目，核心能力来源于：

- [Infinite Canvas](https://github.com/basketikun/infinite-canvas)
- [3D Director Desk](https://github.com/xiaozangao/3d-director-desk)

---

## 许可证

[MIT](LICENSE)
