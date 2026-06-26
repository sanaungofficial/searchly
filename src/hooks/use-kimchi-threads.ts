"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StoredThreadMessage } from "@/lib/kimchi-assistant/thread-serialize";
import { WELCOME_MESSAGE } from "@/lib/kimchi-assistant/chat-chips";

export type ThreadSummary = {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
};

const WELCOME: StoredThreadMessage = {
  kind: "text",
  role: "assistant",
  content: WELCOME_MESSAGE,
};

export function useKimchiThreads() {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<StoredThreadMessage[]>([WELCOME]);
  const [loading, setLoading] = useState(true);
  const [threadMenuOpen, setThreadMenuOpen] = useState(false);
  const initRef = useRef(false);

  const refreshThreadList = useCallback(async () => {
    const res = await fetch("/api/assistant/threads", { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    const list = (data.threads ?? []) as ThreadSummary[];
    setThreads(list);
    return list;
  }, []);

  const loadThread = useCallback(async (threadId: string) => {
    const res = await fetch(`/api/assistant/threads/${threadId}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setActiveThreadId(threadId);
    setMessages(data.thread?.messages?.length ? data.thread.messages : [WELCOME]);
  }, []);

  const ensureThread = useCallback(async () => {
    if (activeThreadId) return activeThreadId;

    const res = await fetch("/api/assistant/threads", { method: "POST" });
    if (!res.ok) return null;
    const data = await res.json();
    const thread = data.thread;
    if (!thread?.id) return null;

    setActiveThreadId(thread.id);
    setMessages(thread.messages?.length ? thread.messages : [WELCOME]);
    void refreshThreadList();
    return thread.id as string;
  }, [activeThreadId, refreshThreadList]);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    void (async () => {
      setLoading(true);
      try {
        const list = await refreshThreadList();
        if (list.length > 0) {
          await loadThread(list[0].id);
        } else {
          await ensureThread();
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshThreadList, loadThread, ensureThread]);

  const selectThread = useCallback(
    async (threadId: string) => {
      setThreadMenuOpen(false);
      if (threadId === activeThreadId) return;
      await loadThread(threadId);
    },
    [activeThreadId, loadThread],
  );

  const createThread = useCallback(async () => {
    const res = await fetch("/api/assistant/threads", { method: "POST" });
    if (!res.ok) return;
    const data = await res.json();
    const thread = data.thread;
    if (!thread?.id) return;

    setActiveThreadId(thread.id);
    setMessages(thread.messages?.length ? thread.messages : [WELCOME]);
    setThreadMenuOpen(false);
    void refreshThreadList();
  }, [refreshThreadList]);

  const persistMessages = useCallback(
    async (threadId: string, toSave: StoredThreadMessage[]) => {
      if (toSave.length === 0) return;
      const res = await fetch(`/api/assistant/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: toSave }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const saved = (data.messages ?? []) as StoredThreadMessage[];
      setMessages((prev) => {
        const next = [...prev];
        for (let i = 0; i < saved.length; i++) {
          const idx = next.length - toSave.length + i;
          if (idx >= 0 && saved[i]?.id) {
            next[idx] = { ...next[idx], id: saved[i].id };
          }
        }
        return next;
      });
      void refreshThreadList();
    },
    [refreshThreadList],
  );

  const appendLocal = useCallback((msg: StoredThreadMessage | StoredThreadMessage[]) => {
    const batch = Array.isArray(msg) ? msg : [msg];
    setMessages((prev) => [...prev, ...batch]);
    return batch;
  }, []);

  const persistAppend = useCallback(
    async (msg: StoredThreadMessage | StoredThreadMessage[]) => {
      const batch = appendLocal(msg);
      const threadId = activeThreadId ?? (await ensureThread());
      if (threadId) void persistMessages(threadId, batch);
    },
    [activeThreadId, appendLocal, ensureThread, persistMessages],
  );

  const updateLastAssistant = useCallback((content: string) => {
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last?.kind === "text" && last.role === "assistant") {
        copy[copy.length - 1] = { ...last, content };
      }
      return copy;
    });
  }, []);

  return {
    threads,
    activeThreadId,
    messages,
    setMessages,
    loading,
    threadMenuOpen,
    setThreadMenuOpen,
    selectThread,
    createThread,
    ensureThread,
    persistAppend,
    persistMessages,
    updateLastAssistant,
    refreshThreadList,
  };
}
