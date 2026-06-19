"use client";

import { useRef, useState } from "react";
import {
  COMPANIES,
  JOBS,
  INITIAL_KANBAN_CARDS,
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

type OppTab = "discover" | "myjobs" | "tracker";

interface OpportunitiesProps {
  onOpenLive: () => void;
}

export function WorkspaceOpportunities({ onOpenLive }: OpportunitiesProps) {
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

  const [kanbanCards, setKanbanCards] = useState<KanbanCard[]>(INITIAL_KANBAN_CARDS);
  const [drawerCardId, setDrawerCardId] = useState<number | null>(null);
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

  const openDrawer = (cardId: number) => setDrawerCardId(cardId);
  const closeDrawer = () => setDrawerCardId(null);

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
            ["discover", "Discover"],
            ["myjobs", "My Jobs"],
            ["tracker", "Pipeline"],
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
        {(tab === "discover" || tab === "myjobs") && (
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
            {tab === "myjobs" && (
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
        )}
      </div>

      {/* URL paste panel — renders in My Jobs tab (DiscoverTab has its own inline panel) */}
      {showAddPanel && tab === "myjobs" && (
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

      {/* CSV upload panel — only in My Jobs */}
      {showCsvPanel && tab === "myjobs" && (
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
            onSelectCompany={() => {
              /* company detail view (could be expanded later) */
            }}
          />
        )}
        {tab === "myjobs" && (
          <MyJobsTab
            cards={kanbanCards.filter((c) => c.stage === "saved")}
            onChangeStage={changeStage}
            onOpenDrawer={openDrawer}
            onRemove={(id) => setKanbanCards((prev) => prev.filter((c) => c.id !== id))}
          />
        )}
        {tab === "tracker" && (
          <PipelineTab
            cards={kanbanCards.filter((c) => c.stage !== "saved")}
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
          />
        );
      })()}
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
              Scout it
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
                Scout is analyzing this listing…
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
        {/* Pipeline snapshot */}
        <div style={{ marginBottom: 28 }}>
          <p
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 9,
              fontWeight: 500,
              color: "#A09890",
              letterSpacing: "1.1px",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Your pipeline
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
            {[
              { count: pipeline.saved, label: "Saved", color: "#1A3A2F" },
              { count: pipeline.applied, label: "Applied", color: "#C4A86A" },
              { count: pipeline.interview, label: "Interviewing", color: "#4A8B6A" },
              { count: pipeline.offer, label: "Offers", color: "#C4574A" },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: "#FFFFFF",
                  borderRadius: 9,
                  padding: "14px 16px",
                  border: "1px solid rgba(0,0,0,0.06)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-dm-mono), monospace",
                    fontSize: 26,
                    fontWeight: 500,
                    color: s.color,
                    marginBottom: 3,
                  }}
                >
                  {s.count}
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 10,
                    color: "#A09890",
                  }}
                >
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>

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
              Scout signals · updated weekly
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
                Scout is scanning the market…
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

        {/* Monitored companies */}
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
              Scout radar · {COMPANIES.length} companies
            </p>
            <button
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 11,
                color: "#1A3A2F",
                padding: 0,
              }}
            >
              View all →
            </button>
          </div>
          <div
            style={{
              display: "flex",
              gap: 12,
              overflowX: "auto",
              paddingBottom: 6,
              scrollbarWidth: "none",
            }}
          >
            {COMPANIES.map((co) => {
              const fitColor = co.fit >= 90 ? "#4A8B6A" : co.fit >= 85 ? "#C4A86A" : "#A09890";
              const cardBorder = co.fit >= 90 ? "rgba(74,139,106,0.2)" : "rgba(0,0,0,0.06)";
              const rolesBadgeColor = co.openRoles.length > 0 ? "#4A8B6A" : "#A09890";
              return (
                <button
                  key={co.id}
                  onClick={() => onSelectCompany(co.id)}
                  style={{
                    flex: "none",
                    width: 220,
                    background: "#FFFFFF",
                    borderRadius: 10,
                    padding: "16px 16px 14px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
                    cursor: "pointer",
                    border: `1.5px solid ${cardBorder}`,
                    transition: "box-shadow 0.2s",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)")}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.boxShadow =
                      "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)")
                  }
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 7,
                          background: "#1A3A2F",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--font-dm-sans), system-ui",
                            fontSize: 10,
                            fontWeight: 600,
                            color: "#E8D5A3",
                          }}
                        >
                          {co.initials}
                        </span>
                      </div>
                      <p
                        style={{
                          fontFamily: "var(--font-dm-sans), system-ui",
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#1A1A1A",
                        }}
                      >
                        {co.name}
                      </p>
                    </div>
                    <p
                      style={{
                        fontFamily: "var(--font-dm-mono), monospace",
                        fontSize: 14,
                        fontWeight: 500,
                        color: fitColor,
                        flexShrink: 0,
                      }}
                    >
                      {co.fit}%
                    </p>
                  </div>
                  <p
                    style={{
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 10,
                      fontWeight: 300,
                      color: "#52493F",
                      lineHeight: 1.5,
                      marginBottom: 10,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {co.fitReason}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: rolesBadgeColor,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 9,
                        color: "#52493F",
                      }}
                    >
                      {co.openRoles.length} open role{co.openRoles.length !== 1 ? "s" : ""} matching you
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Upcoming live sessions preview */}
        <div>
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
              Live this week
            </p>
            <button
              onClick={onOpenLive}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 11,
                color: "#1A3A2F",
                padding: 0,
              }}
            >
              View all →
            </button>
          </div>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "none" }}>
            {LIVE_SESSIONS.filter((s) => !s.isLive)
              .slice(0, 3)
              .map((s) => (
                <button
                  key={s.id}
                  onClick={onOpenLive}
                  style={{
                    flex: "none",
                    width: 280,
                    background: "#FFFFFF",
                    borderRadius: 10,
                    padding: 0,
                    cursor: "pointer",
                    border: "1px solid rgba(0,0,0,0.06)",
                    overflow: "hidden",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      background: s.bgColor,
                      padding: "14px 16px 12px",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 9,
                        fontWeight: 600,
                        color: s.accentColor,
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                      }}
                    >
                      {s.category}
                    </span>
                    <p
                      style={{
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#FFFFFF",
                        marginTop: 4,
                        lineHeight: 1.3,
                      }}
                    >
                      {s.title}
                    </p>
                  </div>
                  <div style={{ padding: "10px 16px 12px" }}>
                    <p
                      style={{
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 10,
                        color: "#52493F",
                        marginBottom: 4,
                      }}
                    >
                      {s.startsIn} · {s.registered} registered
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 10,
                        color: "#A09890",
                      }}
                    >
                      with {s.host}
                    </p>
                  </div>
                </button>
              ))}
          </div>
        </div>
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
              Scout is analyzing {progress.done} of {progress.total} URLs…
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
          Scout it
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
          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#1A3A2F" }}>Scout is analyzing this listing…</p>
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
   My Jobs tab — all saved jobs with status dropdown
   ────────────────────────────────────────────────────────────── */
interface MyJobsTabProps {
  cards: KanbanCard[];
  onChangeStage: (id: number, stage: KanbanStage) => void;
  onOpenDrawer: (id: number) => void;
  onRemove: (id: number) => void;
}

function MyJobsTab({ cards, onChangeStage, onOpenDrawer, onRemove }: MyJobsTabProps) {
  if (cards.length === 0) {
    return (
      <div
        style={{
          padding: 80,
          textAlign: "center",
          color: "#A09890",
          fontFamily: "var(--font-dm-sans), system-ui",
          fontSize: 13,
        }}
      >
        No saved jobs yet. Use <strong style={{ color: "#1A3A2F" }}>+ Add job</strong> or <strong style={{ color: "#1A3A2F" }}>Upload CSV</strong> above to begin.
      </div>
    );
  }
  return (
    <div style={{ padding: "24px 32px 48px" }}>
      <p
        style={{
          fontFamily: "var(--font-dm-sans), system-ui",
          fontSize: 9,
          fontWeight: 500,
          color: "#A09890",
          letterSpacing: "1.1px",
          textTransform: "uppercase",
          marginBottom: 14,
        }}
      >
        Saved · {cards.length}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {cards.map((c) => {
          const job = c.jobRef !== null ? JOBS[c.jobRef] : null;
          const fitColor = c.fit >= 90 ? "#4A8B6A" : c.fit >= 85 ? "#C4A86A" : "#A09890";
          return (
            <div
              key={c.id}
              style={{
                background: "#FFFFFF",
                borderRadius: 10,
                padding: "18px 22px",
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
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
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 18, fontWeight: 500, color: fitColor }}>
                      {c.fit}%
                    </span>
                    <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: "#A09890" }}>fit</span>
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
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
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
                <button
                  onClick={() => onRemove(c.id)}
                  style={{
                    padding: "7px 12px",
                    background: "transparent",
                    color: "#A09890",
                    border: "none",
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  Remove
                </button>
                <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: "#A09890", marginLeft: "auto" }}>
                  Change status to move →
                </span>
              </div>
            </div>
          );
        })}
      </div>
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
  const stageOrder: KanbanStage[] = ["applied", "interview", "offer", "closed"];
  const sortedCards = [...visibleCards].sort((a, b) => {
    return stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage);
  });

  const filterChips: ["all" | KanbanStage, string][] = [
    ["all", "All"],
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
            ? "No jobs in pipeline yet. Move jobs from My Jobs by changing their status to Applied."
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
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 18, fontWeight: 500, color: fitColor }}>
                        {c.fit}%
                      </span>
                      <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: "#A09890" }}>fit</span>
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
interface JobDrawerProps {
  card: KanbanCard;
  onClose: () => void;
  moveCard: (id: number, stage: KanbanStage) => void;
  copied: boolean;
  setCopied: (b: boolean) => void;
}

function JobDrawer({ card, onClose, moveCard, copied, setCopied }: JobDrawerProps) {
  const job = card.jobRef !== null ? JOBS[card.jobRef] : null;
  const fitColor = card.fit >= 90 ? "#4A8B6A" : card.fit >= 85 ? "#C4A86A" : "#A09890";

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.18)", zIndex: 60 }}
      />
      <div
        style={{
          width: 440,
          background: "#F8F6F2",
          borderLeft: "1px solid rgba(0,0,0,0.07)",
          overflowY: "auto",
          zIndex: 70,
          position: "relative",
          animation: "slideInRight 0.25s ease both",
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
                  {card.company} · {job?.location || "Remote"}
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
            <span
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: 13,
                fontWeight: 500,
                color: fitColor,
              }}
            >
              {card.fit}% fit
            </span>
            {job && (
              <span
                style={{
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 10,
                  color: "#A09890",
                }}
              >
                · {job.salary}
              </span>
            )}
          </div>
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
                  onClose();
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

          {job ? (
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
                  Scout&apos;s fit summary
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
          ) : (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: "#A09890",
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 12,
              }}
            >
              <SparkleIcon /> Detailed analysis available for jobs Scout has read.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
