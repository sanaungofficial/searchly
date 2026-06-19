#!/usr/bin/env python3
"""Splice new MyJobsTab + PipelineTab + helper components into workspace-opportunities.tsx"""

import re

FILE = "/home/z/my-project/src/components/scout/workspace-opportunities.tsx"

with open(FILE, "r") as f:
    content = f.read()

# Find the start of MyJobsTab section and the start of JobDrawer section
start_marker = "/* ──────────────────────────────────────────────────────────────\n   My Jobs tab — saved jobs list with quick apply"
end_marker = "/* ──────────────────────────────────────────────────────────────\n   Job drawer (right side panel)"

start_idx = content.index(start_marker)
end_idx = content.index(end_marker)

# The new code that replaces everything between start_marker and end_marker
new_code = '''/* ──────────────────────────────────────────────────────────────
   Helpers: CSV parser, StatusDropdown, CsvUploadPanel, MyJobsUrlPastePanel
   ───────────────────────────────────────────────────────────────── */

/* Parse CSV text into a list of {url, company?, role?} objects.
   Supports two formats:
   1. Header row: url,company,role
   2. Plain URLs (one per line)
   3. Inline CSV: url,company,role (no header) */
function parseCsv(text: string): Array<{ url: string; company?: string; role?: string }> {
  const lines = text.split(/\\r?\\n/).map((l) => l.trim()).filter(Boolean);
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

'''

new_content = content[:start_idx] + new_code + "\n" + content[end_idx:]

with open(FILE, "w") as f:
    f.write(new_content)

print(f"Done. File size: {len(new_content)} chars")
