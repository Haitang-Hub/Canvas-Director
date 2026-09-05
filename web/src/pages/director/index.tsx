import "./styles/index.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowRight, BookOpen, Boxes, Check, Clock3, Hand, Keyboard, MousePointer2, Plus, Sparkles, Trash2, Users } from "lucide-react";
import { useThemeStore } from "@/stores/use-theme-store";
import {
  createDirectorDeskRecord,
  deleteDirectorDeskRecord,
  ensureDirectorDeskRecordForId,
  ensureDirectorDeskRecords,
  readActiveDirectorDeskId,
  touchDirectorDeskRecord,
  writeActiveDirectorDeskId,
  writeDirectorDeskRecords,
  type DirectorDeskRecord,
} from "./editor/workspaces/directorDeskRegistry";
import { getPerformanceBenchmarkMode } from "./editor/performance/performanceBenchmark";

const HOME_QUICK_START_STEPS = [
  ["选择导演台", "打开已有导演台，或点击“新建导演台”创建一个空场景。"],
  ["摆人物和道具", "从工具栏添加模型，选中后使用 XYZ 三轴移动、旋转和缩放。"],
  ["记录镜头", "点击“运镜 → 开始掌镜”，用 WASD 移动，每到一个镜头按 Enter。"],
  ["预演并导出", "先“看路线”检查轨迹，再“看成片”，满意后导出 MP4 参考视频。"],
] as const;

const HOME_RELEASE_NOTES = [
  "人物路线支持添加、插入、删除和拖动，行走时会沿平滑曲线自然转向",
  "人物路线与摄影机轨迹可常亮显示，并支持批量移动多个轨迹点",
  "新增路径碰撞开关，可让人物贴地，并阻止人物和镜头穿过场景物体",
  "看成片时可随时暂停和拖动底部时间轴，不会再退出第一视角预览",
  "主成片 FOV 与监看小窗 FOV 已分开设置，导出使用主成片 FOV",
  "新增可拖动实时监看小窗、MP4 参考视频导出和更可靠的撤销逻辑",
] as const;

const HOME_COMMUNITY_CONTRIBUTORS = [
  {
    name: "AIGC 耀光",
    douyinId: "AIJPDM001",
    contribution: "群友镜头预设构想与共创反馈",
  },
] as const;

const HOME_CONTROL_GROUPS = [
  {
    title: "普通导演视角",
    description: "摆场景和检查路线时使用",
    controls: [
      ["W / A / S / D", "前进、左移、后退、右移"],
      ["Space / Shift", "上升 / 下降"],
      ["鼠标左键拖动", "环绕观察场景"],
      ["鼠标右键拖动", "平移观察中心"],
      ["滚轮", "靠近 / 远离场景"],
    ],
  },
  {
    title: "掌镜模式",
    description: "像 FPS 游戏一样录制摄影机轨迹点",
    controls: [
      ["W / A / S / D", "前进、左移、后退、右移"],
      ["E / Q", "镜头上升 / 下降"],
      ["移动鼠标", "转动镜头方向"],
      ["Enter", "保存或更新当前轨迹点"],
      ["Space", "播放 / 暂停人物和物体运动"],
      ["F", "锁定或取消准星所指目标"],
      ["滚轮", "调整镜头 FOV"],
      ["Esc", "释放鼠标并退出掌镜"],
      ["单击画面", "重新锁定鼠标"],
    ],
  },
  {
    title: "通用编辑",
    description: "场景、路线点和时间轴都适用",
    controls: [
      ["⌘ / Ctrl + C", "复制选中的人物或物体"],
      ["⌘ / Ctrl + V", "粘贴并选中新副本"],
      ["⌘ / Ctrl + Z", "撤销最近一次编辑或拖动"],
      ["Shift + 单击", "在场景树中多选 / 取消选择"],
      ["Delete / Backspace", "删除当前选中对象"],
      ["拖动 XYZ 字母", "连续调整对应轴数值"],
      ["↑ / ↓", "聚焦 XYZ 字母时微调数值"],
      ["拖动底部时间轴", "立即暂停并定位到指定时间"],
    ],
  },
] as const;

const HOME_MAC_GESTURES = [
  ["单指按下并拖动", "普通导演视角中环绕观察；掌镜时直接移动手指即可转向"],
  ["双指上下滑动", "普通视角缩放场景；掌镜模式调整镜头 FOV"],
  ["双指点按后拖动", "开启 macOS“辅助点按”后，可平移普通导演视角"],
  ["双指滚动首页", "上下查看完整使用说明和本次更新"],
  ["轻点画面", "掌镜退出锁定后，重新进入鼠标锁定"],
] as const;

const HOME_TOOL_GROUPS = [
  ["顶部", "首页、切换导演台、导演/第一视角、运镜工作台、视角手感"],
  ["视口工具栏", "移动、旋转、缩放、添加角色、路线常亮、导入模型、模型库、添加机位"],
  ["画面工具", "选择画幅、当前/四方位/十二方位截图、全屏"],
  ["底部时间轴", "回到开头、播放/暂停、拖动定位、总时长、记录点、删除当前点"],
  ["运镜工作台", "开始掌镜、添加/插入/批量移动轨迹点、看路线、看成片、导出视频"],
  ["右侧属性", "对象 XYZ、姿势、动作、人物路线、场景地面与路径碰撞"],
] as const;

function formatDirectorDeskUpdatedAt(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "刚刚更新";

  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (diffMinutes < 1) return "刚刚更新";
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  if (diffMinutes < 1440) return `${Math.round(diffMinutes / 60)} 小时前`;

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export default function DirectorPage() {
  const navigate = useNavigate();
  const theme = useThemeStore((state) => state.theme);
  const [records, setRecords] = useState(() => ensureDirectorDeskRecords());

  // 兼容旧链接：/director?instanceId=… 与性能基准参数一律进入全屏编辑器页
  const urlInstanceId = new URLSearchParams(window.location.search).get("instanceId")?.trim() || null;
  const benchmarkMode = getPerformanceBenchmarkMode(window.location.search);
  useEffect(() => {
    if (urlInstanceId || benchmarkMode) {
      navigate({ pathname: "/director/editor", search: window.location.search }, { replace: true });
    }
  }, [benchmarkMode, navigate, urlInstanceId]);

  if (urlInstanceId || benchmarkMode) return null;

  const activeDeskId = readActiveDirectorDeskId() ?? records[0]?.id ?? "";

  function openDirectorDesk(id: string) {
    if (!id) return;
    const ensured = ensureDirectorDeskRecordForId(records, id);
    const nextRecords = touchDirectorDeskRecord(ensured.records, id);
    setRecords(nextRecords);
    writeActiveDirectorDeskId(id);
    navigate({ pathname: "/director/editor", search: `?instanceId=${encodeURIComponent(id)}` });
  }

  function handleCreateDesk() {
    const record = createDirectorDeskRecord(records);
    const nextRecords = [...records, record];
    writeDirectorDeskRecords(nextRecords);
    setRecords(nextRecords);
    writeActiveDirectorDeskId(record.id);
    navigate({ pathname: "/director/editor", search: `?instanceId=${encodeURIComponent(record.id)}` });
  }

  function handleDeleteDesk(desk: DirectorDeskRecord) {
    if (!window.confirm(`删除「${desk.name}」？这个导演台里的本地场景也会一起删除。`)) return;

    const result = deleteDirectorDeskRecord(records, desk.id);
    setRecords(result.records);
  }

  return (
    <div className="director-desk-app" data-theme={theme === "dark" ? "dark" : "light"}>
      <main className="director-home-shell">
        <section className="director-home-hero">
          <div>
            <p className="director-home-kicker">Standalone 3D Director Desk</p>
            <h1>选择一个导演台开始摆场景</h1>
            <p>
              每个导演台独立保存，重启后先回到这里选择，不会再直接打开上一次的无名工程。
            </p>
          </div>
          <div className="director-home-hero-actions">
            <button className="director-home-primary-button" type="button" onClick={handleCreateDesk}>
              <Plus aria-hidden="true" size={18} />
              新建导演台
            </button>
            <a className="director-home-scroll-hint" href="#director-home-guide-title">
              向下查看使用说明
              <ArrowDown aria-hidden="true" size={14} />
            </a>
          </div>
        </section>

        {records.length ? (
          <section className="director-home-grid" aria-label="导演台列表">
            {records.map((desk, index) => (
              <article
                key={desk.id}
                className={`director-home-card ${desk.id === activeDeskId ? "is-active" : ""}`}
              >
                <button className="director-home-card-main" type="button" onClick={() => openDirectorDesk(desk.id)}>
                  <span className="director-home-card-icon">
                    <Boxes aria-hidden="true" size={22} strokeWidth={1.8} />
                  </span>
                  <span className="director-home-card-content">
                    <span className="director-home-card-title">{desk.name}</span>
                    <span className="director-home-card-meta">
                      <Clock3 aria-hidden="true" size={13} />
                      {formatDirectorDeskUpdatedAt(desk.updatedAt)}
                    </span>
                  </span>
                  <span className="director-home-card-index">{String(index + 1).padStart(2, "0")}</span>
                  <ArrowRight className="director-home-card-arrow" aria-hidden="true" size={18} />
                </button>
                <button
                  className="director-home-card-delete"
                  type="button"
                  aria-label={`删除${desk.name}`}
                  onClick={() => handleDeleteDesk(desk)}
                >
                  <Trash2 aria-hidden="true" size={15} strokeWidth={1.9} />
                </button>
              </article>
            ))}
          </section>
        ) : (
          <section className="director-home-empty" aria-label="空导演台列表">
            <Boxes aria-hidden="true" size={28} strokeWidth={1.6} />
            <h2>还没有导演台</h2>
            <p>点击“新建导演台”创建一个干净的 3D 场景。</p>
          </section>
        )}

        <section className="director-home-guide" aria-labelledby="director-home-guide-title">
          <header className="director-home-section-heading">
            <span><BookOpen aria-hidden="true" size={16} />第一次使用</span>
            <div>
              <h2 id="director-home-guide-title">四步完成第一条运镜</h2>
              <p>不用先学习复杂的 3D 软件，按照下面顺序操作即可。</p>
            </div>
          </header>
          <ol className="director-home-steps">
            {HOME_QUICK_START_STEPS.map(([title, description], index) => (
              <li key={title}>
                <span>{index + 1}</span>
                <div><strong>{title}</strong><p>{description}</p></div>
              </li>
            ))}
          </ol>
          <p className="director-home-shortcuts">
            <strong>掌镜快捷键</strong>
            <kbd>WASD</kbd>移动
            <kbd>Q / E</kbd>下降 / 上升
            <kbd>Enter</kbd>保存镜头
            <kbd>Space</kbd>播放 / 暂停
            <kbd>Esc</kbd>退出掌镜
          </p>
        </section>

        <section className="director-home-release" aria-labelledby="director-home-release-title">
          <header className="director-home-section-heading">
            <span><Sparkles aria-hidden="true" size={16} />本次更新</span>
            <div>
              <h2 id="director-home-release-title">路线编辑、监看与导出升级</h2>
              <p>这次重点补全人物运动、镜头预演和参考视频工作流。</p>
            </div>
          </header>
          <ul className="director-home-release-list">
            {HOME_RELEASE_NOTES.map((note) => (
              <li key={note}><Check aria-hidden="true" size={15} /><span>{note}</span></li>
            ))}
          </ul>
        </section>

        <section className="director-home-contributors" aria-labelledby="director-home-contributors-title">
          <header className="director-home-section-heading">
            <span><Users aria-hidden="true" size={16} />群友贡献</span>
            <div>
              <h2 id="director-home-contributors-title">共同完善 3D 导演台</h2>
              <p>感谢群友提供真实工作流、镜头构想和使用反馈。</p>
            </div>
          </header>
          <dl className="director-home-contributor-list">
            {HOME_COMMUNITY_CONTRIBUTORS.map((contributor) => (
              <div key={contributor.douyinId}>
                <dt>{contributor.name}</dt>
                <dd><span>{contributor.contribution}</span><strong>抖音号：{contributor.douyinId}</strong></dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="director-home-controls" aria-labelledby="director-home-controls-title">
          <header className="director-home-section-heading">
            <span><Keyboard aria-hidden="true" size={16} />完整操作表</span>
            <div>
              <h2 id="director-home-controls-title">键盘、鼠标与触控板操作</h2>
              <p>快捷键在输入框中不会触发；掌镜模式下请先单击 3D 画面锁定鼠标。</p>
            </div>
          </header>

          <div className="director-home-control-grid">
            {HOME_CONTROL_GROUPS.map((group) => (
              <article key={group.title} className="director-home-control-group">
                <header><MousePointer2 aria-hidden="true" size={15} /><div><h3>{group.title}</h3><p>{group.description}</p></div></header>
                <dl>
                  {group.controls.map(([keys, action]) => (
                    <div key={keys}><dt>{keys}</dt><dd>{action}</dd></div>
                  ))}
                </dl>
              </article>
            ))}
          </div>

          <article className="director-home-mac-gestures">
            <header><Hand aria-hidden="true" size={17} /><div><h3>macOS 触控板手势</h3><p>以 MacBook 默认手势和已开启“辅助点按”为准</p></div></header>
            <dl>
              {HOME_MAC_GESTURES.map(([gesture, action]) => (
                <div key={gesture}><dt>{gesture}</dt><dd>{action}</dd></div>
              ))}
            </dl>
          </article>

          <article className="director-home-tools-guide">
            <h3>主要界面按钮</h3>
            <dl>
              {HOME_TOOL_GROUPS.map(([area, actions]) => (
                <div key={area}><dt>{area}</dt><dd>{actions}</dd></div>
              ))}
            </dl>
          </article>
        </section>
      </main>
    </div>
  );
}
