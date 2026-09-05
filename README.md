# Canvas Director

<div style="position:absolute;top:24px;right:24px;z-index:100">
  <a href="README_zh.md" style="display:inline-block;background:#1e293b;color:#7dd3fc;border:1px solid #334155;border-radius:6px;padding:4px 12px;font-size:13px;text-decoration:none;font-weight:500">中文</a>
</div>

<div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);border:1px solid #334155;border-radius:12px;padding:32px;margin:16px 0">
<h1 style="margin:0 0 8px;font-size:28px;color:#f1f5f9">Canvas Director</h1>
<p style="margin:0 0 4px;font-size:15px;color:#cbd5e1">A browser-based AI-assisted visual creation tool that deeply integrates an <strong style="color:#7dd3fc">infinite 2D canvas</strong> with a <strong style="color:#7dd3fc">3D director desk</strong> via iframe, enabling a complete short drama production pipeline from storyboard previsualization to AI generation.</p>
<p style="margin:0;font-size:13px;color:#64748b">Origins: This project is a derivative work combining two independent open-source projects: <a href="https://github.com/basketikun/infinite-canvas" style="color:#7dd3fc;text-decoration:none">✦ Infinite Canvas</a> · <a href="https://github.com/xiaozangao/3d-director-desk" style="color:#7dd3fc;text-decoration:none">✦ 3D Director Desk</a></p>
</div>

<br>

<!-- NAV CARDS -->
<table style="width:100%;border-collapse:collapse;margin:16px 0">
<tr>
<td style="width:25%;vertical-align:top;padding:8px">
<a href="#features" style="text-decoration:none;color:inherit">
<div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:14px 16px;height:100%">
<div style="font-size:22px;margin-bottom:6px">⚡</div>
<div style="font-weight:600;font-size:14px;color:#f1f5f9">Features</div>
<div style="font-size:12px;color:#94a3b8;margin-top:4px">Canvas · AI · Agent · 3D Desk</div>
</div>
</a>
</td>
<td style="width:25%;vertical-align:top;padding:8px">
<a href="#screenshots" style="text-decoration:none;color:inherit">
<div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:14px 16px;height:100%">
<div style="font-size:22px;margin-bottom:6px">🖼️</div>
<div style="font-weight:600;font-size:14px;color:#f1f5f9">Screenshots</div>
<div style="font-size:12px;color:#94a3b8;margin-top:4px">Infinite Canvas · 3D Director</div>
</div>
</a>
</td>
<td style="width:25%;vertical-align:top;padding:8px">
<a href="#quickstart" style="text-decoration:none;color:inherit">
<div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:14px 16px;height:100%">
<div style="font-size:22px;margin-bottom:6px">🚀</div>
<div style="font-weight:600;font-size:14px;color:#f1f5f9">Quick Start</div>
<div style="font-size:12px;color:#94a3b8;margin-top:4px">Online · Local · Docker</div>
</div>
</a>
</td>
<td style="width:25%;vertical-align:top;padding:8px">
<a href="#docs" style="text-decoration:none;color:inherit">
<div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:14px 16px;height:100%">
<div style="font-size:22px;margin-bottom:6px">📚</div>
<div style="font-weight:600;font-size:14px;color:#f1f5f9">Documentation</div>
<div style="font-size:12px;color:#94a3b8;margin-top:4px">Features · Node Guide · Shortcuts</div>
</div>
</a>
</td>
</tr>
</table>

<h2 id="features">Features</h2>

<h3>Infinite Canvas</h3>
<ul>
<li>Create, rename, duplicate, delete, import, and export canvas projects; multi-canvas management</li>
<li>Drag, zoom, connect nodes; mini-map navigation; undo/redo; double-click to create, grouping and snapping</li>
<li>Drag files directly into canvas; export as zip</li>
</ul>

<h3>AI Creation</h3>
<ul>
<li><strong>Text-to-Image / Image-to-Image</strong>: Multi-reference images, preserve aspect ratio, transparent background</li>
<li><strong>Inpainting</strong>: Mask annotation for region-specific editing</li>
<li><strong>Text-to-Video / Image-to-Video</strong>: First/last frame and all-reference modes; configurable duration</li>
<li><strong>Audio Generation</strong>: Multiple audio models supported</li>
<li><strong>Text Generation</strong>: Adjustable reasoning intensity; multiple results merged as alternatives</li>
<li>Multi-model channels: OpenAI, Gemini, Agnes and other OpenAI-compatible APIs</li>
<li>Custom call scripts for different relay services</li>
</ul>

<h3>Canvas Agent</h3>
<ul>
<li>Connect local Codex CLI via MCP protocol to operate the canvas</li>
<li>Persistent right sidebar with streaming conversation responses</li>
<li>Approval operations, three-level permission; auto-generate prompts per node with upstream asset references</li>
<li><code>/</code> quick-select Skill, <code>@</code> reference canvas assets</li>
<li>Multi-tab isolation, auto-restore historical sessions</li>
</ul>

<h3>3D Director Desk</h3>
<ul>
<li>Three.js-based 3D scene editor, embeddable as iframe node in canvas</li>
<li>Character and prop model library (built-in UE figures / Mixamo), FBX/GLB import support</li>
<li>First-person camera recording, WASD controls + Enter to record trajectory points</li>
<li>Dual timeline: camera trajectory + character movement; presets, anti-shake</li>
<li>Export clean screenshots and H.264 MP4 reference videos (720p/1080p, 24–60FPS)</li>
<li>postMessage API sends screenshots and camera params back to canvas nodes</li>
</ul>

<h3>Plugin System &amp; Prompt Library</h3>
<ul>
<li>Plugin SDK: TypeScript + auto JSX runtime; one-click install from registry</li>
<li>18+ built-in plugins: Markdown, SVG, HTML, Panorama, Sticky Note, LaTeX, Mermaid, Mind Map, QR Code, Color Picker, Word Count, JSON Table, Code Runner, Image Stitch/Compare/Split, Audio Waveform</li>
<li>Prompt library: 7 built-in sources with independent cache; custom JSON sources supported</li>
<li>Cross-source search, tag filter, detail preview, one-click insert to canvas</li>
</ul>

<h3>Data Management</h3>
<ul>
<li>Projects and assets stored locally in browser (IndexedDB) by default</li>
<li>Optional WebDAV configuration for cross-device sync</li>
</ul>

<h2 id="comparison">Comparison</h2>

<table style="width:100%;border-collapse:collapse;font-size:13px">
<thead>
<tr style="background:#1e293b">
<th style="padding:8px 12px;text-align:left;border-bottom:1px solid #334155;color:#94a3b8;font-weight:500;width:18%">Dimension</th>
<th style="padding:8px 12px;text-align:left;border-bottom:1px solid #334155;color:#94a3b8;font-weight:500;width:31%">Infinite Canvas</th>
<th style="padding:8px 12px;text-align:left;border-bottom:1px solid #334155;color:#94a3b8;font-weight:500;width:31%">3D Director</th>
</tr>
</thead>
<tbody>
<tr><td colspan="3" style="padding:7px 12px;border-bottom:1px solid #1e293b;font-weight:600">Core Positioning</td></tr>
<tr><td colspan="3" style="padding:7px 12px;border-bottom:1px solid #1e293b">2D node-based AI workspace &nbsp;·&nbsp; 3D storyboard camera tool</td></tr>
<tr><td colspan="3" style="padding:7px 12px;border-bottom:1px solid #1e293b;font-weight:600">AI Capability</td></tr>
<tr><td colspan="3" style="padding:7px 12px;border-bottom:1px solid #1e293b">✅ Multimodal: image/video/LLM &nbsp;·&nbsp; ❌ No AI, reference output only</td></tr>
<tr><td colspan="3" style="padding:7px 12px;border-bottom:1px solid #1e293b;font-weight:600">Space</td></tr>
<tr><td colspan="3" style="padding:7px 12px;border-bottom:1px solid #1e293b">Infinite 2D node canvas &nbsp;·&nbsp; WebGL 3D space</td></tr>
<tr><td colspan="3" style="padding:7px 12px;border-bottom:1px solid #1e293b;font-weight:600">Camera Control</td></tr>
<tr><td colspan="3" style="padding:7px 12px;border-bottom:1px solid #1e293b">Prompt description only &nbsp;·&nbsp; ✅ First-person trajectory recording</td></tr>
<tr><td colspan="3" style="padding:7px 12px;border-bottom:1px solid #1e293b;font-weight:600">Model Support</td></tr>
<tr><td colspan="3" style="padding:7px 12px;border-bottom:1px solid #1e293b">2D image/video processing &nbsp;·&nbsp; ✅ 3D characters/props/FBX/GLB</td></tr>
<tr><td colspan="3" style="padding:7px 12px;font-weight:600">Storage</td></tr>
<tr><td colspan="3" style="padding:7px 12px">IndexedDB &nbsp;·&nbsp; localStorage</td></tr>
</tbody>
</table>

<h2 id="workflow">Workflow</h2>

<table style="width:100%;border-collapse:collapse;font-size:13px">
<thead>
<tr style="background:#1e293b">
<th style="padding:8px 12px;text-align:center;border-bottom:1px solid #334155;color:#94a3b8;font-weight:500;width:12%">Step</th>
<th style="padding:8px 12px;text-align:left;border-bottom:1px solid #334155;color:#94a3b8;font-weight:500">Action</th>
</tr>
</thead>
<tbody>
<tr><td style="padding:8px 12px;text-align:center;border-bottom:1px solid #1e293b;font-weight:700;color:#7dd3fc">1</td><td style="padding:8px 12px;border-bottom:1px solid #1e293b">Write scripts, prompts, and character settings in canvas nodes</td></tr>
<tr><td style="padding:8px 12px;text-align:center;border-bottom:1px solid #1e293b;font-weight:700;color:#7dd3fc">2</td><td style="padding:8px 12px;border-bottom:1px solid #1e293b">Open embedded 3D Director in canvas to position characters</td></tr>
<tr><td style="padding:8px 12px;text-align:center;border-bottom:1px solid #1e293b;font-weight:700;color:#7dd3fc">3</td><td style="padding:8px 12px;border-bottom:1px solid #1e293b">Record camera trajectories, export reference screenshots</td></tr>
<tr><td style="padding:8px 12px;text-align:center;border-bottom:1px solid #1e293b;font-weight:700;color:#7dd3fc">4</td><td style="padding:8px 12px;border-bottom:1px solid #1e293b">Send assets back to canvas via postMessage</td></tr>
<tr><td style="padding:8px 12px;text-align:center;border-bottom:1px solid #1e293b;font-weight:700;color:#7dd3fc">5</td><td style="padding:8px 12px;border-bottom:1px solid #1e293b">Canvas sends references to AI for final generation</td></tr>
<tr><td style="padding:8px 12px;text-align:center;font-weight:700;color:#7dd3fc">6</td><td style="padding:8px 12px">Results return to canvas for continued iteration</td></tr>
</tbody>
</table>

<h2 id="screenshots">Screenshots</h2>

<h3>Infinite Canvas</h3>
<table style="width:100%;border-collapse:collapse">
<tr>
<td style="width:50%;padding:6px;vertical-align:top">
<img src="./docs/assets/canvas_1.png" alt="Canvas Interface" style="width:100%;border-radius:8px;border:1px solid #334155" loading="lazy">
<div style="font-size:12px;color:#94a3b8;margin-top:4px;text-align:center">Main Canvas Interface</div>
</td>
<td style="width:50%;padding:6px;vertical-align:top">
<img src="./docs/assets/canvas_2.png" alt="Node Editing" style="width:100%;border-radius:8px;border:1px solid #334155" loading="lazy">
<div style="font-size:12px;color:#94a3b8;margin-top:4px;text-align:center">Node Editing</div>
</td>
</tr>
<tr>
<td style="padding:6px;vertical-align:top">
<img src="./docs/assets/canvas_3.png" alt="Asset Management" style="width:100%;border-radius:8px;border:1px solid #334155" loading="lazy">
<div style="font-size:12px;color:#94a3b8;margin-top:4px;text-align:center">Asset Management</div>
</td>
<td style="padding:6px;vertical-align:top">
<img src="./docs/assets/canvas_4.png" alt="Plugin Panel" style="width:100%;border-radius:8px;border:1px solid #334155" loading="lazy">
<div style="font-size:12px;color:#94a3b8;margin-top:4px;text-align:center">Plugin Panel</div>
</td>
</tr>
</table>

<h3 style="margin-top:24px">3D Director Desk</h3>
<table style="width:100%;border-collapse:collapse">
<tr>
<td style="width:50%;padding:6px;vertical-align:top">
<img src="./docs/assets/director_1.png" alt="Scene Setup" style="width:100%;border-radius:8px;border:1px solid #334155" loading="lazy">
<div style="font-size:12px;color:#94a3b8;margin-top:4px;text-align:center">Scene Setup</div>
</td>
<td style="width:50%;padding:6px;vertical-align:top">
<img src="./docs/assets/director_2.png" alt="Camera Recording" style="width:100%;border-radius:8px;border:1px solid #334155" loading="lazy">
<div style="font-size:12px;color:#94a3b8;margin-top:4px;text-align:center">Camera Recording</div>
</td>
</tr>
<tr>
<td style="padding:6px;vertical-align:top">
<img src="./docs/assets/director_3.png" alt="Timeline Editing" style="width:100%;border-radius:8px;border:1px solid #334155" loading="lazy">
<div style="font-size:12px;color:#94a3b8;margin-top:4px;text-align:center">Timeline Editing</div>
</td>
<td style="padding:6px;vertical-align:top">
<img src="./docs/assets/director_4.png" alt="Rehearsal Preview" style="width:100%;border-radius:8px;border:1px solid #334155" loading="lazy">
<div style="font-size:12px;color:#94a3b8;margin-top:4px;text-align:center">Rehearsal Preview</div>
</td>
</tr>
</table>

<h2>Tech Stack</h2>

<table style="width:100%;border-collapse:collapse;font-size:13px">
<thead>
<tr style="background:#1e293b">
<th style="padding:8px 12px;text-align:left;border-bottom:1px solid #334155;color:#94a3b8;font-weight:500;width:30%">Category</th>
<th style="padding:8px 12px;text-align:left;border-bottom:1px solid #334155;color:#94a3b8;font-weight:500">Technology</th>
</tr>
</thead>
<tbody>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">Frontend Framework</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b">React 19 + TypeScript</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">Build Tool</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b">Vite 7</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">UI Components</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b">Ant Design 6 + Tailwind CSS v4</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">State Management</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b">Zustand 5 (localforage for persistence)</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">Routing</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b">React Router 7</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">Data Fetching</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b">TanStack React Query 5 + Axios</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">3D Rendering</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b">Three.js 0.184 + React Three Fiber 9 + drei 10</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">Code Editor</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b">CodeMirror 6</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">Animation</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b">Framer Motion 12</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">Agent Runtime</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b">Node.js ≥ 18 + @openai/codex 0.146</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">Agent Protocol</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b">MCP SDK 1.12 + Express 5</td></tr>
<tr><td colspan="2" style="padding:6px 12px;font-weight:600">Local Proxy</td><td style="padding:6px 12px">Pure Node.js (CORS resolution)</td></tr>
</tbody>
</table>

<h2 id="quickstart">Quick Start</h2>

<h3>Online Demo</h3>
<p>Deploy to <a href="https://vercel.com" style="color:#7dd3fc">Vercel</a> or <a href="https://render.com" style="color:#7dd3fc">Render</a>. No backend required — browser connects directly to AI APIs.</p>

<h3>Local Development</h3>

```bash
# Clone
git clone git@github.com:basketikun/infinite-canvas.git
cd infinite-canvas

# Start frontend (port 5070)
cd web && npm install && npm run dev

# Start docs site (optional)
cd ../docs && npm run dev
```

<p style="font-size:13px;color:#94a3b8">Configure <code>Base URL</code>, <code>API Key</code> (stored locally in browser only), and default model names on first launch.</p>

<h3>Start Local Agent (Optional)</h3>

```bash
npx -y @basketikun/canvas-agent@latest
# Start (port 17371)
```

<h3>Start Local Proxy (Optional)</h3>
<p style="font-size:13px;color:#94a3b8">Resolve CORS issues when connecting to AI APIs directly from the browser:</p>

```bash
npx @basketikun/canvas-proxy@latest --port 23210
# Proxy (port 23210)
```

<h3>Docker Deployment</h3>

```bash
docker-compose up -d
```
<p style="font-size:13px;color:#94a3b8">Visit <code>http://localhost:5070</code></p>

<h2>Project Structure</h2>

```
Canvas Director/
├── web/                    # Frontend app (Vite + React)
│   └── src/
│       ├── pages/          # Page routes (canvas/, director/)
│       ├── components/     # UI components
│       ├── stores/         # Zustand global state
│       ├── services/       # API service layer
│       ├── lib/            # Utility functions
│       └── types/          # TypeScript type definitions
├── canvas-agent/           # Local AI Agent service (Node.js)
├── canvas-proxy/           # CORS local proxy
├── plugins/                # Plugin system
│   ├── canvas/sdk/         # Plugin development SDK
│   ├── canvas/registry/    # Official plugin registry
│   └── canvas/*/           # Individual plugin implementations
├── docs/                   # Documentation site (Next.js + MDX)
│   └── assets/             # README screenshot assets
├── docs_3d_director/       # 3D Director source docs
├── Dockerfile
├── docker-compose.yml
└── nginx.conf
```

<h2 id="docs">Documentation & Resources</h2>

<p style="font-size:13px;color:#94a3b8">Full documentation at <a href="./docs/index.md" style="color:#7dd3fc">docs/index.md</a></p>

<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px">
<thead>
<tr style="background:#1e293b">
<th style="padding:7px 12px;text-align:left;border-bottom:1px solid #334155;color:#94a3b8;font-weight:500;width:28%">Doc</th>
<th style="padding:7px 12px;text-align:left;border-bottom:1px solid #334155;color:#94a3b8;font-weight:500">Description</th>
</tr>
</thead>
<tbody>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">Quick Start</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b"><a href="./docs/content/docs/overview/quick-start.mdx" style="color:#7dd3fc">Quick Start</a> — Installation, configuration &amp; getting started</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">Features</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b"><a href="./docs/content/docs/overview/features.mdx" style="color:#7dd3fc">Features</a> — Full feature descriptions</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">Canvas Node Guide</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b"><a href="./docs/content/docs/canvas/canvas-node-manual.mdx" style="color:#7dd3fc">Canvas Node Guide</a> — Node type usage</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">Shortcuts</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b"><a href="./docs/content/docs/canvas/canvas-shortcuts.mdx" style="color:#7dd3fc">Shortcuts</a> — Keyboard shortcuts reference</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">Local Development</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b"><a href="./docs/content/docs/development/local-development.mdx" style="color:#7dd3fc">Local Development</a> — Debugging &amp; build</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">Docker Deployment</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b"><a href="./docs/content/docs/overview/docker.mdx" style="color:#7dd3fc">Docker Deployment</a> — Containerized deployment</td></tr>
<tr><td colspan="2" style="padding:6px 12px;border-bottom:1px solid #1e293b;font-weight:600">Agent Connection</td><td style="padding:6px 12px;border-bottom:1px solid #1e293b"><a href="./docs/content/docs/development/local-codex-canvas.mdx" style="color:#7dd3fc">Agent Connection</a> — Codex Agent integration</td></tr>
<tr><td colspan="2" style="padding:6px 12px;font-weight:600">Embedding Protocol</td><td style="padding:6px 12px"><a href="./docs_3d_director/embed-contract.md" style="color:#7dd3fc">Embedding Protocol</a> — 3D Director postMessage API</td></tr>
</tbody>
</table>

<p style="font-size:12px;color:#64748b;margin-top:12px">Screenshot assets are stored in the <code>docs/assets/</code> directory.</p>

<h2>Limitations</h2>

<ul style="font-size:13px;color:#94a3b8">
<li>Frontend-first architecture: projects and assets are stored locally in the browser — no cloud accounts or storage</li>
<li>AI API Key is stored in the browser; requests go directly to AI providers</li>
<li>Docker static asset path verification in production is still in progress</li>
<li>Complex 3D model import is limited by browser WebGL performance — export JSON backups regularly</li>
<li>Storage formats may change during development — always export backups for important projects</li>
</ul>
