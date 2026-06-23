"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import type { JobMeta } from "@/lib/job-meta";
import { parsedJobToMeta } from "@/lib/job-meta";
import {
  KANBAN_STAGES,
  STAGE_LABELS,
  STAGE_COLORS,
  type KanbanCard,
  type KanbanStage,
} from "./workspace-data";
import { PlusIcon, UploadIcon } from "./workspace-icons";
import { WorkspaceCompanies } from "./workspace-companies";
import { JobDrawer, type DrawerTool } from "./job-drawer";
import { CompanyLogo } from "./company-logo";
import { fontSans, fontMono, color, type as T } from "@/lib/typography";

export type { DrawerTool };

type OppTab = "pipeline" | "companies";

// Props now sourced from WorkspaceContext
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface OpportunitiesProps {}

export function WorkspaceOpportunities() {
  const { kanbanCards, setKanbanCards, addJob, updateStage, removeJob, drawerCardId, setDrawerCardId, drawerTool, setDrawerTool } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSubtab: OppTab = pathname === "/opportunities/companies" ? "companies" : "pipeline";
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
  const [pipelineFilter, setPipelineFilter] = useState<"all" | KanbanStage>("all");

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

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#F7F5F2",
        animation: "fadeIn 0.3s ease both",
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          padding: "12px 28px",
          borderBottom: "1px solid rgba(0,0,0,0.07)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 0 }}>
          {([
            ["pipeline", "Pipeline"],
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
          {tab !== "companies" && <button
            onClick={() => { setShowAddPanel((p) => !p); setShowCsvPanel(false); }}
            style={{
              padding: "7px 16px",
              background: "#1A3A2F",
              color: "#E8D5A3",
              border: "none",
              borderRadius: 5,
              fontFamily: fontSans,
              fontSize: T.caption,
              fontWeight: 500,
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
                padding: "7px 16px",
                background: showCsvPanel ? "#1A3A2F" : "transparent",
                color: showCsvPanel ? "#E8D5A3" : "#1A3A2F",
                border: "1px solid rgba(26,58,47,0.2)",
                borderRadius: 5,
                fontFamily: fontSans,
                fontSize: T.caption,
                fontWeight: 500,
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
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {tab === "companies" && <WorkspaceCompanies />}
        {tab === "pipeline" && (
          <PipelineTab
            cards={kanbanCards}
            filter={pipelineFilter}
            setFilter={setPipelineFilter}
            onChangeStage={changeStage}
            onOpenDrawer={openDrawer}
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
          background: `${stageColor}18`,
          border: `1px solid ${stageColor}40`,
          borderRadius: 5,
          fontFamily: "var(--font-ui)",
          fontSize: isSmall ? 10 : 11,
          fontWeight: 500,
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
              background: "#FFFFFF",
              borderRadius: 6,
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              border: "1px solid rgba(0,0,0,0.08)",
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
        padding: "14px 28px",
        background: "rgba(26,58,47,0.04)",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
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
            <button
              onClick={() => inputRef.current?.click()}
              style={{
                padding: "8px 16px",
                background: "#1A3A2F",
                color: "#E8D5A3",
                border: "none",
                borderRadius: 5,
                fontFamily: "var(--font-ui)",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <UploadIcon /> Choose file
            </button>
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
          <div
            style={{
              marginTop: 12,
              padding: "10px 14px",
              background: "#FFFFFF",
              borderRadius: 5,
              border: "1px solid rgba(0,0,0,0.06)",
              maxWidth: 520,
            }}
          >
            <p style={{ fontFamily: fontMono, fontSize: T.label, color: color.mutedLight, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
              Example CSV
            </p>
            <pre style={{ fontFamily: fontMono, fontSize: T.label, color: color.stone, lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
{`url,company,role
https://stripe.com/jobs/...,Stripe,Senior PM
https://linear.app/careers/...,Linear,Product Lead
https://figma.com/careers/...,Figma,Design Systems PM`}
            </pre>
          </div>
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
        padding: "12px 28px",
        background: "rgba(26,58,47,0.04)",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
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
            border: "1px solid rgba(26,58,47,0.2)",
            borderRadius: 6,
            background: "#FFFFFF",
            fontFamily: "var(--font-ui)",
            fontSize: 12,
            color: "#1A1A1A",
            minWidth: 0,
          }}
        />
        <button
          onClick={onSubmit}
          style={{
            padding: "9px 18px",
            background: "#1A3A2F",
            color: "#E8D5A3",
            border: "none",
            borderRadius: 6,
            fontFamily: "var(--font-ui)",
            fontSize: 12,
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
        <div style={{ padding: "8px 12px", background: "rgba(196,87,74,0.06)", borderRadius: 6, border: "1px solid rgba(196,87,74,0.15)", maxWidth: 560 }}>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "#C4574A" }}>{error}</p>
        </div>
      )}
      {analysis && !loading && (
        <div
          style={{
            maxWidth: 640,
            background: "#FFFFFF",
            borderRadius: 8,
            padding: "14px 16px",
            border: "1px solid rgba(0,0,0,0.06)",
            animation: "fadeIn 0.3s ease both",
          }}
        >
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
                  <span style={{ padding: "2px 8px", background: "rgba(0,0,0,0.05)", borderRadius: 100, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
                    📍 {analysis.location}
                  </span>
                )}
                {typeof analysis.salary === "string" && analysis.salary && (
                  <span style={{ padding: "2px 8px", background: "rgba(74,139,106,0.1)", borderRadius: 100, fontFamily: fontSans, fontSize: T.caption, fontWeight: 500, color: "#2D6B4A" }}>
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
              background: "#1A3A2F",
              color: "#E8D5A3",
              border: "none",
              borderRadius: 5,
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Add to My Jobs
          </button>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Pipeline tab — flat list with stage filter + status dropdowns
   ────────────────────────────────────────────────────────────── */
interface PipelineTabProps {
  cards: KanbanCard[];
  filter: "all" | KanbanStage;
  setFilter: (f: "all" | KanbanStage) => void;
  onChangeStage: (id: number, stage: KanbanStage) => void;
  onOpenDrawer: (id: number) => void;
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
}: PipelineTabProps) {
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const visibleCards = filter === "all" ? cards : cards.filter((c) => c.stage === filter);
  const stageOrder: KanbanStage[] = ["saved", "applied", "interview", "offer", "closed"];
  const sortedCards = [...visibleCards].sort((a, b) => {
    return stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage);
  });

  const filterChips: ["all" | KanbanStage, string][] = [
    ["all", "All"],
    ["saved", "Saved"],
    ["applied", "Applied"],
    ["interview", "Interviewing"],
    ["offer", "Offer"],
    ["closed", "Closed"],
  ];

  return (
    <div style={{ padding: "24px 32px 48px" }}>
      {/* Filter chips + view toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
          {filterChips.map(([id, label]) => {
            const active = filter === id;
            const count = id === "all" ? cards.length : cards.filter((c) => c.stage === id).length;
            return (
              <button
                key={id}
                onClick={() => setFilter(id)}
                style={{
                  padding: "5px 14px",
                  color: active ? color.forest : color.muted,
                  border: active ? `1px solid ${color.forest}` : "1px solid rgba(0,0,0,0.1)",
                  borderRadius: 100,
                  background: "transparent",
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
                <span style={{ fontFamily: fontMono, fontSize: T.label, opacity: 0.7 }}>{count}</span>
              </button>
            );
          })}
        </div>
        {/* View toggle */}
        <div style={{ display: "flex", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
          {(["list", "kanban"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              title={mode === "list" ? "List view" : "Board view"}
              style={{
                padding: "5px 10px",
                background: viewMode === mode ? "#1A3A2F" : "transparent",
                color: viewMode === mode ? "#E8D5A3" : "var(--scout-muted)",
                border: "none",
                fontFamily: "var(--font-ui)",
                fontSize: 13,
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              {mode === "list" ? "☰" : "⊞"}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {cards.length === 0 ? (
        <div style={{ padding: 80, textAlign: "center", color: color.mutedLight, fontFamily: fontSans, fontSize: T.caption }}>
          No jobs yet. Click &quot;+ Add job&quot; above to paste a URL, or &quot;Upload CSV&quot; to bulk-add jobs.
        </div>
      ) : sortedCards.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", color: color.mutedLight, fontFamily: fontSans, fontSize: T.caption }}>
          No jobs match this filter.
        </div>
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
                      <div
                        key={c.id}
                        onClick={() => onOpenDrawer(c.id)}
                        style={{ background: "#FFFFFF", borderRadius: 8, padding: "12px 14px", border: "1px solid rgba(0,0,0,0.06)", borderTop: `2px solid ${stageColor}`, cursor: "pointer", transition: "box-shadow 0.15s" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <CompanyLogo name={c.company} website={url} size={28} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.role}</p>
                            <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.company}</p>
                          </div>
                        </div>
                        {meta?.location && (
                          <span style={{ display: "inline-block", padding: "2px 8px", background: "rgba(0,0,0,0.05)", borderRadius: 100, fontFamily: fontSans, fontSize: T.label, color: color.stone, marginBottom: meta?.salary ? 3 : 0 }}>
                            📍 {meta.location}
                          </span>
                        )}
                        {meta?.nextStep && (
                          <div style={{ marginTop: 6, padding: "4px 7px", background: isOverdue ? "rgba(196,87,74,0.07)" : "rgba(26,58,47,0.05)", borderRadius: 4, borderLeft: `2px solid ${isOverdue ? "#C4574A" : "#4A8B6A"}` }}>
                            <p style={{ fontFamily: fontSans, fontSize: T.label, color: isOverdue ? "#C4574A" : "#4A8B6A", fontWeight: 500 }}>
                              {isOverdue ? "⚠ " : "→ "}{meta.nextStep}
                            </p>
                          </div>
                        )}
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
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sortedCards.map((c) => {
            const meta = (c as KanbanCard & { _meta?: JobMeta })._meta;
            const url = (c as KanbanCard & { _url?: string })._url ?? null;
            const stageColor = STAGE_COLORS[c.stage];
            const nextStepDue = meta?.nextStepDue;
            const isOverdue = nextStepDue ? new Date(nextStepDue) < new Date() : false;
            return (
              <div
                key={c.id}
                style={{ background: "#FFFFFF", borderRadius: 10, padding: "16px 20px", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", borderLeft: `3px solid ${stageColor}` }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, cursor: "pointer" }}
                  onClick={() => onOpenDrawer(c.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                    <CompanyLogo name={c.company} website={url} size={38} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontFamily: fontSans, fontSize: T.body, fontWeight: 600, color: color.ink, marginBottom: 2 }}>{c.role}</p>
                      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, marginBottom: meta?.location || meta?.salary ? 6 : 0 }}>
                        {c.company} · {c.days === 0 ? "Today" : `${c.days}d ago`}
                      </p>
                      {(meta?.location || meta?.salary) && (
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {meta?.location && (
                            <span style={{ padding: "2px 8px", background: "rgba(0,0,0,0.05)", borderRadius: 100, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
                              📍 {meta.location}
                            </span>
                          )}
                          {meta?.salary && (
                            <span style={{ padding: "2px 8px", background: "rgba(74,139,106,0.08)", borderRadius: 100, fontFamily: fontSans, fontSize: T.caption, fontWeight: 500, color: "#2D6B4A" }}>
                              {meta.salary}
                            </span>
                          )}
                        </div>
                      )}
                      {meta?.nextStep && (
                        <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", background: isOverdue ? "rgba(196,87,74,0.07)" : "rgba(26,58,47,0.05)", borderRadius: 5, borderLeft: `2px solid ${isOverdue ? "#C4574A" : "#4A8B6A"}` }}>
                          <span style={{ fontFamily: fontSans, fontSize: T.caption, color: isOverdue ? "#C4574A" : "#4A8B6A", fontWeight: 500 }}>
                            {isOverdue ? "⚠ " : "→ "}{meta.nextStep}
                            {meta.nextStepDue ? ` · ${meta.nextStepDue}` : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <StatusDropdown stage={c.stage} onChange={(s) => { onChangeStage(c.id, s); }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}




