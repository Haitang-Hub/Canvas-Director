import { nanoid } from "nanoid";

import i18n from "@/i18n";
import { applyGroupSelection, applyUngroupSelection, collectGroupMemberNodes, getGroupWrapRect } from "@/lib/canvas/canvas-node-geometry";
import { getNodeSpec, isRegisteredNodeType } from "@/lib/canvas/node-registry";
import { createDirectorDeskRecord, ensureDirectorDeskRecords, writeDirectorDeskRecords } from "@/pages/director/editor/workspaces/directorDeskRegistry";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData, type CanvasNodeMetadata, type CanvasNodeTypeId, type ViewportTransform } from "@/types/canvas";

export type CanvasAgentOp =
    | { type: "add_node"; id?: string; nodeType?: CanvasNodeTypeId; title?: string; position?: { x: number; y: number }; x?: number; y?: number; width?: number; height?: number; metadata?: CanvasNodeMetadata }
    | { type: "update_node"; id: string; patch?: Partial<CanvasNodeData>; metadata?: CanvasNodeMetadata }
    | { type: "delete_node"; id?: string; ids?: string[]; nodeType?: CanvasNodeTypeId }
    | { type: "delete_connections"; id?: string; ids?: string[]; all?: boolean }
    | { type: "connect_nodes"; id?: string; fromNodeId: string; toNodeId: string }
    | { type: "set_viewport"; viewport: ViewportTransform }
    | { type: "select_nodes"; ids: string[] }
    | { type: "duplicate_nodes"; ids: string[]; offsetX?: number; offsetY?: number }
    | { type: "group_nodes"; ids: string[]; title?: string }
    | { type: "ungroup_nodes"; ids: string[] }
    | { type: "run_generation"; nodeId: string; mode?: "text" | "image" | "video" | "audio"; prompt?: string };

export type CanvasAgentSnapshot = {
    projectId: string;
    title: string;
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
    selectedNodeIds: string[];
    viewport: ViewportTransform;
};

export function summarizeCanvasAgentOps(ops?: CanvasAgentOp[]) {
    const counts = (Array.isArray(ops) ? ops : []).reduce<Record<string, number>>((acc, op) => {
        if (!op?.type) return acc;
        acc[op.type] = (acc[op.type] || 0) + 1;
        return acc;
    }, {});
    return Object.entries(counts)
        .map(([type, count]) => `${opLabel(type)} ${count}`)
        .join("，");
}

export function applyCanvasAgentOps(snapshot: CanvasAgentSnapshot, ops?: CanvasAgentOp[]) {
    let nodes = snapshot.nodes;
    let connections = snapshot.connections;
    let selectedNodeIds = snapshot.selectedNodeIds;
    let viewport = snapshot.viewport;

    (Array.isArray(ops) ? ops : []).forEach((op, index) => {
        if (!op?.type) return;
        if (op.type === "add_node") {
            const nodeType = op.nodeType && isRegisteredNodeType(op.nodeType) ? op.nodeType : CanvasNodeType.Text;
            const spec = getNodeSpec(nodeType);
            const node: CanvasNodeData = {
                id: op.id || `${nodeType}-${Date.now()}-${index}`,
                type: nodeType,
                title: op.title || spec.title,
                position: op.position || { x: op.x ?? index * 36, y: op.y ?? index * 36 },
                width: op.width || spec.width,
                height: op.height || spec.height,
                metadata: { ...spec.metadata, ...op.metadata },
            };
            // Agent 建的导演台节点与手动创建一致：绑定一个真实导演台实例，保证后续 stage_open 可直达。
            if (nodeType === CanvasNodeType.Director && !node.metadata?.directorDeskId) {
                const records = ensureDirectorDeskRecords();
                const record = createDirectorDeskRecord(records);
                writeDirectorDeskRecords([...records, record]);
                node.metadata = { ...node.metadata, directorDeskId: record.id, directorDeskName: record.name };
            }
            nodes = [...nodes, node];
            selectedNodeIds = [node.id];
        }
        if (op.type === "update_node") {
            if (!op.id) return;
            nodes = nodes.map((node) => (node.id === op.id ? { ...node, ...op.patch, metadata: { ...node.metadata, ...op.patch?.metadata, ...op.metadata } } : node));
        }
        if (op.type === "delete_node") {
            const ids = new Set(op.ids || (op.id ? [op.id] : op.nodeType ? nodes.filter((node) => node.type === op.nodeType).map((node) => node.id) : []));
            nodes = nodes.filter((node) => !ids.has(node.id));
            connections = connections.filter((conn) => !ids.has(conn.fromNodeId) && !ids.has(conn.toNodeId));
            selectedNodeIds = selectedNodeIds.filter((id) => !ids.has(id));
        }
        if (op.type === "delete_connections") {
            const ids = new Set(op.ids || (op.id ? [op.id] : []));
            connections = op.all ? [] : connections.filter((conn) => !ids.has(conn.id));
        }
        if (op.type === "connect_nodes") {
            if (!op.fromNodeId || !op.toNodeId) return;
            const fromNode = nodes.find((node) => node.id === op.fromNodeId);
            const toNode = nodes.find((node) => node.id === op.toNodeId);
            // 镜头节点只允许与镜头节点相连（shot_link 表达叙事顺序）；与生成节点等混连没有语义。
            if (fromNode && toNode && (fromNode.type === CanvasNodeType.Shot) !== (toNode.type === CanvasNodeType.Shot)) {
                throw new Error(i18n.t("canvas.agentOps.shotConnectForbidden"));
            }
            const exists = connections.some((conn) => conn.fromNodeId === op.fromNodeId && conn.toNodeId === op.toNodeId);
            const hasNodes = Boolean(fromNode) && Boolean(toNode);
            if (!exists && hasNodes) connections = [...connections, { id: op.id || nanoid(), fromNodeId: op.fromNodeId, toNodeId: op.toNodeId }];
        }
        if (op.type === "set_viewport" && op.viewport) viewport = op.viewport;
        if (op.type === "select_nodes") selectedNodeIds = (op.ids || []).filter((id) => nodes.some((node) => node.id === id));
        if (op.type === "duplicate_nodes") {
            const ids = new Set(op.ids || []);
            const offsetX = op.offsetX ?? 36;
            const offsetY = op.offsetY ?? 36;
            const idMap = new Map<string, string>();
            const copies = nodes.filter((node) => ids.has(node.id)).map((node, index) => {
                const id = `${node.type}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
                idMap.set(node.id, id);
                return { ...node, id, position: { x: node.position.x + offsetX, y: node.position.y + offsetY }, metadata: node.metadata ? { ...node.metadata } : undefined };
            });
            // 副本整体属于同一组时，把 groupId 重映射到组节点的副本，避免两个组共享成员。
            copies.forEach((node) => {
                const groupId = node.metadata?.groupId;
                if (groupId && idMap.has(groupId)) node.metadata = { ...node.metadata, groupId: idMap.get(groupId) };
            });
            const internalConnections = connections.filter((connection) => idMap.has(connection.fromNodeId) && idMap.has(connection.toNodeId)).map((connection) => ({ id: nanoid(), fromNodeId: idMap.get(connection.fromNodeId) || "", toNodeId: idMap.get(connection.toNodeId) || "" }));
            nodes = [...nodes, ...copies];
            connections = [...connections, ...internalConnections];
            if (copies.length) selectedNodeIds = copies.map((node) => node.id);
        }
        if (op.type === "group_nodes") {
            const ids = new Set(op.ids || []);
            const members = collectGroupMemberNodes(ids, nodes);
            if (members.length >= 2) {
                const rect = getGroupWrapRect(members);
                const spec = getNodeSpec(CanvasNodeType.Group);
                const group: CanvasNodeData = { id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: CanvasNodeType.Group, title: op.title || spec.title, position: { x: rect.x, y: rect.y }, width: rect.width, height: rect.height, metadata: { ...spec.metadata } };
                const result = applyGroupSelection(ids, nodes, connections, group);
                if (result) {
                    nodes = result.nodes;
                    connections = result.connections;
                    selectedNodeIds = result.selectedIds;
                }
            }
        }
        if (op.type === "ungroup_nodes") {
            const result = applyUngroupSelection(new Set(op.ids || []), nodes, connections);
            if (result) {
                nodes = result.nodes;
                connections = result.connections;
                selectedNodeIds = result.selectedIds;
            }
        }
    });

    return { ...snapshot, nodes, connections, selectedNodeIds, viewport };
}

function opLabel(type: string) {
    return i18n.t(`canvas.agentOps.${type}`, { defaultValue: type });
}
