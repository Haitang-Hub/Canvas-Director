# Canvas Director

[English](README.md) · **简体中文**

![Version](https://img.shields.io/badge/版本-v0.17.0-2da44e)
![License](https://img.shields.io/badge/许可证-MIT-d4a72c)
![React](https://img.shields.io/badge/React-19-0969da)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)
![Vite](https://img.shields.io/badge/Vite-7-2da44e)
![Three.js](https://img.shields.io/badge/Three.js-0.184-6e7781)

**Canvas Director** 是一款基于浏览器的 AI 辅助视觉创作工具，通过 iframe 将**无限 2D 画布**与**3D 导演台**深度整合：在画布上编写剧本与提示词，在 3D 导演台中完成分镜摆位与运镜录制，再把预演素材交给 AI 生成最终图片与视频，一站式完成短剧 / 短视频创作全流程。

无需后端服务，浏览器直连你自己配置的 OpenAI 兼容 AI 接口。

## 功能特性

**无限画布**

- 无限画布拖拽平移、滚轮缩放，支持小地图导航、缩放滑杆与重置视图。
- 点阵、网格线、空白三种背景，支持浅色与深色主题。
- 节点拖拽、四角缩放、连线、复制粘贴；框选、多选、一键打组与解散组。
- 节点、连线、视口、背景、助手会话均支持撤销与重做。
- 双击空白处快速创建节点，提供完整快捷键支持。

**AI 创作**

- 文生图、图生图 / 参考图编辑、遮罩标注式局部重绘。
- 文生视频、图生视频与关键帧动画；音频生成；支持图片理解的多模型 LLM 对话。
- 适配任意 OpenAI 兼容渠道，可通过自定义调用脚本灵活对接中转站与自建服务。
- 输入框内 `@` 引用已连接资源（图片直接显示真实缩略图）；支持批量生成、图片组叠卡预览与备选结果。
- 视频任务保存远端任务 ID，刷新页面后自动继续轮询状态；失败步骤可从断点重试。

**Canvas Agent**

- 本地 Codex CLI 通过 MCP 协议接入并直接操作画布，回复流式输出。
- 支持审批与权限控制；连接凭据经 URL fragment 传递，日志自动脱敏常见密钥。

**3D 导演台**

- 通过 iframe 与 `postMessage` 嵌入画布，导演台工作区独立管理。
- 内置人物与道具模型库（本地 Guo / Mixamo 资源），完成场景摆位。
- 第一人称掌镜操作，支持运镜轨迹录制与双时间轴。
- 导出干净的参考截图与 H.264 MP4 视频，回传到画布继续使用。

**插件系统**

- 内置 18+ 节点插件：Markdown、SVG、HTML、360° 全景、便利贴、Mermaid 图、LaTeX 公式、代码运行、JSON 表格、思维导图、二维码、取色板、草图、切图 / 拼图 / 图片对比、音频波形裁剪等。
- 支持通过 URL 动态安装、更新、卸载远程插件，官方插件注册表可一键安装。
- 提供 TypeScript 插件开发 SDK，可自定义节点类型并复用 AI 生成与面板扩展能力。

**本地优先存储**

- 画布项目与素材保存在浏览器本地（基于 localforage 的 IndexedDB）。
- 可选配置 WebDAV 实现跨设备同步。
- API Key 保存在浏览器本地，请求直接发往 OpenAI 兼容接口。
- 可选开启本地代理，解决浏览器 CORS 限制并统一转发请求。

## 典型工作流

1. 在画布节点中编写剧本、提示词与角色设定。
2. 打开嵌入的 3D 导演台，摆放人物、道具与场景站位。
3. 录制摄影机运镜轨迹，导出参考截图与镜头参数。
4. 通过 `postMessage` 将预演素材回传给画布节点。
5. 画布把参考图交给 AI 模型，完成最终生图 / 生视频。
6. 生成结果回到画布，继续迭代与整理。

## 项目截图

**无限画布**

<p>
  <img src="docs/assets/canvas_1.png" width="49%" alt="画布总览">
  <img src="docs/assets/canvas_2.png" width="49%" alt="节点与生成配置">
</p>
<p>
  <img src="docs/assets/canvas_3.png" width="49%" alt="AI 生成工作流">
  <img src="docs/assets/canvas_4.png" width="49%" alt="画布助手">
</p>

**3D 导演台**

<p>
  <img src="docs/assets/director_1.png" width="49%" alt="导演台场景">
  <img src="docs/assets/director_2.png" width="49%" alt="机位与时间轴">
</p>
<p>
  <img src="docs/assets/director_3.png" width="49%" alt="人物摆位">
  <img src="docs/assets/director_4.png" width="49%" alt="镜头录制">
</p>

## 快速开始

### 在线部署

项目自带 `vercel.json` / `render.yaml`，可一键部署到 [Vercel](https://vercel.com) 或 [Render](https://render.com)。无需后端服务，浏览器直连 AI 接口。

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

## 数据与安全

- 画布项目和「我的素材」主要保存在浏览器本地，项目本身不提供云同步；可自行配置 WebDAV 实现跨设备同步。
- AI API Key 保存在浏览器本地，由前端直接请求你配置的 OpenAI 兼容接口，请使用可信渠道的密钥。
- 可选的 Canvas Agent 在你自己的本机运行，采用 Token 认证连接。

## 致谢

Canvas Director 为二次开发项目，核心能力来源于：

- [Infinite Canvas](https://github.com/basketikun/infinite-canvas)
- [3D Director Desk](https://github.com/xiaozangao/3d-director-desk)

## 许可证

[MIT](LICENSE)
