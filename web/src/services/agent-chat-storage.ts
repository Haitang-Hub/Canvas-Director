/**
 * 浏览器内置 Agent 的对话消息持久化（localforage）。
 * 本机 canvas-agent 引擎的线程历史以服务端为权威，不做本地持久化；
 * 这里只保存内置引擎按页面上下文（canvas / director）划分的单个活动会话。
 *
 * 存储规范：记录带 version；读到未知版本、损坏 JSON 或清单异常时置「只读保护」，
 * 拒绝写入覆盖原文件；低版本先备份到 :backup-v<n> 再迁移；不按数量/大小静默裁剪消息。
 */

import localforage from "localforage";

import type { AgentChatItem, AgentPageContext } from "@/stores/use-agent-store";

const CHAT_VERSION = 1;
const SAVE_DEBOUNCE_MS = 400;

const chatStore = localforage.createInstance({ name: "infinite-canvas", storeName: "agent_chat" });

type StoredChat = { version: number; savedAt: string; messages: AgentChatItem[] };

const chatCaches = new Map<AgentPageContext, AgentChatItem[]>();
/** 只读保护：读到未知版本/损坏记录后拒绝写入，避免覆盖原始数据。 */
const protectedContexts = new Set<AgentPageContext>();
const saveTimers = new Map<AgentPageContext, ReturnType<typeof setTimeout>>();

function storageKey(context: AgentPageContext) {
    return `agent_chat:browser:${context}`;
}

function normalizeMessages(value: unknown): AgentChatItem[] | null {
    if (!Array.isArray(value)) return null;
    return value.filter((item): item is AgentChatItem => Boolean(item && typeof item === "object" && item.id && item.role));
}

/** 读取上下文的会话消息（带内存缓存，进程内只读一次存储）。 */
export async function loadBrowserChat(context: AgentPageContext): Promise<AgentChatItem[]> {
    const cached = chatCaches.get(context);
    if (cached) return cached;
    let messages: AgentChatItem[] = [];
    try {
        const raw = await chatStore.getItem<string>(storageKey(context));
        if (raw) {
            const parsed = JSON.parse(raw) as StoredChat;
            if (!parsed || typeof parsed !== "object" || typeof parsed.version !== "number" || parsed.version > CHAT_VERSION) {
                // 未知版本或损坏清单：拒绝覆盖，保持只读
                protectedContexts.add(context);
            } else {
                const normalized = normalizeMessages(parsed.messages);
                if (!normalized) {
                    protectedContexts.add(context);
                } else {
                    if (parsed.version < CHAT_VERSION) {
                        // 低版本：先备份原始记录再迁移
                        await chatStore.setItem(`${storageKey(context)}:backup-v${parsed.version}`, raw);
                    }
                    messages = normalized;
                }
            }
        }
    } catch {
        // JSON 损坏等读取异常：拒绝写入，避免破坏可能可恢复的原始数据
        protectedContexts.add(context);
    }
    chatCaches.set(context, messages);
    return messages;
}

/** 持久化上下文的会话消息（防抖合并写入；被保护或被清空的上下文跳过）。 */
export function saveBrowserChat(context: AgentPageContext, messages: AgentChatItem[]) {
    chatCaches.set(context, messages);
    if (protectedContexts.has(context)) return;
    const timer = saveTimers.get(context);
    if (timer) clearTimeout(timer);
    saveTimers.set(context, setTimeout(() => {
        saveTimers.delete(context);
        const record: StoredChat = { version: CHAT_VERSION, savedAt: new Date().toISOString(), messages: chatCaches.get(context) || [] };
        void chatStore.setItem(storageKey(context), JSON.stringify(record)).catch(() => undefined);
    }, SAVE_DEBOUNCE_MS));
}

/** 立即写回未落盘的变更（页面卸载/切换上下文时调用）。 */
export function flushBrowserChat(context: AgentPageContext) {
    const timer = saveTimers.get(context);
    if (!timer) return;
    clearTimeout(timer);
    saveTimers.delete(context);
    if (protectedContexts.has(context)) return;
    const record: StoredChat = { version: CHAT_VERSION, savedAt: new Date().toISOString(), messages: chatCaches.get(context) || [] };
    void chatStore.setItem(storageKey(context), JSON.stringify(record)).catch(() => undefined);
}

/** 清空上下文的会话：删除存储记录并解除只读保护（用户显式清空）。 */
export function clearBrowserChat(context: AgentPageContext) {
    const timer = saveTimers.get(context);
    if (timer) {
        clearTimeout(timer);
        saveTimers.delete(context);
    }
    chatCaches.set(context, []);
    protectedContexts.delete(context);
    void chatStore.removeItem(storageKey(context)).catch(() => undefined);
}

/** 当前上下文是否处于只读保护（用于面板提示）。 */
export function isBrowserChatProtected(context: AgentPageContext) {
    return protectedContexts.has(context);
}
