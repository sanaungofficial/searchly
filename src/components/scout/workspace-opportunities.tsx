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
  KANBAN_STAGES,
  STAGE_LABELS,
  STAGE_COLORS,
  type KanbanCard,
  type KanbanStage,
} from "./workspace-data";
import { PlusIcon, UploadIcon } from "./workspace-icons";
import { DataSourcesPopover } from "./data-sources-popover";
import { PipelineRecommendedSection, buildRecommendedProspectCard } from "./pipeline-recommended-section";
import { PipelineNetworkSection } from "./pipeline-network-section";
import type { VectorMatchedJob } from "@/lib/vector-matched-job";
import type { NetworkJobListing } from "@/lib/network-job-display";
import { buildNetworkProspectCard } from "@/lib/network-job-display";
import { WorkspaceCompanies } from "./workspace-companies";
import { JobDrawer, type DrawerTool } from "./job-drawer";
import { CompanyLogo } from "./company-logo";
import { ScoutBox, ScoutDisplayTitle, ScoutLabel, ScoutPrimaryBtn } from "./scout-box";
import { fontSans, fontMono, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";

export type { DrawerTool };

type OppTab = "pipeline" | "network" | "companies";
export type PipelineFilter = "all" | "recommended" | KanbanStage;

// Props now sourced from WorkspaceContext
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface OpportunitiesProps {}

export function WorkspaceOpportunities() {
  const { kanbanCards, setKanbanCards, addJob, updateStage, removeJob, drawerCardId, setDrawerCardId, drawerTool, setDrawerTool } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSubtab: OppTab =
    pathname === "/opportunities/companies"
      ? "companies"
      : pathname === "/opportunities/network"
        ? "network"
        : "pipeline";
  const setSubtab = (t: OppTab) => { router.push(`/opportunities/${t}`); };
  const tab = activeSubtab;
  const setTab = setSubtab;
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addJobUrl, setAddJobUrl] = useState("");
  const [addJobLoading, setAddJobLoading] = useState(false);
  const [jobAnalysis, setJobAnalysis] = useState<Record<string, unknown> | null>(null);
  const [addJobError, setAddJobError] = useState<string | null>(null);

  useEffect(() => {
    const openAdd = searchParams.get("addJob") === "1";
    const jobId = searchParams.get("job");
    const tool = searchParams.get("tool");

    if (openAdd) {
      setShowAddPanel(true);
    }

    if (jobId) {
      const card = kanbanCards.find((c) => {
        const ext = c as KanbanCard & { _dbId?: string };
        return ext._dbId === jobId;
      });
      if (card) {
        setDrawerCardId(card.id);
        if (tool === "resume" || tool === "cover" || tool === "fit") {
          setDrawerTool(tool);
        }
        router.replace("/opportunities/pipeline");
        return;
      }
    }

    if (openAdd && !jobId) {
      router.replace("/opportunities/pipeline");
    }
  }, [searchParams, kanbanCards, router, setDrawerCardId, setDrawerTool]);

  // CSV upload state
  const [showCsvPanel, setShowCsvPanel] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvProgress, setCsvProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Pipeline flat-list filter
  const [pipelineFilter, setPipelineFilter] = useState<PipelineFilter>("all");
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

  const openDrawer = (cardId: number) => {
    setDrawerCardId(cardId);
    setDrawerTool(null);
  };
  const closeDrawer = () => {
    setDrawerCardId(null);
    setDrawerTool(null);
  };

  const closeProspectDrawer = () => {
    setProspectJob(null);
    setProspectCard(null);
    setAddingProspect(false);
    setProspectDetailLoading(false);
  };

  const openRecommendedJob = useCallback(async (job: VectorMatchedJob) => {
    const drawerId = -Math.abs(Date.now() % 1_000_000);
    setProspectJob({ companyName: job.companyName, job, drawerId });
    setProspectCard(buildRecommendedProspectCard(job, drawerId));
    setProspectDetailLoading(Boolean(job.hirebaseId));

    try {
      const res = await fetch("/api/companies/prospect-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job }),
      });
      const data = await res.json().catch(() => ({})) as { job?: typeof job };
      if (res.ok && data.job) {
        const enriched = { ...job, ...data.job, companyName: job.companyName, matchScore: job.matchScore, matchLabel: job.matchLabel, matchReasons: job.matchReasons, matchedSkills: job.matchedSkills, gapSkills: job.gapSkills, vectorRank: job.vectorRank };
        setProspectJob((prev) => (prev ? { ...prev, job: enriched } : null));
        setProspectCard(buildRecommendedProspectCard(enriched, drawerId));
      }
    } catch {
      // Drawer still opens with vector match data.
    } finally {
      setProspectDetailLoading(false);
    }
  }, []);

  const saveRecommendedJob = useCallback(async (job: VectorMatchedJob) => {
    const meta = buildRecommendedProspectCard(job, 0)._meta;
    const created = await addJob(job.companyName, job.title, job.url ?? undefined, meta);
    if (created) {
      setPipelineFilter("saved");
      setDrawerCardId(created.cardId);
    }
  }, [addJob]);

  const openProspectJob = useCallback(async (companyName: string, job: CachedJob) => {
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
  }, []);

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
      closeProspectDrawer();
      if (created) {
        setDrawerCardId(created.cardId);
        setTab("pipeline");
      }
    } finally {
      setAddingProspect(false);
    }
  };

  const openProspectInPipeline = () => {
    if (!existingProspectPipelineCard) return;
    closeProspectDrawer();
    setDrawerCardId(existingProspectPipelineCard.id);
    setTab("pipeline");
  };

  const closeNetworkDrawer = () => {
    setNetworkProspectJob(null);
    setNetworkProspectCard(null);
    setAddingNetworkJob(false);
  };

  const openNetworkJob = useCallback((job: NetworkJobListing) => {
    const drawerId = -Math.abs(Date.now() % 1_000_000);
    setNetworkProspectJob(job);
    setNetworkProspectCard(buildNetworkProspectCard(job, drawerId));
  }, []);

  const addNetworkJobToPipeline = async (job: NetworkJobListing = networkProspectJob!) => {
    if (!job) return;
    setAddingNetworkJob(true);
    try {
      const card = buildNetworkProspectCard(job, 0);
      const meta = card._meta;
      const created = await addJob(
        job.companyName ?? job.recruiter?.agencyName ?? "Confidential employer",
        job.positionTitle,
        job.topEchelonUrl ?? undefined,
        meta
      );
      closeNetworkDrawer();
      if (created) {
        setDrawerCardId(created.cardId);
        setTab("pipeline");
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
            ["pipeline", "Pipeline"],
            ["network", "In-Network"],
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
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <DataSourcesPopover compact />
          {tab !== "companies" && tab !== "network" && <button
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
          </button>}
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
        {tab === "companies" && <WorkspaceCompanies onOpenProspectJob={openProspectJob} />}
        {tab === "network" && (
          <PipelineNetworkSection
            onOpenJob={openNetworkJob}
            onSaveJob={addNetworkJobToPipeline}
          />
        )}
        {tab === "pipeline" && (
          <PipelineTab
            cards={kanbanCards}
            filter={pipelineFilter}
            setFilter={setPipelineFilter}
            onChangeStage={changeStage}
            onOpenDrawer={openDrawer}
            onOpenRecommended={openRecommendedJob}
            onSaveRecommended={saveRecommendedJob}
            drawerCard={drawerCardId !== null ? kanbanCards.find((c) => c.id === drawerCardId) || null : null}
            closeDrawer={closeDrawer}
            moveCard={moveCard}
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
            onToolChange={setDrawerTool}
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
            closeNetworkDrawer();
            setDrawerCardId(existingNetworkPipelineCard.id);
            setTab("pipeline");
          } : undefined}
        />
      )}
    </div>
  );
}


/* ──────────────────────────────────────────────────────────────
   Helpers: CSV parser, StatusDropdown, CsvUploadPanel, MyJobsUrlPastePanel
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

/* ── StatusDropdown — colored stage selector used in My Jobs + Pipeline cards ── */
function StatusDropdown({
  stage,
  onChange,
  size = "normal",
}: {
  stage: KanbanStage;
  onChange: (s: KanbanStage) => void;
  size?: "small" | "normal";
}) {
  const [open, setOpen] = useState(false);
  const stageColor = STAGE_COLORS[stage];
  const isSmall = size === "small";
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        style={{
          padding: isSmall ? "4px 10px" : "6px 14px",
          background: surface.card,
          border: border.line,
          borderRadius: 0,
          fontFamily: fontSans,
          fontSize: isSmall ? T.label : T.caption,
          fontWeight: 600,
          color: stageColor,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: stageColor, flexShrink: 0 }} />
        {STAGE_LABELS[stage]} ▾
      </button>
      {open && (
        <>
          <div onClick={(e) => { e.stopPropagation(); setOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 99 }} />
          <div
            style={{
              position: "absolute",
              top: "100%",
              right: 0,
              marginTop: 4,
              background: surface.card,
              border: border.line,
              boxShadow: "3px 3px 0 rgba(17,17,17,0.06)",
              zIndex: 100,
              minWidth: 150,
              overflow: "hidden",
            }}
          >
            {KANBAN_STAGES.map((s) => (
              <button
                key={s}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(s);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  padding: "8px 14px",
                  background: s === stage ? `${STAGE_COLORS[s]}10` : "transparent",
                  border: "none",
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  fontWeight: s === stage ? 600 : 500,
                  color: s === stage ? STAGE_COLORS[s] : "#2A2218",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: STAGE_COLORS[s], flexShrink: 0 }} />
                {STAGE_LABELS[s]}
                {s === stage && <span style={{ marginLeft: "auto", color: STAGE_COLORS[s] }}>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
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
        padding: "16px 28px",
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
        padding: "16px 28px",
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
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
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
          style={{
            padding: "9px 18px",
            background: color.forest,
            color: color.gold,
            border: border.lineStrong,
            borderRadius: 0,
            fontFamily: fontSans,
            fontSize: T.caption,
            fontWeight: 600,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Search →
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#1A3A2F", animation: "pulse 1s ease infinite", flexShrink: 0 }} />
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.forest }}>Kimchi is analyzing this listing…</p>
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

function getFeaturedJobId(cards: KanbanCard[]): number | null {
  const withNext = cards.find((c) => (c as KanbanCard & { _meta?: JobMeta })._meta?.nextStep);
  if (withNext) return withNext.id;
  const interviewing = cards.find((c) => c.stage === "interview");
  if (interviewing) return interviewing.id;
  return cards[0]?.id ?? null;
}

function PipelineStatBar({ label, pct, highlight }: { label: string; pct: number; highlight?: boolean }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <ScoutLabel>{label}</ScoutLabel>
        <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.stone }}>{pct}%</span>
      </div>
      <div style={{ height: 3, background: "rgba(17,17,17,0.08)", position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            background: highlight ? color.forest : color.ink,
          }}
        />
      </div>
    </div>
  );
}

interface PipelineTabProps {
  cards: KanbanCard[];
  filter: PipelineFilter;
  setFilter: (f: PipelineFilter) => void;
  onChangeStage: (id: number, stage: KanbanStage) => void;
  onOpenDrawer: (id: number) => void;
  onOpenRecommended: (job: VectorMatchedJob) => void;
  onSaveRecommended: (job: VectorMatchedJob) => Promise<void>;
  drawerCard: KanbanCard | null;
  closeDrawer: () => void;
  moveCard: (id: number, stage: KanbanStage) => void;
}

function PipelineTab({
  cards,
  filter,
  setFilter,
  onChangeStage,
  onOpenDrawer,
  onOpenRecommended,
  onSaveRecommended,
}: PipelineTabProps) {
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [wideLayout, setWideLayout] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 960px)");
    const update = () => setWideLayout(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const visibleCards = filter === "all" || filter === "recommended" ? cards : cards.filter((c) => c.stage === filter);
  const stageOrder: KanbanStage[] = ["saved", "applied", "interview", "offer", "closed"];
  const sortedCards = [...visibleCards].sort((a, b) => stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage));
  const featuredId = getFeaturedJobId(sortedCards);

  const filterChips: [PipelineFilter, string][] = [
    ["all", "All"],
    ["recommended", "Recommended"],
    ["saved", "Saved"],
    ["applied", "Applied"],
    ["interview", "Interviewing"],
    ["offer", "Offer"],
    ["closed", "Closed"],
  ];

  const activeCount = cards.filter((c) => c.stage !== "closed").length;
  const stageCounts = stageOrder
    .filter((s) => s !== "closed")
    .map((s) => ({ stage: s, count: cards.filter((c) => c.stage === s).length }));
  const maxCount = Math.max(1, ...stageCounts.map((s) => s.count));

  return (
    <div style={{ padding: "32px 36px 48px" }}>
      {/* Editorial header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ width: 8, height: 8, background: color.forest, display: "inline-block", flexShrink: 0 }} />
          <ScoutLabel>Job search pipeline</ScoutLabel>
        </div>
        <ScoutDisplayTitle size={36} style={{ marginBottom: 10 }}>
          Track every role in one place
        </ScoutDisplayTitle>
        <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.muted, maxWidth: 520, lineHeight: 1.6, margin: 0 }}>
          Add roles from job URLs, track stage and next steps, and open any listing for match tools.
        </p>
      </div>

      {/* Summary + filter (desktop sidebar) or summary only + mobile chips */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: wideLayout ? "1fr 220px" : "1fr",
          gap: 20,
          marginBottom: 28,
        }}
      >
        <ScoutBox stack padding={22}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
            <ScoutLabel>Pipeline summary</ScoutLabel>
            <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.forest }}>
              {activeCount} active
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 20 }}>
            <span style={displayTitleStyle(48, { lineHeight: 1 })}>
              {activeCount}
            </span>
            <span style={displayTitleStyle(22, { color: color.muted, lineHeight: 1.1 })}>/ roles</span>
          </div>
          {stageCounts.map(({ stage, count }, i) => (
            <PipelineStatBar
              key={stage}
              label={STAGE_LABELS[stage]}
              pct={Math.round((count / maxCount) * 100)}
              highlight={i === 0 && count > 0}
            />
          ))}
        </ScoutBox>

        {wideLayout && (
          <ScoutBox padding={0}>
            <div style={{ padding: "14px 18px", borderBottom: border.line, background: surface.inset }}>
              <ScoutLabel>Filter</ScoutLabel>
            </div>
            {filterChips.map(([id, label], i) => {
              const active = filter === id;
              const count = id === "all" ? cards.length : id === "recommended" ? null : cards.filter((c) => c.stage === id).length;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "11px 18px",
                    border: "none",
                    borderBottom: i < filterChips.length - 1 ? border.line : "none",
                    fontFamily: fontSans,
                    fontSize: T.bodySm,
                    fontWeight: active ? 600 : 500,
                    color: active ? color.ink : color.muted,
                    background: active ? surface.inset : surface.card,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {label}
                  {count != null && (
                    <span style={{ fontFamily: fontMono, fontSize: T.label, opacity: 0.7, marginLeft: 6 }}>{count}</span>
                  )}
                </button>
              );
            })}
          </ScoutBox>
        )}
      </div>

      {/* Mobile / narrow filter chips + view toggle */}
      {!wideLayout && filter !== "recommended" && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
            {filterChips.map(([id, label]) => {
              const active = filter === id;
              const count = id === "all" ? cards.length : id === "recommended" ? null : cards.filter((c) => c.stage === id).length;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  style={{
                    padding: "6px 12px",
                    color: active ? color.forest : color.muted,
                    border: active ? border.lineStrong : border.line,
                    borderRadius: 0,
                    background: active ? surface.card : "transparent",
                    fontFamily: fontSans,
                    fontSize: T.caption,
                    fontWeight: active ? 600 : 500,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  {label}
                  {count != null && (
                    <span style={{ fontFamily: fontMono, fontSize: T.label, opacity: 0.7 }}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", border: border.line, flexShrink: 0 }}>
            {(["list", "kanban"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                title={mode === "list" ? "List view" : "Board view"}
                style={{
                  padding: "6px 10px",
                  background: viewMode === mode ? color.forest : surface.card,
                  color: viewMode === mode ? color.gold : color.muted,
                  border: "none",
                  borderLeft: mode === "kanban" ? border.line : "none",
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                {mode === "list" ? "☰" : "⊞"}
              </button>
            ))}
          </div>
        </div>
      )}

      {wideLayout && filter !== "recommended" && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <ScoutLabel>Open roles</ScoutLabel>
          <div style={{ display: "flex", border: border.line }}>
            {(["list", "kanban"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                title={mode === "list" ? "List view" : "Board view"}
                style={{
                  padding: "6px 10px",
                  background: viewMode === mode ? color.forest : surface.card,
                  color: viewMode === mode ? color.gold : color.muted,
                  border: "none",
                  borderLeft: mode === "kanban" ? border.line : "none",
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                {mode === "list" ? "List" : "Board"}
              </button>
            ))}
          </div>
        </div>
      )}

      {filter === "recommended" ? (
        <PipelineRecommendedSection
          pipelineCards={cards}
          onOpenJob={onOpenRecommended}
          onSaveJob={onSaveRecommended}
        />
      ) : cards.length === 0 ? (
        <ScoutBox style={{ padding: 60, textAlign: "center" }}>
          <p style={{ color: color.mutedLight, fontFamily: fontSans, fontSize: T.bodySm, margin: 0 }}>
            No jobs yet. Click &quot;Add job&quot; above to paste a URL, or &quot;Upload CSV&quot; to bulk-add jobs.
          </p>
        </ScoutBox>
      ) : sortedCards.length === 0 ? (
        <ScoutBox style={{ padding: 48, textAlign: "center" }}>
          <p style={{ color: color.mutedLight, fontFamily: fontSans, fontSize: T.bodySm, margin: 0 }}>
            No jobs match this filter.
          </p>
        </ScoutBox>
      ) : viewMode === "kanban" ? (
        /* ── Kanban board ── */
        <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 20, alignItems: "flex-start" }}>
          {stageOrder.map((stage) => {
            const colCards = cards.filter((c) => c.stage === stage);
            const stageColor = STAGE_COLORS[stage];
            return (
              <div key={stage} style={{ minWidth: 210, maxWidth: 210, flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, padding: "0 2px" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: stageColor, flexShrink: 0 }} />
                  <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: stageColor }}>{STAGE_LABELS[stage]}</span>
                  <span style={{ fontFamily: fontMono, fontSize: T.label, color: color.mutedLight, marginLeft: "auto" }}>{colCards.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {colCards.map((c) => {
                    const meta = (c as KanbanCard & { _meta?: JobMeta })._meta;
                    const url = (c as KanbanCard & { _url?: string })._url ?? null;
                    const nextStepDue = meta?.nextStepDue;
                    const isOverdue = nextStepDue ? new Date(nextStepDue) < new Date() : false;
                    return (
                      <div key={c.id} onClick={() => onOpenDrawer(c.id)} style={{ cursor: "pointer" }}>
                        <ScoutBox padding="12px 14px" style={{ borderTop: `2px solid ${stageColor}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <CompanyLogo name={c.company} website={url} size={28} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.role}</p>
                            <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.company}</p>
                          </div>
                        </div>
                        {meta?.location && (
                          <span style={{ display: "inline-block", padding: "2px 8px", background: "rgba(0,0,0,0.05)", borderRadius: 0, fontFamily: fontSans, fontSize: T.label, color: color.stone, marginBottom: meta?.salary ? 3 : 0 }}>
                            📍 {meta.location}
                          </span>
                        )}
                        {meta?.nextStep && (
                          <div style={{ marginTop: 6, padding: "4px 7px", background: isOverdue ? "rgba(196,87,74,0.07)" : "rgba(26,58,47,0.05)", borderRadius: 0, borderLeft: `2px solid ${isOverdue ? "#C4574A" : "#1A3A2F"}` }}>
                            <p style={{ fontFamily: fontSans, fontSize: T.label, color: isOverdue ? "#C4574A" : "#1A3A2F", fontWeight: 500 }}>
                              {isOverdue ? "⚠ " : "→ "}{meta.nextStep}
                            </p>
                          </div>
                        )}
                        </ScoutBox>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── List view ── */
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sortedCards.map((c) => {
            const meta = (c as KanbanCard & { _meta?: JobMeta })._meta;
            const url = (c as KanbanCard & { _url?: string })._url ?? null;
            const nextStepDue = meta?.nextStepDue;
            const isOverdue = nextStepDue ? new Date(nextStepDue) < new Date() : false;
            const isFeatured = c.id === featuredId;
            return (
              <ScoutBox key={c.id} stack={isFeatured} padding={18}>
                <div
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}
                >
                  <div
                    style={{ display: "flex", alignItems: "start", gap: 16, flex: 1, minWidth: 0, cursor: "pointer" }}
                    onClick={() => onOpenDrawer(c.id)}
                  >
                    <CompanyLogo name={c.company} website={url} size={40} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={displayTitleStyle(T.heading, { margin: "0 0 4px", lineHeight: 1.15 })}>
                        {c.role}
                      </p>
                      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 8px" }}>
                        {c.company} · {c.days === 0 ? "Today" : `${c.days}d ago`}
                      </p>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: meta?.nextStep ? 8 : 0 }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            border: border.line,
                            fontFamily: fontSans,
                            fontSize: T.label,
                            fontWeight: 600,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: color.stone,
                          }}
                        >
                          {STAGE_LABELS[c.stage]}
                        </span>
                        {meta?.location && (
                          <span style={{ padding: "2px 8px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
                            {meta.location}
                          </span>
                        )}
                        {meta?.salary && (
                          <span style={{ padding: "2px 8px", border: border.line, fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.forest }}>
                            {meta.salary}
                          </span>
                        )}
                      </div>
                      {meta?.nextStep && (
                        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: isOverdue ? "#C4574A" : color.stone, margin: 0, fontWeight: 500 }}>
                          {isOverdue ? "⚠ " : "Next · "}{meta.nextStep}
                          {meta.nextStepDue ? ` · ${meta.nextStepDue}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <StatusDropdown stage={c.stage} onChange={(s) => { onChangeStage(c.id, s); }} />
                </div>
              </ScoutBox>
            );
          })}
        </div>
      )}
    </div>
  );
}




