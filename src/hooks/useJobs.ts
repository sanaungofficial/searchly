"use client";

import { useState, useEffect, useCallback } from "react";
import type { KanbanCard, KanbanStage } from "@/components/scout/workspace-data";
import type { JobMeta } from "@/lib/job-meta";

export type { JobMeta };

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
  userNotes: string | null;
  companyLinkedinUrl: string | null;
  fitAnalysis: string | null;
  createdAt: string;
}

function dbJobToKanban(job: DbJob, index: number): KanbanCard {
  let _meta: JobMeta | undefined;
  if (job.notes) {
    try { _meta = JSON.parse(job.notes) as JobMeta; } catch { /* ignore */ }
  }
  let fit = 0;
  if (job.fitAnalysis) {
    try {
      const fa = JSON.parse(job.fitAnalysis) as { score?: number };
      if (fa.score) fit = Math.min(100, Math.round(fa.score * 10));
    } catch { /* ignore */ }
  }
  return {
    id: index,
    company: job.company,
    initials: job.company.slice(0, 2).toUpperCase(),
    role: job.role,
    stage: DB_TO_KANBAN[job.stage] ?? "saved",
    fit,
    jobRef: null,
    days: Math.floor((Date.now() - new Date(job.createdAt).getTime()) / 86400000),
    _dbId: job.id,
    _url: job.url ?? undefined,
    _userNotes: job.userNotes ?? undefined,
    _companyLinkedinUrl: job.companyLinkedinUrl ?? undefined,
    _meta,
  } as KanbanCard & { _dbId: string; _url?: string; _userNotes?: string; _companyLinkedinUrl?: string; _meta?: JobMeta };
}

export function useJobs(fallback: KanbanCard[], reloadKey?: string) {
  const [cards, setCards] = useState<KanbanCard[]>(fallback);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((jobs: DbJob[]) => {
        if (Array.isArray(jobs)) {
          setCards(jobs.map(dbJobToKanban));
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [reloadKey]);

  const addJob = useCallback(async (company: string, role: string, url?: string, meta?: JobMeta) => {
    const notes = meta ? JSON.stringify(meta) : undefined;
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company, role, url, notes }),
    });
    if (!res.ok) return null;
    const job: DbJob = await res.json();
    let cardId = 0;
    setCards((prev) => {
      cardId = prev.length;
      return [dbJobToKanban(job, cardId), ...prev];
    });

    // Auto-run match score in background if we have a description
    const description = meta?.description;
    const vectorFit = meta?.vectorMatch?.matchScore;
    if (vectorFit != null && job.id) {
      const fit = Math.min(100, Math.round(vectorFit));
      fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fitAnalysis: JSON.stringify({ score: fit / 10, source: "hirebase_vector" }) }),
      });
      setCards((prev) => prev.map((c) => {
        const card = c as KanbanCard & { _dbId?: string };
        return card._dbId === job.id ? { ...c, fit } : c;
      }));
    } else if (description && job.id) {
      fetch("/api/ai/job-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle: role, company, description }),
      })
        .then((r) => r.json())
        .then((matchData: { score?: number }) => {
          if (!matchData.score) return;
          const fit = Math.min(100, Math.round(matchData.score * 10));
          fetch(`/api/jobs/${job.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fitAnalysis: JSON.stringify({ score: matchData.score }) }),
          });
          setCards((prev) => prev.map((c) => {
            const card = c as KanbanCard & { _dbId?: string };
            return card._dbId === job.id ? { ...c, fit } : c;
          }));
        })
        .catch(() => {}); // best-effort, silently ignore
    }

    return { id: job.id, cardId };
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
