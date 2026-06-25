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
  STAGE_LABELS,
  type KanbanCard,
  type KanbanStage,
} from "./workspace-data";
import { PlusIcon, UploadIcon } from "./workspace-icons";
import { DataSourcesPopover } from "./data-sources-popover";
import { PipelineRecommendedSection, buildRecommendedProspectCard } from "./pipeline-recommended-section";
import { PipelinePreferencesPanel } from "./pipeline-preferences-panel";
import { PipelineStageJobsList } from "./pipeline-stage-jobs-list";
import { PipelineNetworkSection } from "./pipeline-network-section";
import type { VectorMatchedJob } from "@/lib/vector-matched-job";
import type { NetworkJobListing } from "@/lib/network-job-display";
import { buildNetworkProspectCard } from "@/lib/network-job-display";
import { canViewNetworkJobInternal } from "@/lib/network-job-access";
import {
  companiesUrl,
  findKanbanCardByDbId,
  legacyOpportunitiesQueryToPath,
  networkJobUrl,
  opportunitiesTabUrl,
  parseOpportunitiesLocation,
  pipelineJobUrl,
  pipelineProspectUrl,
  prospectPathId,
} from "@/lib/workspace-urls";
import { WorkspaceCompanies } from "./workspace-companies";
import { JobDrawer, type DrawerTool } from "./job-drawer";
import { ScoutBox, ScoutDisplayTitle, ScoutLabel, ScoutPrimaryBtn } from "./scout-box";
import { KimchiProcessLoader } from "./kimchi-process-loader";
import { fontSans, fontMono, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";
import type { RecommendationPreferencesState } from "@/lib/recommendation-preferences";

export type { DrawerTool };

type OppTab = "pipeline" | "network" | "companies";

// Props now sourced from WorkspaceContext
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface OpportunitiesProps {}

export function WorkspaceOpportunities() {
  const { kanbanCards, setKanbanCards, addJob, updateStage, removeJob, drawerCardId, setDrawerCardId, drawerTool, setDrawerTool, isAdmin, userRole, actingUserId } = useWorkspace();
  const isMobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const loc = parseOpportunitiesLocation(pathname);
  const tab = loc.tab;
  const setTab = (t: OppTab) => { router.push(opportunitiesTabUrl(t)); };
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addJobUrl, setAddJobUrl] = useState("");
  const [addJobLoading, setAddJobLoading] = useState(false);
  const [jobAnalysis, setJobAnalysis] = useState<Record<string, unknown> | null>(null);
  const [addJobError, setAddJobError] = useState<string | null>(null);

  useEffect(() => {
    const legacyPath = legacyOpportunitiesQueryToPath(searchParams.toString());
    if (legacyPath) {
      router.replace(legacyPath);
      return;
    }
    if (searchParams.get("addJob") === "1") {
      setShowAddPanel(true);
      router.replace("/opportunities/pipeline");
    }
  }, [searchParams, router]);

  const loadProspectFromPath = useCallback(async (prospectId: string) => {
    const drawerId = -Math.abs(Date.now() % 1_000_000);
    setProspectDetailLoading(true);
    try {
      const res = await fetch(`/api/jobs/prospect/${encodeURIComponent(prospectId)}`);
      const data = (await res.json().catch(() => ({}))) as { job?: CachedJob; companyName?: string };
      if (!res.ok || !data.job) return;
      const companyName = data.companyName ?? "Company";
      const job = data.job;
      setProspectJob({ companyName, job, drawerId });
      setProspectCard(buildProspectKanbanCard(companyName, job, drawerId));
    } finally {
      setProspectDetailLoading(false);
    }
  }, []);

  const loadedProspectRef = useRef<string | null>(null);
  const loadedNetworkJobRef = useRef<string | null>(null);

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
      loadedProspectRef.current = null;
      setProspectJob(null);
      setProspectCard(null);
      return;
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
        setAddJobError(data.error ?? "Could not analyze this URL.");
      } else {
        setJobAnalysis(data);
      }
    } catch {
      setAddJobError("Network error. Please try again.");
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
    await addJob(company, role, addJobUrl.trim() || undefined, meta);
    setShowAddPanel(false);
    setJobAnalysis(null);
    setAddJobUrl("");
    setAddJobError(null);
  };

  const moveCard = (cardId: number, stage: KanbanStage) => {
    updateStage(cardId, stage);
  };

  const openDrawer = (cardId: number, tool: DrawerTool = null) => {
    const ext = kanbanCards.find((c) => c.id === cardId) as (KanbanCard & { _dbId?: string }) | undefined;
    if (ext?._dbId) {
      router.push(pipelineJobUrl(ext._dbId, tool));
      return;
    }
    setDrawerCardId(cardId);
    setDrawerTool(tool);
  };
  const closeDrawer = () => {
    router.push("/opportunities/pipeline");
  };
  const handleDrawerToolChange = (tool: DrawerTool) => {
    setDrawerTool(tool);
    if (loc.jobId) router.replace(pipelineJobUrl(loc.jobId, tool));
  };

  const closeProspectDrawer = () => {
    loadedProspectRef.current = null;
    setProspectJob(null);
    setProspectCard(null);
    setAddingProspect(false);
    setProspectDetailLoading(false);
    router.push("/opportunities/pipeline");
  };

  const openRecommendedJob = useCallback(async (job: VectorMatchedJob) => {
    const prospectId = prospectPathId(job);
    loadedProspectRef.current = prospectId;
    router.push(pipelineProspectUrl(prospectId));
    const drawerId = -Math.abs(Date.now() % 1_000_000);
    setProspectJob({ companyName: job.companyName, job, drawerId });
    setProspectCard(buildRecommendedProspectCard(job, drawerId));
    setProspectDetailLoading(true);

    try {
      const hirebaseId = job.hirebaseId?.trim();
      if (hirebaseId) {
        const res = await fetch(`/api/jobs/prospect/${encodeURIComponent(hirebaseId)}`);
        const data = (await res.json().catch(() => ({}))) as { job?: CachedJob; companyName?: string };
        if (res.ok && data.job) {
          const enriched: VectorMatchedJob = {
            ...job,
            ...data.job,
            companyName: data.companyName ?? job.companyName,
            matchScore: job.matchScore,
            matchLabel: job.matchLabel,
            matchReasons: job.matchReasons,
            matchedSkills: job.matchedSkills,
            gapSkills: job.gapSkills,
            vectorRank: job.vectorRank,
          };
          setProspectJob((prev) => (prev ? { ...prev, companyName: enriched.companyName, job: enriched } : null));
          setProspectCard(buildRecommendedProspectCard(enriched, drawerId));
          return;
        }
      }

      const res = await fetch("/api/companies/prospect-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job }),
      });
      const data = (await res.json().catch(() => ({}))) as { job?: CachedJob };
      if (res.ok && data.job) {
        const enriched: VectorMatchedJob = {
          ...job,
          ...data.job,
          companyName: job.companyName,
          matchScore: job.matchScore,
          matchLabel: job.matchLabel,
          matchReasons: job.matchReasons,
          matchedSkills: job.matchedSkills,
          gapSkills: job.gapSkills,
          vectorRank: job.vectorRank,
        };
        setProspectJob((prev) => (prev ? { ...prev, job: enriched } : null));
        setProspectCard(buildRecommendedProspectCard(enriched, drawerId));
      }
    } catch {
      // Drawer still opens with vector match data.
    } finally {
      setProspectDetailLoading(false);
    }
  }, [router]);

  const saveRecommendedJob = useCallback(async (job: VectorMatchedJob) => {
    const meta = buildRecommendedProspectCard(job, 0)._meta;
    const created = await addJob(job.companyName, job.title, job.url ?? undefined, meta);
    if (created) {
      router.push(pipelineJobUrl(created.id));
    }
  }, [addJob, router]);

  const openProspectJob = useCallback(async (companyName: string, job: CachedJob) => {
    const prospectId = prospectPathId(job);
    loadedProspectRef.current = prospectId;
    router.push(pipelineProspectUrl(prospectId));
    const drawerId = -Math.abs(Date.now() % 1_000_000);
    setProspectJob({ companyName, job, drawerId });
    setProspectCard(buildProspectKanbanCard(companyName, job, drawerId));
    setProspectDetailLoading(Boolean(job.hirebaseId));

    try {
      const res = await fetch("/api/companies/prospect-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job }),
      });
      const data = await res.json().catch(() => ({})) as { job?: CachedJob };
      if (res.ok && data.job) {
        setProspectJob((prev) => (prev ? { ...prev, job: data.job! } : null));
        setProspectCard(buildProspectKanbanCard(companyName, data.job, drawerId));
      }
    } catch {
      // Drawer still opens with cached snapshot.
    } finally {
      setProspectDetailLoading(false);
    }
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
        router.push(pipelineJobUrl(created.id));
      } else {
        router.push("/opportunities/pipeline");
      }
    } finally {
      setAddingProspect(false);
    }
  };

  const openProspectInPipeline = () => {
    if (!existingProspectPipelineCard) return;
    const ext = existingProspectPipelineCard as KanbanCard & { _dbId?: string };
    closeProspectDrawer();
    if (ext._dbId) router.push(pipelineJobUrl(ext._dbId));
    else setDrawerCardId(existingProspectPipelineCard.id);
  };

  const closeNetworkDrawer = () => {
    loadedNetworkJobRef.current = null;
    setNetworkProspectJob(null);
    setNetworkProspectCard(null);
    setAddingNetworkJob(false);
    router.push("/opportunities/network");
  };

  const networkInternalView = canViewNetworkJobInternal(userRole, isAdmin);

  const openNetworkJob = useCallback((job: NetworkJobListing) => {
    loadedNetworkJobRef.current = job.id;
    router.push(networkJobUrl(job.id));
    const drawerId = -Math.abs(Date.now() % 1_000_000);
    setNetworkProspectJob(job);
    setNetworkProspectCard(buildNetworkProspectCard(job, drawerId, { internalView: networkInternalView }));
  }, [networkInternalView, router]);

  useEffect(() => {
    if (!loc.networkJobId) {
      loadedNetworkJobRef.current = null;
      setNetworkProspectJob(null);
      setNetworkProspectCard(null);
      return;
    }
    if (loadedNetworkJobRef.current === loc.networkJobId) return;
    loadedNetworkJobRef.current = loc.networkJobId;
    void (async () => {
      try {
        const res = await fetch(`/api/network-jobs/${encodeURIComponent(loc.networkJobId!)}`);
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
        router.push(pipelineJobUrl(created.id));
      } else {
        router.push("/opportunities/network");
      }
    } finally {
      setAddingNetworkJob(false);
    }
  };

  const existingNetworkPipelineCard = networkProspectJob
    ? findPipelineCardByUrl(kanbanCards, networkProspectJob.topEchelonUrl)
    : null;

  return (
    <div
      style={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: surface.page,
        animation: "fadeIn 0.3s ease both",
      }}
    >
      {/* Tab bar */}
      {isMobile ? (
        <>
          <WorkspaceMobileTopBar
            center={
              <div
                style={{
                  display: "flex",
                  gap: 0,
                  overflowX: "auto",
                  WebkitOverflowScrolling: "touch",
                  justifyContent: "center",
                  maxWidth: "100%",
                }}
              >
                {([
                  ["pipeline", "Open Roles"],
                  ["network", "Network"],
                  ["companies", "Companies"],
                ] as [OppTab, string][]).map(([id, label]) => {
                  const active = tab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setTab(id)}
                      style={{
                        padding: "8px 14px",
                        border: "none",
                        borderBottom: active ? "2px solid #1A3A2F" : "2px solid transparent",
                        background: "transparent",
                        color: active ? color.forest : color.muted,
                        fontFamily: fontSans,
                        fontSize: T.caption,
                        fontWeight: active ? 600 : 500,
                        cursor: "pointer",
                        transition: "all 0.15s",
                        letterSpacing: "0.1px",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            }
          />
          <div
            style={{
              padding: "8px 12px",
              borderBottom: border.line,
              background: surface.card,
              flexShrink: 0,
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <DataSourcesPopover compact />
            {tab !== "companies" && tab !== "network" && (
              <button
                onClick={() => { setShowAddPanel((p) => !p); setShowCsvPanel(false); }}
                style={{
                  padding: "8px 16px",
                  background: color.forest,
                  color: color.gold,
                  border: border.lineStrong,
                  borderRadius: 0,
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  fontWeight: 600,
                  cursor: "pointer",
                  letterSpacing: "0.2px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <PlusIcon /> Add job
              </button>
            )}
            {tab === "pipeline" && (
              <button
                onClick={() => { setShowCsvPanel((p) => !p); setShowAddPanel(false); }}
                style={{
                  padding: "8px 16px",
                  background: showCsvPanel ? color.forest : surface.card,
                  color: showCsvPanel ? color.gold : color.forest,
                  border: border.lineStrong,
                  borderRadius: 0,
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  fontWeight: 600,
                  cursor: "pointer",
                  letterSpacing: "0.2px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <UploadIcon /> Upload CSV
              </button>
            )}
          </div>
        </>
      ) : (
        <div
          style={{
            padding: "12px 28px",
            borderBottom: border.line,
            background: surface.card,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 0 }}>
            {([
              ["pipeline", "Open Roles"],
              ["network", "Network"],
              ["companies", "Companies"],
            ] as [OppTab, string][]).map(([id, label]) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  style={{
                    padding: "7px 18px",
                    border: "none",
                    borderBottom: active ? "2px solid #1A3A2F" : "2px solid transparent",
                    background: "transparent",
                    color: active ? color.forest : color.muted,
                    fontFamily: fontSans,
                    fontSize: T.caption,
                    fontWeight: active ? 600 : 500,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    letterSpacing: "0.1px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <DataSourcesPopover compact />
            {tab !== "companies" && tab !== "network" && (
              <button
                onClick={() => { setShowAddPanel((p) => !p); setShowCsvPanel(false); }}
                style={{
                  padding: "8px 16px",
                  background: color.forest,
                  color: color.gold,
                  border: border.lineStrong,
                  borderRadius: 0,
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  fontWeight: 600,
                  cursor: "pointer",
                  letterSpacing: "0.2px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <PlusIcon /> Add job
              </button>
            )}
            {tab === "pipeline" && (
              <button
                onClick={() => { setShowCsvPanel((p) => !p); setShowAddPanel(false); }}
                style={{
                  padding: "8px 16px",
                  background: showCsvPanel ? color.forest : surface.card,
                  color: showCsvPanel ? color.gold : color.forest,
                  border: border.lineStrong,
                  borderRadius: 0,
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  fontWeight: 600,
                  cursor: "pointer",
                  letterSpacing: "0.2px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <UploadIcon /> Upload CSV
              </button>
            )}
          </div>
        </div>
      )}

      {/* URL paste panel — renders in Pipeline tab (DiscoverTab has its own inline panel) */}
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

      {/* CSV upload panel — only in Pipeline */}
      {showCsvPanel && tab === "pipeline" && (
        <CsvUploadPanel
          loading={csvLoading}
          progress={csvProgress}
          onFileSelected={onCsvFileSelected}
          onClose={() => setShowCsvPanel(false)}
          inputRef={csvInputRef}
        />
      )}

      {/* Content area */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {tab === "companies" && (
          <WorkspaceCompanies
            onOpenProspectJob={openProspectJob}
            selectedCompanyId={loc.companyId ?? null}
            onCompanySelect={(id) => router.push(companiesUrl(id))}
          />
        )}
        {tab === "network" && (
          <PipelineNetworkSection
            onOpenJob={openNetworkJob}
            onSaveJob={addNetworkJobToPipeline}
          />
        )}
        {tab === "pipeline" && (
          <PipelineTab
            cards={kanbanCards}
            onOpenDrawer={openDrawer}
            onChangeStage={changeStage}
            onOpenRecommended={openRecommendedJob}
            onSaveRecommended={saveRecommendedJob}
            actingUserId={actingUserId}
          />
        )}
      </div>

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
              prev.map((c) => c.id === card.id ? { ...c, ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [`_${k}`, v ?? undefined])) } : c)
            )}
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
            if (ext._dbId) router.push(pipelineJobUrl(ext._dbId));
            else setDrawerCardId(existingNetworkPipelineCard.id);
          } : undefined}
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
    <div
      style={{
        padding: "16px clamp(16px, 4vw, 28px)",
        background: surface.card,
        borderBottom: border.line,
        animation: "fadeIn 0.2s ease both",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color: "#1A1A1A" }}>
          Upload CSV — bulk add jobs
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
              Kimchi is analyzing {progress.done} of {progress.total} URLs…
            </p>
          </div>
          <div style={{ height: 4, background: "rgba(0,0,0,0.08)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "#1A3A2F", borderRadius: 2, transition: "width 0.3s ease" }} />
          </div>
        </div>
      ) : (
        <>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 400, color: color.stone, lineHeight: 1.55, marginBottom: 10, maxWidth: 520 }}>
            Upload a CSV file with job URLs. One URL per line, or columns: <code style={{ fontFamily: fontMono, fontSize: T.label, background: "rgba(0,0,0,0.05)", padding: "1px 5px", borderRadius: 3 }}>url,company,role</code>
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
    </div>
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
    <div
      style={{
        padding: "16px clamp(16px, 4vw, 28px)",
        background: surface.card,
        borderBottom: border.line,
        animation: "fadeIn 0.2s ease both",
      }}
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
            borderRadius: 0,
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
            background: color.forest,
            color: color.gold,
            border: border.lineStrong,
            borderRadius: 0,
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
        <div style={{ marginTop: 12 }}>
          <KimchiProcessLoader preset="jobParse" variant="inline" />
        </div>
      )}
      {error && !loading && (
        <div style={{ padding: "8px 12px", background: "rgba(196,87,74,0.06)", borderRadius: 0, border: "1px solid rgba(196,87,74,0.15)", maxWidth: 560 }}>
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
                  <span style={{ padding: "2px 8px", background: "rgba(0,0,0,0.05)", borderRadius: 0, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
                    📍 {analysis.location}
                  </span>
                )}
                {typeof analysis.salary === "string" && analysis.salary && (
                  <span style={{ padding: "2px 8px", background: "rgba(26,58,47,0.08)", borderRadius: 0, fontFamily: fontSans, fontSize: T.caption, fontWeight: 500, color: "#2D6B4A" }}>
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
              background: color.forest,
              color: color.gold,
              border: border.lineStrong,
              borderRadius: 0,
              fontFamily: fontSans,
              fontSize: T.caption,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Add to My Jobs
          </button>
        </ScoutBox>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Pipeline tab — Citebound-style list with summary + filter boxes
   ────────────────────────────────────────────────────────────── */

function PipelineStatBar({
  label,
  pct,
  highlight,
  count,
  active,
  onClick,
}: {
  label: string;
  pct: number;
  highlight?: boolean;
  count: number;
  active?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <ScoutLabel>{label}</ScoutLabel>
        <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.stone }}>
          {count > 0 ? count : `${pct}%`}
        </span>
      </div>
      <div style={{ height: 3, background: "rgba(17,17,17,0.08)", position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            background: highlight || active ? color.forest : color.ink,
          }}
        />
      </div>
    </>
  );

  if (!onClick) {
    return <div style={{ marginBottom: 10 }}>{inner}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        marginBottom: 10,
        padding: "8px 10px",
        marginLeft: -10,
        marginRight: -10,
        border: active ? border.lineStrong : "1px solid transparent",
        background: active ? "rgba(26,58,47,0.06)" : "transparent",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {inner}
    </button>
  );
}

type PipelineView = "recommended" | KanbanStage;

interface PipelineTabProps {
  cards: KanbanCard[];
  onOpenDrawer: (id: number) => void;
  onChangeStage: (id: number, stage: KanbanStage) => void;
  onOpenRecommended: (job: VectorMatchedJob) => void;
  onSaveRecommended: (job: VectorMatchedJob) => Promise<void>;
  actingUserId?: string | null;
}

function PipelineTab({
  cards,
  onOpenDrawer,
  onChangeStage,
  onOpenRecommended,
  onSaveRecommended,
  actingUserId,
}: PipelineTabProps) {
  const isMobile = useIsMobile();
  const [wideLayout, setWideLayout] = useState(false);
  const [pipelineView, setPipelineView] = useState<PipelineView>("recommended");
  const [locationPrefs, setLocationPrefs] = useState<RecommendationPreferencesState | null>(null);
  const [preferencesRefreshKey, setPreferencesRefreshKey] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 960px)");
    const update = () => setWideLayout(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const stageOrder: KanbanStage[] = ["saved", "applied", "interview", "offer"];
  const closedCount = cards.filter((c) => c.stage === "closed").length;
  const activeCount = cards.filter((c) => c.stage !== "closed").length;
  const stageCounts = stageOrder.map((s) => ({ stage: s, count: cards.filter((c) => c.stage === s).length }));
  const maxCount = Math.max(1, ...stageCounts.map((s) => s.count), closedCount);

  const handlePreferencesLoaded = useCallback((prefs: RecommendationPreferencesState) => {
    setLocationPrefs(prefs);
  }, []);

  const handlePreferencesApplied = (prefs: RecommendationPreferencesState) => {
    setLocationPrefs(prefs);
    setPreferencesRefreshKey((k) => k + 1);
    setPipelineView("recommended");
  };

  return (
    <div style={{ padding: isMobile ? "20px 16px 32px" : "32px 36px 48px" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ width: 8, height: 8, background: color.forest, display: "inline-block", flexShrink: 0 }} />
          <ScoutLabel>Recommended roles</ScoutLabel>
        </div>
        <ScoutDisplayTitle size={isMobile ? 28 : 36} style={{ marginBottom: 10 }}>
          Discover your next role
        </ScoutDisplayTitle>
        <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.muted, maxWidth: 560, lineHeight: 1.6, margin: 0 }}>
          Personalized matches from Hirebase — save any role to track it in your pipeline ({activeCount} active).
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: wideLayout ? "minmax(260px, 1fr) minmax(280px, 1fr)" : "1fr",
          gap: 20,
          marginBottom: 28,
          alignItems: "stretch",
        }}
      >
        <ScoutBox stack padding={22}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
            <ScoutLabel>Your pipeline</ScoutLabel>
            <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.forest }}>
              {activeCount} active
            </span>
          </div>

          <button
            type="button"
            onClick={() => setPipelineView("recommended")}
            style={{
              display: "block",
              width: "100%",
              padding: "10px 10px",
              marginBottom: 12,
              marginLeft: -10,
              border: pipelineView === "recommended" ? border.lineStrong : border.line,
              background: pipelineView === "recommended" ? "rgba(26,58,47,0.08)" : surface.inset,
              cursor: "pointer",
              textAlign: "left",
              fontFamily: fontSans,
              fontSize: T.bodySm,
              fontWeight: pipelineView === "recommended" ? 600 : 500,
              color: pipelineView === "recommended" ? color.forest : color.ink,
            }}
          >
            Recommendations
          </button>

          {stageCounts.map(({ stage, count }, i) => (
            <PipelineStatBar
              key={stage}
              label={STAGE_LABELS[stage]}
              count={count}
              pct={Math.round((count / maxCount) * 100)}
              highlight={i === 0 && count > 0}
              active={pipelineView === stage}
              onClick={() => setPipelineView(stage)}
            />
          ))}
          {closedCount > 0 && (
            <PipelineStatBar
              label={STAGE_LABELS.closed}
              count={closedCount}
              pct={Math.round((closedCount / maxCount) * 100)}
              active={pipelineView === "closed"}
              onClick={() => setPipelineView("closed")}
            />
          )}
        </ScoutBox>

        <PipelinePreferencesPanel
          actingUserId={actingUserId}
          onLoaded={handlePreferencesLoaded}
          onApplied={handlePreferencesApplied}
        />
      </div>

      {pipelineView === "recommended" ? (
        <PipelineRecommendedSection
          pipelineCards={cards}
          onOpenJob={onOpenRecommended}
          onSaveJob={onSaveRecommended}
          actingUserId={actingUserId}
          locationPrefs={locationPrefs}
          preferencesRefreshKey={preferencesRefreshKey}
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




