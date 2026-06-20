"use client";

import { useRef, useState } from "react";
import {
  COMPANIES,
  JOBS,
  INITIAL_SIGNALS,
  LIVE_SESSIONS,
  KANBAN_STAGES,
  STAGE_LABELS,
  STAGE_COLORS,
  type KanbanCard,
  type KanbanStage,
  type SignalItem,
  type SignalsData,
} from "./workspace-data";
import { PlusIcon, RefreshIcon, SparkleIcon, UploadIcon } from "./workspace-icons";
import { ResumeEditor } from "./resume-editor";

type OppTab = "discover" | "pipeline";

interface OpportunitiesProps {
  onOpenLive: () => void;
  /** Controlled drawer state (lifted to parent so ChatWidget can open drawer from any section) */
  drawerCardId: number | null;
  setDrawerCardId: (id: number | null) => void;
  drawerTool: DrawerTool;
  setDrawerTool: (t: DrawerTool) => void;
  /** Controlled kanban cards (lifted so ChatWidget can show job picker) */
  kanbanCards: KanbanCard[];
  setKanbanCards: React.Dispatch<React.SetStateAction<KanbanCard[]>>;
}

export function WorkspaceOpportunities({
  onOpenLive,
  drawerCardId,
  setDrawerCardId,
  drawerTool,
  setDrawerTool,
  kanbanCards,
  setKanbanCards,
}: OpportunitiesProps) {
  const [tab, setTab] = useState<OppTab>("discover");
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addJobUrl, setAddJobUrl] = useState("");
  const [addJobLoading, setAddJobLoading] = useState(false);
  const [jobAnalysis, setJobAnalysis] = useState<null | {
    company: string;
    role: string;
    fitScore: number;
    fitReason: string;
    salaryRange: string;
    requirements: string[];
    tailoredBullets: string[];
    coverLetterOpener: string;
    skillGaps: string[];
    insiderTip: string;
  }>(null);

  const [signalsData, setSignalsData] = useState<SignalsData | null>(INITIAL_SIGNALS);
  const [signalsLoading, setSignalsLoading] = useState(false);

  const [usedBullets, setUsedBullets] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [selectedJobRef, setSelectedJobRef] = useState<number | null>(null);

  // CSV upload state
  const [showCsvPanel, setShowCsvPanel] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvProgress, setCsvProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Pipeline flat-list filter
  const [pipelineFilter, setPipelineFilter] = useState<"all" | KanbanStage>("all");

  // Resume editor (opened from drawer)
  const [resumeEditorOpen, setResumeEditorOpen] = useState(false);
  const [dbId, setDbId] = useState<string | null>(null);
  void setDbId; // used when saving a real job to DB

  /* ── Mock URL analysis (shared by single-URL panel and CSV bulk upload) ── */
  const analyzeUrl = (url: string, hintCompany?: string, hintRole?: string) => {
    let company = hintCompany || "Company";
    let role = hintRole || "Senior PM";
    if (!hintCompany) {
      const lower = url.toLowerCase();
      if (lower.includes("stripe")) { company = "Stripe"; role = "Senior PM — Revenue"; }
      else if (lower.includes("linear")) { company = "Linear"; role = "Product Lead"; }
      else if (lower.includes("figma")) { company = "Figma"; role = "Design Systems PM"; }
      else if (lower.includes("notion")) { company = "Notion"; role = "Head of Product Ops"; }
      else if (lower.includes("vercel")) { company = "Vercel"; role = "Platform PM"; }
    }
    return {
      company, role, fitScore: 84,
      fitReason: `Your background in API-first products and cross-functional leadership maps well to what ${company} is hiring for. Eight years of SaaS pattern recognition gives you a strong starting position.`,
      salaryRange: "$180–230k + equity",
      requirements: [
        "8+ years product management experience in SaaS",
        "Track record of shipping API-first or platform products",
        "Cross-functional leadership across engineering & design",
        "Data-driven decision-making with SQL or Amplitude",
        "Experience scaling products from $1M to $50M+ ARR",
      ],
      tailoredBullets: [
        `Owned ${company}-scale revenue infrastructure product strategy, driving API-first decisions that reduced integration friction by 40%`,
        "Built cross-functional alignment across engineering, design, and finance stakeholders to ship load-bearing platform changes on time",
        "Defined and tracked north-star metrics for financial data products, improving decision velocity for 200+ enterprise customers",
      ],
      coverLetterOpener: `When I look at what ${company} is building, I see a problem I've spent years thinking about from the other side. My eight years in SaaS product have been defined by a conviction that the best infrastructure products make hard decisions feel obvious.`,
      skillGaps: [
        "Direct domain experience in this specific surface area — surface adjacent work explicitly",
        "Engineering depth signal — revise 1–2 bullets to name technical decisions you influenced",
      ],
      insiderTip: `${company} interviews are known for being opinionated — come with 2–3 strong product opinions about their current roadmap.`,
    };
  };

  /* ── Add job (single URL) ── */
  const submitAddJob = () => {
    const url = addJobUrl.trim();
    if (!url) return;
    setAddJobLoading(true);
    setJobAnalysis(null);
    window.setTimeout(() => {
      setJobAnalysis(analyzeUrl(url));
      setAddJobLoading(false);
    }, 1500);
  };

  /* ── Add a job directly from a URL (used by CSV bulk upload) ── */
  const addJobFromUrl = (url: string, hintCompany?: string, hintRole?: string) => {
    const analysis = analyzeUrl(url, hintCompany, hintRole);
    setKanbanCards((prev) => {
      const newId = Math.max(...prev.map((c) => c.id), 0) + 1;
      return [...prev, {
        id: newId,
        company: analysis.company,
        initials: analysis.company.slice(0, 2).toUpperCase(),
        role: analysis.role,
        stage: "saved" as KanbanStage,
        fit: analysis.fitScore,
        jobRef: null,
        days: 0,
      }];
    });
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
      await new Promise((resolve) => window.setTimeout(resolve, 600));
      addJobFromUrl(item.url, item.company, item.role);
      setCsvProgress({ done: i + 1, total: items.length });
    }
    setCsvLoading(false);
    setShowCsvPanel(false);
    if (csvInputRef.current) csvInputRef.current.value = "";
  };

  /* ── Change a card's stage (used by status dropdowns in My Jobs + Pipeline) ── */
  const changeStage = (cardId: number, newStage: KanbanStage) => {
    setKanbanCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, stage: newStage } : c)));
  };

  const addToKanban = () => {
    if (!jobAnalysis) return;
    const newId = Math.max(...kanbanCards.map((c) => c.id), 0) + 1;
    setKanbanCards((prev) => [
      ...prev,
      {
        id: newId,
        company: jobAnalysis.company,
        initials: jobAnalysis.company.slice(0, 2).toUpperCase(),
        role: jobAnalysis.role,
        stage: "saved",
        fit: jobAnalysis.fitScore,
        jobRef: null,
        days: 0,
      },
    ]);
    setShowAddPanel(false);
    setJobAnalysis(null);
    setAddJobUrl("");
  };

  const refreshSignals = () => {
    setSignalsLoading(true);
    setSignalsData(null);
    window.setTimeout(() => {
      setSignalsData(INITIAL_SIGNALS);
      setSignalsLoading(false);
    }, 1500);
  };

  const moveCard = (cardId: number, stage: KanbanStage) => {
    setKanbanCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, stage } : c)));
  };

  const openDrawer = (cardId: number) => {
    setDrawerCardId(cardId);
    setDrawerTool(null);
  };
  const closeDrawer = () => {
    setDrawerCardId(null);
    setDrawerTool(null);
  };

  const pipeline = {
    saved: kanbanCards.filter((c) => c.stage === "saved").length,
    applied: kanbanCards.filter((c) => c.stage === "applied").length,
    interview: kanbanCards.filter((c) => c.stage === "interview").length,
    offer: kanbanCards.filter((c) => c.stage === "offer").length,
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#F2EDE3",
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
        <div style={{ display: "flex", gap: 3, background: "rgba(0,0,0,0.05)", padding: 3, borderRadius: 7 }}>
          {([
            ["discover", "Signals"],
            ["pipeline", "Pipeline"],
          ] as [OppTab, string][]).map(([id, label]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  padding: "7px 20px",
                  borderRadius: 5,
                  border: "none",
                  background: active ? "#1A3A2F" : "transparent",
                  color: active ? "#E8D5A3" : "#52493F",
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        {tab === "pipeline" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
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
            </button>
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
          </div>
        )}
      </div>

      {/* URL paste panel — renders in Pipeline tab (DiscoverTab has its own inline panel) */}
      {showAddPanel && tab === "pipeline" && (
        <MyJobsUrlPastePanel
          url={addJobUrl}
          setUrl={setAddJobUrl}
          onSubmit={submitAddJob}
          loading={addJobLoading}
          analysis={jobAnalysis}
          onAddToKanban={addToKanban}
          onDismiss={() => { setJobAnalysis(null); setShowAddPanel(false); setAddJobUrl(""); }}
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

      {/* Content area + right drawer — flex row */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {tab === "discover" && (
            <DiscoverTab
              showAddPanel={showAddPanel}
              addJobUrl={addJobUrl}
              setAddJobUrl={setAddJobUrl}
              submitAddJob={submitAddJob}
              addJobLoading={addJobLoading}
              jobAnalysis={jobAnalysis}
              addToKanban={addToKanban}
              dismissJobAnalysis={() => setJobAnalysis(null)}
              pipeline={pipeline}
              signalsData={signalsData}
              signalsLoading={signalsLoading}
              refreshSignals={refreshSignals}
              onOpenLive={onOpenLive}
              onSelectCompany={() => {}}
            />
          )}
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

        {/* Job detail panel — slides in from right, no overlay */}
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
            />
          );
        })()}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Discover Tab
   ────────────────────────────────────────────────────────────── */
interface DiscoverTabProps {
  showAddPanel: boolean;
  addJobUrl: string;
  setAddJobUrl: (s: string) => void;
  submitAddJob: () => void;
  addJobLoading: boolean;
  jobAnalysis: OpportunitiesProps extends never ? never : any;
  addToKanban: () => void;
  dismissJobAnalysis: () => void;
  pipeline: { saved: number; applied: number; interview: number; offer: number };
  signalsData: SignalsData | null;
  signalsLoading: boolean;
  refreshSignals: () => void;
  onOpenLive: () => void;
  onSelectCompany: (id: number) => void;
}

function DiscoverTab({
  showAddPanel,
  addJobUrl,
  setAddJobUrl,
  submitAddJob,
  addJobLoading,
  jobAnalysis,
  addToKanban,
  dismissJobAnalysis,
  pipeline,
  signalsData,
  signalsLoading,
  refreshSignals,
  onOpenLive,
  onSelectCompany,
}: DiscoverTabProps) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      {/* Add job panel */}
      {showAddPanel && (
        <div
          style={{
            padding: "12px 28px",
            background: "rgba(26,58,47,0.04)",
            borderBottom: "1px solid rgba(0,0,0,0.07)",
            animation: "fadeIn 0.2s ease both",
          }}
        >
          <div style={{ display: "flex", gap: 8, maxWidth: 560 }}>
            <input
              type="url"
              placeholder="Paste a job listing URL — e.g. https://stripe.com/jobs/..."
              value={addJobUrl}
              onChange={(e) => setAddJobUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitAddJob()}
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
              onClick={submitAddJob}
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
          </div>
          {addJobLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#1A3A2F",
                  animation: "pulse 1s ease infinite",
                }}
              />
              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#1A3A2F" }}>
                Searchly is analyzing this listing…
              </p>
            </div>
          )}

          {/* Job Analysis Package */}
          {jobAnalysis && (
            <div
              style={{
                padding: "20px 0 0",
                animation: "fadeIn 0.3s ease both",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  marginBottom: 20,
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <p
                      style={{
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 15,
                        fontWeight: 600,
                        color: "#1A1A1A",
                      }}
                    >
                      {jobAnalysis.company}
                    </p>
                    <span
                      style={{
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 11,
                        color: "#52493F",
                      }}
                    >
                      ·
                    </span>
                    <p
                      style={{
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 13,
                        color: "#52493F",
                      }}
                    >
                      {jobAnalysis.role}
                    </p>
                  </div>
                  <p
                    style={{
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 11,
                      fontWeight: 300,
                      color: "#7A7268",
                      lineHeight: 1.6,
                      maxWidth: 520,
                      textWrap: "pretty",
                    }}
                  >
                    {jobAnalysis.fitReason}
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span
                      style={{
                        fontFamily: "var(--font-dm-mono), monospace",
                        fontSize: 26,
                        fontWeight: 500,
                        color: "#4A8B6A",
                      }}
                    >
                      {jobAnalysis.fitScore}%
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 11,
                        color: "#A09890",
                      }}
                    >
                      fit
                    </span>
                  </div>
                  <p
                    style={{
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 10,
                      color: "#A09890",
                    }}
                  >
                    {jobAnalysis.salaryRange}
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                {/* Requirements */}
                <div
                  style={{
                    background: "#FFFFFF",
                    borderRadius: 8,
                    padding: "14px 16px",
                    border: "1px solid rgba(0,0,0,0.06)",
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
                      marginBottom: 10,
                    }}
                  >
                    Key Requirements
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {jobAnalysis.requirements.map((r: string, i: number) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
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
                          {r}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Skill gaps */}
                <div
                  style={{
                    background: "#FFFFFF",
                    borderRadius: 8,
                    padding: "14px 16px",
                    border: "1px solid rgba(0,0,0,0.06)",
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
                      marginBottom: 10,
                    }}
                  >
                    Skill Gaps to Address
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {jobAnalysis.skillGaps.map((g: string, i: number) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                        <span style={{ color: "#C4A86A", fontSize: 11, flexShrink: 0, marginTop: 1 }}>△</span>
                        <p
                          style={{
                            fontFamily: "var(--font-dm-sans), system-ui",
                            fontSize: 11,
                            fontWeight: 300,
                            color: "#2A2218",
                            lineHeight: 1.5,
                          }}
                        >
                          {g}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                    <p
                      style={{
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 9,
                        fontWeight: 600,
                        color: "#A09890",
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                        marginBottom: 5,
                      }}
                    >
                      Insider tip
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 10,
                        fontWeight: 300,
                        color: "#52493F",
                        lineHeight: 1.55,
                        fontStyle: "italic",
                      }}
                    >
                      {jobAnalysis.insiderTip}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tailored resume bullets */}
              <div
                style={{
                  background: "#FFFFFF",
                  borderRadius: 8,
                  padding: "14px 16px",
                  border: "1px solid rgba(0,0,0,0.06)",
                  marginBottom: 14,
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
                    marginBottom: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  Tailored Resume Bullets <span style={{ color: "#C4A86A" }}>✦</span>
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {jobAnalysis.tailoredBullets.map((b: string, i: number) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        padding: "8px 10px",
                        background: "rgba(26,58,47,0.03)",
                        borderRadius: 5,
                        borderLeft: "2px solid #1A3A2F",
                      }}
                    >
                      <p
                        style={{
                          fontFamily: "var(--font-dm-sans), system-ui",
                          fontSize: 11,
                          fontWeight: 300,
                          color: "#1A1A1A",
                          lineHeight: 1.6,
                          textWrap: "pretty",
                        }}
                      >
                        {b}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cover letter opener */}
              <div
                style={{
                  background: "#FFFFFF",
                  borderRadius: 8,
                  padding: "14px 16px",
                  border: "1px solid rgba(0,0,0,0.06)",
                  marginBottom: 16,
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
                    marginBottom: 10,
                  }}
                >
                  Cover Letter Opener
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 12,
                    fontWeight: 300,
                    color: "#1A1A1A",
                    lineHeight: 1.75,
                    textWrap: "pretty",
                    fontStyle: "italic",
                  }}
                >
                  {jobAnalysis.coverLetterOpener}
                </p>
              </div>

              {/* CTAs */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={addToKanban}
                  style={{
                    padding: "10px 22px",
                    background: "#1A3A2F",
                    color: "#E8D5A3",
                    border: "none",
                    borderRadius: 6,
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  + Add to pipeline
                </button>
                <button
                  style={{
                    padding: "10px 18px",
                    background: "#FFFFFF",
                    color: "#1A3A2F",
                    border: "1px solid rgba(26,58,47,0.2)",
                    borderRadius: 6,
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Export bullets to resume →
                </button>
                <button
                  onClick={dismissJobAnalysis}
                  style={{
                    padding: "10px 16px",
                    background: "transparent",
                    color: "#A09890",
                    border: "none",
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Welcome / dashboard content */}
      <div style={{ padding: "24px 32px 48px" }}>
        {/* Market signals strip */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 9,
                fontWeight: 500,
                color: "#A09890",
                letterSpacing: "1.1px",
                textTransform: "uppercase",
              }}
            >
              Searchly signals · updated weekly
            </p>
            <button
              onClick={refreshSignals}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 10,
                color: "#1A3A2F",
                padding: 0,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <RefreshIcon /> Refresh →
            </button>
          </div>
          {signalsLoading && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 16px",
                background: "#FFFFFF",
                borderRadius: 9,
                border: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#1A3A2F",
                  animation: "pulse 1s ease infinite",
                  flexShrink: 0,
                }}
              />
              <p
                style={{
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 11,
                  color: "#1A3A2F",
                }}
              >
                Searchly is scanning the market…
              </p>
            </div>
          )}
          {signalsData && (
            <>
              <div
                style={{
                  background: "#1A3A2F",
                  borderRadius: 9,
                  padding: "12px 16px",
                  marginBottom: 10,
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 9,
                    fontWeight: 600,
                    color: "rgba(232,213,163,0.5)",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    marginBottom: 4,
                  }}
                >
                  This week&apos;s read
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-cormorant), Georgia, serif",
                    fontSize: 15,
                    fontWeight: 500,
                    color: "#E8D5A3",
                    lineHeight: 1.5,
                    textWrap: "pretty",
                  }}
                >
                  {signalsData.headline}
                </p>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  overflowX: "auto",
                  paddingBottom: 4,
                  scrollbarWidth: "none",
                }}
              >
                {signalsData.signals.map((s: SignalItem, i: number) => {
                  const sentimentColor =
                    s.sentiment === "positive" ? "#2D6B4A" : s.sentiment === "negative" ? "#8B3A3A" : "#7A6020";
                  const sentimentBg =
                    s.sentiment === "positive"
                      ? "rgba(45,107,74,0.08)"
                      : s.sentiment === "negative"
                      ? "rgba(139,58,58,0.08)"
                      : "rgba(122,96,32,0.08)";
                  const typeLabel =
                    s.type === "hiring_surge"
                      ? "↑ Hiring"
                      : s.type === "hiring_freeze"
                      ? "↓ Freeze"
                      : s.type === "funding"
                      ? "$ Funding"
                      : s.type === "role_demand"
                      ? "⬆ Demand"
                      : s.type === "salary"
                      ? "$ Salary"
                      : "◎ Trend";
                  return (
                    <div
                      key={i}
                      style={{
                        flex: "none",
                        width: 240,
                        background: "#FFFFFF",
                        borderRadius: 9,
                        padding: "14px 16px",
                        border: "1px solid rgba(0,0,0,0.06)",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 100,
                            background: sentimentBg,
                            fontFamily: "var(--font-dm-sans), system-ui",
                            fontSize: 9,
                            fontWeight: 700,
                            color: sentimentColor,
                            textTransform: "uppercase",
                          }}
                        >
                          {typeLabel}
                        </span>
                        {s.company && (
                          <span
                            style={{
                              fontFamily: "var(--font-dm-sans), system-ui",
                              fontSize: 10,
                              fontWeight: 600,
                              color: "#1A3A2F",
                            }}
                          >
                            {s.company}
                          </span>
                        )}
                      </div>
                      <p
                        style={{
                          fontFamily: "var(--font-dm-sans), system-ui",
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#1A1A1A",
                          marginBottom: 5,
                          lineHeight: 1.4,
                          textWrap: "pretty",
                        }}
                      >
                        {s.title}
                      </p>
                      <p
                        style={{
                          fontFamily: "var(--font-dm-sans), system-ui",
                          fontSize: 10,
                          fontWeight: 300,
                          color: "#4A8B6A",
                          lineHeight: 1.5,
                        }}
                      >
                        → {s.actionable}
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Salary benchmark + hot/cold skills */}
        {signalsData && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 20 }}>
            {/* Salary benchmark */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: 10,
                padding: "16px 18px",
                border: "1px solid rgba(0,0,0,0.06)",
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
                  marginBottom: 8,
                }}
              >
                Salary benchmark
              </p>
              <p
                style={{
                  fontFamily: "var(--font-cormorant), Georgia, serif",
                  fontSize: 16,
                  fontWeight: 500,
                  fontStyle: "italic",
                  color: "#1A1A1A",
                  marginBottom: 4,
                }}
              >
                {signalsData.salaryBenchmark.role}
              </p>
              <p
                style={{
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 11,
                  fontWeight: 300,
                  color: "#52493F",
                  lineHeight: 1.55,
                  textWrap: "pretty",
                }}
              >
                {signalsData.salaryBenchmark.note}
              </p>
            </div>

            {/* Hot / cold skills */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: 10,
                padding: "16px 18px",
                border: "1px solid rgba(0,0,0,0.06)",
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
                  marginBottom: 8,
                }}
              >
                Skills in demand
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                {signalsData.hotSkills.map((s) => (
                  <span
                    key={s}
                    style={{
                      padding: "3px 10px",
                      background: "rgba(74,139,106,0.1)",
                      borderRadius: 100,
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 10,
                      fontWeight: 500,
                      color: "#2D6B4A",
                    }}
                  >
                    ↑ {s}
                  </span>
                ))}
              </div>
              <p
                style={{
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 9,
                  fontWeight: 600,
                  color: "#A09890",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  marginBottom: 6,
                }}
              >
                Cooling
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {signalsData.coldSkills.map((s) => (
                  <span
                    key={s}
                    style={{
                      padding: "3px 10px",
                      background: "rgba(160,152,144,0.12)",
                      borderRadius: 100,
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 10,
                      color: "#7A7268",
                    }}
                  >
                    ↓ {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
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
              Searchly is analyzing {progress.done} of {progress.total} URLs…
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
    company: string;
    role: string;
    fitScore: number;
    fitReason: string;
    salaryRange: string;
    requirements: string[];
    tailoredBullets: string[];
    coverLetterOpener: string;
    skillGaps: string[];
    insiderTip: string;
  } | null;
  onAddToKanban: () => void;
  onDismiss: () => void;
}

function MyJobsUrlPastePanel({ url, setUrl, onSubmit, loading, analysis, onAddToKanban, onDismiss }: MyJobsUrlPastePanelProps) {
  return (
    <div
      style={{
        padding: "12px 28px",
        background: "rgba(26,58,47,0.04)",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
        animation: "fadeIn 0.2s ease both",
      }}
    >
      <div style={{ display: "flex", gap: 8, maxWidth: 560, marginBottom: loading || analysis ? 12 : 0 }}>
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
          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#1A3A2F" }}>Searchly is analyzing this listing…</p>
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
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>{analysis.company}</p>
                <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#52493F" }}>·</span>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#52493F" }}>{analysis.role}</p>
              </div>
              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 300, color: "#7A7268", lineHeight: 1.5, maxWidth: 420, textWrap: "pretty" }}>
                {analysis.fitReason}
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
              <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 20, fontWeight: 500, color: "#4A8B6A" }}>{analysis.fitScore}%</span>
              <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, color: "#A09890" }}>{analysis.salaryRange}</span>
            </div>
          </div>
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
                padding: "6px 14px",
                background: active ? "#1A3A2F" : "rgba(0,0,0,0.05)",
                color: active ? "#E8D5A3" : "#52493F",
                border: "none",
                borderRadius: 100,
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 11,
                fontWeight: 500,
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
            const fitColor = c.fit >= 90 ? "#4A8B6A" : c.fit >= 85 ? "#C4A86A" : "#A09890";
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
                        {c.company} · {job?.location || "Remote"} · {c.days === 0 ? "Today" : `${c.days} days ago`}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                        <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 18, fontWeight: 500, color: fitColor }}>
                          {c.fit}%
                        </span>
                        <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: "#A09890" }}>fit</span>
                      </div>
                      <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 100, background: c.fit >= 88 ? "rgba(74,139,106,0.12)" : c.fit >= 75 ? "rgba(196,168,106,0.12)" : "rgba(160,152,144,0.12)", color: c.fit >= 88 ? "#2D6B4A" : c.fit >= 75 ? "#7A6020" : "#7A7268", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {c.fit >= 88 ? "Strong match" : c.fit >= 75 ? "Good fit" : "Fair match"}
                      </span>
                    </div>
                    <StatusDropdown stage={c.stage} onChange={(s) => onChangeStage(c.id, s)} />
                  </div>
                </div>
                {job && (
                  <p
                    style={{
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 12,
                      fontWeight: 300,
                      color: "#52493F",
                      lineHeight: 1.6,
                      marginBottom: 14,
                      textWrap: "pretty",
                    }}
                  >
                    {job.fitSummary}
                  </p>
                )}
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
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
                  {c.days <= 2 && (
                    <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 600, padding: "4px 9px", borderRadius: 100, background: "rgba(45,107,74,0.1)", color: "#2D6B4A", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      ⚡ Early applicant
                    </span>
                  )}
                  <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: "#A09890", marginLeft: "auto" }}>
                    {((c.id * 17 + c.fit) % 80) + 12} applicants
                  </span>
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
  copied: boolean;
  setCopied: (b: boolean) => void;
  tool?: DrawerTool;
  onToolChange?: (t: DrawerTool) => void;
}

function JobDrawer({ card, onClose, moveCard, copied, setCopied, tool = null, onToolChange }: JobDrawerProps) {
  const [dbId, setDbId] = useState<string | null>(null);
  void setDbId;
  const [resumeEditorOpen, setResumeEditorOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"overview" | "company" | "ai">("overview");
  const job = card.jobRef !== null ? JOBS[card.jobRef] : null;
  const fitColor = card.fit >= 90 ? "#4A8B6A" : card.fit >= 85 ? "#C4A86A" : "#A09890";
  const setTool = (t: DrawerTool) => { onToolChange?.(t); setDrawerTab("ai"); };

  const mockDescription = job ? {
    postedAt: `${card.days === 0 ? "Today" : `${card.days} days ago`}`,
    type: "Full-time",
    level: "Senior Level",
    location: job.location,
    salary: job.salary,
    tags: ["SaaS", "Product", "Strategy"],
    responsibilities: [
      `Lead product strategy and roadmap for ${card.company}'s core platform.`,
      "Drive cross-functional alignment across engineering, design, and GTM teams.",
      "Define and track north-star metrics; present to executive stakeholders monthly.",
      "Own the discovery-to-launch lifecycle for major product initiatives.",
      "Partner with sales and customer success to synthesize user feedback into product decisions.",
      "Recruit and mentor junior PMs as the team scales.",
    ],
    requirements: [
      "8+ years of product management experience in B2B SaaS",
      "Track record of shipping platform or API-first products at scale",
      "Strong analytical skills — comfortable in SQL, Amplitude, or Looker",
      "Exceptional written and verbal communication",
      "Experience navigating ambiguity in high-growth environments",
    ],
    niceToHave: [
      "Background in fintech, devtools, or enterprise software",
      "Experience building 0-to-1 products",
      "MBA or equivalent analytical training",
    ],
    companyBlurb: `${card.company} is a high-growth technology company building the next generation of infrastructure for modern businesses. Backed by top-tier investors, we're focused on shipping products that make our customers wildly successful. Our team is mission-driven, moves fast, and takes ownership seriously.`,
    companySize: "200–500 employees",
    companyStage: "Series C",
    companyIndustry: "Enterprise SaaS",
  } : null;

  return (
    <>
      <div
        style={{
          width: 460,
          minWidth: 460,
          background: "#FFFFFF",
          borderLeft: "1px solid rgba(0,0,0,0.08)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          animation: "slideInRight 0.2s ease both",
          flexShrink: 0,
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px 0", borderBottom: "1px solid rgba(0,0,0,0.08)", background: "#FFFFFF", flexShrink: 0 }}>
          {/* Top row: close + apply */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#A09890", padding: 0, lineHeight: 1 }}>×</button>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ padding: "7px 16px", background: "transparent", color: "#1A3A2F", border: "1px solid rgba(26,58,47,0.25)", borderRadius: 5, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 500, cursor: "pointer" }}>
                Save
              </button>
              <button style={{ padding: "7px 16px", background: "#1A3A2F", color: "#E8D5A3", border: "none", borderRadius: 5, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Apply ↗
              </button>
            </div>
          </div>

          {/* Company + title */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: "#1A3A2F", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 700, color: "#E8D5A3" }}>{card.initials}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#7A7268", marginBottom: 2 }}>
                {card.company} · {mockDescription?.postedAt}
              </p>
              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 17, fontWeight: 700, color: "#1A1A1A", lineHeight: 1.3 }}>{card.role}</p>
            </div>
          </div>

          {/* Meta row */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            {[
              { icon: "📍", text: job?.location || "Remote" },
              { icon: "⏱", text: mockDescription?.type || "Full-time" },
              { icon: "💼", text: mockDescription?.level || "Senior Level" },
              { icon: "💰", text: job?.salary || "Competitive" },
            ].map((m, i) => (
              <span key={i} style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#52493F", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 12 }}>{m.icon}</span> {m.text}
              </span>
            ))}
          </div>

          {/* Fit score bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: `${fitColor}0D`, borderRadius: 8, marginBottom: 14 }}>
            <div style={{ position: "relative", width: 44, height: 44, flexShrink: 0 }}>
              <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="22" cy="22" r="18" stroke="rgba(0,0,0,0.08)" strokeWidth="4" fill="none" />
                <circle cx="22" cy="22" r="18" stroke={fitColor} strokeWidth="4" fill="none" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 18 * card.fit / 100} ${2 * Math.PI * 18}`} />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 11, fontWeight: 700, color: fitColor }}>{card.fit}%</span>
              </div>
            </div>
            <div>
              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 700, color: fitColor, marginBottom: 2 }}>
                {card.fit >= 88 ? "Strong match" : card.fit >= 75 ? "Good fit" : "Fair match"}
              </p>
              <div style={{ display: "flex", gap: 12 }}>
                {([["Experience", Math.min(100, Math.round(card.fit * 1.08))], ["Skills", Math.round(card.fit * 0.88)], ["Industry", Math.round(card.fit * 0.94)]] as [string, number][]).map(([label, pct]) => (
                  <span key={label} style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: "#7A7268" }}>
                    {label} <span style={{ fontWeight: 600, color: "#1A1A1A" }}>{Math.min(100, pct)}%</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Stage + move */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: "#A09890" }}>Move to:</span>
            {KANBAN_STAGES.filter((s) => s !== card.stage).map((s) => (
              <button key={s} onClick={() => { moveCard(card.id, s); }}
                style={{ padding: "4px 10px", background: `${STAGE_COLORS[s]}15`, border: `1px solid ${STAGE_COLORS[s]}40`, borderRadius: 100, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 500, color: STAGE_COLORS[s], cursor: "pointer" }}>
                {STAGE_LABELS[s]}
              </button>
            ))}
          </div>

          {/* Tab strip */}
          <div style={{ display: "flex", gap: 0, borderBottom: "none" }}>
            {(["overview", "company", "ai"] as const).map((t) => {
              const labels = { overview: "Overview", company: "Company", ai: "✦ AI Tools" };
              const active = drawerTab === t;
              return (
                <button key={t} onClick={() => setDrawerTab(t)}
                  style={{ padding: "8px 16px", background: "none", border: "none", borderBottom: active ? "2px solid #1A3A2F" : "2px solid transparent", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: active ? 600 : 400, color: active ? "#1A3A2F" : "#A09890", cursor: "pointer", transition: "all 0.15s" }}>
                  {labels[t]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

          {/* ── Overview Tab ── */}
          {drawerTab === "overview" && mockDescription && (
            <div style={{ animation: "fadeIn 0.2s ease both" }}>
              <div style={{ marginBottom: 22 }}>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 600, color: "#A09890", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>Responsibilities</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {mockDescription.responsibilities.map((r, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: "#1A3A2F", fontSize: 11, flexShrink: 0, marginTop: 2 }}>•</span>
                      <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 300, color: "#2A2218", lineHeight: 1.6 }}>{r}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 22 }}>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 600, color: "#A09890", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>Requirements</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {mockDescription.requirements.map((r, i) => {
                    const matched = i < Math.round(mockDescription.requirements.length * (card.fit / 100));
                    return (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "7px 10px", borderRadius: 5, background: matched ? "rgba(74,139,106,0.05)" : "rgba(160,152,144,0.05)" }}>
                        <span style={{ fontSize: 11, flexShrink: 0, marginTop: 2, color: matched ? "#4A8B6A" : "#A09890" }}>{matched ? "✓" : "○"}</span>
                        <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 300, color: matched ? "#2A2218" : "#7A7268", lineHeight: 1.6 }}>{r}</p>
                        {matched && <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, fontWeight: 600, color: "#4A8B6A", padding: "2px 6px", background: "rgba(74,139,106,0.1)", borderRadius: 100, flexShrink: 0, alignSelf: "center" }}>You have this</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: 22 }}>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 600, color: "#A09890", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>Nice to have</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {mockDescription.niceToHave.map((r, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: "#C4A86A", fontSize: 11, flexShrink: 0, marginTop: 2 }}>△</span>
                      <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 300, color: "#2A2218", lineHeight: 1.6 }}>{r}</p>
                    </div>
                  ))}
                </div>
              </div>

              {job && (
                <div style={{ marginBottom: 22 }}>
                  <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 600, color: "#A09890", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>Searchly's fit summary</p>
                  <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 300, color: "#2A2218", lineHeight: 1.7, padding: "12px 14px", background: "rgba(26,58,47,0.04)", borderRadius: 7, borderLeft: "3px solid #1A3A2F" }}>
                    {job.fitSummary}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Company Tab ── */}
          {drawerTab === "company" && mockDescription && (
            <div style={{ animation: "fadeIn 0.2s ease both" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 18, padding: "16px", background: "rgba(26,58,47,0.04)", borderRadius: 10 }}>
                <div style={{ width: 52, height: 52, borderRadius: 12, background: "#1A3A2F", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 16, fontWeight: 700, color: "#E8D5A3" }}>{card.initials}</span>
                </div>
                <div>
                  <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 15, fontWeight: 700, color: "#1A1A1A", marginBottom: 2 }}>{card.company}</p>
                  <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#52493F" }}>{mockDescription.companyIndustry} · {mockDescription.companyStage}</p>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
                {[["Stage", mockDescription.companyStage], ["Size", mockDescription.companySize], ["Industry", mockDescription.companyIndustry], ["Location", job?.location || "Remote"]].map(([k, v]) => (
                  <div key={k as string} style={{ padding: "10px 12px", background: "#F8F6F2", borderRadius: 7 }}>
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, fontWeight: 600, color: "#A09890", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 3 }}>{k}</p>
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 500, color: "#1A1A1A" }}>{v}</p>
                  </div>
                ))}
              </div>
              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 600, color: "#A09890", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>About</p>
              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 300, color: "#2A2218", lineHeight: 1.7 }}>{mockDescription.companyBlurb}</p>
            </div>
          )}

          {/* ── AI Tools Tab ── */}
          {drawerTab === "ai" && (
            <div style={{ animation: "fadeIn 0.2s ease both" }}>

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
              onClick={() => setTool(tool === "resume" ? null : "resume")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                background: tool === "resume" ? "#1A3A2F" : "#FFFFFF",
                color: tool === "resume" ? "#E8D5A3" : "#1A1A1A",
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
                Update resume
                <span style={{ display: "block", fontSize: 10, fontWeight: 300, opacity: 0.7 }}>Maximize your interview chances</span>
              </span>
              <span style={{ fontSize: 12, opacity: 0.5 }}>{tool === "resume" ? "▲" : "›"}</span>
            </button>
            <button
              onClick={() => setTool(tool === "cover" ? null : "cover")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                background: tool === "cover" ? "#1A3A2F" : "#FFFFFF",
                color: tool === "cover" ? "#E8D5A3" : "#1A1A1A",
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
                Create cover letter
                <span style={{ display: "block", fontSize: 10, fontWeight: 300, opacity: 0.7 }}>Make your application stand out</span>
              </span>
              <span style={{ fontSize: 12, opacity: 0.5 }}>{tool === "cover" ? "▲" : "›"}</span>
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
                Tell me why I&apos;m a good fit
                <span style={{ display: "block", fontSize: 10, fontWeight: 300, opacity: 0.7 }}>Understand your strengths & gaps</span>
              </span>
              <span style={{ fontSize: 12, opacity: 0.5 }}>{tool === "fit" ? "▲" : "›"}</span>
            </button>
            {dbId && (
              <button
                onClick={() => setResumeEditorOpen(true)}
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
                <span style={{ fontSize: 14, flexShrink: 0 }}>📄</span>
                <span style={{ flex: 1 }}>
                  Tailored resume
                  <span style={{ display: "block", fontSize: 10, fontWeight: 300, opacity: 0.7 }}>AI-tailored full resume for this role</span>
                </span>
                <span style={{ fontSize: 12, opacity: 0.5 }}>›</span>
              </button>
            )}
          </div>

          {/* Tool views or standard drawer content */}
          {/* Tool view: Update resume */}
          {tool === "resume" && job && (
            <div style={{ animation: "fadeIn 0.3s ease both" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 600, color: "#1A3A2F", textTransform: "uppercase", letterSpacing: "1px" }}>Updated resume bullets</p>
                <button
                  onClick={() => { if (navigator.clipboard) navigator.clipboard.writeText(job.bullets.map(b => "• " + b.tailored).join("\n\n")); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }}
                  style={{ padding: "4px 10px", background: copied ? "rgba(74,139,106,0.1)" : "#1A3A2F", color: copied ? "#4A8B6A" : "#E8D5A3", border: "none", borderRadius: 4, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, cursor: "pointer" }}
                >
                  {copied ? "Copied ✓" : "Copy all"}
                </button>
              </div>
              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 300, color: "#52493F", lineHeight: 1.55, marginBottom: 14, textWrap: "pretty" }}>
                Searchly rewrote these bullets to align with what {card.company} screens for. Replace the originals on your resume.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {job.bullets.map((b, i) => (
                  <div key={i} style={{ padding: "12px 14px", background: "#FFFFFF", borderRadius: 7, borderLeft: "3px solid #1A3A2F" }}>
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 400, color: "#1A1A1A", lineHeight: 1.6, marginBottom: 8, textWrap: "pretty" }}>
                      {b.tailored}
                    </p>
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: "#A09890", fontStyle: "italic" }}>
                      Original: {b.original}
                    </p>
                  </div>
                ))}
              </div>
              <div style={{ padding: "14px", background: "rgba(196,168,106,0.08)", borderRadius: 7, borderLeft: "2px solid #C4A86A" }}>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 600, color: "#7A6020", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6 }}>Suggested summary line</p>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 300, color: "#2A2218", lineHeight: 1.6, fontStyle: "italic", textWrap: "pretty" }}>
                  Senior PM with 8 years scaling API-first SaaS products — {card.company}-scale infrastructure experience with measurable revenue impact.
                </p>
              </div>
            </div>
          )}

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
                  Searchly&apos;s fit summary
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
            <div style={{ padding: 24, textAlign: "center", color: "#A09890", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12 }}>
              <SparkleIcon /> Detailed analysis available for jobs Searchly has read.
            </div>
          ) : null}
            </div>
          )}
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
    </>
  );
}
