# Canvas Director

一款基于浏览器的 AI 辅助可视化创作工具，将**无限画布（2D 节点式 AI 创作工作台）**与**3D 导演台**深度整合：在无限画布中通过 iframe 嵌入 3D 导演台，实现从分镜预演到 AI 生成的完整短剧创作链路。

> **项目来源**：本项目为二次开发，核心能力来源于以下两个独立开源项目：
> - 无限画布：[basketikun/infinite-canvas](https://github.com/basketikun/infinite-canvas)
> - 3D 导演台：[xiaozangao/3d-director-desk](https://github.com/xiaozangao/3d-director-desk)

---

## 目录

- [功能概览](#功能概览)
- [产品对比](#产品对比)
- [典型工作流](#典型工作流)
- [项目截图](#项目截图)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [文档与资源](#文档与资源)
- [当前限制](#当前限制)

---

## 功能概览

### 无限画布

- 多画布项目管理：创建、重命名、复制、删除、导入、导出
- 节点拖拽、缩放、连线、小地图导航、撤销重做
- 双击空白区域快速创建节点，支持分组与吸附
- 拖拽文件直接入画布，导出为压缩包

### AI 创作

- **文生图 / 图生图**：支持多张参考图，保留原始比例，透明背景生成
- **局部编辑**：蒙版标注，指定区域修改
- **文生视频 / 图生视频**：支持首尾帧、全能参考模式，视频时长可配置
- **音频生成**：支持多种音频模型
- **文本生成**：支持推理强度调节，多结果合并为备选文本
- 多模型渠道管理：支持 OpenAI、Gemini、Agnes 等 OpenAI 兼容接口
- 自定义调用脚本，适配不同中转站

### Canvas Agent

- 连接本地 Codex CLI，通过 MCP 协议操作画布
- 右侧常驻侧边栏，流式对话响应
- 支持审批操作、三档权限调节
- 按节点生成提示词，自动引用上游素材
- 支持 `/` 快速选择 Skill，`@` 引用画布素材
- 多标签页隔离，历史会话自动恢复

### 3D 导演台（iframe 嵌入）

- 基于 Three.js 的 3D 场景编辑器，可在画布中以 iframe 节点形式嵌入
- 角色与道具模型库（内置 UE 人偶 / Mixamo 本地资源），支持 FBX/GLB 导入
- 第一人称掌镜录制运镜轨迹，WASD 操作 + Enter 记录轨迹点
- 双时间轴：摄影机轨迹 + 人物运动路线
- 机位设置、运镜预设（环绕、跟拍、慢推）、镜头防抖
- 导出干净截图、H.264 MP4 参考视频（720p/1080p，24–60FPS）
- 通过 postMessage 将截图和镜头参数回传给画布节点，作为 AI 生图/生视频的参考素材

### 插件系统

- 插件 SDK：使用 TypeScript + 自动 JSX 运行时开发自定义节点
- 插件注册表：从仓库一键安装官方插件
- 内置 18+ 插件：Markdown、SVG、HTML、全景、便利贴、LaTeX 公式、Mermaid 图、思维导图、二维码、色板提取、文字统计、JSON 表格、代码运行、图片拼接/对比/分割、音频波形

### 提示词库

- 内置 7 个提示词来源，独立缓存与刷新
- 支持添加自定义标准 JSON 来源
- 跨来源搜索、标签筛选、详情预览、一键插入画布

### 数据管理

- 画布项目和素材默认存储在浏览器本地（IndexedDB）
- 可选配置 WebDAV 实现跨设备同步

---

## 产品对比

| 维度 | 无限画布 | 3D 导演台 |
|---|---|---|
| 核心定位 | 2D 节点式 AI 创作工作台 | 3D 分镜运镜预演工具 |
| AI 能力 | ✅ 多模态 AI 生图/生视频/LLM | ❌ 无 AI，仅产出参考素材 |
| 空间 | 无限 2D 节点画布 | WebGL 真实三维空间 |
| 运镜控制 | 只能通过提示词描述 | ✅ 第一人称掌镜录制轨迹 |
| 模型能力 | 2D 图片/视频素材处理 | ✅ 3D 人物/道具/FBX/GLB 导入 |
| 存储 | IndexedDB | localStorage |
| 相互集成 | 可 iframe 嵌入 3D 导演台 | 提供 postMessage 接口适配嵌入 |

---

## 典型工作流

1. 在画布编写剧本、提示词、角色设定节点
2. 画布内打开嵌入的 3D 导演台，在三维空间摆放人物站位与动作
3. 录制摄影机运镜轨迹，导出参考截图和镜头参数
4. 通过 postMessage 将预演素材回传给画布节点
5. 画布将参考图交给 AI 模型完成最终图片/视频生成
6. 生成结果回到画布，继续迭代整理

---

## 项目截图

### 无限画布

![画布界面](./docs/assets/canvas_1.png)
![节点编辑](./docs/assets/canvas_2.png)
![素材管理](./docs/assets/canvas_3.png)
![插件面板](./docs/assets/canvas_4.png)

### 3D 导演台

![场景搭建](./docs/assets/director_1.png)
![掌镜录制](./docs/assets/director_2.png)
![时间轴编辑](./docs/assets/director_3.png)
![运镜预演](./docs/assets/director_4.png)

---

## 技术栈

| 类别 | 技术 |
|---|---|
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite 7 |
| UI 组件 | Ant Design 6 + Tailwind CSS v4 |
| 状态管理 | Zustand 5（持久化用 localforage） |
| 路由 | React Router 7 |
| 数据请求 | TanStack React Query 5 + Axios |
| 3D 渲染 | Three.js 0.184 + React Three Fiber 9 + drei 10 |
| 代码编辑 | CodeMirror 6 |
| 动画 | Framer Motion 12 |
| 国际化 | i18next + react-i18next |
| Agent 运行时 | Node.js ≥ 18 + @openai/codex 0.146 |
| Agent 协议 | MCP SDK 1.12 + Express 5 |
| 本地代理 | 纯 Node.js（解决 CORS） |

---

## 快速开始

### 在线体验

部署到 [Vercel](https://vercel.com) 或 [Render](https://render.com)，无需后端服务，浏览器直连 AI API。

### 本地开发

```bash
# 克隆项目
git clone git@github.com:basketikun/infinite-canvas.git
cd infinite-canvas

# 安装前端依赖
cd web && npm install

# 启动前端（端口 5070）
npm run dev

# 启动文档站点（可选）
cd ../docs && npm run dev
```

首次使用请在设置中配置：
- `Base URL`：AI 提供商接口地址
- `API Key`：认证密钥（仅存储在浏览器本地）
- 默认模型名称（文本/图像/视频）

### 启动本地 Agent（可选）

```bash
npm install -g @basketikun/canvas-agent@latest
canvas-agent          # 启动（端口 17371）
canvas-agent --debug  # 调试模式
```

### 启动本地代理（可选）

解决浏览器直连 AI API 时的 CORS 问题：

```bash
cd canvas-proxy && node index.js --port 23210
```

### Docker 部署

```bash
docker-compose up -d
```

访问 `http://localhost:5070`。

## 项目结构

```
Canvas Director/
├── web/                    # 前端主应用（Vite + React）
│   └── src/
│       ├── pages/          # 页面路由（canvas/、director/）
│       ├── components/     # UI 组件
│       ├── stores/         # Zustand 全局状态
│       ├── services/       # API 服务层
│       ├── lib/            # 工具函数库
│       └── types/          # TypeScript 类型定义
├── canvas-agent/           # 本地 AI Agent 服务（Node.js）
├── canvas-proxy/           # CORS 本地代理
├── plugins/                # 插件系统
│   ├── canvas/sdk/         # 插件开发 SDK
│   ├── canvas/registry/    # 官方插件注册表
│   └── canvas/*/           # 各插件实现
├── docs/                   # 文档站点（Next.js + MDX）
│   └── assets/             # README 截图资源
├── docs_3d_director/       # 3D 导演台源文档
├── Dockerfile
├── docker-compose.yml
└── nginx.conf
```

---

## 文档与资源

完整文档请访问 [docs/index.md](./docs/index.md)，包含：

| 文档 | 说明 |
|---|---|
| [快速开始](./docs/content/docs/overview/quick-start.mdx) | 安装配置与上手指南 |
| [功能详情](./docs/content/docs/overview/features.mdx) | 全部功能详细说明 |
| [画布节点指南](./docs/content/docs/canvas/canvas-node-manual.mdx) | 各节点类型用法 |
| [快捷键](./docs/content/docs/canvas/canvas-shortcuts.mdx) | 画布快捷键一览 |
| [本地开发](./docs/content/docs/development/local-development.mdx) | 本地调试与构建 |
| [Docker 部署](./docs/content/docs/overview/docker.mdx) | Docker 容器化方案 |
| [Agent 连接说明](./docs/content/docs/development/local-codex-canvas.mdx) | Codex Agent 集成 |
| [嵌入协议](./docs_3d_director/embed-contract.md) | 3D 导演台 postMessage 接口 |

**截图资源**统一存放在 [`docs/assets/`](./docs/assets/) 目录。

---

## 当前限制

- 项目为前端优先架构，画布项目与素材保存在浏览器本地，不提供云账户或云存储
- AI API Key 存储在浏览器本地，由前端直连 AI 提供商接口
- Docker 静态资源路径在生产环境的验证仍在进行中
- 3D 导演台复杂模型导入受浏览器 WebGL 性能限制，重要工程请定期导出 JSON 备份
- 开发阶段存储格式会变动，重要工程务必导出备份

---

## 许可

MIT License — 允许个人、开源及商业场景免费使用。
