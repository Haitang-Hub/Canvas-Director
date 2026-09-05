<p align="center">
  <img src="web/public/logo.svg" width="96" alt="infinite-canvas logo">
</p>

<h1 align="center">Canvas Director（无限画布 · 3D 导演台）</h1>

<p align="center">
  <a href="https://linux.do/"><img src="https://img.shields.io/badge/Linux.do-Community-2b6de8?style=flat-square" alt="Linux.do"></a>
  <a href="https://render.com/deploy?repo=https://github.com/basketikun/infinite-canvas"><img src="https://img.shields.io/badge/Render-Deploy-46e3b7?style=flat-square&logo=render&logoColor=111111" alt="Deploy to Render"></a>
  <a href="https://github.com/basketikun/infinite-canvas"><img src="https://img.shields.io/github/stars/basketikun/infinite-canvas?style=flat-square&logo=github" alt="GitHub stars"></a>
  <a href="https://github.com/basketikun/infinite-canvas/tags"><img src="https://img.shields.io/github/v/tag/basketikun/infinite-canvas?style=flat-square&label=version" alt="Version"></a>
  <a href="https://vite.dev/"><img src="https://img.shields.io/badge/Vite-7-646cff?style=flat-square&logo=vite&logoColor=white" alt="Vite"></a>
  <a href="https://reactrouter.com/"><img src="https://img.shields.io/badge/React_Router-7-ca4245?style=flat-square&logo=reactrouter&logoColor=white" alt="React Router"></a>
</p>

<p align="center">
<a href="https://trendshift.io/repositories/50077?utm_source=repository-badge&amp;utm_medium=badge&amp;utm_campaign=badge-repository-50077" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/repositories/50077" alt="basketikun%2Finfinite-canvas | Trendshift" width="250" height="55"/></a>
</p>

<p align="center">
  <a href="docs/content/docs/overview/quick-start.mdx">快速开始</a> · <a href="docs/content/docs/overview/features.mdx">功能介绍</a> · <a href="docs/content/docs/overview/render.mdx">Render 部署</a> · <a href="docs/content/docs/overview/docker.mdx">Docker 部署</a> · <a href="docs/content/docs/canvas/canvas-node-manual.mdx">画布节点操作手册</a> · <a href="docs/content/docs/canvas/canvas-shortcuts.mdx">画布快捷键</a> · <a href="SECURITY.md">漏洞提交</a> · <a href="docs/content/docs/progress/todo.mdx">待办事项</a> · <a href="canvas-agent/README.md">本地 Canvas Agent</a> · <a href="plugins/infinite-canvas">Codex app 插件</a>
</p>

**Canvas Director** 是一款面向 AI 视觉创作的开源工作台，由 [无限画布](https://github.com/basketikun/infinite-canvas) 与 [3D 导演台](https://github.com/xiaozangao/3d-director-desk) 两个项目融合而成。它把**画布编排、AI 图片生成、3D 运镜分镜、参考图编辑、对话助手、提示词库和素材沉淀**放在同一个界面里，适合用来探索视觉方案并连续迭代图片结果。

> [!CAUTION]
> 项目目前处于开发阶段，不保证历史数据兼容。各种本地存储格式都可能直接调整，欢迎关注后续更新。
>
> 如果你需要稳定维护自己的分支，建议自行 fork 后独立开发。二次开发与 PR 请保留原作者信息和前端页面标识。

## 核心功能

- **无限画布**：多画布项目、节点拖拽缩放、连线、小地图、撤销重做、导入导出。
- **AI 创作**：浏览器前台直连你配置的 OpenAI 兼容接口，支持文生图、图生图、参考图编辑、文本问答、音频和视频生成。
- **画布助手**：围绕选中节点和上游节点对话、生图，并把结果插回画布。
- **3D 导演台节点**：在画布中直接打开运镜场景，摆放人物与道具、记录摄影机轨迹、预览或导出参考视频，无缝衔接 AI 生图流程。
- **本地 Agent**：通过本机 Canvas Agent 连接 Codex / Claude Code，让 Agent 通过 MCP 操作当前画布。
- **Codex App 插件**：提供 Codex app 插件，安装后会自动注册 MCP 并尝试拉起本地 Agent。
- **插件系统**：支持通过 URL 动态安装 / 启用 / 更新 / 卸载远程节点插件，并提供 TypeScript SDK 自行开发画布节点插件。
- **自定义接口调用**：可自定义生图 / 视频接口的调用方式，灵活适配各类中转站与自建服务。
- **提示词库**：内置 7 个开源提示词来源并支持自定义标准 JSON 来源，由浏览器前端直连并缓存到 IndexedDB。
- **iframe 嵌入**：支持通过 `instanceId` 隔离工程，将画布或 3D 导演台嵌入其他网页应用。

完整功能说明见 [功能介绍](docs/content/docs/overview/features.mdx)。

如果你在为担心没有合适的生图 API 来发愁，可以查看该免费生图项目：[chatgpt2api](https://github.com/basketikun/chatgpt2api)

## 快速开始

AI API Key、Base URL、画布、素材和生成记录默认保存在浏览器本地。

### 本地开发

推荐从项目根目录运行启动脚本，自动安装依赖、启动代理与服务：

**Windows：**

```bash
git clone git@github.com:basketikun/infinite-canvas.git
cd infinite-canvas
start.bat
```

**macOS / Linux：**

```bash
git clone git@github.com:basketikun/infinite-canvas.git
cd infinite-canvas
chmod +x start.sh
./start.sh
```

启动后访问 http://localhost:5070。如需单独使用包管理器：

```bash
git clone git@github.com:basketikun/infinite-canvas.git
cd infinite-canvas
bun install   # 或 npm install / pnpm install / yarn install
bun run dev --prefix web
```

停止服务时在终端按 `Ctrl + C`。

### Docker 运行

```bash
git clone git@github.com:basketikun/infinite-canvas.git
cd infinite-canvas
docker compose up -d
```

运行后默认端口 5070，可访问 `http://localhost:5070`。

首次打开后进入右上角配置，填入自己的 OpenAI 兼容 `Base URL` 和 `API Key`。

如果默认的 OpenAI 接口调用方式与您的 API 不同，可自定义生图/视频脚本调用。

## iframe 嵌入

项目可作为独立页面嵌入其他网页。通过 `instanceId` 隔离工程：

```html
<iframe
  src="http://localhost:5070/?instanceId=canvas_123&theme=dark"
></iframe>
```

消息格式详见 [docs/content/docs/overview/embed.mdx]。

## 效果展示

<table width="100%">
  <tr>
    <td width="50%"><img src="https://i.ibb.co/TDFvGWDT/image.png" alt="image" border="0"></td>
    <td width="50%"><img src="https://i.ibb.co/zVwJq3YS/image.png" alt="image" border="0"></td>
  </tr>
  <tr>
    <td width="50%"><img src="https://i.ibb.co/PvY3qhhK/image.png" alt="image" border="0"></td>
    <td width="50%"><img src="https://i.ibb.co/7D04LwN/image.png" alt="image" border="0"></td>
  </tr>
  <tr>
    <td width="50%"><img src="https://i.ibb.co/bj30FtS5/5.png" alt="5" border="0"></td>
    <td width="50%"><img src="https://i.ibb.co/hxRvjw51/image.png" alt="image" border="0"></td>
  </tr>
  <tr>
    <td width="50%"><img src="https://i.ibb.co/jkWsF8q1/image.png" alt="image" border="0"></td>
    <td width="50%"><img src="https://i.ibb.co/XrnfXHx7/image.png" alt="image" border="0"></td>
  </tr>
</table>

## 作者 & 来源

本项目由以下两个开源项目共同贡献融合：

| 项目 | 作者 / 来源 |
|------|------------|
| **无限画布**（infinite-canvas） | [basketikun/infinite-canvas](https://github.com/basketikun/infinite-canvas) |
| **3D 导演台**（3d-director-desk） | [xiaozangao/3d-director-desk](https://github.com/xiaozangao/3d-director-desk) |

## Star History

<a href="https://www.star-history.com/?repos=basketikun%2Finfinite-canvas&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=basketikun/infinite-canvas&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=basketikun/infinite-canvas&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=basketikun/infinite-canvas&type=date&legend=top-left" />
 </picture>
</a>
