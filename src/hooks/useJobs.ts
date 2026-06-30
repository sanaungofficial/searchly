"use client";

import { useState, useEffect, useCallback } from "react";
import type { KanbanCard, KanbanStage } from "@/components/scout/workspace-data";
import type { JobMeta } from "@/lib/job-meta";
import { KANBAN_TO_DB, resolveDbJobKanbanStage } from "@/lib/pipeline-kanban-stage";
import { withClientUserId } from "@/lib/workspace-urls";

export type { JobMeta };

interface DbJob {
  id: string;
  company: string;
  role: string;
  stage: string;
  url: string | null;
  notes: string | null;
  userNotes: string | null;
  companyLinkedinUrl: string | null;
  coverLetter?: string | null;
  fitAnalysis: string | null;
  appliedAt: string | null;
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
    stage: resolveDbJobKanbanStage(job.stage, job.appliedAt),
    fit,
    jobRef: null,
    days: Math.floor((Date.now() - new Date(job.createdAt).getTime()) / 86400000),
    _dbId: job.id,
    _url: job.url ?? undefined,
    _userNotes: job.userNotes ?? undefined,
    _companyLinkedinUrl: job.companyLinkedinUrl ?? undefined,
    _coverLetter: job.coverLetter ?? undefined,
    _fitAnalysis: job.fitAnalysis ?? undefined,
    _meta,
  } as KanbanCard & { _dbId: string; _url?: string; _userNotes?: string; _companyLinkedinUrl?: string; _coverLetter?: string; _fitAnalysis?: string; _meta?: JobMeta };
}

export function useJobs(fallback: KanbanCard[], reloadKey?: string, adminReviewClientId?: string | null) {
  const [cards, setCards] = useState<KanbanCard[]>(fallback);
  const [loaded, setLoaded] = useState(false);
  const jobsUrl = adminReviewClientId ? withClientUserId("/api/jobs", adminReviewClientId) : "/api/jobs";

  useEffect(() => {
    setLoaded(false);
    fetch(jobsUrl)
      .then((r) => r.json())
      .then((jobs: DbJob[]) => {
        if (Array.isArray(jobs)) {
          setCards(jobs.map(dbJobToKanban));
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [reloadKey, jobsUrl]);

  const scopeJobPath = useCallback(
    (path: string) => (adminReviewClientId ? withClientUserId(path, adminReviewClientId) : path),
    [adminReviewClientId],
  );

  const addJob = useCallback(async (company: string, role: string, url?: string, meta?: JobMeta) => {
    const notes = meta ? JSON.stringify(meta) : undefined;
    const res = await fetch(scopeJobPath("/api/jobs"), {
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

    // Persist vector fit from recommendations without calling Anthropic.
    const vectorFit = meta?.vectorMatch?.matchScore;
    if (vectorFit != null && job.id) {
      const fit = Math.min(100, Math.round(vectorFit));
      fetch(scopeJobPath(`/api/jobs/${job.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fitAnalysis: JSON.stringify({ score: fit / 10, source: "hirebase_vector" }) }),
      });
      setCards((prev) => prev.map((c) => {
        const card = c as KanbanCard & { _dbId?: string };
        return card._dbId === job.id ? { ...c, fit } : c;
      }));
    }

    return { id: job.id, cardId };
  }, [scopeJobPath]);

  const updateStage = useCallback(async (cardId: number, stage: KanbanStage) => {
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, stage } : c)));
    const card = cards.find((c) => c.id === cardId) as (KanbanCard & { _dbId?: string }) | undefined;
    if (!card?._dbId) return;
    await fetch(scopeJobPath(`/api/jobs/${card._dbId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: KANBAN_TO_DB[stage] }),
    });
  }, [cards, scopeJobPath]);

  const removeJob = useCallback(async (cardId: number) => {
    const card = cards.find((c) => c.id === cardId) as (KanbanCard & { _dbId?: string }) | undefined;
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    if (!card?._dbId) return;
    await fetch(scopeJobPath(`/api/jobs/${card._dbId}`), { method: "DELETE" });
  }, [cards, scopeJobPath]);

  return { cards, setCards, addJob, updateStage, removeJob, loaded };
}
