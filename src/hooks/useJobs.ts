"use client";

import { useState, useEffect, useCallback } from "react";
import type { KanbanCard, KanbanStage } from "@/components/scout/workspace-data";

// Map DB stage enum → KanbanStage
const DB_TO_KANBAN: Record<string, KanbanStage> = {
  SAVED: "saved",
  APPLYING: "saved",
  APPLIED: "applied",
  SCREENING: "applied",
  INTERVIEWING: "interview",
  OFFER: "offer",
  REJECTED: "closed",
  WITHDRAWN: "closed",
};

// Map KanbanStage → DB stage enum
const KANBAN_TO_DB: Record<KanbanStage, string> = {
  saved: "SAVED",
  applied: "APPLIED",
  interview: "INTERVIEWING",
  offer: "OFFER",
  closed: "WITHDRAWN",
};

interface DbJob {
  id: string;
  company: string;
  role: string;
  stage: string;
  url: string | null;
  notes: string | null;
  createdAt: string;
}

function dbJobToKanban(job: DbJob, index: number): KanbanCard {
  return {
    id: index,
    company: job.company,
    initials: job.company.slice(0, 2).toUpperCase(),
    role: job.role,
    stage: DB_TO_KANBAN[job.stage] ?? "saved",
    fit: 0,
    jobRef: null,
    days: Math.floor((Date.now() - new Date(job.createdAt).getTime()) / 86400000),
    _dbId: job.id,
  } as KanbanCard & { _dbId: string };
}

export function useJobs(fallback: KanbanCard[]) {
  const [cards, setCards] = useState<KanbanCard[]>(fallback);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((jobs: DbJob[]) => {
        if (Array.isArray(jobs) && jobs.length > 0) {
          setCards(jobs.map(dbJobToKanban));
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const addJob = useCallback(async (company: string, role: string, url?: string) => {
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company, role, url }),
    });
    if (!res.ok) return;
    const job: DbJob = await res.json();
    setCards((prev) => [dbJobToKanban(job, prev.length), ...prev]);
  }, []);

  const updateStage = useCallback(async (cardId: number, stage: KanbanStage) => {
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, stage } : c)));
    const card = cards.find((c) => c.id === cardId) as (KanbanCard & { _dbId?: string }) | undefined;
    if (!card?._dbId) return;
    await fetch(`/api/jobs/${card._dbId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: KANBAN_TO_DB[stage] }),
    });
  }, [cards]);

  const removeJob = useCallback(async (cardId: number) => {
    const card = cards.find((c) => c.id === cardId) as (KanbanCard & { _dbId?: string }) | undefined;
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    if (!card?._dbId) return;
    await fetch(`/api/jobs/${card._dbId}`, { method: "DELETE" });
  }, [cards]);

  return { cards, setCards, addJob, updateStage, removeJob, loaded };
}
