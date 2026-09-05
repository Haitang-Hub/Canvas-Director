# Canvas Director

一款基于浏览器的 AI 辅助可视化创作工具，将**无限画布（2D 节点式 AI 创作工作台）**与**3D 导演台**深度整合：在无限画布中通过 iframe 嵌入 3D 导演台，实现从分镜预演到 AI 生成的完整短剧创作链路。

A browser-based AI-assisted visual creation tool that deeply integrates an **infinite 2D canvas** with a **3D director desk** via iframe, enabling a complete short drama production pipeline from storyboard previsualization to AI generation.

> **Origins**: This project is a derivative work combining two independent open-source projects:
> - Infinite Canvas: [basketikun/infinite-canvas](https://github.com/basketikun/infinite-canvas)
> - 3D Director Desk: [xiaozangao/3d-director-desk](https://github.com/xiaozangao/3d-director-desk)
>
> **项目来源**：本项目为二次开发，核心能力来源于以下两个独立开源项目：
> - 无限画布：[basketikun/infinite-canvas](https://github.com/basketikun/infinite-canvas)
> - 3D 导演台：[xiaozangao/3d-director-desk](https://github.com/xiaozangao/3d-director-desk)

---

## Contents · 目录

- [Features · 功能概览](#features)
- [Comparison · 产品对比](#comparison)
- [Workflow · 典型工作流](#workflow)
- [Screenshots · 项目截图](#screenshots)
- [Tech Stack · 技术栈](#tech-stack)
- [Quick Start · 快速开始](#quick-start)
- [Structure · 项目结构](#project-structure)
- [Documentation · 文档与资源](#documentation)
- [Limitations · 当前限制](#limitations)

---

## Features · 功能概览

### Infinite Canvas · 无限画布

- Create, rename, duplicate, delete, import, and export canvas projects. Multi-canvas management.
- Drag, zoom, connect nodes; mini-map navigation; undo/redo; grouping and snapping.
- Double-click empty area to quickly create nodes; drag files directly into canvas; export as zip.
- 多画布项目管理：创建、重命名、复制、删除、导入、导出
- 节点拖拽、缩放、连线、小地图导航、撤销重做；双击空白区域快速创建节点，支持分组与吸附
- 拖拽文件直接入画布，导出为压缩包

### AI Creation · AI 创作

- **Text-to-Image / Image-to-Image**: Multi-reference images, preserve original aspect ratio, transparent background generation
- **Inpainting**: Mask annotation for region-specific editing
- **Text-to-Video / Image-to-Video**: Support first/last frame and all-reference modes; configurable duration
- **Audio Generation**: Multiple audio models supported
- **Text Generation**: Adjustable reasoning intensity; multiple results merged as alternatives
- Multi-model channel management: OpenAI, Gemini, Agnes and other OpenAI-compatible interfaces
- Custom call scripts for different relay services
- **文生图 / 图生图**：支持多张参考图，保留原始比例，透明背景生成
- **局部编辑**：蒙版标注，指定区域修改
- **文生视频 / 图生视频**：支持首尾帧、全能参考模式，视频时长可配置
- **音频生成**：支持多种音频模型
- **文本生成**：支持推理强度调节，多结果合并为备选文本
- 多模型渠道管理：支持 OpenAI、Gemini、Agnes 等 OpenAI 兼容接口
- 自定义调用脚本，适配不同中转站

### Canvas Agent · 画布 Agent

- Connect local Codex CLI via MCP protocol to operate the canvas
- Persistent right sidebar with streaming conversation responses
- Approval operations, three-level permission adjustment
- Auto-generate prompts per node, reference upstream assets
- `/` quick-select Skill, `@` reference canvas assets
- Multi-tab isolation, auto-restore historical sessions
- 连接本地 Codex CLI，通过 MCP 协议操作画布；右侧常驻侧边栏，流式对话响应
- 支持审批操作、三档权限调节；按节点生成提示词，自动引用上游素材
- 支持 `/` 快速选择 Skill，`@` 引用画布素材；多标签页隔离，历史会话自动恢复

### 3D Director Desk · 3D 导演台

- Three.js-based 3D scene editor, embeddable as iframe node in canvas
- Character and prop model library (built-in UE figures / Mixamo local resources), FBX/GLB import support
- First-person camera recording, WASD controls + Enter to record trajectory points
- Dual timeline: camera trajectory + character movement
- Camera settings, preset movements (orbit, tracking, slow push), anti-shake
- Export clean screenshots and H.264 MP4 reference videos (720p/1080p, 24–60FPS)
- postMessage API to send screenshots and camera parameters back to canvas nodes as AI image/video references
- 基于 Three.js 的 3D 场景编辑器，可在画布中以 iframe 节点形式嵌入
- 角色与道具模型库（内置 UE 人偶 / Mixamo 本地资源），支持 FBX/GLB 导入
- 第一人称掌镜录制运镜轨迹，WASD 操作 + Enter 记录轨迹点
- 双时间轴：摄影机轨迹 + 人物运动路线；机位设置、运镜预设、镜头防抖
- 导出干净截图和 H.264 MP4 参考视频；通过 postMessage 将截图和镜头参数回传给画布节点

### Plugin System · 插件系统

- TypeScript + auto JSX runtime SDK for custom node plugins
- Plugin registry: one-click install official plugins from repository
- 18+ built-in plugins: Markdown, SVG, HTML, Panorama, Sticky Note, LaTeX, Mermaid, Mind Map, QR Code, Color Picker, Word Count, JSON Table, Code Runner, Image Stitch/Compare/Split, Audio Waveform
- 插件 SDK：TypeScript + 自动 JSX 运行时开发自定义节点
- 插件注册表：从仓库一键安装官方插件
- 内置 18+ 插件：Markdown、SVG、HTML、全景、便利贴、LaTeX 公式、Mermaid 图、思维导图、二维码、色板提取、文字统计、JSON 表格、代码运行、图片拼接/对比/分割、音频波形

### Prompt Library · 提示词库

- 7 built-in prompt sources with independent cache and refresh
- Support custom standard JSON sources
- Cross-source search, tag filter, detail preview, one-click insert to canvas
- 内置 7 个提示词来源，独立缓存与刷新；支持添加自定义标准 JSON 来源
- 跨来源搜索、标签筛选、详情预览、一键插入画布

### Data Management · 数据管理

- Canvas projects and assets stored in browser local (IndexedDB) by default
- Optional WebDAV configuration for cross-device sync
- 画布项目和素材默认存储在浏览器本地（IndexedDB）；可选配置 WebDAV 实现跨设备同步

---

## Comparison · 产品对比

| Dimension · 维度 | Infinite Canvas · 无限画布 | 3D Director · 3D 导演台 |
|---|---|---|
| Core Positioning · 核心定位 | 2D node-based AI creation workspace | 3D storyboard camera rehearsal tool |
| AI Capability · AI 能力 | ✅ Multimodal: image/video/LLM | ❌ No AI, reference output only |
| Space · 空间 | Infinite 2D node canvas | WebGL 3D space |
| Camera Control · 运镜控制 | Prompt description only | ✅ First-person trajectory recording |
| Model Support · 模型能力 | 2D image/video processing | ✅ 3D characters/props/FBX/GLB |
| Storage · 存储 | IndexedDB | localStorage |
| Integration · 集成 | iframe embeddable | postMessage API |

---

## Workflow · 典型工作流

1. Write scripts, prompts, and character settings in canvas nodes
2. Open the embedded 3D Director in canvas to position characters and set actions in 3D space
3. Record camera movement trajectories, export reference screenshots and lens parameters
4. Send pre-visualization assets back to canvas nodes via postMessage
5. Canvas sends reference images to AI models for final image/video generation
6. Results return to canvas for continued iteration and organization

1. 在画布编写剧本、提示词、角色设定节点
2. 画布内打开嵌入的 3D 导演台，在三维空间摆放人物站位与动作
3. 录制摄影机运镜轨迹，导出参考截图和镜头参数
4. 通过 postMessage 将预演素材回传给画布节点
5. 画布将参考图交给 AI 模型完成最终图片/视频生成
6. 生成结果回到画布，继续迭代整理

---

## Screenshots · 项目截图

### Infinite Canvas · 无限画布

| | |
|---|---|
| ![Canvas Interface](./docs/assets/canvas_1.png)<br>画布界面 · Canvas Interface | ![Node Editing](./docs/assets/canvas_2.png)<br>节点编辑 · Node Editing |
| ![Asset Management](./docs/assets/canvas_3.png)<br>素材管理 · Asset Management | ![Plugin Panel](./docs/assets/canvas_4.png)<br>插件面板 · Plugin Panel |

### 3D Director · 3D 导演台

| | |
|---|---|
| ![Scene Setup](./docs/assets/director_1.png)<br>场景搭建 · Scene Setup | ![Camera Recording](./docs/assets/director_2.png)<br>掌镜录制 · Camera Recording |
| ![Timeline Editing](./docs/assets/director_3.png)<br>时间轴编辑 · Timeline Editing | ![Rehearsal Preview](./docs/assets/director_4.png)<br>运镜预演 · Rehearsal Preview |

---

## Tech Stack · 技术栈

| Category · 类别 | Technology · 技术 |
|---|---|
| Frontend Framework · 前端框架 | React 19 + TypeScript |
| Build Tool · 构建工具 | Vite 7 |
| UI Components · UI 组件 | Ant Design 6 + Tailwind CSS v4 |
| State Management · 状态管理 | Zustand 5 (localforage for persistence) |
| Routing · 路由 | React Router 7 |
| Data Fetching · 数据请求 | TanStack React Query 5 + Axios |
| 3D Rendering · 3D 渲染 | Three.js 0.184 + React Three Fiber 9 + drei 10 |
| Code Editor · 代码编辑 | CodeMirror 6 |
| Animation · 动画 | Framer Motion 12 |
| i18n · 国际化 | i18next + react-i18next |
| Agent Runtime · Agent 运行时 | Node.js ≥ 18 + @openai/codex 0.146 |
| Agent Protocol · Agent 协议 | MCP SDK 1.12 + Express 5 |
| Local Proxy · 本地代理 | Pure Node.js (CORS resolution) |

---

## Quick Start · 快速开始

### Online Demo · 在线体验

Deploy to [Vercel](https://vercel.com) or [Render](https://render.com). No backend required — browser connects directly to AI APIs.
部署到 [Vercel](https://vercel.com) 或 [Render](https://render.com)，无需后端服务，浏览器直连 AI API。

### Local Development · 本地开发

```bash
# Clone and setup · 克隆项目
git clone git@github.com:basketikun/infinite-canvas.git
cd infinite-canvas

# Install and start frontend (port 5070) · 启动前端
cd web && npm install && npm run dev

# Start docs site (optional) · 启动文档站点（可选）
cd ../docs && npm run dev
```

Configure on first launch in Settings:
首次使用请在设置中配置：
- `Base URL`: AI provider endpoint · AI 提供商接口地址
- `API Key`: stored locally in browser only · 认证密钥（仅存储在浏览器本地）
- Default model names for text/image/video · 默认模型名称（文本/图像/视频）

### Start Local Agent (Optional) · 启动本地 Agent

```bash
npm install -g @basketikun/canvas-agent@latest
canvas-agent          # Start · 启动（端口 17371）
canvas-agent --debug  # Debug mode · 调试模式
```

### Start Local Proxy (Optional) · 启动本地代理

Resolve CORS issues when connecting to AI APIs directly from the browser:
解决浏览器直连 AI API 时的 CORS 问题：

```bash
cd canvas-proxy && node index.js --port 23210
```

### Docker Deployment · Docker 部署

```bash
docker-compose up -d
```
Visit `http://localhost:5070`. 访问 `http://localhost:5070`。

---

## Project Structure · 项目结构

```
Canvas Director/
├── web/                    # Frontend app · 前端主应用（Vite + React）
│   └── src/
│       ├── pages/          # Page routes · 页面路由（canvas/、director/）
│       ├── components/     # UI components · UI 组件
│       ├── stores/         # Zustand state · Zustand 全局状态
│       ├── services/       # API layer · API 服务层
│       ├── lib/            # Utilities · 工具函数库
│       └── types/          # Type definitions · TypeScript 类型定义
├── canvas-agent/           # Local AI Agent · 本地 AI Agent 服务（Node.js）
├── canvas-proxy/           # CORS proxy · CORS 本地代理
├── plugins/                # Plugin system · 插件系统
│   ├── canvas/sdk/         # Plugin SDK · 插件开发 SDK
│   ├── canvas/registry/    # Plugin registry · 官方插件注册表
│   └── canvas/*/           # Plugin implementations · 各插件实现
├── docs/                   # Documentation site · 文档站点（Next.js + MDX）
│   └── assets/             # Screenshot assets · README 截图资源
├── docs_3d_director/       # 3D Director source docs · 3D 导演台源文档
├── Dockerfile
├── docker-compose.yml
└── nginx.conf
```

---

## Documentation · 文档与资源

Full documentation at [docs/index.md](./docs/index.md). 完整文档请访问 [docs/index.md](./docs/index.md)。

| Doc · 文档 | Link · 链接 | Description · 说明 |
|---|---|---|
| Quick Start · 快速开始 | [mdx](./docs/content/docs/overview/quick-start.mdx) | Installation, configuration & getting started · 安装配置与上手指南 |
| Features · 功能详情 | [mdx](./docs/content/docs/overview/features.mdx) | Full feature descriptions · 全部功能详细说明 |
| Canvas Node Guide · 画布节点指南 | [mdx](./docs/content/docs/canvas/canvas-node-manual.mdx) | Node type usage · 各节点类型用法 |
| Shortcuts · 快捷键 | [mdx](./docs/content/docs/canvas/canvas-shortcuts.mdx) | Canvas keyboard shortcuts · 画布快捷键一览 |
| Local Development · 本地开发 | [mdx](./docs/content/docs/development/local-development.mdx) | Local debugging & build · 本地调试与构建 |
| Docker Deployment · Docker 部署 | [mdx](./docs/content/docs/overview/docker.mdx) | Containerized deployment · Docker 容器化方案 |
| Agent Connection · Agent 连接说明 | [mdx](./docs/content/docs/development/local-codex-canvas.mdx) | Codex Agent integration · Codex Agent 集成 |
| Embedding Protocol · 嵌入协议 | [md](./docs_3d_director/embed-contract.md) | 3D Director postMessage API · 3D 导演台 postMessage 接口 |

**Screenshot assets · 截图资源** are stored in [`docs/assets/`](./docs/assets/).

---

## Limitations · 当前限制

- Frontend-first architecture: canvas projects and assets are stored locally in the browser — no cloud accounts or cloud storage provided.
  前端优先架构，画布项目与素材保存在浏览器本地，不提供云账户或云存储。
- AI API Key is stored in the browser and requests are sent directly to AI providers — no server-side proxy.
  AI API Key 存储在浏览器本地，由前端直连 AI 提供商接口。
- Docker static asset path verification in production is still in progress.
  Docker 静态资源路径在生产环境的验证仍在进行中。
- 3D Director complex model import is limited by browser WebGL performance — export JSON backups regularly for important projects.
  3D 导演台复杂模型导入受浏览器 WebGL 性能限制，重要工程请定期导出 JSON 备份。
- Storage formats may change during development — always export backups for important projects.
  开发阶段存储格式会变动，重要工程务必导出备份。

---

## License · 许可

MIT License — free for personal, open-source, and commercial use.
MIT 许可 — 允许个人、开源及商业场景免费使用。
