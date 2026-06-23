"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import type { JobMeta } from "@/hooks/useJobs";
import {
  JOBS,
  KANBAN_STAGES,
  STAGE_LABELS,
  STAGE_COLORS,
  type KanbanCard,
  type KanbanStage,
} from "./workspace-data";
import { PlusIcon, UploadIcon } from "./workspace-icons";
import { ResumeEditor } from "./resume-editor";
import { WorkspaceCompanies } from "./workspace-companies";
import { ResumeMatchDrawer } from "./resume-match-drawer";
import { CoverLetterDrawer } from "./cover-letter-drawer";

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
  const [jobAnalysis, setJobAnalysis] = useState<null | {
    company: string | null;
    role: string | null;
    location: string | null;
    salary: string | null;
    description: string | null;
    requirements: string[];
  }>(null);
  const [addJobError, setAddJobError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);

  // CSV upload state
  const [showCsvPanel, setShowCsvPanel] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvProgress, setCsvProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Pipeline flat-list filter — initialized from ?stage= query param if present
  const stageParam = searchParams.get("stage") as KanbanStage | null;
  const [pipelineFilter, setPipelineFilter] = useState<"all" | KanbanStage>(
    stageParam && ["saved", "applied", "interview", "offer", "closed"].includes(stageParam)
      ? stageParam
      : "all"
  );

  // Sync filter when stage param changes (e.g. back-nav)
  useEffect(() => {
    const s = searchParams.get("stage") as KanbanStage | null;
    if (s && ["saved", "applied", "interview", "offer", "closed"].includes(s)) {
      setPipelineFilter(s);
    }
  }, [searchParams]);

  // Resume editor (opened from drawer)
  const [resumeEditorOpen, setResumeEditorOpen] = useState(false);
  const [dbId, setDbId] = useState<string | null>(null);
  void setDbId; // used when saving a real job to DB

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
    const company = jobAnalysis.company ?? "Unknown Company";
    const role = jobAnalysis.role ?? "Unknown Role";
    const meta: JobMeta = {
      location: jobAnalysis.location,
      salary: jobAnalysis.salary,
      description: jobAnalysis.description,
      requirements: jobAnalysis.requirements,
    };
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
                  color: active ? "#1A3A2F" : "#A09890",
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
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
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 11,
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
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 11,
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
            copied={copied}
            setCopied={setCopied}
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
            copied={copied}
            setCopied={setCopied}
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
          fontFamily: "var(--font-dm-sans), system-ui",
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
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 11,
                  fontWeight: s === stage ? 600 : 400,
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
        <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 600, color: "#1A1A1A" }}>
          Upload CSV — bulk add jobs
        </p>
        {!loading && (
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#A09890", padding: 0, lineHeight: 1 }}
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
            <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#1A3A2F" }}>
              Kimchi is analyzing {progress.done} of {progress.total} URLs…
            </p>
          </div>
          <div style={{ height: 4, background: "rgba(0,0,0,0.08)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "#1A3A2F", borderRadius: 2, transition: "width 0.3s ease" }} />
          </div>
        </div>
      ) : (
        <>
          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 300, color: "#52493F", lineHeight: 1.55, marginBottom: 10, maxWidth: 520 }}>
            Upload a CSV file with job URLs. One URL per line, or columns: <code style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 10, background: "rgba(0,0,0,0.05)", padding: "1px 5px", borderRadius: 3 }}>url,company,role</code>
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
                fontFamily: "var(--font-dm-sans), system-ui",
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
            <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: "#A09890" }}>
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
            <p style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 9, color: "#A09890", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 5 }}>
              Example CSV
            </p>
            <pre style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 10, color: "#52493F", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
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
  analysis: {
    company: string | null;
    role: string | null;
    location: string | null;
    salary: string | null;
    description: string | null;
    requirements: string[];
  } | null;
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
            fontFamily: "var(--font-dm-sans), system-ui",
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
            fontFamily: "var(--font-dm-sans), system-ui",
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
            color: "#A09890",
            border: "none",
            fontFamily: "var(--font-dm-sans), system-ui",
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
          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#1A3A2F" }}>Kimchi is analyzing this listing…</p>
        </div>
      )}
      {error && !loading && (
        <div style={{ padding: "8px 12px", background: "rgba(196,87,74,0.06)", borderRadius: 6, border: "1px solid rgba(196,87,74,0.15)", maxWidth: 560 }}>
          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#C4574A" }}>{error}</p>
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
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>{analysis.company ?? "Unknown company"}</p>
                {analysis.role && (
                  <>
                    <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#52493F" }}>·</span>
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#52493F" }}>{analysis.role}</p>
                  </>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {analysis.location && (
                  <span style={{ padding: "2px 8px", background: "rgba(0,0,0,0.05)", borderRadius: 100, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: "#52493F" }}>
                    📍 {analysis.location}
                  </span>
                )}
                {analysis.salary && (
                  <span style={{ padding: "2px 8px", background: "rgba(74,139,106,0.1)", borderRadius: 100, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 500, color: "#2D6B4A" }}>
                    {analysis.salary}
                  </span>
                )}
              </div>
            </div>
          </div>
          {analysis.description && (
            <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 300, color: "#2A2218", lineHeight: 1.6, marginBottom: 10, textWrap: "pretty" }}>
              {analysis.description}
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
              fontFamily: "var(--font-dm-sans), system-ui",
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
  copied: boolean;
  setCopied: (b: boolean) => void;
}

function PipelineTab({
  cards,
  filter,
  setFilter,
  onChangeStage,
  onOpenDrawer,
}: PipelineTabProps) {
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
      {/* Filter chips */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {filterChips.map(([id, label]) => {
          const active = filter === id;
          const count = id === "all" ? cards.length : cards.filter((c) => c.stage === id).length;
          return (
            <button
              key={id}
              onClick={() => setFilter(id)}
              style={{
                padding: "5px 14px",
                background: active ? "transparent" : "transparent",
                color: active ? "#1A3A2F" : "#A09890",
                border: active ? "1px solid #1A3A2F" : "1px solid rgba(0,0,0,0.1)",
                borderRadius: 100,
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 11,
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {label}
              <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 10, opacity: 0.7 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Empty state */}
      {sortedCards.length === 0 ? (
        <div
          style={{
            padding: 80,
            textAlign: "center",
            color: "#A09890",
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 13,
          }}
        >
          {cards.length === 0
            ? "No jobs yet. Click \"+ Add job\" above to paste a URL, or \"Upload CSV\" to bulk-add jobs."
            : "No jobs match this filter."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sortedCards.map((c) => {
            const job = c.jobRef !== null ? JOBS[c.jobRef] : null;
            const stageColor = STAGE_COLORS[c.stage];
            return (
              <div
                key={c.id}
                style={{
                  background: "#FFFFFF",
                  borderRadius: 10,
                  padding: "18px 22px",
                  border: "1px solid rgba(0,0,0,0.06)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  borderLeft: `3px solid ${stageColor}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12 }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", flex: 1, minWidth: 0 }}
                    onClick={() => onOpenDrawer(c.id)}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 8,
                        background: "#1A3A2F",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 600, color: "#E8D5A3" }}>
                        {c.initials}
                      </span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 14, fontWeight: 600, color: "#1A1A1A", marginBottom: 2 }}>
                        {c.role}
                      </p>
                      <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#7A7268" }}>
                        {c.company} · {c.days === 0 ? "Today" : `${c.days} days ago`}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <StatusDropdown stage={c.stage} onChange={(s) => onChangeStage(c.id, s)} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    onClick={() => onOpenDrawer(c.id)}
                    style={{
                      padding: "7px 14px",
                      background: "transparent",
                      color: "#1A3A2F",
                      border: "1px solid rgba(26,58,47,0.2)",
                      borderRadius: 5,
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    Open detail
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


/* ──────────────────────────────────────────────────────────────
   Job drawer (right side panel)
   ────────────────────────────────────────────────────────────── */
export type DrawerTool = "resume" | "cover" | "fit" | null;

interface JobDrawerProps {
  card: KanbanCard;
  onClose: () => void;
  moveCard: (id: number, stage: KanbanStage) => void;
  onDelete: () => void;
  onCardUpdate: (fields: Record<string, string | null>) => void;
  copied: boolean;
  setCopied: (b: boolean) => void;
  tool?: DrawerTool;
  onToolChange?: (t: DrawerTool) => void;
}

function JobDrawer({ card, onClose, moveCard, onDelete, onCardUpdate, copied, setCopied, tool = null, onToolChange }: JobDrawerProps) {
  const dbId = (card as KanbanCard & { _dbId?: string })._dbId ?? null;
  const cardUrl = (card as KanbanCard & { _url?: string })._url ?? null;
  const meta = (card as KanbanCard & { _meta?: JobMeta })._meta ?? null;
  const initialMatchData = (card as KanbanCard & { _matchData?: unknown })._matchData ?? null;
  const [resumeEditorOpen, setResumeEditorOpen] = useState(false);
  const [matchDrawerOpen, setMatchDrawerOpen] = useState(false);
  const [coverDrawerOpen, setCoverDrawerOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const extCard = card as KanbanCard & { _dbId?: string; _url?: string; _userNotes?: string; _companyLinkedinUrl?: string };
  const [urlValue, setUrlValue] = useState(extCard._url ?? "");
  const [notesValue, setNotesValue] = useState(extCard._userNotes ?? "");
  const [descValue, setDescValue] = useState(meta?.description ?? "");
  const companyLinkedinUrl = extCard._companyLinkedinUrl ||
    `https://www.linkedin.com/company/${card.company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;

  function patchField(fields: Record<string, string | null>) {
    if (!dbId) return;
    fetch(`/api/jobs/${dbId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    onCardUpdate(fields);
  }

  function patchDescription(value: string) {
    if (!dbId) return;
    fetch(`/api/jobs/${dbId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: value || null }),
    });
  }

  const job = card.jobRef !== null ? JOBS[card.jobRef] : null;
  const fitColor = card.fit >= 90 ? "#4A8B6A" : card.fit >= 85 ? "#C4A86A" : "#A09890";
  const setTool = (t: DrawerTool) => onToolChange?.(t);

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.1)", zIndex: 60 }}
      />
      <div
        style={{
          position: "fixed",
          top: 8,
          right: 8,
          bottom: 8,
          width: 440,
          background: "#F8F6F2",
          borderRadius: 12,
          overflowY: "auto",
          zIndex: 70,
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          transform: visible ? "translateX(0)" : "translateX(calc(100% + 16px))",
          transition: "transform 0.25s ease",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 18px", borderBottom: "1px solid rgba(0,0,0,0.07)", background: "#FFFFFF" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 7,
                  background: "#1A3A2F",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#E8D5A3",
                  }}
                >
                  {card.initials}
                </span>
              </div>
              <div>
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#1A1A1A",
                  }}
                >
                  {card.role}
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 11,
                    color: "#7A7268",
                    marginTop: 2,
                  }}
                >
                  <a
                    href={companyLinkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "inherit", textDecoration: "none", borderBottom: "1px dotted rgba(0,0,0,0.25)" }}
                  >
                    {card.company}
                  </a>
                  {(job?.location || meta?.location) ? ` · ${job?.location || meta?.location}` : ""}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 18,
                color: "#A09890",
                padding: 0,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span
              style={{
                padding: "3px 10px",
                borderRadius: 100,
                background: `${STAGE_COLORS[card.stage]}20`,
                color: STAGE_COLORS[card.stage],
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              {STAGE_LABELS[card.stage]}
            </span>
            {(job?.salary || meta?.salary) && (
              <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: "#A09890" }}>
                · {job?.salary || meta?.salary}
              </span>
            )}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
              <input
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                onBlur={() => patchField({ url: urlValue || null })}
                placeholder="Paste job URL…"
                style={{
                  width: 160,
                  fontSize: 10,
                  fontFamily: "var(--font-dm-sans), system-ui",
                  color: "#52493F",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid rgba(0,0,0,0.15)",
                  outline: "none",
                  padding: "2px 0",
                }}
              />
              {urlValue && (
                <a
                  href={urlValue}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#4A8B6A", fontSize: 12, lineHeight: 1, textDecoration: "none", flexShrink: 0 }}
                  title="Open link"
                >
                  ↗
                </a>
              )}
            </div>
          </div>
          {dbId && (
            <button
              onClick={() => { if (window.confirm("Remove this job from your pipeline?")) onDelete(); }}
              style={{ marginTop: 10, background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#C4574A", fontFamily: "var(--font-dm-sans), system-ui", padding: 0, textAlign: "left" }}
            >
              Remove job
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: 20 }}>
          {/* Move-to stage chips */}
          <p
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 9,
              fontWeight: 600,
              color: "#A09890",
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: 8,
            }}
          >
            Move to
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
            {KANBAN_STAGES.filter((s) => s !== card.stage).map((s) => (
              <button
                key={s}
                onClick={() => {
                  moveCard(card.id, s);
                }}
                style={{
                  padding: "6px 12px",
                  background: "#FFFFFF",
                  border: "1px solid rgba(0,0,0,0.1)",
                  borderRadius: 5,
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 11,
                  color: "#1A1A1A",
                  cursor: "pointer",
                }}
              >
                {STAGE_LABELS[s]}
              </button>
            ))}
          </div>

          {/* AI Tools — 3 buttons */}
          <p
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 9,
              fontWeight: 600,
              color: "#1A3A2F",
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: 8,
              marginTop: 4,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span style={{ color: "#C4A86A" }}>✦</span> AI Tools
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
            <button
              onClick={() => setMatchDrawerOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                background: "#FFFFFF",
                color: "#1A1A1A",
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 7,
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 14, flexShrink: 0 }}>✦</span>
              <span style={{ flex: 1 }}>
                Customize your resume
                <span style={{ display: "block", fontSize: 10, fontWeight: 300, opacity: 0.7 }}>See your match & maximize interview chances</span>
              </span>
              <span style={{ fontSize: 12, opacity: 0.5 }}>›</span>
            </button>
            <button
              onClick={() => setCoverDrawerOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                background: "#FFFFFF",
                color: "#1A1A1A",
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 7,
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 14, flexShrink: 0 }}>✉</span>
              <span style={{ flex: 1 }}>
                Build Cover Letter
                <span style={{ display: "block", fontSize: 10, fontWeight: 300, opacity: 0.7 }}>Make your application stand out</span>
              </span>
              <span style={{ fontSize: 12, opacity: 0.5 }}>›</span>
            </button>
            <button
              onClick={() => setTool(tool === "fit" ? null : "fit")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                background: tool === "fit" ? "#1A3A2F" : "#FFFFFF",
                color: tool === "fit" ? "#E8D5A3" : "#1A1A1A",
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 7,
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 14, flexShrink: 0 }}>👍</span>
              <span style={{ flex: 1 }}>
                Analyze How Well You Fit
                <span style={{ display: "block", fontSize: 10, fontWeight: 300, opacity: 0.7 }}>Understand your strength & weakness</span>
              </span>
              <span style={{ fontSize: 12, opacity: 0.5 }}>{tool === "fit" ? "▲" : "›"}</span>
            </button>
          </div>

          {/* Tool views or standard drawer content */}
          {/* Coming-soon placeholder for DB jobs (no mock data) */}
          {tool !== null && !job && (
            <div style={{ padding: "16px", background: "#FFFFFF", borderRadius: 7, border: "1px solid rgba(0,0,0,0.07)", animation: "fadeIn 0.3s ease both", marginBottom: 14 }}>
              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 600, color: "#1A1A1A", marginBottom: 6 }}>
                {tool === "resume" ? "Resume tailoring" : tool === "cover" ? "Cover letter" : "Fit analysis"} — coming soon
              </p>
              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 300, color: "#52493F", lineHeight: 1.6 }}>
                AI tools for manually added jobs are rolling out shortly. Upload your base resume in Profile so we can personalize output when it&apos;s ready.
              </p>
            </div>
          )}

          {/* Resume tool view removed — now handled by ResumeMatchDrawer overlay */}

          {/* Tool view: Create cover letter */}
          {tool === "cover" && job && (
            <div style={{ animation: "fadeIn 0.3s ease both" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 600, color: "#1A3A2F", textTransform: "uppercase", letterSpacing: "1px" }}>Cover letter</p>
                <button
                  onClick={() => { if (navigator.clipboard) navigator.clipboard.writeText(job.coverLetter); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }}
                  style={{ padding: "4px 10px", background: copied ? "rgba(74,139,106,0.1)" : "#1A3A2F", color: copied ? "#4A8B6A" : "#E8D5A3", border: "none", borderRadius: 4, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, cursor: "pointer" }}
                >
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>
              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 300, color: "#52493F", lineHeight: 1.55, marginBottom: 14, textWrap: "pretty" }}>
                Tailored to {card.company} — references their priorities and your specific background.
              </p>
              <div style={{ padding: "16px", background: "#FFFFFF", borderRadius: 7, borderLeft: "3px solid #1A3A2F" }}>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 300, color: "#1A1A1A", lineHeight: 1.75, whiteSpace: "pre-wrap", textWrap: "pretty" }}>
                  {job.coverLetter}
                </p>
              </div>
            </div>
          )}

          {/* Tool view: Tell me why I'm a good fit */}
          {tool === "fit" && job && (
            <div style={{ animation: "fadeIn 0.3s ease both" }}>
              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 600, color: "#1A3A2F", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>Fit analysis</p>

              {/* Fit score breakdown */}
              <div style={{ padding: "16px", background: "#FFFFFF", borderRadius: 7, marginBottom: 14, display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
                  <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="32" cy="32" r="28" stroke="rgba(0,0,0,0.08)" strokeWidth="6" fill="none" />
                    <circle cx="32" cy="32" r="28" stroke={fitColor} strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 28 * card.fit / 100} ${2 * Math.PI * 28}`} />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 16, fontWeight: 600, color: fitColor }}>{card.fit}%</span>
                  </div>
                </div>
                <div>
                  <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 600, color: "#1A1A1A", marginBottom: 2 }}>{card.fit >= 85 ? "Strong match" : card.fit >= 70 ? "Good fit" : "Fair match"}</p>
                  <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 300, color: "#52493F", lineHeight: 1.5, textWrap: "pretty" }}>{job.fitSummary}</p>
                </div>
              </div>

              {/* Why you fit */}
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 600, color: "#4A8B6A", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>Why you fit</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {job.fitWorks.map((w, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 10px", background: "rgba(74,139,106,0.06)", borderRadius: 5 }}>
                      <span style={{ color: "#4A8B6A", fontSize: 11, flexShrink: 0, marginTop: 1 }}>✓</span>
                      <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 300, color: "#2A2218", lineHeight: 1.5, textWrap: "pretty" }}>{w}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Watch outs */}
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 600, color: "#C4A86A", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>Watch outs</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {job.fitWatches.map((w, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 10px", background: "rgba(196,168,106,0.06)", borderRadius: 5 }}>
                      <span style={{ color: "#C4A86A", fontSize: 11, flexShrink: 0, marginTop: 1 }}>△</span>
                      <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 300, color: "#2A2218", lineHeight: 1.5, textWrap: "pretty" }}>{w}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gaps */}
              <div>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 600, color: "#C4574A", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>Gaps to address</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {job.gaps.map((g, i) => (
                    <div key={i} style={{ padding: "10px 12px", background: "#FFFFFF", borderRadius: 5, borderLeft: "2px solid #C4574A" }}>
                      <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 600, color: "#1A1A1A", marginBottom: 3 }}>{g.title}</p>
                      <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 300, color: "#52493F", lineHeight: 1.5, textWrap: "pretty" }}>{g.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Standard drawer content (no tool active) */}
          {tool === null && job ? (
            <>
              {/* Fit summary */}
              <div style={{ marginBottom: 18 }}>
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 9,
                    fontWeight: 600,
                    color: "#A09890",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    marginBottom: 8,
                  }}
                >
                  Kimchi&apos;s fit summary
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 12,
                    fontWeight: 300,
                    color: "#2A2218",
                    lineHeight: 1.65,
                    textWrap: "pretty",
                  }}
                >
                  {job.fitSummary}
                </p>
              </div>

              {/* Why you fit */}
              <div style={{ marginBottom: 18 }}>
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 9,
                    fontWeight: 600,
                    color: "#4A8B6A",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    marginBottom: 8,
                  }}
                >
                  Why you fit
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {job.fitWorks.map((w, i) => (
                    <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                      <span style={{ color: "#4A8B6A", fontSize: 11, flexShrink: 0, marginTop: 1 }}>✓</span>
                      <p
                        style={{
                          fontFamily: "var(--font-dm-sans), system-ui",
                          fontSize: 11,
                          fontWeight: 300,
                          color: "#2A2218",
                          lineHeight: 1.5,
                        }}
                      >
                        {w}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tailored bullets */}
              <div style={{ marginBottom: 18 }}>
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 9,
                    fontWeight: 600,
                    color: "#A09890",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    marginBottom: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  Tailored bullets <span style={{ color: "#C4A86A" }}>✦</span>
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {job.bullets.map((b, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "10px 12px",
                        background: "#FFFFFF",
                        borderRadius: 6,
                        borderLeft: "2px solid #1A3A2F",
                      }}
                    >
                      <p
                        style={{
                          fontFamily: "var(--font-dm-sans), system-ui",
                          fontSize: 11,
                          fontWeight: 300,
                          color: "#1A1A1A",
                          lineHeight: 1.55,
                          marginBottom: 6,
                        }}
                      >
                        {b.tailored}
                      </p>
                      <p
                        style={{
                          fontFamily: "var(--font-dm-sans), system-ui",
                          fontSize: 9,
                          color: "#A09890",
                          fontStyle: "italic",
                        }}
                      >
                        Original: {b.original}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cover letter */}
              <div style={{ marginBottom: 18 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <p
                    style={{
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 9,
                      fontWeight: 600,
                      color: "#A09890",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    Cover letter opener
                  </p>
                  <button
                    onClick={() => {
                      if (job && navigator.clipboard) navigator.clipboard.writeText(job.coverLetter);
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 2000);
                    }}
                    style={{
                      padding: "4px 10px",
                      background: copied ? "rgba(74,139,106,0.1)" : "#1A3A2F",
                      color: copied ? "#4A8B6A" : "#E8D5A3",
                      border: "none",
                      borderRadius: 4,
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 10,
                      cursor: "pointer",
                    }}
                  >
                    {copied ? "Copied ✓" : "Copy"}
                  </button>
                </div>
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 11,
                    fontWeight: 300,
                    color: "#1A1A1A",
                    lineHeight: 1.7,
                    fontStyle: "italic",
                    padding: "12px 14px",
                    background: "#FFFFFF",
                    borderRadius: 6,
                    textWrap: "pretty",
                  }}
                >
                  {job.coverLetter.split("\n\n")[1] || job.coverLetter.slice(0, 280) + "…"}
                </p>
              </div>

              {/* Gaps */}
              <div>
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 9,
                    fontWeight: 600,
                    color: "#C4A86A",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    marginBottom: 8,
                  }}
                >
                  Gaps to address
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {job.gaps.map((g, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "12px 14px",
                        background: "#FFFFFF",
                        borderRadius: 6,
                        borderLeft: "2px solid #C4A86A",
                      }}
                    >
                      <p
                        style={{
                          fontFamily: "var(--font-dm-sans), system-ui",
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#1A1A1A",
                          marginBottom: 4,
                        }}
                      >
                        {g.title}
                      </p>
                      <p
                        style={{
                          fontFamily: "var(--font-dm-sans), system-ui",
                          fontSize: 11,
                          fontWeight: 300,
                          color: "#52493F",
                          lineHeight: 1.55,
                          marginBottom: 6,
                        }}
                      >
                        {g.body}
                      </p>
                      <p
                        style={{
                          fontFamily: "var(--font-dm-sans), system-ui",
                          fontSize: 10,
                          color: "#1A3A2F",
                          fontStyle: "italic",
                        }}
                      >
                        → {g.fix}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : tool === null ? (
            <div style={{ animation: "fadeIn 0.3s ease both" }}>
              {/* Editable job description */}
              <div style={{ marginBottom: 18 }}>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, fontWeight: 600, color: "#A09890", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>
                  Job Description
                </p>
                <textarea
                  value={descValue}
                  onChange={(e) => setDescValue(e.target.value)}
                  onBlur={() => patchDescription(descValue)}
                  placeholder="Paste or type the job description here. AI will fill this in automatically later."
                  rows={8}
                  style={{
                    width: "100%",
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 11,
                    fontWeight: 300,
                    color: "#1A1A1A",
                    background: "#FFFFFF",
                    border: "1px solid rgba(0,0,0,0.1)",
                    borderRadius: 7,
                    padding: "10px 12px",
                    resize: "vertical",
                    outline: "none",
                    lineHeight: 1.6,
                    boxSizing: "border-box",
                  }}
                />
              </div>
              {/* Key requirements (from scraped meta) */}
              {meta?.requirements && meta.requirements.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, fontWeight: 600, color: "#A09890", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>
                    Key requirements
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {meta.requirements.map((r, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 10px", background: "#FFFFFF", borderRadius: 5 }}>
                        <span style={{ color: "#4A8B6A", fontSize: 11, flexShrink: 0, marginTop: 1 }}>✓</span>
                        <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 300, color: "#2A2218", lineHeight: 1.5 }}>{r}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Notes */}
          <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid rgba(0,0,0,0.07)" }}>
            <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, fontWeight: 600, color: "#A09890", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>
              Notes
            </p>
            <textarea
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              onBlur={() => patchField({ userNotes: notesValue || null })}
              placeholder="Recruiter contacts, next steps, impressions…"
              rows={4}
              style={{
                width: "100%",
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 11,
                fontWeight: 300,
                color: "#1A1A1A",
                background: "#FFFFFF",
                border: "1px solid rgba(0,0,0,0.1)",
                borderRadius: 7,
                padding: "10px 12px",
                resize: "vertical",
                outline: "none",
                lineHeight: 1.6,
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      </div>

      {dbId && (
        <ResumeEditor
          open={resumeEditorOpen}
          onOpenChange={setResumeEditorOpen}
          jobId={dbId}
          jobTitle={card.role}
          company={card.company}
        />
      )}

      {matchDrawerOpen && (
        <ResumeMatchDrawer
          jobTitle={card.role}
          company={card.company}
          description={meta?.description ?? ""}
          jobId={dbId ?? undefined}
          initialMatchData={initialMatchData as Parameters<typeof ResumeMatchDrawer>[0]["initialMatchData"]}
          onClose={() => setMatchDrawerOpen(false)}
          onTailorResume={() => {
            if (dbId) setResumeEditorOpen(true);
          }}
        />
      )}

      {coverDrawerOpen && (
        <CoverLetterDrawer
          jobTitle={card.role}
          company={card.company}
          description={meta?.description ?? ""}
          onClose={() => setCoverDrawerOpen(false)}
        />
      )}
    </>
  );
}

