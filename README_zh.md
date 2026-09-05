# Canvas Director

<div style="position:absolute;top:24px;right:24px;z-index:100">
  <a href="README.md" style="display:inline-block;background:#1e293b;color:#7dd3fc;border:1px solid #334155;border-radius:6px;padding:4px 12px;font-size:13px;text-decoration:none;font-weight:500">English</a>
</div>

<div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);border:1px solid #334155;border-radius:12px;padding:32px;margin:16px 0">
<h1 style="margin:0 0 8px;font-size:28px;color:#f1f5f9">Canvas Director</h1>
<p style="margin:0 0 4px;font-size:15px;color:#cbd5e1">A browser-based AI-assisted visual creation tool that deeply integrates an <strong style="color:#7dd3fc">infinite 2D canvas</strong> with a <strong style="color:#7dd3fc">3D director desk</strong> via iframe, enabling a complete short drama production pipeline from storyboard previsualization to AI generation.</p>
<p style="margin:0;font-size:13px;color:#64748b">项目来源：本项目为二次开发，核心能力来源于两个独立开源项目：<a href="https://github.com/basketikun/infinite-canvas" style="color:#7dd3fc;text-decoration:none">✦ Infinite Canvas</a> · <a href="https://github.com/xiaozangao/3d-director-desk" style="color:#7dd3fc;text-decoration:none">✦ 3D Director Desk</a></p>
</div>

<br>

<!-- NAV CARDS -->
<table style="width:100%;border-collapse:collapse;margin:16px 0">
<tr>
<td style="width:25%;vertical-align:top;padding:8px">
<a href="#features" style="text-decoration:none;color:inherit">
<div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:14px 16px;height:100%">
<div style="font-size:22px;margin-bottom:6px">⚡</div>
<div style="font-weight:600;font-size:14px;color:#f1f5f9">功能概览</div>
<div style="font-size:12px;color:#94a3b8;margin-top:4px">画布 · AI · Agent · 3D 导演台</div>
</div>
</a>
</td>
<td style="width:25%;vertical-align:top;padding:8px">
<a href="#screenshots" style="text-decoration:none;color:inherit">
<div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:14px 16px;height:100%">
<div style="font-size:22px;margin-bottom:6px">🖼️</div>
<div style="font-weight:600;font-size:14px;color:#f1f5f9">项目截图</div>
<div style="font-size:12px;color:#94a3b8;margin-top:4px">无限画布 · 3D 导演台</div>
</div>
</a>
</td>
<td style="width:25%;vertical-align:top;padding:8px">
<a href="#quickstart" style="text-decoration:none;color:inherit">
<div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:14px 16px;height:100%">
<div style="font-size:22px;margin-bottom:6px">🚀</div>
<div style="font-weight:600;font-size:14px;color:#f1f5f9">快速开始</div>
<div style="font-size:12px;color:#94a3b8;margin-top:4px">在线体验 · 本地开发 · Docker</div>
</div>
</a>
</td>
<td style="width:25%;vertical-align:top;padding:8px">
<a href="#docs" style="text-decoration:none;color:inherit">
<div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:14px 16px;height:100%">
<div style="font-size:22px;margin-bottom:6px">📚</div>
<div style="font-weight:600;font-size:14px;color:#f1f5f9">文档</div>
<div style="font-size:12px;color:#94a3b8;margin-top:4px">功能详情 · 节点指南 · 快捷键</div>
</div>
</a>
</td>
</tr>
</table>

<h2 id="features">功能概览</h2>

<h3>无限画布</h3>
<ul>
<li>多画布项目管理：创建、重命名、复制、删除、导入、导出</li>
<li>节点拖拽、缩放、连线、小地图导航、撤销重做；双击空白区域快速创建节点，支持分组与吸附</li>
<li>拖拽文件直接入画布，导出为压缩包</li>
</ul>

<h3>AI 创作</h3>
<ul>
<li><strong>文生图 / 图生图</strong>：支持多张参考图，保留原始比例，透明背景生成</li>
<li><strong>局部编辑</strong>：蒙版标注，指定区域修改</li>
<li><strong>文生视频 / 图生视频</strong>：支持首尾帧、全能参考模式，视频时长可配置</li>
<li><strong>音频生成</strong>：支持多种音频模型</li>
<li><strong>文本生成</strong>：支持推理强度调节，多结果合并为备选文本</li>
<li>多模型渠道管理：OpenAI、Gemini、Agnes 等 OpenAI 兼容接口</li>
<li>自定义调用脚本，适配不同中转站</li>
</ul>

<h3>Canvas Agent</h3>
<ul>
<li>连接本地 Codex CLI，通过 MCP 协议操作画布</li>
<li>右侧常驻侧边栏，流式对话响应</li>
<li>支持审批操作、三档权限调节；按节点生成提示词，自动引用上游素材</li>
<li>支持 <code>/</code> 快速选择 Skill，<code>@</code> 引用画布素材</li>
<li>多标签页隔离，历史会话自动恢复</li>
</ul>

<h3>3D 导演台</h3>
<ul>
<li>基于 Three.js 的 3D 场景编辑器，可在画布中以 iframe 节点形式嵌入</li>
<li>角色与道具模型库（内置 UE 人偶 / Mixamo 本地资源），支持 FBX/GLB 导入</li>
<li>第一人称掌镜录制运镜轨迹，WASD 操作 + Enter 记录轨迹点</li>
<li>双时间轴：摄影机轨迹 + 人物运动路线；机位设置、运镜预设、镜头防抖</li>
<li>导出干净截图和 H.264 MP4 参考视频（720p/1080p，24–60FPS）</li>
<li>通过 postMessage 将截图和镜头参数回传给画布节点</li>
</ul>

<h3>插件系统 &amp; 提示词库</h3>
<ul>
<li>插件 SDK：TypeScript + 自动 JSX 运行时；插件注册表一键安装官方插件</li>
<li>内置 18+ 插件：Markdown、SVG、HTML、全景、便利贴、LaTeX、Mermaid、思维导图、二维码、色板提取、文字统计、JSON 表格、代码运行、图片拼接/对比/分割、音频波形</li>
<li>提示词库：7 个内置来源，独立缓存与刷新；支持自定义 JSON 来源</li>
<li>跨来源搜索、标签筛选、详情预览、一键插入画布</li>
</ul>

<h3>数据管理</h3>
<ul>
<li>画布项目和素材默认存储在浏览器本地（IndexedDB）</li>
<li>可选配置 WebDAV 实现跨设备同步</li>
</ul>

<h2 id="comparison">产品对比</h2>

<table style="width:100%;border-collapse:collapse;font-size:13px">
<thead>
<tr style="background:#1e293b">
<th style="padding:8px 12px;text-align:left;border-bottom:1px solid #334155;color:#94a3b8;font-weight:500;width:18%">维度</th>
<th style="padding:8px 12px;text-align:left;border-bottom:1px solid #334155;color:#94a3b8;font-weight:500;width:31%">无限画布</th>
<th style="padding:8px 12px;text-align:left;border-bottom:1px solid #334155;color:#94a3b8;font-weight:500;width:31%">3D 导演台</th>
</tr>
</thead>
<tbody>
<tr><td colspan="3" style="padding:7px 12px;border-bottom:1px solid #1e293b;font-weight:600">核心定位</td></tr>
<tr><td colspan="3" style="padding:7px 12px;border-bottom:1px solid #1e293b">2D 节点式 AI 创作工作台 &nbsp;·&nbsp; 3D 分镜运镜预演工具</td></tr>
<tr><td colspan="3" style="padding:7px 12px;border-bottom:1px solid #1e293b;font-weight:600">AI 能力</td></tr>
<tr><td colspan="3" style="padding:7px 12px;border-bottom:1px solid #1e293b">✅ 多模态：生图 / 生视频 / LLM &nbsp;·&nbsp; ❌ 无 AI，仅产出参考素材</td></tr>
<tr><td colspan="3" style="padding:7px 12px;border-bottom:1px solid #1e293b;font-weight:600">空间</td></tr>
<tr><td colspan="3" style="padding:7px 12px;border-bottom:1px solid #1e293b">无限 2D 节点画布 &nbsp;·&nbsp; WebGL 真实三维空间</td></tr>
<tr><td colspan="3" style="padding:7px 12px;border-bottom:1px solid #1e293b;font-weight:600">运镜控制</td></tr>
<tr><td colspan="3" style="padding:7px 12px;border-bottom:1px solid #1e293b">只能通过提示词描述 &nbsp;·&nbsp; ✅ 第一人称掌镜录制轨迹</td></tr>
<tr><td colspan="3" style="padding:7px 12px;border-bottom:1px solid #1e293b;font-weight:600">模型能力</td></tr>
<tr><td colspan="3" style="padding:7px 12px;border-bottom:1px solid #1e293b">2D 图片/视频处理 &nbsp;·&nbsp; ✅ 3D 人物/道具/FBX/GLB 导入</td></tr>
<tr><td colspan="3" style="padding:7px 12px;font-weight:600">存储</td></tr>
<tr><td colspan="3" style="padding:7px 12px">IndexedDB &nbsp;·&nbsp; localStorage</td></tr>
</tbody>
</table>

<h2 id="workflow">典型工作流</h2>

<table style="width:100%;border-collapse:collapse;font-size:13px">
<thead>
<tr style="background:#1e293b">
<th style="padding:8px 12px;text-align:center;border-bottom:1px solid #334155;color:#94a3b8;font-weight:500;width:12%">步骤</th>
<th style="padding:8px 12px;text-align:left;border-bottom:1px solid #334155;color:#94a3b8;font-weight:500">操作</th>
</tr>
</thead>
<tbody>
<tr><td style="padding:8px 12px;text-align:center;border-bottom:1px solid #1e293b;font-weight:700;color:#7dd3fc">1</td><td style="padding:8px 12px;border-bottom:1px solid #1e293b">在画布编写剧本、提示词、角色设定节点</td></tr>
<tr><td style="padding:8px 12px;text-align:center;border-bottom:1px solid #1e293b;font-weight:700;color:#7dd3fc">2</td><td style="padding:8px 12px;border-bottom:1px solid #1e293b">画布内打开嵌入的 3D 导演台，摆放人物站位与动作</td></tr>
<tr><td style="padding:8px 12px;text-align:center;border-bottom:1px solid #1e293b;font-weight:700;color:#7dd3fc">3</td><td style="padding:8px 12px;border-bottom:1px solid #1e293b">录制摄影机运镜轨迹，导出参考截图和镜头参数</td></tr>
<tr><td style="padding:8px 12px;text-align:center;border-bottom:1px solid #1e293b;font-weight:700;color:#7dd3fc">4</td><td style="padding:8px 12px;border-bottom:1px solid #1e293b">通过 postMessage 将预演素材回传给画布节点</td></tr>
<tr><td style="padding:8px 12px;text-align:center;border-bottom:1px solid #1e293b;font-weight:700;color:#7dd3fc">5</td><td style="padding:8px 12px;border-bottom:1px solid #1e293b">画布将参考图交给 AI 完成最终生图/生视频</td></tr>
<tr><td style="padding:8px 12px;text-align:center;font-weight:700;color:#7dd3fc">6</td><td style="padding:8px 12px">生成结果回到画布，继续迭代整理</td></tr>
</tbody>
</table>

<h2 id="screenshots">项目截图</h2>

<h3>无限画布</h3>
<table style="width:100%;border-collapse:collapse">
<tr>
<td style="width:50%;padding:6px;vertical-align:top">
<img src="./docs/assets/canvas_1.png" alt="画布主界面" style="width:100%;border-radius:8px;border:1px solid #334155" loading="lazy">
<div style="font-size:12px;color:#94a3b8;margin-top:4px;text-align:center">画布主界面</div>
</td>
<td style="width:50%;padding:6px;vertical-align:top">
<img src="./docs/assets/canvas_2.png" alt="节点编辑" style="width:100%;border-radius:8px;border:1px solid #334155" loading="lazy">
<div style="font-size:12px;color:#94a3b8;margin-top:4px;text-align:center">节点编辑</div>
</td>
</tr>
<tr>
<td style="padding:6px;vertical-align:top">
<img src="./docs/assets/canvas_3.png" alt="素材管理" style="width:100%;border-radius:8px;border:1px solid #334155" loading="lazy">
<div style="font-size:12px;color:#94a3b8;margin-top:4px;text-align:center">素材管理</div>
</td>
<td style="padding:6px;vertical-align:top">
<img src="./docs/assets/canvas_4.png" alt="插件面板" style="width:100%;border-radius:8px;border:1px solid #334155" loading="lazy">
<div style="font-size:12px;color:#94a3b8;margin-top:4px;text-align:center">插件面板</div>
</td>
</tr>
</table>

<h3 style="margin-top:24px">3D 导演台</h3>
<table style="width:100%;border-collapse:collapse">
<tr>
<td style="width:50%;padding:6px;vertical-align:top">
<img src="./docs/assets/director_1.png" alt="场景搭建" style="width:100%;border-radius:8px;border:1px solid #334155" loading="lazy">
<div style="font-size:12px;color:#94a3b8;margin-top:4px;text-align:center">场景搭建</div>
</td>
<td style="width:50%;padding:6px;vertical-align:top">
<img src="./docs/assets/director_2.png" alt="掌镜录制" style="width:100%;border-radius:8px;border:1px solid #334155" loading="lazy">
<div style="font-size:12px;color:#94a3b8;margin-top:4px;text-align:center">掌镜录制</div>
</td>
</tr>
<tr>
<td style="padding:6px;vertical-align:top">
<img src="./docs/assets/director_3.png" alt="时间轴编辑" style="width:100%;border-radius:8px;border:1px solid #334155" loading="lazy">
<div style="font-size:12px;color:#94a3b8;margin-top:4px;text-align:center">时间轴编辑</div>
</td>
<td style="padding:6px;vertical-align:top">
<img src="./docs/assets/director_4.png" alt="运镜预演" style="width:100%;border-radius:8px;border:1px solid #334155" loading="lazy">
<div style="font-size:12px;color:#94a3b8;margin-top:4px;text-align:center">运镜预演</div>
</td>
</tr>
</table>

<h2>技术栈</h2>

<table style="width:100%;border-collapse:collapse;font-size:13px">
<thead>
<tr style="background:#1e293b">
<th style="padding:8px 12px;text-align:left;border-bottom:1px solid #334155;color:#94a3b8;font-weight:500;width:30%">类别</th>
<th style="padding:8px 12px;text-align:left;border-bottom:1px solid #334155;color:#94a3b8;font-weight:500">技术</th>
</tr>
</thead>
<tbody>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">前端框架</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b">React 19 + TypeScript</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">构建工具</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b">Vite 7</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">UI 组件</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b">Ant Design 6 + Tailwind CSS v4</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">状态管理</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b">Zustand 5（持久化用 localforage）</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">路由</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b">React Router 7</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">数据请求</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b">TanStack React Query 5 + Axios</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">3D 渲染</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b">Three.js 0.184 + React Three Fiber 9 + drei 10</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">代码编辑</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b">CodeMirror 6</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">动画</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b">Framer Motion 12</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">Agent 运行时</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b">Node.js ≥ 18 + @openai/codex 0.146</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">Agent 协议</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b">MCP SDK 1.12 + Express 5</td></tr>
<tr><td colspan="2" style="padding:6px 12px;font-weight:600">本地代理</td><td style="padding:6px 12px">纯 Node.js（解决 CORS）</td></tr>
</tbody>
</table>

<h2 id="quickstart">快速开始</h2>

<h3>在线体验</h3>
<p>部署到 <a href="https://vercel.com" style="color:#7dd3fc">Vercel</a> 或 <a href="https://render.com" style="color:#7dd3fc">Render</a>，无需后端服务，浏览器直连 AI API。</p>

<h3>本地开发</h3>

```bash
# 克隆项目
git clone git@github.com:basketikun/infinite-canvas.git
cd infinite-canvas

# 启动前端（端口 5070）
cd web && npm install && npm run dev

# 启动文档站点（可选）
cd ../docs && npm run dev
```

<p style="font-size:13px;color:#94a3b8">首次使用请在设置中配置 <code>Base URL</code>、<code>API Key</code>（仅存储在浏览器本地）及默认模型名称。</p>

<h3>启动本地 Agent（可选）</h3>

```bash
npx -y @basketikun/canvas-agent@latest
# 启动（端口 17371）
```

<h3>启动本地代理（可选）</h3>
<p style="font-size:13px;color:#94a3b8">解决浏览器直连 AI API 时的 CORS 问题：</p>

```bash
npx @basketikun/canvas-proxy@latest --port 23210
# 代理（端口 23210）
```

<h3>Docker 部署</h3>

```bash
docker-compose up -d
```
<p style="font-size:13px;color:#94a3b8">访问 <code>http://localhost:5070</code></p>

<h2>项目结构</h2>

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

<h2 id="docs">文档与资源</h2>

<p style="font-size:13px;color:#94a3b8">完整文档请访问 <a href="./docs/index.md" style="color:#7dd3fc">docs/index.md</a></p>

<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px">
<thead>
<tr style="background:#1e293b">
<th style="padding:7px 12px;text-align:left;border-bottom:1px solid #334155;color:#94a3b8;font-weight:500;width:28%">文档</th>
<th style="padding:7px 12px;text-align:left;border-bottom:1px solid #334155;color:#94a3b8;font-weight:500">说明</th>
</tr>
</thead>
<tbody>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">快速开始</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b"><a href="./docs/content/docs/overview/quick-start.mdx" style="color:#7dd3fc">快速开始</a> — 安装配置与上手指南</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">功能详情</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b"><a href="./docs/content/docs/overview/features.mdx" style="color:#7dd3fc">功能详情</a> — 全部功能详细说明</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">画布节点指南</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b"><a href="./docs/content/docs/canvas/canvas-node-manual.mdx" style="color:#7dd3fc">画布节点指南</a> — 各节点类型用法</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">快捷键</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b"><a href="./docs/content/docs/canvas/canvas-shortcuts.mdx" style="color:#7dd3fc">快捷键</a> — 画布快捷键一览</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">本地开发</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b"><a href="./docs/content/docs/development/local-development.mdx" style="color:#7dd3fc">本地开发</a> — 本地调试与构建</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">Docker 部署</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b"><a href="./docs/content/docs/overview/docker.mdx" style="color:#7dd3fc">Docker 部署</a> — 容器化方案</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">Agent 连接说明</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b"><a href="./docs/content/docs/development/local-codex-canvas.mdx" style="color:#7dd3fc">Agent 连接说明</a> — Codex Agent 集成</td></tr>
<tr><td colspan="2" style="padding:6px 12px;font-weight:600">嵌入协议</td><td style="padding:6px 12px"><a href="./docs_3d_director/embed-contract.md" style="color:#7dd3fc">嵌入协议</a> — 3D 导演台 postMessage 接口</td></tr>
</tbody>
</table>

<p style="font-size:12px;color:#64748b;margin-top:12px">截图资源统一存放在 <code>docs/assets/</code> 目录。</p>

<h2>当前限制</h2>

<ul style="font-size:13px;color:#94a3b8">
<li>前端优先架构，画布项目与素材保存在浏览器本地，不提供云账户或云存储</li>
<li>AI API Key 存储在浏览器本地，由前端直连 AI 提供商接口</li>
<li>Docker 静态资源路径在生产环境的验证仍在进行中</li>
<li>3D 导演台复杂模型导入受浏览器 WebGL 性能限制，重要工程请定期导出 JSON 备份</li>
<li>开发阶段存储格式会变动，重要工程务必导出备份</li>
</ul>
