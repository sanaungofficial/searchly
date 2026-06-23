"use client";

import { useLayoutEffect, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { ResumeEditor } from "./resume-editor";
import { CompanyLogo } from "./company-logo";
import { ResumeMatchDrawer } from "./resume-match-drawer";
import { CoverLetterDrawer } from "./cover-letter-drawer";
import { CreditsStatusBar } from "./credits-display";
import { fontSans, fontDisplay, fontMono, color, type as T, drawerType as DT } from "@/lib/typography";

export type DrawerTool = "resume" | "cover" | "fit" | null;

interface JobDrawerProps {
  card: KanbanCard;
  onClose: () => void;
  moveCard: (id: number, stage: KanbanStage) => void;
  onDelete: () => void;
  onCardUpdate: (fields: Record<string, string | null>) => void;
  tool?: DrawerTool;
  onToolChange?: (t: DrawerTool) => void;
}

type DrawerTab = "overview" | "company";

const sans = fontSans;
const serif = fontDisplay;
const mono = fontMono;
const mint = "#4A8B6A";
const mintLight = "rgba(74,139,106,0.12)";
const mintBtn = "#3D7A5C";
const border = "1px solid rgba(0,0,0,0.08)";
const cardBg = "#FFFFFF";
const pageBg = "#F4F6F5";
const DRAWER_WIDTH = "min(1180px, calc(100vw - 16px))";
const AI_SIDEBAR_WIDTH = 340;

function guessCompanyWebsite(jobUrl: string | null): string | null {
  if (!jobUrl) return null;
  try {
    const u = new URL(jobUrl.startsWith("http") ? jobUrl : `https://${jobUrl}`);
    const host = u.hostname.replace(/^www\./, "");
    if (/lever\.co|greenhouse\.io|ashbyhq\.com|workday|myworkdayjobs|linkedin\.com|indeed\.com|job-boards/i.test(host)) {
      return null;
    }
    return u.origin;
  } catch {
    return null;
  }
}

type TrackedCompanySummary = { id: string; name: string };

function normalizeCompanyName(name: string) {
  return name.trim().toLowerCase();
}

function CompanyTrackPanel({
  companyName,
  jobUrl,
  hqLocation,
}: {
  companyName: string;
  jobUrl: string | null;
  hqLocation: string | null;
}) {
  const router = useRouter();
  const [tracked, setTracked] = useState<TrackedCompanySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTracked = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/companies", { signal: AbortSignal.timeout(15000) });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = (data as { error?: string } | null)?.error ?? "Couldn't load your tracked companies.";
        setError(msg);
        return;
      }
      if (!Array.isArray(data)) {
        setError("Unexpected response from server.");
        return;
      }
      const list = data as TrackedCompanySummary[];
      const match = list.find((c) => normalizeCompanyName(c.name) === normalizeCompanyName(companyName));
      setTracked(match ?? null);
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }, [companyName]);

  useEffect(() => {
    loadTracked();
  }, [loadTracked]);

  async function handleTrack() {
    setSaving(true);
    setError(null);
    try {
      const website = guessCompanyWebsite(jobUrl);
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: companyName.trim(),
          website,
          hqLocation: hqLocation?.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = (data as { error?: string }).error ?? "Couldn't track company.";
        if (res.status === 409) {
          await loadTracked();
          return;
        }
        setError(msg);
        return;
      }
      const created = (await res.json()) as TrackedCompanySummary;
      setTracked(created);
    } catch {
      setError("Network error — company not tracked.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 20, paddingTop: 20, borderTop: border }}>
      {loading ? (
        <p style={{ fontFamily: sans, fontSize: 14, color: "var(--scout-muted)", margin: 0 }}>Checking watchlist…</p>
      ) : tracked ? (
        <>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              background: mintLight,
              borderRadius: 20,
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 12, color: mint }}>✓</span>
            <span style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: "#2A4A3A" }}>On your watchlist</span>
          </div>
          <p style={{ fontFamily: sans, fontSize: 14, color: "var(--scout-muted)", lineHeight: 1.55, margin: "0 0 14px" }}>
            Scan open roles, enrich company intel, and manage notes from Companies.
          </p>
          <button
            type="button"
            onClick={() => router.push("/opportunities/companies")}
            style={{
              padding: "10px 18px",
              background: mintBtn,
              color: "#FFF",
              border: "none",
              borderRadius: 10,
              fontFamily: sans,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Open in Companies →
          </button>
        </>
      ) : (
        <>
          <p style={{ fontFamily: sans, fontSize: 14, color: "var(--scout-muted)", lineHeight: 1.55, margin: "0 0 14px" }}>
            Add {companyName} to your watchlist to scan careers pages for new roles and keep company notes in one place.
          </p>
          {error && (
            <p style={{ fontFamily: sans, fontSize: 13, color: "#B45309", margin: "0 0 10px" }}>{error}</p>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleTrack}
              disabled={saving}
              style={{
                padding: "10px 18px",
                background: saving ? "rgba(26,58,47,0.35)" : mintBtn,
                color: "#FFF",
                border: "none",
                borderRadius: 10,
                fontFamily: sans,
                fontSize: 14,
                fontWeight: 600,
                cursor: saving ? "default" : "pointer",
              }}
            >
              {saving ? "Adding…" : "Track company"}
            </button>
            {error && (
              <button
                type="button"
                onClick={() => loadTracked()}
                disabled={loading}
                style={{
                  padding: "10px 18px",
                  background: "#FFF",
                  color: "#1A3A2F",
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 10,
                  fontFamily: sans,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: loading ? "default" : "pointer",
                }}
              >
                Retry
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function IconPin() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 21s7-4.5 7-10a7 7 0 1 0-14 0c0 5.5 7 10 7 10z" />
      <circle cx="12" cy="11" r="2.5" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconBriefcase() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
function IconHome() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}
function IconDollar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 2v20M17 7.5A4.5 4.5 0 0 0 7.5 12H12a4.5 4.5 0 1 1 0 9H7" />
    </svg>
  );
}

function MetaRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: sans, fontSize: 14, color: "#5C534A" }}>
      <span style={{ color: "#8A8278", display: "flex" }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      {icon && <span style={{ color: mint, display: "flex" }}>{icon}</span>}
      <h3 style={{ fontFamily: sans, fontSize: 18, fontWeight: 700, color: "#1A1A1A", margin: 0 }}>{children}</h3>
    </div>
  );
}

function MatchBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontFamily: sans, fontSize: 13, color: "#5C534A" }}>{label}</span>
        <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: mint }}>{pct}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 100, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: mint, borderRadius: 100 }} />
      </div>
    </div>
  );
}

function parseBullets(text: string | null | undefined): string[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const bullets = lines.filter((l) => /^[-•*]\s/.test(l) || /^\d+[.)]\s/.test(l));
  if (bullets.length > 0) return bullets.map((l) => l.replace(/^[-•*\d.)]+\s*/, "")).slice(0, 10);
  const paras = text.split(/\n\n+/).filter((p) => p.trim().length > 20);
  if (paras.length > 1) return paras.slice(1).flatMap((p) => p.split(/\n/).filter(Boolean)).slice(0, 8);
  return [];
}

function summaryParagraph(text: string | null | undefined): string {
  if (!text) return "";
  const first = text.split(/\n\n+/)[0]?.trim() ?? text.trim();
  if (first.length <= 420) return first;
  return first.slice(0, 420).trim() + "…";
}

function daysLabel(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function MatchScoreCard({ fit, onRunMatch }: { fit: number; onRunMatch?: () => void }) {
  const fitColor = fit >= 85 ? mint : fit >= 70 ? "#C4A86A" : "var(--scout-muted)";
  const label = fit >= 85 ? "STRONG MATCH" : fit >= 70 ? "GOOD MATCH" : "FAIR MATCH";
  const exp = fit;
  const skill = Math.max(0, Math.min(100, fit - 4));
  const industry = Math.max(0, Math.min(100, fit - 8));

  if (fit <= 0) {
    return (
      <div style={{ background: "#F0F2F1", borderRadius: 14, padding: "20px 22px", minWidth: 220, border }}>
        <p style={{ fontFamily: sans, fontSize: 15, fontWeight: 600, color: "#5C534A", marginBottom: 10 }}>Match score</p>
        <p style={{ fontFamily: sans, fontSize: 14, color: "#8A8278", lineHeight: 1.5, marginBottom: 14 }}>See how well your resume fits this role.</p>
        {onRunMatch && (
          <button
            onClick={onRunMatch}
            style={{ width: "100%", padding: "11px 14px", background: mintBtn, color: "#FFF", border: "none", borderRadius: 10, fontFamily: sans, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Analyze match
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ background: "#F0F2F1", borderRadius: 14, padding: "20px 22px", minWidth: 220, border }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
          <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="32" cy="32" r="26" stroke="rgba(0,0,0,0.08)" strokeWidth="6" fill="none" />
            <circle cx="32" cy="32" r="26" stroke={fitColor} strokeWidth="6" fill="none" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 26 * fit / 100} ${2 * Math.PI * 26}`} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: fitColor }}>{fit}%</span>
          </div>
        </div>
        <div>
          <p style={{ fontFamily: sans, fontSize: 13, fontWeight: 700, color: fitColor, letterSpacing: "0.4px", margin: 0 }}>{label}</p>
          <p style={{ fontFamily: sans, fontSize: 14, color: "#8A8278", margin: "3px 0 0" }}>vs. your profile</p>
        </div>
      </div>
      <MatchBar label="Experience Level" pct={exp} />
      <MatchBar label="Skills" pct={skill} />
      <MatchBar label="Industry Exp." pct={industry} />
    </div>
  );
}

function AiToolCard({
  title,
  subtitle,
  buttonLabel,
  highlighted,
  creditCost,
  onClick,
}: {
  title: string;
  subtitle: string;
  buttonLabel: string;
  highlighted?: boolean;
  creditCost?: number;
  onClick: () => void;
}) {
  return (
    <div
      style={{
        background: highlighted ? mintLight : cardBg,
        border,
        borderRadius: 14,
        padding: "18px 20px",
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <p style={{ fontFamily: sans, fontSize: 16, fontWeight: 700, color: "#1A1A1A", margin: 0 }}>{title}</p>
        {creditCost ? (
          <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 600, color: "var(--scout-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>
            {creditCost} credit{creditCost !== 1 ? "s" : ""}
          </span>
        ) : null}
      </div>
      <p style={{ fontFamily: sans, fontSize: 14, color: "var(--scout-muted)", lineHeight: 1.5, margin: "0 0 14px" }}>{subtitle}</p>
      <button
        onClick={onClick}
        style={{
          width: "100%",
          padding: "12px 16px",
          background: mintBtn,
          color: "#FFF",
          border: "none",
          borderRadius: 10,
          fontFamily: sans,
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

export function JobDrawer({ card, onClose, moveCard, onDelete, onCardUpdate, tool = null, onToolChange }: JobDrawerProps) {
  const { openFitChat } = useWorkspace();
  const dbId = (card as KanbanCard & { _dbId?: string })._dbId ?? null;
  const cardUrl = (card as KanbanCard & { _url?: string })._url ?? null;
  const meta = (card as KanbanCard & { _meta?: JobMeta })._meta ?? null;
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("overview");
  const [resumeEditorOpen, setResumeEditorOpen] = useState(false);
  const [matchDrawerOpen, setMatchDrawerOpen] = useState(false);
  const [coverDrawerOpen, setCoverDrawerOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  useLayoutEffect(() => { setVisible(true); }, []);

  useEffect(() => {
    if (tool === "resume") setMatchDrawerOpen(true);
    if (tool === "cover") setCoverDrawerOpen(true);
  }, [tool]);

  const extCard = card as KanbanCard & { _dbId?: string; _url?: string; _userNotes?: string; _companyLinkedinUrl?: string };
  const [urlValue, setUrlValue] = useState(extCard._url ?? "");
  const [notesValue, setNotesValue] = useState(extCard._userNotes ?? "");
  const [descValue, setDescValue] = useState(meta?.description ?? "");
  const [nextStepValue, setNextStepValue] = useState(meta?.nextStep ?? "");
  const [nextStepDueValue, setNextStepDueValue] = useState(meta?.nextStepDue ?? "");

  function patchNextStep(nextStep: string, nextStepDue: string) {
    if (!dbId) return;
    const updatedMeta = { ...(meta ?? {}), nextStep: nextStep || null, nextStepDue: nextStepDue || null };
    fetch(`/api/jobs/${dbId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: JSON.stringify(updatedMeta) }),
    });
  }

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
    const updatedMeta = { ...(meta ?? {}), description: value || null };
    fetch(`/api/jobs/${dbId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: JSON.stringify(updatedMeta) }),
    });
  }

  const job = card.jobRef !== null ? JOBS[card.jobRef] : null;
  const setTool = (t: DrawerTool) => onToolChange?.(t);

  const location = job?.location || meta?.location;
  const salary = job?.salary || meta?.salary;
  const jobType = meta?.jobType;
  const expLevel = meta?.seniority || meta?.experienceLevel;
  const remoteLabel = meta?.remote === true ? "Remote" : meta?.remote === false ? "On-site" : null;
  const summary = summaryParagraph(meta?.description ?? null);
  const bullets = parseBullets(meta?.description ?? null);
  const tags = meta?.tags ?? [];
  const requirements = meta?.requirements ?? [];

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.18)", zIndex: 60 }} />
      <div
        style={{
          position: "fixed",
          top: 8,
          right: 8,
          bottom: 8,
          width: DRAWER_WIDTH,
          maxWidth: "calc(100vw - 16px)",
          background: pageBg,
          borderRadius: 14,
          overflow: "hidden",
          zIndex: 70,
          boxShadow: "0 12px 48px rgba(0,0,0,0.16)",
          transform: visible ? "translateX(0)" : "translateX(calc(100% + 16px))",
          transition: "transform 0.25s ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Top bar — tabs + actions (JobRight-style) */}
        <div style={{ padding: "14px 28px", background: cardBg, borderBottom: border, display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: "#8A8278", padding: 0, lineHeight: 1, marginRight: 4 }}
          >
            ×
          </button>
          <div style={{ display: "flex", gap: 24 }}>
            {(["overview", "company"] as DrawerTab[]).map((t) => {
              const active = drawerTab === t;
              return (
                <button
                  key={t}
                  onClick={() => setDrawerTab(t)}
                  style={{
                    background: "none",
                    border: "none",
                    borderBottom: active ? `2px solid ${mint}` : "2px solid transparent",
                    padding: "6px 0 10px",
                    fontFamily: sans,
                    fontSize: 15,
                    fontWeight: active ? 700 : 500,
                    color: active ? "#1A1A1A" : "#8A8278",
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            {urlValue && (
              <a
                href={urlValue}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: sans, fontSize: 14, color: "#5C534A", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
              >
                Original job post ↗
              </a>
            )}
            {urlValue && (
              <a
                href={urlValue}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "10px 20px",
                  background: mintBtn,
                  color: "#FFF",
                  borderRadius: 10,
                  fontFamily: sans,
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: "none",
                  letterSpacing: "0.2px",
                }}
              >
                APPLY NOW
              </a>
            )}
          </div>
        </div>

        {drawerTab === "company" ? (
          <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
              <SectionTitle>Company</SectionTitle>
              <div style={{ background: cardBg, border, borderRadius: 12, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                  <CompanyLogo name={card.company} website={cardUrl} size={52} />
                  <div>
                    <p style={{ fontFamily: serif, fontSize: 24, fontWeight: 700, color: "#1A1A1A", margin: 0 }}>{card.company}</p>
                    {location && <p style={{ fontFamily: sans, fontSize: 14, color: "var(--scout-muted)", margin: "6px 0 0" }}>{location}</p>}
                  </div>
                </div>
                <a
                  href={companyLinkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontFamily: sans, fontSize: 14, color: mint, fontWeight: 600 }}
                >
                  View on LinkedIn ↗
                </a>
                <CompanyTrackPanel
                  companyName={card.company}
                  jobUrl={urlValue || cardUrl}
                  hqLocation={location ?? null}
                />
              </div>
            </div>
        ) : (
          /* Overview — left: job posting · right: pipeline, notes, AI */
          <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
            <div style={{ flex: 1, minWidth: 0, overflowY: "auto", overflowX: "hidden" }}>
              {/* Hero — title + match score */}
              <div style={{ padding: "28px 32px 24px", background: cardBg, borderBottom: border }}>
                <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
                      <CompanyLogo name={card.company} website={cardUrl} size={56} />
                      <div>
                        <p style={{ fontFamily: sans, fontSize: 14, color: "var(--scout-muted)", margin: 0 }}>
                          <a href={companyLinkedinUrl} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none", fontWeight: 600 }}>
                            {card.company}
                          </a>
                          {" · "}{daysLabel(card.days)}
                        </p>
                      </div>
                    </div>
                    <h2 style={{ fontFamily: serif, fontSize: 28, fontWeight: 700, color: "#1A1A1A", margin: "0 0 16px", lineHeight: 1.2 }}>
                      {card.role}
                    </h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px 24px" }}>
                      {location && <MetaRow icon={<IconPin />} label={location} />}
                      {remoteLabel && <MetaRow icon={<IconHome />} label={remoteLabel} />}
                      {jobType && <MetaRow icon={<IconClock />} label={jobType} />}
                      {expLevel && <MetaRow icon={<IconBriefcase />} label={expLevel} />}
                      {salary && <MetaRow icon={<IconDollar />} label={salary} />}
                    </div>
                  </div>
                  <MatchScoreCard fit={card.fit} onRunMatch={dbId ? () => setMatchDrawerOpen(true) : undefined} />
                </div>
              </div>

              {/* Main job content — posting only */}
              <div style={{ padding: "28px 32px 36px" }}>
                  {summary && (
                    <div style={{ marginBottom: 22 }}>
                      <p style={{ fontFamily: sans, fontSize: 15, color: "#2A2218", lineHeight: 1.7, margin: 0 }}>{summary}</p>
                      {tags.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                          {tags.map((t, i) => (
                            <span key={i} style={{ padding: "6px 12px", background: mintLight, borderRadius: 100, fontFamily: sans, fontSize: 13, fontWeight: 500, color: "#2A4A3A" }}>
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {bullets.length > 0 && (
                    <div style={{ marginBottom: 22 }}>
                      <SectionTitle icon={<IconBriefcase />}>Responsibilities</SectionTitle>
                      <ul style={{ margin: 0, paddingLeft: 20, fontFamily: sans, fontSize: 15, color: "#2A2218", lineHeight: 1.7 }}>
                        {bullets.map((b, i) => (
                          <li key={i} style={{ marginBottom: 8 }}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {requirements.length > 0 && (
                    <div style={{ marginBottom: 22 }}>
                      <SectionTitle icon={<span style={{ fontSize: 16 }}>◎</span>}>Qualification</SectionTitle>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {requirements.map((r, i) => (
                          <span
                            key={i}
                            style={{
                              padding: "6px 13px",
                              background: card.fit >= 70 ? mintLight : "rgba(0,0,0,0.05)",
                              border: card.fit >= 70 ? `1px solid rgba(74,139,106,0.25)` : border,
                              borderRadius: 100,
                              fontFamily: sans,
                              fontSize: 13,
                              fontWeight: 500,
                              color: card.fit >= 70 ? "#2A4A3A" : "#5C534A",
                            }}
                          >
                            {card.fit >= 70 ? "✓ " : ""}{r}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mock job tool views */}
                  {tool !== null && !job && (
                    <div style={{ padding: 16, background: cardBg, borderRadius: 12, border, marginBottom: 14 }}>
                      <p style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                        {tool === "resume" ? "Resume tailoring" : tool === "cover" ? "Cover letter" : "Fit analysis"} — coming soon
                      </p>
                      <p style={{ fontFamily: sans, fontSize: 14, color: "#52493F", lineHeight: 1.6, margin: 0 }}>
                        AI tools for manually added jobs are rolling out shortly.
                      </p>
                    </div>
                  )}

                  {tool === "cover" && job && (
                    <div style={{ marginBottom: 18 }}>
                      <SectionTitle>Cover letter</SectionTitle>
                      <div style={{ padding: 16, background: cardBg, borderRadius: 12, border, borderLeft: `3px solid ${mint}` }}>
                        <p style={{ fontFamily: sans, fontSize: 15, lineHeight: 1.75, whiteSpace: "pre-wrap", margin: 0 }}>{job.coverLetter}</p>
                      </div>
                    </div>
                  )}

                  {tool === "fit" && job && (
                    <div style={{ marginBottom: 18 }}>
                      <SectionTitle>Fit analysis</SectionTitle>
                      <p style={{ fontFamily: sans, fontSize: 15, lineHeight: 1.7, marginBottom: 12 }}>{job.fitSummary}</p>
                      {job.fitWorks.map((w, i) => (
                        <div key={i} style={{ padding: "10px 12px", background: mintLight, borderRadius: 8, marginBottom: 8, fontSize: 14 }}>✓ {w}</div>
                      ))}
                    </div>
                  )}

                  {tool === null && job ? (
                    <div>
                      <SectionTitle>Kimchi&apos;s fit summary</SectionTitle>
                      <p style={{ fontFamily: sans, fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>{job.fitSummary}</p>
                    </div>
                  ) : tool === null ? (
                    <div style={{ marginBottom: 18 }}>
                      <SectionTitle icon={<IconBriefcase />}>Job description</SectionTitle>
                      <textarea
                        value={descValue}
                        onChange={(e) => setDescValue(e.target.value)}
                        onBlur={() => patchDescription(descValue)}
                        placeholder="Paste or type the job description here. AI will fill this in automatically when you add via URL."
                        rows={descValue ? Math.min(12, Math.max(6, descValue.split("\n").length + 2)) : 6}
                        style={{
                          width: "100%",
                          fontFamily: sans,
                          fontSize: 15,
                          color: "#1A1A1A",
                          background: cardBg,
                          border,
                          borderRadius: 12,
                          padding: "16px 18px",
                          resize: "vertical",
                          outline: "none",
                          lineHeight: 1.7,
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  ) : null}

                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: border }}>
                    <input
                      value={urlValue}
                      onChange={(e) => setUrlValue(e.target.value)}
                      onBlur={() => patchField({ url: urlValue || null })}
                      placeholder="Job URL…"
                      style={{ width: "100%", fontSize: 13, fontFamily: sans, color: "#8A8278", background: "transparent", border: "none", borderBottom: "1px solid rgba(0,0,0,0.1)", outline: "none", padding: "4px 0" }}
                    />
                  </div>
                </div>
              </div>

            {/* Right — pipeline, notes, AI tools */}
            <div
              style={{
                width: AI_SIDEBAR_WIDTH,
                flexShrink: 0,
                padding: "24px 20px 32px",
                borderLeft: border,
                background: cardBg,
                overflowY: "auto",
                overflowX: "hidden",
                display: "flex",
                flexDirection: "column",
                gap: 24,
              }}
            >
              {/* Pipeline */}
              <div>
                <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, color: "#8A8278", textTransform: "uppercase", letterSpacing: "0.8px", margin: "0 0 12px" }}>
                  Pipeline
                </p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                  <span style={{
                    padding: "5px 12px",
                    borderRadius: 100,
                    background: `${STAGE_COLORS[card.stage]}18`,
                    color: STAGE_COLORS[card.stage],
                    fontFamily: sans,
                    fontSize: 12,
                    fontWeight: 700,
                  }}>
                    {STAGE_LABELS[card.stage]}
                  </span>
                  {dbId && (
                    <button
                      type="button"
                      onClick={() => { if (window.confirm("Remove this job from your pipeline?")) onDelete(); }}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#C4574A", fontFamily: sans, padding: 0 }}
                    >
                      Remove job
                    </button>
                  )}
                </div>
                <p style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, color: "#8A8278", textTransform: "uppercase", letterSpacing: "0.6px", margin: "0 0 8px" }}>Move to</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  {KANBAN_STAGES.filter((s) => s !== card.stage).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => moveCard(card.id, s)}
                      style={{
                        padding: "6px 10px",
                        background: pageBg,
                        border,
                        borderRadius: 7,
                        fontFamily: sans,
                        fontSize: 12,
                        fontWeight: 500,
                        color: "#1A1A1A",
                        cursor: "pointer",
                      }}
                    >
                      {STAGE_LABELS[s]}
                    </button>
                  ))}
                </div>
                <p style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, color: "#8A8278", textTransform: "uppercase", letterSpacing: "0.6px", margin: "0 0 8px" }}>Next action</p>
                <input
                  value={nextStepValue}
                  onChange={(e) => setNextStepValue(e.target.value)}
                  onBlur={() => patchNextStep(nextStepValue, nextStepDueValue)}
                  placeholder="e.g. Follow up with recruiter…"
                  style={{ width: "100%", padding: "10px 12px", border, borderRadius: 8, fontFamily: sans, fontSize: 13, outline: "none", background: pageBg, marginBottom: 8, boxSizing: "border-box" }}
                />
                <input
                  type="date"
                  value={nextStepDueValue}
                  onChange={(e) => setNextStepDueValue(e.target.value)}
                  onBlur={() => patchNextStep(nextStepValue, nextStepDueValue)}
                  style={{ width: "100%", padding: "10px 12px", border, borderRadius: 8, fontFamily: sans, fontSize: 13, outline: "none", background: pageBg, boxSizing: "border-box" }}
                />
              </div>

              {/* Notes */}
              <div>
                <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, color: "#8A8278", textTransform: "uppercase", letterSpacing: "0.8px", margin: "0 0 10px" }}>
                  Notes
                </p>
                <textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  onBlur={() => patchField({ userNotes: notesValue || null })}
                  placeholder="Recruiter contacts, impressions…"
                  rows={5}
                  style={{
                    width: "100%",
                    fontFamily: sans,
                    fontSize: 13,
                    background: pageBg,
                    border,
                    borderRadius: 10,
                    padding: "12px 14px",
                    resize: "vertical",
                    outline: "none",
                    lineHeight: 1.55,
                    boxSizing: "border-box",
                    minHeight: 100,
                  }}
                />
              </div>

              {/* AI tools */}
              <div>
                <p style={{ fontFamily: sans, fontSize: 15, fontWeight: 700, color: "#1A1A1A", margin: "0 0 14px", lineHeight: 1.3 }}>
                  Boost your interview chances
                </p>
              <CreditsStatusBar />
              <AiToolCard
                highlighted
                creditCost={1}
                title="Improve resume match"
                subtitle="See your match score and tailor your resume for this role."
                buttonLabel="Optimize my resume"
                onClick={() => setMatchDrawerOpen(true)}
              />
              <AiToolCard
                creditCost={1}
                title="Build cover letter"
                subtitle="Make your application stand out with a tailored letter."
                buttonLabel="Build cover letter"
                onClick={() => setCoverDrawerOpen(true)}
              />
              <AiToolCard
                creditCost={1}
                title="Analyze how well you fit"
                subtitle="Understand your strengths and gaps for this role."
                buttonLabel="Analyze fit"
                onClick={() => openFitChat(card.id)}
              />
              </div>
            </div>
          </div>
        )}
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
          onClose={() => setMatchDrawerOpen(false)}
          onTailorResume={() => { if (dbId) setResumeEditorOpen(true); }}
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
