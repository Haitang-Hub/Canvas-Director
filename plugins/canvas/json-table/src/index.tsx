// JSON 表格节点:编辑 JSON(数组对象)并渲染为表格;
// 行拆分为文本节点的功能在工具条(模板存 metadata.rowTemplate,支持 {{列名}}/{{}} 占位);
// AI 生成与文本节点同款:选中节点在下方生成面板输入提示词(上游图片/文本自动作为参考),结果写回本节点。
import { definePlugin, useMemo } from "@infinite-canvas/plugin-sdk";
import type { CanvasNodeContentProps } from "@infinite-canvas/plugin-sdk";

type Row = Record<string, unknown>;

// 兼容 AI 输出:只取首个代码围栏内的内容,丢弃围栏外 AI 解释文本,再提取首个 JSON 数组
// 若外层是对象,自动选取 shots/rows/data/items/columns 等常见数组字段
function cleanJson(raw: string): string {
    let s = raw.trim();
    const fenceIdx = s.search(/```[a-zA-Z]*\s*\n/i);
    if (fenceIdx !== -1) {
        const afterStart = fenceIdx + "```".length;
        const langLineEnd = s.indexOf("\n", afterStart);
        const bodyStart = langLineEnd === -1 ? afterStart : langLineEnd + 1;
        const bodyEnd = s.indexOf("\n```", bodyStart);
        if (bodyEnd !== -1) s = s.slice(bodyStart, bodyEnd).trim();
    }
    // 1) 直接是数组
    if (s.startsWith("[")) return s;
    // 2) 尝试用正则提取第一个 [...] 块
    const arr = s.match(/\[[\s\S]*?\]/);
    if (arr) {
        try {
            const parsed = JSON.parse(arr[0]);
            if (Array.isArray(parsed)) return arr[0];
        } catch { /* ignore */ }
    }
    // 3) 外层是对象:先尝试优先字段,若不存在则降级到首个出现的数组属性
    try {
        const obj = JSON.parse(s);
        if (obj && typeof obj === "object" && !Array.isArray(obj)) {
            const priority = ["shots", "rows", "data", "items", "columns", "list", "table"];
            for (const key of priority) {
                if (Array.isArray(obj[key])) return JSON.stringify(obj[key]);
            }
            // 兜底:取第一个数组属性(按插入顺序),用于没有命名优先字段的情形
            for (const k of Object.keys(obj)) {
                if (Array.isArray(obj[k])) return JSON.stringify(obj[k]);
            }
        }
    } catch { /* ignore */ }
    return s;
}

function parseRows(source: string): Row[] | null {
    const cleaned = cleanJson(source);
    if (!cleaned.trim()) return null;
    try {
        const data = JSON.parse(cleaned);
        return Array.isArray(data) ? (data as Row[]) : null;
    } catch {
        return null;
    }
}

function renderTemplate(tpl: string, row: Row): string {
    return tpl.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key: string) => (row[key] === undefined || row[key] === null ? "" : String(row[key])));
}

// 将单元格值展平为可读文本:数组元素逗号分隔,对象取关键字符串字段
function formatCell(val: unknown): string {
    if (val == null) return "";
    if (typeof val === "string") return val;
    if (typeof val === "number" || typeof val === "boolean") return String(val);
    if (Array.isArray(val)) {
        return val
            .map((item) => {
                if (typeof item === "object" && item !== null) {
                    const str = Object.entries(item as Record<string, unknown>)
                        .map(([k, v]) => `${k}:${formatCell(v)}`)
                        .join(" ");
                    return str || formatCell(item);
                }
                return formatCell(item);
            })
            .join("；");
    }
    if (typeof val === "object") {
        return Object.entries(val as Record<string, unknown>)
            .map(([k, v]) => `${k}:${formatCell(v)}`)
            .join(" ");
    }
    return String(val);
}

function JsonTableContent({ ctx }: CanvasNodeContentProps) {
    const editing = Boolean(ctx.node.metadata?.editing);
    const source = (ctx.node.metadata?.content as string | undefined) || "";
    const rows = useMemo(() => parseRows(source), [source]);
    const columns = useMemo(() => {
        if (!rows) return [];
        const keys: string[] = [];
        for (const row of rows.slice(0, 50)) for (const k of Object.keys(row)) if (!keys.includes(k)) keys.push(k);
        return keys;
    }, [rows]);

    if (editing) {
        return (
            <textarea autoFocus value={source} placeholder={'[\n  {"name": "张三", "age": 25}\n]'} onChange={(e) => ctx.updateMetadata({ content: e.target.value })} onMouseDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()} spellCheck={false} style={{ height: "100%", width: "100%", display: "block", resize: "none", border: "none", outline: "none", background: "transparent", color: ctx.theme.node.text, fontFamily: "monospace", fontSize: 13, lineHeight: 1.5, padding: 12, boxSizing: "border-box" }} />
        );
    }

    return (
        <div data-canvas-no-zoom onWheel={(e) => e.stopPropagation()} style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", gap: 8, padding: 12, boxSizing: "border-box" }}>
            {rows && columns.length ? (
                <div style={{ flex: 1, minHeight: 0, overflow: "auto", border: `1px solid ${ctx.theme.node.stroke}`, borderRadius: 8 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: ctx.theme.node.text }}>
                        <thead>
                            <tr>
                                {columns.map((col) => (
                                    <th key={col} style={{ position: "sticky", top: 0, background: ctx.theme.node.panel, textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${ctx.theme.node.stroke}`, fontWeight: 600 }}>
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, i) => (
                                <tr key={i}>
                                    {columns.map((col) => (
                                        <td key={col} style={{ padding: "6px 8px", borderBottom: `1px solid ${ctx.theme.node.stroke}`, whiteSpace: "pre-wrap", wordBreak: "break-word", maxWidth: 280 }}>
                                            {formatCell(row[col])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {source.trim() && !rows ? <span style={{ color: "#ef4444", fontSize: 12 }}>JSON 解析失败:需要对象数组</span> : <span style={{ color: ctx.theme.node.placeholder, fontSize: 12 }}>选中节点,在下方面板输入提示词生成,或点工具条「编辑」输入对象数组</span>}
                </div>
            )}
        </div>
    );
}

export default definePlugin({
    id: "json-table",
    name: "JSON 表格",
    version: "1.1.0",
    description: "编辑 JSON 数据并渲染为表格,支持 AI 生成与行拆分",
    nodes: [
        {
            type: "json-table:table",
            title: "JSON 表格",
            icon: "🧾",
            description: "JSON 数据表格视图",
            defaultSize: { width: 380, height: 280 },
            defaultMetadata: { content: "" },
            minimapColor: "#0ea5e9",
            // AI 生成复用宿主内置文本生成面板:结果写回本节点,上游图片/文本自动作为参考
            useBuiltinPanel: { mode: "text", writeBackToSelf: true },
            resource: (node) => ({ kind: "text", text: node.metadata?.content as string | undefined }),
            Content: JsonTableContent,
            toolbar: (ctx) => {
                const editing = Boolean(ctx.node.metadata?.editing);
                const rows = editing ? null : parseRows((ctx.node.metadata?.content as string | undefined) || "");
                const tpl = (ctx.node.metadata?.rowTemplate as string | undefined) || "• {{}}";
                const split = () => {
                    if (!rows || !rows.length) return;
                    const baseX = ctx.node.position.x + ctx.node.width + 60;
                    const ops = rows.map((row, i) => {
                        // 支持无列名 {{}}:整体拼接该行所有值
                        const text = renderTemplate(tpl, row).replace(/\{\{\s*\}\}/g, Object.values(row).map((v) => (v === null || v === undefined ? "" : String(v))).join(" "));
                        return { type: "add_node" as const, id: `json-table-row-${ctx.node.id}-${i}`, nodeType: "text", title: `表格行 ${i + 1}`, x: baseX, y: ctx.node.position.y + i * 90, metadata: { content: text, status: "success" as const } };
                    });
                    ctx.applyOps([...ops, ...ops.map((op) => ({ type: "connect_nodes" as const, fromNodeId: ctx.node.id, toNodeId: op.id! }))]);
                };
                return [
                    { id: "json-toggle", title: editing ? "预览表格" : "编辑 JSON", label: editing ? "预览" : "编辑", icon: editing ? "👁" : "✎", active: editing, onClick: () => ctx.updateMetadata({ editing: !editing }) },
                    ...(rows && rows.length ? [{ id: "json-split", title: `按模板拆分每行为文本节点(模板:${tpl})`, label: `拆行(${rows.length})`, icon: "⇢", onClick: split }] : []),
                ];
            },
        },
    ],
});
