"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import type { JobMeta } from "@/lib/job-meta";
import { parsedJobToMeta } from "@/lib/job-meta";
import {
  buildProspectKanbanCard,
  cachedJobToMeta,
  findPipelineCardByUrl,
  type CachedJob,
} from "@/lib/cached-job";
import {
  STAGE_DESCRIPTIONS,
  STAGE_LABELS,
  type KanbanCard,
  type KanbanStage,
} from "./workspace-data";
import { PlusIcon, UploadIcon } from "./workspace-icons";
import { DataSourcesPopover } from "./data-sources-popover";
import { PipelineRecommendedSection, buildRecommendedProspectCard } from "./pipeline-recommended-section";
import { PipelineStageJobsList } from "./pipeline-stage-jobs-list";
import { WorkspaceSegmentTabs } from "./workspace-segment-tabs";
import { WorkspaceContent, WorkspaceScroll } from "./workspace-content";
import type { VectorMatchedJob } from "@/lib/vector-matched-job";
import type { NetworkJobListing } from "@/lib/network-job-display";
import { buildNetworkProspectCard } from "@/lib/network-job-display";
import { canViewNetworkJobInternal } from "@/lib/network-job-access";
import {
  findKanbanCardByDbId,
  legacyOpportunitiesQueryToPath,
  opportunitiesTabUrl,
  parseOpportunitiesLocation,
  pipelineJobUrl,
  pipelineProspectUrl,
  parseLegacyCompaniesRedirect,
  prospectPathId,
  type OppTab,
} from "@/lib/workspace-urls";
import { JobDrawer, type DrawerTool } from "./job-drawer";
import { ScoutBox, ScoutDisplayTitle, ScoutLabel, ScoutPrimaryBtn } from "./scout-box";
import { KimchiProcessLoader } from "./kimchi-process-loader";
import { fontSans, fontMono, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";
import { readProspectJobCache, writeProspectJobCache } from "@/lib/prospect-jobs-cache";
import { buildSkillGoal, normalizeSkillGoals } from "@/lib/upskill-programs";
import { primaryTargetRole } from "@/lib/target-roles-unified";
import { profileLearningPathUrl } from "@/lib/workspace-urls";

export type { DrawerTool };

// Props now sourced from WorkspaceContext
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface OpportunitiesProps {}

export function WorkspaceOpportunities() {
  const { kanbanCards, setKanbanCards, addJob, updateStage, removeJob, drawerCardId, setDrawerCardId, drawerTool, setDrawerTool, isAdmin, userRole, actingUserId, isImpersonating, withClientScope, withClientReviewPath } = useWorkspace();
  const isMobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const loc = parseOpportunitiesLocation(pathname);
  const tab = loc.tab;
  const go = useCallback((path: string) => router.push(withClientReviewPath(path)), [router, withClientReviewPath]);
  const setTab = (t: OppTab) => { go(opportunitiesTabUrl(t)); };
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addJobUrl, setAddJobUrl] = useState("");
  const [addJobLoading, setAddJobLoading] = useState(false);
  const [jobAnalysis, setJobAnalysis] = useState<Record<string, unknown> | null>(null);
  const [addJobError, setAddJobError] = useState<string | null>(null);

  useEffect(() => {
    const legacyPath = legacyOpportunitiesQueryToPath(searchParams.toString());
    if (legacyPath) {
      router.replace(withClientReviewPath(legacyPath));
      return;
    }
    const companiesRedirect = parseLegacyCompaniesRedirect(pathname);
    if (companiesRedirect) {
      router.replace(withClientReviewPath(companiesRedirect));
      return;
    }
    if (searchParams.get("addJob") === "1") {
      setShowAddPanel(true);
      router.replace(withClientReviewPath(opportunitiesTabUrl("pipeline")));
    }
  }, [searchParams, router, pathname, withClientReviewPath]);

  const loadProspectFromPath = useCallback(async (prospectId: string) => {
    const drawerId = -Math.abs(Date.now() % 1_000_000);
    const cached = readProspectJobCache(prospectId);
    if (cached) {
      const matched = {
        ...cached.job,
        companyName: cached.companyName ?? "Company",
        title: cached.job.title,
        matchScore: cached.match?.matchScore ?? 0,
        matchLabel: cached.match?.matchLabel ?? "",
        matchReasons: cached.match?.matchReasons ?? [],
        matchedSkills: cached.match?.matchedSkills,
        gapSkills: cached.match?.gapSkills,
      };
      setProspectJob({ companyName: cached.companyName ?? "Company", job: cached.job, drawerId });
      setProspectCard(buildRecommendedProspectCard(matched, drawerId));
      setProspectDetailLoading(false);
      return;
    }

    setProspectDetailLoading(true);
    try {
      const res = await fetch(withClientScope(`/api/jobs/prospect/${encodeURIComponent(prospectId)}`));
      const data = (await res.json().catch(() => ({}))) as {
        job?: CachedJob;
        companyName?: string;
        match?: {
          matchScore: number;
          matchLabel: string;
          matchReasons: string[];
          matchedSkills?: string[];
          gapSkills?: string[];
        };
      };
      if (!res.ok || !data.job) return;
      const companyName = data.companyName ?? "Company";
      const job = data.job;
      writeProspectJobCache({
        prospectId,
        job,
        companyName,
        match: data.match,
        fetchedAt: Date.now(),
      });
      const matched = {
        ...job,
        companyName,
        title: job.title,
        matchScore: data.match?.matchScore ?? 0,
        matchLabel: data.match?.matchLabel ?? "",
        matchReasons: data.match?.matchReasons ?? [],
        matchedSkills: data.match?.matchedSkills,
        gapSkills: data.match?.gapSkills,
      };
      setProspectJob({ companyName, job, drawerId });
      setProspectCard(buildRecommendedProspectCard(matched, drawerId));
    } finally {
      setProspectDetailLoading(false);
    }
  }, []);

  const loadedProspectRef = useRef<string | null>(null);
  const pendingProspectNavRef = useRef<string | null>(null);
  const loadedNetworkJobRef = useRef<string | null>(null);
  const pendingNetworkNavRef = useRef<string | null>(null);

  useEffect(() => {
    if (loc.jobId) {
      const card = findKanbanCardByDbId(
        kanbanCards as (KanbanCard & { _dbId?: string })[],
        loc.jobId
      );
      if (card) {
        setDrawerCardId(card.id);
        setDrawerTool(loc.tool ?? null);
      }
    } else if (tab === "pipeline" && !loc.prospectId) {
      setDrawerCardId(null);
      setDrawerTool(null);
    }
  }, [loc.jobId, loc.tool, loc.prospectId, tab, kanbanCards, setDrawerCardId, setDrawerTool]);

  useEffect(() => {
    if (!loc.prospectId) {
      if (pendingProspectNavRef.current) return;
      loadedProspectRef.current = null;
      setProspectJob(null);
      setProspectCard(null);
      return;
    }
    if (loc.prospectId === pendingProspectNavRef.current) {
      pendingProspectNavRef.current = null;
    }
    if (loadedProspectRef.current === loc.prospectId) return;
    loadedProspectRef.current = loc.prospectId;
    void loadProspectFromPath(loc.prospectId);
  }, [loc.prospectId, loadProspectFromPath]);

  // CSV upload state
  const [showCsvPanel, setShowCsvPanel] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvProgress, setCsvProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [prospectJob, setProspectJob] = useState<{
    companyName: string;
    job: CachedJob;
    drawerId: number;
  } | null>(null);
  const [prospectCard, setProspectCard] = useState<(KanbanCard & { _url?: string; _meta?: JobMeta }) | null>(null);
  const [prospectDetailLoading, setProspectDetailLoading] = useState(false);
  const [addingProspect, setAddingProspect] = useState(false);
  const [networkProspectJob, setNetworkProspectJob] = useState<NetworkJobListing | null>(null);
  const [networkProspectCard, setNetworkProspectCard] = useState<(KanbanCard & { _url?: string; _meta?: JobMeta }) | null>(null);
  const [addingNetworkJob, setAddingNetworkJob] = useState(false);

  /* ── Add job (single URL) — calls real parse-job API ── */
  const submitAddJob = async () => {
    const url = addJobUrl.trim();
    if (!url) return;
    setAddJobLoading(true);
    setJobAnalysis(null);
    setAddJobError(null);
    try {
      const res = await fetch("/api/ai/parse-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddJobError(data.error ?? "Couldn't parse this URL — check the link and try again.");
      } else {
        setJobAnalysis(data);
      }
    } catch {
      setAddJobError("Network error — try again.");
    } finally {
      setAddJobLoading(false);
    }
  };

  /* ── Add a job directly from a URL (used by CSV bulk upload) ── */
  const addJobFromUrl = async (url: string, hintCompany?: string, hintRole?: string) => {
    const company = hintCompany ?? (() => {
      try { return new URL(url).hostname.replace(/^www\./, "").split(".")[0]; } catch { return "Company"; }
    })();
    const role = hintRole ?? "Unknown Role";
    await addJob(company, role, url);
  };

  /* ── CSV upload handler ── */
  const onCsvFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const items = parseCsv(text);
    if (items.length === 0) return;
    setCsvLoading(true);
    setCsvProgress({ done: 0, total: items.length });
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await addJobFromUrl(item.url, item.company, item.role);
      setCsvProgress({ done: i + 1, total: items.length });
    }
    setCsvLoading(false);
    setShowCsvPanel(false);
    if (csvInputRef.current) csvInputRef.current.value = "";
  };

  /* ── Change a card's stage (used by status dropdowns in My Jobs + Pipeline) ── */
  const changeStage = (cardId: number, newStage: KanbanStage) => {
    updateStage(cardId, newStage);
  };

  const addToKanban = async () => {
    if (!jobAnalysis) return;
    const company = (jobAnalysis.company as string | null) ?? "Unknown Company";
    const role = (jobAnalysis.role as string | null) ?? "Unknown Role";
    const meta: JobMeta = parsedJobToMeta(jobAnalysis);
    const created = await addJob(company, role, addJobUrl.trim() || undefined, meta);
    setShowAddPanel(false);
    setJobAnalysis(null);
    setAddJobUrl("");
    setAddJobError(null);
    if (created) {
      setDrawerCardId(created.cardId);
      setDrawerTool(null);
      go(pipelineJobUrl(created.id));
    }
  };

  const moveCard = (cardId: number, stage: KanbanStage) => {
    updateStage(cardId, stage);
  };

  const openDrawer = (cardId: number, tool: DrawerTool = null) => {
    const ext = kanbanCards.find((c) => c.id === cardId) as (KanbanCard & { _dbId?: string }) | undefined;
    if (ext?._dbId) {
      go(pipelineJobUrl(ext._dbId, tool));
      return;
    }
    setDrawerCardId(cardId);
    setDrawerTool(tool);
  };
  const closeDrawer = () => {
    go(opportunitiesTabUrl("pipeline"));
  };
  const handleDrawerToolChange = (tool: DrawerTool) => {
    setDrawerTool(tool);
    if (loc.jobId) router.replace(withClientReviewPath(pipelineJobUrl(loc.jobId, tool)));
  };

  const addGapToUpskill = useCallback(
    async (skill: string, role: string) => {
      const profileRes = await fetch(withClientScope("/api/profile"));
      const profile = profileRes.ok ? await profileRes.json() : null;
      const existing = normalizeSkillGoals(profile?.skillGoals);
      const targetRole = role.trim() || primaryTargetRole(profile?.targetRoles) || "General";
      const next = [
        ...existing.filter(
          (g) => !(g.skill.toLowerCase() === skill.toLowerCase() && g.role === targetRole),
        ),
        buildSkillGoal(skill, targetRole, "saved_job"),
      ];
      await fetch(withClientScope("/api/profile"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillGoals: next }),
      });
      router.push(withClientReviewPath(profileLearningPathUrl(skill)));
    },
    [router, withClientReviewPath, withClientScope],
  );

  const closeProspectDrawer = () => {
    pendingProspectNavRef.current = null;
    if (loc.prospectId) loadedProspectRef.current = loc.prospectId;
    else loadedProspectRef.current = null;
    setProspectJob(null);
    setProspectCard(null);
    setAddingProspect(false);
    setProspectDetailLoading(false);
    go(opportunitiesTabUrl("pipeline"));
  };

  const openRecommendedJob = useCallback((job: VectorMatchedJob) => {
    const prospectId = prospectPathId(job);
    pendingProspectNavRef.current = prospectId;
    loadedProspectRef.current = prospectId;
    go(pipelineProspectUrl(prospectId));
    const drawerId = -Math.abs(Date.now() % 1_000_000);
    const cached = readProspectJobCache(prospectId);
    const enriched: VectorMatchedJob = cached?.job
      ? {
          ...job,
          ...cached.job,
          companyName: cached.companyName ?? job.companyName,
          matchScore: job.matchScore,
          matchLabel: job.matchLabel,
          matchReasons: job.matchReasons,
          matchedSkills: job.matchedSkills,
          gapSkills: job.gapSkills,
          vectorRank: job.vectorRank,
        }
      : job;
    setProspectJob({ companyName: enriched.companyName, job: enriched, drawerId });
    setProspectCard(buildRecommendedProspectCard(enriched, drawerId));
    setProspectDetailLoading(false);
  }, [router]);

  const saveRecommendedJob = useCallback(async (job: VectorMatchedJob) => {
    const meta = buildRecommendedProspectCard(job, 0)._meta;
    const created = await addJob(job.companyName, job.title, job.url ?? undefined, meta);
    if (created) {
      setDrawerCardId(created.cardId);
      setDrawerTool(null);
      go(pipelineJobUrl(created.id));
    }
  }, [addJob, go, setDrawerCardId, setDrawerTool]);

  const openProspectJob = useCallback((companyName: string, job: CachedJob) => {
    const prospectId = prospectPathId(job);
    pendingProspectNavRef.current = prospectId;
    loadedProspectRef.current = prospectId;
    go(pipelineProspectUrl(prospectId));
    const drawerId = -Math.abs(Date.now() % 1_000_000);
    const cached = readProspectJobCache(prospectId);
    const displayJob = cached?.job ?? job;
    setProspectJob({ companyName: cached?.companyName ?? companyName, job: displayJob, drawerId });
    setProspectCard(buildProspectKanbanCard(cached?.companyName ?? companyName, displayJob, drawerId));
    setProspectDetailLoading(false);
  }, [router]);

  const existingProspectPipelineCard = prospectJob
    ? findPipelineCardByUrl(kanbanCards, prospectJob.job.url)
    : null;

  const addProspectToPipeline = async () => {
    if (!prospectJob || !prospectCard) return;
    setAddingProspect(true);
    try {
      const meta = (prospectCard as KanbanCard & { _meta?: JobMeta })._meta ?? cachedJobToMeta(prospectJob.job);
      const created = await addJob(
        prospectJob.companyName,
        prospectJob.job.title,
        prospectJob.job.url ?? undefined,
        meta
      );
      loadedProspectRef.current = null;
      setProspectJob(null);
      setProspectCard(null);
      setAddingProspect(false);
      setProspectDetailLoading(false);
      if (created) {
        go(pipelineJobUrl(created.id));
      } else {
        go(opportunitiesTabUrl("pipeline"));
      }
    } finally {
      setAddingProspect(false);
    }
  };

  const openProspectInPipeline = () => {
    if (!existingProspectPipelineCard) return;
    const ext = existingProspectPipelineCard as KanbanCard & { _dbId?: string };
    closeProspectDrawer();
    if (ext._dbId) go(pipelineJobUrl(ext._dbId));
    else setDrawerCardId(existingProspectPipelineCard.id);
  };

  const closeNetworkDrawer = () => {
    pendingNetworkNavRef.current = null;
    if (loc.networkJobId) loadedNetworkJobRef.current = loc.networkJobId;
    else loadedNetworkJobRef.current = null;
    setNetworkProspectJob(null);
    setNetworkProspectCard(null);
    setAddingNetworkJob(false);
    go(opportunitiesTabUrl("pipeline"));
  };

  const networkInternalView = canViewNetworkJobInternal(userRole, isAdmin, isImpersonating);

  useEffect(() => {
    if (!loc.networkJobId) {
      if (pendingNetworkNavRef.current) return;
      loadedNetworkJobRef.current = null;
      setNetworkProspectJob(null);
      setNetworkProspectCard(null);
      return;
    }
    if (loc.networkJobId === pendingNetworkNavRef.current) {
      pendingNetworkNavRef.current = null;
    }
    if (loadedNetworkJobRef.current === loc.networkJobId) return;
    loadedNetworkJobRef.current = loc.networkJobId;
    void (async () => {
      try {
        const res = await fetch(withClientScope(`/api/network-jobs/${encodeURIComponent(loc.networkJobId!)}`));
        const data = await res.json().catch(() => ({})) as { job?: NetworkJobListing };
        if (res.ok && data.job) {
          const drawerId = -Math.abs(Date.now() % 1_000_000);
          setNetworkProspectJob(data.job);
          setNetworkProspectCard(buildNetworkProspectCard(data.job, drawerId, { internalView: networkInternalView }));
        }
      } catch {
        // ignore
      }
    })();
  }, [loc.networkJobId, networkInternalView]);

  const addNetworkJobToPipeline = async (job: NetworkJobListing = networkProspectJob!) => {
    if (!job) return;
    setAddingNetworkJob(true);
    try {
      const card = buildNetworkProspectCard(job, 0, { internalView: networkInternalView });
      const meta = card._meta;
      const created = await addJob(
        job.companyName ?? job.recruiter?.agencyName ?? "Confidential employer",
        job.positionTitle,
        job.topEchelonUrl ?? undefined,
        meta
      );
      loadedNetworkJobRef.current = null;
      setNetworkProspectJob(null);
      setNetworkProspectCard(null);
      setAddingNetworkJob(false);
      if (created) {
        go(pipelineJobUrl(created.id));
      } else {
        go(opportunitiesTabUrl("pipeline"));
      }
    } finally {
      setAddingNetworkJob(false);
    }
  };

  const existingNetworkPipelineCard = networkProspectJob
    ? findPipelineCardByUrl(kanbanCards, networkProspectJob.topEchelonUrl)
    : null;

  const oppActionBtn: React.CSSProperties = {
    padding: "8px 16px",
    background: "#AE7AFF",
    color: "#FFFFFF",
    border: "1.5px solid #161616",
    borderRadius: 0,
    fontFamily: fontSans,
    fontSize: T.caption,
    fontWeight: 600,
    cursor: "pointer",
    letterSpacing: "0.2px",
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
  };

  return (
    <div
      className="bruddle"
      style={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--scout-page)",
        animation: "fadeIn 0.3s ease both",
      }}
    >
      <WorkspaceScroll>
        <WorkspaceContent>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <DataSourcesPopover compact />
              <button
                type="button"
                onClick={() => { setShowAddPanel((p) => !p); setShowCsvPanel(false); }}
                style={oppActionBtn}
              >
                <PlusIcon /> Add job
              </button>
              <button
                type="button"
                onClick={() => { setShowCsvPanel((p) => !p); setShowAddPanel(false); }}
                style={{
                  ...oppActionBtn,
                  background: showCsvPanel ? "#161616" : "transparent",
                  color: showCsvPanel ? "#FFFFFF" : "#161616",
                }}
              >
                <UploadIcon /> Upload CSV
              </button>
            </div>
          </div>

          {showAddPanel && tab === "pipeline" && (
            <MyJobsUrlPastePanel
              url={addJobUrl}
              setUrl={setAddJobUrl}
              onSubmit={submitAddJob}
              loading={addJobLoading}
              analysis={jobAnalysis}
              error={addJobError}
              onAddToKanban={addToKanban}
              onDismiss={() => { setJobAnalysis(null); setShowAddPanel(false); setAddJobUrl(""); setAddJobError(null); }}
            />
          )}

          {showCsvPanel && tab === "pipeline" && (
            <CsvUploadPanel
              loading={csvLoading}
              progress={csvProgress}
              onFileSelected={onCsvFileSelected}
              onClose={() => setShowCsvPanel(false)}
              inputRef={csvInputRef}
            />
          )}

          {tab === "pipeline" && (
            <PipelineTab
              embedded
              cards={kanbanCards}
              onOpenDrawer={openDrawer}
              onChangeStage={changeStage}
              onOpenRecommended={openRecommendedJob}
              onSaveRecommended={saveRecommendedJob}
              actingUserId={actingUserId}
            />
          )}
        </WorkspaceContent>
      </WorkspaceScroll>

      {/* Job drawer — rendered at parent level so both My Jobs + Pipeline can open it */}
      {drawerCardId !== null && (() => {
        const card = kanbanCards.find((c) => c.id === drawerCardId);
        if (!card) return null;
        return (
          <JobDrawer
            card={card}
            onClose={closeDrawer}
            moveCard={moveCard}
            tool={drawerTool}
            onToolChange={handleDrawerToolChange}
            onDelete={() => { removeJob(card.id); closeDrawer(); }}
            onCardUpdate={(fields) => setKanbanCards((prev) =>
              prev.map((c) => {
                if (c.id !== card.id) return c;
                const next = { ...c } as KanbanCard & { _pipelineTags?: string[]; _meta?: JobMeta };
                for (const [k, v] of Object.entries(fields)) {
                  if (k === "pipelineTags" && Array.isArray(v)) {
                    next._pipelineTags = v;
                    next._meta = { ...(next._meta ?? {}), pipelineTags: v };
                    continue;
                  }
                  (next as Record<string, unknown>)[`_${k}`] = v ?? undefined;
                }
                return next;
              }),
            )}
            onAddGapToUpskill={(skill, role) => void addGapToUpskill(skill, role)}
          />
        );
      })()}

      {prospectCard && prospectJob && (
        <JobDrawer
          card={prospectCard}
          onClose={closeProspectDrawer}
          moveCard={() => {}}
          onDelete={closeProspectDrawer}
          onCardUpdate={() => {}}
          prospectMode
          elevated
          detailLoading={prospectDetailLoading}
          onAddToPipeline={existingProspectPipelineCard ? undefined : addProspectToPipeline}
          addingToPipeline={addingProspect}
          existingPipelineCardId={existingProspectPipelineCard?.id ?? null}
          onOpenInPipeline={existingProspectPipelineCard ? openProspectInPipeline : undefined}
          onAddGapToUpskill={(skill, role) => void addGapToUpskill(skill, role)}
        />
      )}

      {networkProspectCard && networkProspectJob && (
        <JobDrawer
          card={networkProspectCard}
          onClose={closeNetworkDrawer}
          moveCard={() => {}}
          onDelete={closeNetworkDrawer}
          onCardUpdate={() => {}}
          prospectMode
          elevated
          onAddToPipeline={existingNetworkPipelineCard ? undefined : () => addNetworkJobToPipeline(networkProspectJob)}
          addingToPipeline={addingNetworkJob}
          existingPipelineCardId={existingNetworkPipelineCard?.id ?? null}
          onOpenInPipeline={existingNetworkPipelineCard ? () => {
            const ext = existingNetworkPipelineCard as KanbanCard & { _dbId?: string };
            closeNetworkDrawer();
            if (ext._dbId) go(pipelineJobUrl(ext._dbId));
            else setDrawerCardId(existingNetworkPipelineCard.id);
          } : undefined}
          onAddGapToUpskill={(skill, role) => void addGapToUpskill(skill, role)}
        />
      )}
    </div>
  );
}


/* ──────────────────────────────────────────────────────────────
   Helpers: CSV parser, CsvUploadPanel, MyJobsUrlPastePanel
   ───────────────────────────────────────────────────────────────── */

/* Parse CSV text into a list of {url, company?, role?} objects.
   Supports two formats:
   1. Header row: url,company,role
   2. Plain URLs (one per line)
   3. Inline CSV: url,company,role (no header) */
function parseCsv(text: string): Array<{ url: string; company?: string; role?: string }> {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const first = lines[0].toLowerCase();
  const hasHeader = first.includes("url") && (first.includes(",") || first.includes("company"));
  const dataLines = hasHeader ? lines.slice(1) : lines;
  return dataLines
    .map((line) => {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length === 1) return { url: parts[0] };
      return { url: parts[0], company: parts[1] || undefined, role: parts[2] || undefined };
    })
    .filter((item) => item.url);
}

/* ── CsvUploadPanel — file picker + progress for bulk URL upload ── */
interface CsvUploadPanelProps {
  loading: boolean;
  progress: { done: number; total: number };
  onFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClose: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

function CsvUploadPanel({ loading, progress, onFileSelected, onClose, inputRef }: CsvUploadPanelProps) {
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <ScoutBox
      padding="16px clamp(16px, 4vw, 28px)"
      style={{ marginBottom: 16, animation: "fadeIn 0.2s ease both" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color: "#1A1A1A" }}>
          Bulk add jobs from CSV
        </p>
        {!loading && (
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--scout-muted)", padding: 0, lineHeight: 1 }}
          >
            ×
          </button>
        )}
      </div>
      {loading ? (
        <div style={{ maxWidth: 480 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div
              style={{ width: 7, height: 7, borderRadius: "50%", background: "#1A3A2F", animation: "pulse 1s ease infinite", flexShrink: 0 }}
            />
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.forest }}>
              Parsing {progress.done} of {progress.total} URLs…
            </p>
          </div>
          <div style={{ height: 4, background: "rgba(0,0,0,0.08)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "#1A3A2F", borderRadius: 2, transition: "width 0.3s ease" }} />
          </div>
        </div>
      ) : (
        <>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 400, color: color.stone, lineHeight: 1.55, marginBottom: 10, maxWidth: 520 }}>
            One URL per line, or columns <code style={{ fontFamily: fontMono, fontSize: T.label, background: "rgba(0,0,0,0.05)", padding: "1px 5px", borderRadius: 3 }}>url,company,role</code>. We&apos;ll add each role to your pipeline.
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <ScoutPrimaryBtn onClick={() => inputRef.current?.click()}>
              <UploadIcon /> Choose file
            </ScoutPrimaryBtn>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              style={{ display: "none" }}
              onChange={onFileSelected}
            />
            <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.mutedLight }}>
              .csv or .txt
            </span>
          </div>
          <ScoutBox style={{ maxWidth: 520, marginTop: 12 }} padding={14}>
            <p style={{ fontFamily: fontMono, fontSize: T.label, color: color.mutedLight, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
              Example CSV
            </p>
            <pre style={{ fontFamily: fontMono, fontSize: T.label, color: color.stone, lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
{`url,company,role
https://stripe.com/jobs/...,Stripe,Senior PM
https://linear.app/careers/...,Linear,Product Lead
https://figma.com/careers/...,Figma,Design Systems PM`}
            </pre>
          </ScoutBox>
        </>
      )}
    </ScoutBox>
  );
}

/* ── MyJobsUrlPastePanel — URL input + compact analysis for My Jobs tab ── */
interface MyJobsUrlPastePanelProps {
  url: string;
  setUrl: (s: string) => void;
  onSubmit: () => void;
  loading: boolean;
  analysis: Record<string, unknown> | null;
  error?: string | null;
  onAddToKanban: () => void;
  onDismiss: () => void;
}

function MyJobsUrlPastePanel({ url, setUrl, onSubmit, loading, analysis, error, onAddToKanban, onDismiss }: MyJobsUrlPastePanelProps) {
  return (
    <ScoutBox
      padding="16px clamp(16px, 4vw, 28px)"
      style={{ marginBottom: 16, animation: "fadeIn 0.2s ease both" }}
    >
      <div style={{ display: "flex", gap: 8, maxWidth: 560, marginBottom: loading || analysis || error ? 12 : 0 }}>
        <input
          type="url"
          placeholder="Paste a job listing URL — e.g. https://stripe.com/jobs/..."
          value={url}
          disabled={loading}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && onSubmit()}
          style={{
            flex: 1,
            padding: "9px 12px",
            border: border.line,
            borderRadius: "var(--scout-radius)",
            background: surface.inset,
            fontFamily: fontSans,
            fontSize: T.caption,
            color: color.ink,
            minWidth: 0,
          }}
        />
        <button
          onClick={onSubmit}
          disabled={loading || !url.trim()}
          style={{
            padding: "9px 18px",
            background: color.cta,
            color: color.ctaForeground,
            border: "var(--scout-border)",
            boxShadow: "var(--scout-shadow-bruddle)",
            borderRadius: "var(--scout-radius)",
            fontFamily: fontSans,
            fontSize: T.caption,
            fontWeight: 600,
            cursor: loading || !url.trim() ? "not-allowed" : "pointer",
            opacity: loading || !url.trim() ? 0.65 : 1,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {loading ? (
            <>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: color.gold, animation: "pulse 1s ease infinite", display: "inline-block" }} />
              Analyzing…
            </>
          ) : (
            "Search →"
          )}
        </button>
        <button
          onClick={onDismiss}
          style={{
            padding: "9px 12px",
            background: "transparent",
            color: "var(--scout-muted)",
            border: "none",
            fontFamily: "var(--font-ui)",
            fontSize: 12,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Cancel
        </button>
      </div>
      {loading && (
        <div style={{ marginTop: 8, maxWidth: 480 }}>
          <KimchiProcessLoader preset="jobParse" variant="inline" />
        </div>
      )}
      {error && !loading && (
        <div style={{ padding: "8px 12px", background: "rgba(196,87,74,0.06)", borderRadius: "var(--scout-radius)", border: "1px solid rgba(196,87,74,0.15)", maxWidth: 560 }}>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "#C4574A" }}>{error}</p>
        </div>
      )}
      {analysis && !loading && (
        <ScoutBox style={{ maxWidth: 640, animation: "fadeIn 0.3s ease both" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink }}>{(analysis.company as string) ?? "Unknown company"}</p>
                {typeof analysis.role === "string" && analysis.role && (
                  <>
                    <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>·</span>
                    <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone }}>{analysis.role}</p>
                  </>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {typeof analysis.location === "string" && analysis.location && (
                  <span style={{ padding: "2px 8px", background: "rgba(0,0,0,0.05)", borderRadius: "var(--scout-radius)", fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
                    📍 {analysis.location}
                  </span>
                )}
                {typeof analysis.salary === "string" && analysis.salary && (
                  <span style={{ padding: "2px 8px", background: "rgba(26,58,47,0.08)", borderRadius: "var(--scout-radius)", fontFamily: fontSans, fontSize: T.caption, fontWeight: 500, color: "#2D6B4A" }}>
                    {analysis.salary}
                  </span>
                )}
              </div>
            </div>
          </div>
          {((typeof analysis.jobSummary === "string" && analysis.jobSummary) || (typeof analysis.description === "string" && analysis.description)) && (
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 400, color: color.ink, lineHeight: 1.6, marginBottom: 10, textWrap: "pretty" }}>
              {(typeof analysis.jobSummary === "string" ? analysis.jobSummary : null) ?? (analysis.description as string)}
            </p>
          )}
          <button
            onClick={onAddToKanban}
            style={{
              padding: "8px 18px",
              background: color.cta,
              color: color.ctaForeground,
              border: "var(--scout-border)",
              boxShadow: "var(--scout-shadow-bruddle)",
              borderRadius: "var(--scout-radius)",
              fontFamily: fontSans,
              fontSize: T.caption,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Add to pipeline
          </button>
        </ScoutBox>
      )}
    </ScoutBox>
  );
}

/* ──────────────────────────────────────────────────────────────
   Pipeline tab — stage tabs + recommended / saved lists
   ────────────────────────────────────────────────────────────── */

type PipelineView = "recommended" | KanbanStage;

interface PipelineTabProps {
  cards: KanbanCard[];
  onOpenDrawer: (id: number) => void;
  onChangeStage: (id: number, stage: KanbanStage) => void;
  onOpenRecommended: (job: VectorMatchedJob) => void;
  onSaveRecommended: (job: VectorMatchedJob) => Promise<void>;
  actingUserId?: string | null;
  embedded?: boolean;
}

function PipelineTab({
  cards,
  onOpenDrawer,
  onChangeStage,
  onOpenRecommended,
  onSaveRecommended,
  actingUserId,
  embedded,
}: PipelineTabProps) {
  const isMobile = useIsMobile();
  const [pipelineView, setPipelineView] = useState<PipelineView>("recommended");

  const stageOrder: KanbanStage[] = ["saved", "applied", "interview", "offer"];
  const closedCount = cards.filter((c) => c.stage === "closed").length;
  const activeCount = cards.filter((c) => c.stage !== "closed").length;
  const stageCounts = stageOrder.map((s) => ({ stage: s, count: cards.filter((c) => c.stage === s).length }));

  const stageTabLabel = (stage: KanbanStage, count: number) => {
    const base = STAGE_LABELS[stage];
    return count > 0 ? `${base} · ${count}` : base;
  };

  const pipelineTabs: { id: PipelineView; label: string }[] = [
    { id: "recommended", label: "Find roles" },
    ...stageCounts.map(({ stage, count }) => ({ id: stage, label: stageTabLabel(stage, count) })),
    ...(closedCount > 0 ? [{ id: "closed" as const, label: `${STAGE_LABELS.closed} · ${closedCount}` }] : []),
  ];

  return (
    <div style={{ padding: embedded ? 0 : isMobile ? "20px 16px 32px" : "32px 36px 48px" }}>
      <div style={{ marginBottom: 20 }}>
        {!embedded && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ width: 8, height: 8, background: color.forest, display: "inline-block", flexShrink: 0 }} />
          <ScoutLabel>Roles</ScoutLabel>
        </div>
        )}
        <ScoutDisplayTitle size={isMobile ? 28 : 36} style={{ marginBottom: 8 }}>
          {pipelineView === "recommended" ? "Find roles that fit" : STAGE_LABELS[pipelineView as KanbanStage] ?? "Pipeline"}
        </ScoutDisplayTitle>
        <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.muted, maxWidth: 560, lineHeight: 1.6, margin: 0 }}>
          {pipelineView === "recommended"
            ? "Open roles scored against your profile — save any you want to track."
            : pipelineView === "closed"
              ? `${STAGE_DESCRIPTIONS.closed} · ${closedCount} role${closedCount === 1 ? "" : "s"}`
              : `${STAGE_DESCRIPTIONS[pipelineView as KanbanStage]} · ${activeCount} active role${activeCount === 1 ? "" : "s"} in your pipeline`}
        </p>
      </div>

      <WorkspaceSegmentTabs tabs={pipelineTabs} active={pipelineView} onChange={setPipelineView} isMobile={isMobile} variant="bruddle" />

      {pipelineView === "recommended" ? (
        <PipelineRecommendedSection
          pipelineCards={cards}
          onOpenJob={onOpenRecommended}
          onSaveJob={onSaveRecommended}
          actingUserId={actingUserId}
        />
      ) : (
        <PipelineStageJobsList
          stage={pipelineView}
          cards={cards}
          onOpenDrawer={onOpenDrawer}
          onChangeStage={onChangeStage}
          onBackToRecommendations={() => setPipelineView("recommended")}
        />
      )}
    </div>
  );
}




