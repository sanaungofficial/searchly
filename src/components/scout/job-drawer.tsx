"use client";

import { useLayoutEffect, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import type { JobMeta } from "@/lib/job-meta";
import { resolveJobDescriptionText } from "@/lib/job-meta";
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
import { JobDrawerCompanySection } from "./job-drawer-company-section";
import { JobDrawerNetworkAdminSection, JobDrawerRecruiterSection } from "./job-drawer-recruiter-section";
import { useHirebaseCompanyProfile } from "@/hooks/useHirebaseCompanyProfile";
import { useIsMobile } from "@/hooks/use-mobile";
import { fontSans, fontMono, color, surface, border as B, type as T, drawerType as DT, displayTitleStyle } from "@/lib/typography";
import { ScoutBox, ScoutLabel } from "./scout-box";
import { ScoreExplainerLabel, ScoreExplainerPopover } from "./score-explainer-popover";
import { JobMatchScorePanel } from "./job-match-score-panel";
import type { MatchData } from "./job-match-ui";
import { matchDataToFitDisplay } from "./job-match-ui";
import { getJobFreshness } from "@/lib/job-posted-freshness";
import { JobFreshnessIndicator } from "./job-freshness-indicator";

export type DrawerTool = "resume" | "cover" | "fit" | null;

interface JobDrawerProps {
  card: KanbanCard;
  onClose: () => void;
  moveCard: (id: number, stage: KanbanStage) => void;
  onDelete: () => void;
  onCardUpdate: (fields: Record<string, string | null>) => void;
  tool?: DrawerTool;
  onToolChange?: (t: DrawerTool) => void;
  prospectMode?: boolean;
  onAddToPipeline?: () => void | Promise<void>;
  addingToPipeline?: boolean;
  existingPipelineCardId?: number | null;
  onOpenInPipeline?: () => void;
  elevated?: boolean;
  /** Prospect/recommended drawer — fetching full Hirebase posting */
  detailLoading?: boolean;
}

type ScrollSection = "overview" | "recruiter" | "company";

const sans = fontSans;
const mono = fontMono;
const line = B.line;
const lineStrong = B.lineStrong;
const cardBg = surface.card;
const pageBg = surface.page;
const mint = color.forest;
const mintLight = "rgba(26,58,47,0.08)";
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
    <div style={{ marginTop: 20, paddingTop: 20, borderTop: line }}>
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
              borderRadius: "var(--scout-radius)",
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 12, color: mint }}>✓</span>
            <span style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: color.forest }}>On your watchlist</span>
          </div>
          <p style={{ fontFamily: sans, fontSize: 14, color: "var(--scout-muted)", lineHeight: 1.55, margin: "0 0 14px" }}>
            Scan open roles, enrich company intel, and manage notes from Target Companies.
          </p>
          <button
            type="button"
            onClick={() => router.push("/profile/target-companies")}
            style={{
              padding: "10px 18px",
              background: color.forest,
              color: color.gold,
              border: "none",
              borderRadius: "var(--scout-radius)",
              fontFamily: sans,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              border: lineStrong,
            }}
          >
            Open in Target Companies →
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
                background: saving ? "rgba(26,58,47,0.35)" : color.forest,
                color: color.gold,
                border: "none",
                borderRadius: "var(--scout-radius)",
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
                  borderRadius: "var(--scout-radius)",
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
function IconGift() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="8" width="18" height="13" rx="1" />
      <path d="M12 8v13M3 12h18" />
      <path d="M12 8c-2 0-3-1.5-3-3.5S10 2 12 2s3 1.5 3 3.5S14 8 12 8z" />
    </svg>
  );
}
function IconTarget() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}
function IconBuilding() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M9 7h1M9 11h1M9 15h1M14 7h1M14 11h1M14 15h1" />
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
      <h3 style={displayTitleStyle(18)}>{children}</h3>
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

function resolveJobFields(meta: JobMeta | null) {
  const responsibilities = meta?.responsibilities?.length
    ? meta.responsibilities
    : parseBullets(meta?.description ?? null);
  const skills = meta?.skills?.length ? meta.skills : (meta?.requirements ?? []);
  const requiredQualifications = meta?.requiredQualifications?.length
    ? meta.requiredQualifications
    : skills.length === 0 ? (meta?.requirements ?? []) : [];
  const preferredQualifications = meta?.preferredQualifications ?? [];
  const jobSummary = meta?.jobSummary ?? summaryParagraph(meta?.description ?? null);
  const companySummary = meta?.companySummary ?? "";
  const benefits = meta?.benefits ?? [];
  const tags = meta?.tags ?? [];
  const hasStructuredSections = !!(
    meta?.jobSummary ||
    meta?.companySummary ||
    responsibilities.length > 0 ||
    skills.length > 0 ||
    requiredQualifications.length > 0 ||
    preferredQualifications.length > 0 ||
    benefits.length > 0
  );
  return {
    responsibilities,
    skills,
    requiredQualifications,
    preferredQualifications,
    jobSummary,
    companySummary,
    benefits,
    tags,
    hasStructuredSections,
  };
}

function JobDrawerMatchSection({
  meta,
  resumeMatch,
  resumeMatchLoading,
  resumeName,
}: {
  meta: JobMeta | null;
  resumeMatch?: MatchData | null;
  resumeMatchLoading?: boolean;
  resumeName?: string | null;
}) {
  const vector = meta?.vectorMatch;
  const fromResume = resumeMatch ? matchDataToFitDisplay(resumeMatch) : null;
  const match = fromResume ?? vector;
  if (!match || match.matchScore <= 0) return null;

  const sourceLabel = fromResume
    ? resumeName
      ? `for ${resumeName}`
      : "for selected resume"
    : "from your profile snapshot (Find roles feed)";

  return (
    <div style={{ marginBottom: 22, padding: "16px 18px", background: "rgba(74,139,106,0.08)", border: "1px solid rgba(74,139,106,0.22)" }}>
      <SectionTitle icon={<IconTarget />}>
        <ScoreExplainerLabel variant={fromResume ? "job-match" : "vector-match"}>Why this is a match</ScoreExplainerLabel>
      </SectionTitle>
      <p style={{ fontFamily: sans, fontSize: 13, color: "var(--scout-muted)", margin: "0 0 10px" }}>
        {match.matchLabel} fit ({match.matchScore}/100) {sourceLabel}
        {fromResume ? " · uses AI" : " · free estimate"}
      </p>
      {resumeMatchLoading && !fromResume && (
        <p style={{ fontFamily: sans, fontSize: 13, color: color.muted, margin: "0 0 10px" }}>Analyzing selected resume…</p>
      )}
      {match.matchReasons.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 20, fontFamily: sans, fontSize: 14, color: "#2A2218", lineHeight: 1.55 }}>
          {match.matchReasons.map((reason) => (
            <li key={reason} style={{ marginBottom: 6 }}>{reason}</li>
          ))}
        </ul>
      ) : (
        <p style={{ fontFamily: sans, fontSize: 14, color: "#2A2218", lineHeight: 1.55, margin: 0 }}>
          Matched to your profile based on role, skills, and experience. Run Analyze fit for a deeper breakdown.
        </p>
      )}
      {(match.matchedSkills?.length || match.gapSkills?.length) ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
          {match.matchedSkills?.map((skill) => (
            <span key={`m-${skill}`} style={{ padding: "4px 10px", background: mintLight, fontFamily: sans, fontSize: 12, color: "#2A4A3A" }}>{skill}</span>
          ))}
          {match.gapSkills?.map((skill) => (
            <span key={`g-${skill}`} style={{ padding: "4px 10px", background: "rgba(196,168,106,0.15)", fontFamily: sans, fontSize: 12, color: "#6B5A2A" }}>Gap: {skill}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: "#8A8278", margin: "0 0 2px", letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</p>
      <p style={{ fontFamily: sans, fontSize: 14, color: "#2A2218", margin: 0, lineHeight: 1.5 }}>{value}</p>
    </div>
  );
}

function JobDrawerDetailsSection({ meta }: { meta: JobMeta | null }) {
  if (!meta) return null;

  const freshness = getJobFreshness(meta.datePosted);
  const posted = meta.datePosted?.trim() ? freshness.detailLabel : null;
  const visa =
    meta.visaSponsored === true ? "Visa sponsorship available" : meta.visaSponsored === false ? "No visa sponsorship listed" : null;
  const industries = [...new Set([...(meta.industries ?? []), ...(meta.subindustries ?? [])])];

  const hasDetails = Boolean(
    posted ||
    meta.department?.trim() ||
    meta.team?.trim() ||
    meta.educationLevel?.trim() ||
    visa ||
    meta.jobBoard?.trim() ||
    industries.length,
  );
  if (!hasDetails) return null;

  return (
    <div style={{ marginBottom: 22 }}>
      <SectionTitle icon={<IconBriefcase />}>Role details</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "4px 20px" }}>
        <DetailRow label="Posted" value={posted} />
        <DetailRow label="Department" value={meta.department?.trim()} />
        <DetailRow label="Team" value={meta.team?.trim()} />
        <DetailRow label="Education" value={meta.educationLevel?.trim()} />
        <DetailRow label="Visa sponsorship" value={visa} />
        <DetailRow label="Source" value={meta.jobBoard?.trim() ? `via ${meta.jobBoard.trim()}` : null} />
      </div>
      {industries.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: "#8A8278", margin: "0 0 8px", letterSpacing: "0.04em", textTransform: "uppercase" }}>Industries</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {industries.map((tag) => (
              <span key={tag} style={{ padding: "4px 10px", background: surface.inset, border: line, fontFamily: sans, fontSize: 12, color: "#5C534A" }}>{tag}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function JobDescriptionPanel({
  text,
  loading,
  editable,
  value,
  onChange,
  onBlur,
}: {
  text: string;
  loading?: boolean;
  editable?: boolean;
  value?: string;
  onChange?: (v: string) => void;
  onBlur?: () => void;
}) {
  if (loading) {
    return (
      <div style={{ marginBottom: 22 }}>
        <SectionTitle icon={<IconBriefcase />}>Job description</SectionTitle>
        <div style={{ padding: "18px 20px", background: surface.inset, border: line }}>
          <p style={{ fontFamily: sans, fontSize: 14, color: "var(--scout-muted)", margin: "0 0 14px" }}>
            Loading full posting from Hirebase…
          </p>
          {[88, 72, 94, 60].map((w, i) => (
            <div
              key={i}
              style={{
                height: 12,
                width: `${w}%`,
                marginBottom: 10,
                background: "#F0EDE8",
                animation: "pulse 1.5s ease-in-out infinite",
                animationDelay: `${i * 0.12}s`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!text.trim() && !editable) {
    return (
      <div style={{ marginBottom: 22 }}>
        <SectionTitle icon={<IconBriefcase />}>Job description</SectionTitle>
        <p style={{ fontFamily: sans, fontSize: 14, color: "var(--scout-muted)", lineHeight: 1.65, margin: 0 }}>
          Full posting text isn&apos;t available yet. Open the job link below or refresh matching roles in Target Companies.
        </p>
      </div>
    );
  }

  if (editable) {
    return (
      <div style={{ marginBottom: 22 }}>
        <SectionTitle icon={<IconBriefcase />}>Job description</SectionTitle>
        <textarea
          value={value ?? text}
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={onBlur}
          placeholder="Paste or type the job description here. AI will fill this in automatically when you add via URL."
          rows={value || text ? Math.min(16, Math.max(8, (value ?? text).split("\n").length + 2)) : 8}
          style={{
            width: "100%",
            fontFamily: sans,
            fontSize: 15,
            color: "#1A1A1A",
            background: cardBg,
            border: line,
            borderRadius: "var(--scout-radius)",
            padding: "16px 18px",
            resize: "vertical",
            outline: "none",
            lineHeight: 1.7,
            boxSizing: "border-box",
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 22 }}>
      <SectionTitle icon={<IconBriefcase />}>Job description</SectionTitle>
      <div
        style={{
          padding: "18px 20px",
          background: cardBg,
          border: line,
          fontFamily: sans,
          fontSize: 15,
          color: "#2A2218",
          lineHeight: 1.75,
          whiteSpace: "pre-wrap",
        }}
      >
        {text}
      </div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul style={{ margin: 0, paddingLeft: 20, fontFamily: sans, fontSize: 15, color: "#2A2218", lineHeight: 1.7 }}>
      {items.map((b, i) => (
        <li key={i} style={{ marginBottom: 8 }}>{b}</li>
      ))}
    </ul>
  );
}

function daysLabel(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
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
        background: highlighted ? surface.inset : cardBg,
        border: highlighted ? lineStrong : line,
        borderRadius: "var(--scout-radius)",
        padding: "18px 20px",
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <p style={displayTitleStyle(DT.title)}>{title}</p>
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
          background: color.forest,
          color: color.gold,
          border: lineStrong,
          borderRadius: "var(--scout-radius)",
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

export function JobDrawer({
  card,
  onClose,
  moveCard,
  onDelete,
  onCardUpdate,
  tool = null,
  onToolChange,
  prospectMode = false,
  onAddToPipeline,
  addingToPipeline = false,
  existingPipelineCardId = null,
  onOpenInPipeline,
  elevated = false,
  detailLoading = false,
}: JobDrawerProps) {
  const { openFitChat } = useWorkspace();
  const isMobile = useIsMobile();
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const dbId = (card as KanbanCard & { _dbId?: string })._dbId ?? null;
  const cardUrl = (card as KanbanCard & { _url?: string })._url ?? null;
  const cardExt = card as KanbanCard & { _meta?: JobMeta; _coverLetter?: string; _fitAnalysis?: string };
  const meta = cardExt._meta ?? null;
  const [activeSection, setActiveSection] = useState<ScrollSection>("overview");
  const scrollRef = useRef<HTMLDivElement>(null);
  const companySectionRef = useRef<HTMLDivElement>(null);
  const recruiterSectionRef = useRef<HTMLDivElement>(null);
  const [resumeEditorOpen, setResumeEditorOpen] = useState(false);
  const [matchDrawerOpen, setMatchDrawerOpen] = useState(false);
  const [coverDrawerOpen, setCoverDrawerOpen] = useState(false);
  const [resumeMatchForJob, setResumeMatchForJob] = useState<MatchData | null>(null);
  const [resumeMatchLoading, setResumeMatchLoading] = useState(false);
  const [resumeMatchName, setResumeMatchName] = useState<string | null>(null);
  const handleResumeMatchChange = useCallback(
    (data: MatchData | null, _assetId: string | null, loading: boolean, name: string | null) => {
      setResumeMatchForJob(data);
      setResumeMatchLoading(loading);
      setResumeMatchName(name);
    },
    [],
  );
  const [visible, setVisible] = useState(false);
  useLayoutEffect(() => { setVisible(true); }, []);

  useEffect(() => {
    if (tool === "resume") setMatchDrawerOpen(true);
    if (tool === "cover") setCoverDrawerOpen(true);
  }, [tool]);

  const scrollToSection = useCallback((section: ScrollSection) => {
    setActiveSection(section);
    const container = scrollRef.current;
    if (!container) return;
    if (section === "overview") {
      container.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const target =
      section === "recruiter" ? recruiterSectionRef.current : companySectionRef.current;
    if (target) {
      container.scrollTo({ top: target.offsetTop - 16, behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    setDescValue(meta?.description ?? "");
  }, [card.id, meta?.description]);

  useEffect(() => {
    setActiveSection("overview");
    setMobileToolsOpen(false);
    setResumeMatchForJob(null);
    setResumeMatchLoading(false);
    setResumeMatchName(null);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [card.id]);

  useEffect(() => {
    const container = scrollRef.current;
    const companyEl = companySectionRef.current;
    const recruiterEl = recruiterSectionRef.current;
    if (!container) return;

    const observers: IntersectionObserver[] = [];

    const onScroll = () => {
      if (container.scrollTop < 80) setActiveSection("overview");
    };
    container.addEventListener("scroll", onScroll, { passive: true });

    if (recruiterEl) {
      const recruiterObserver = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection("recruiter");
        },
        { root: container, threshold: 0.25, rootMargin: "-20% 0px -55% 0px" },
      );
      recruiterObserver.observe(recruiterEl);
      observers.push(recruiterObserver);
    }

    if (companyEl) {
      const companyObserver = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection("company");
        },
        { root: container, threshold: 0.25, rootMargin: "-20% 0px -55% 0px" },
      );
      companyObserver.observe(companyEl);
      observers.push(companyObserver);
    }

    return () => {
      observers.forEach((o) => o.disconnect());
      container.removeEventListener("scroll", onScroll);
    };
  }, [card.id]);

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

  const location = job?.location || meta?.location;
  const salary = job?.salary || meta?.salary;
  const jobType = meta?.jobType;
  const expLevel = meta?.seniority || meta?.experienceLevel;
  const remoteLabel = meta?.remote === true ? "Remote" : meta?.remote === false ? "On-site" : null;
  const {
    responsibilities,
    skills,
    requiredQualifications,
    preferredQualifications,
    jobSummary,
    companySummary,
    benefits,
    tags,
    hasStructuredSections,
  } = resolveJobFields(meta);

  const jobWebsite = urlValue || cardUrl;
  const applicationUrl = jobWebsite;
  const companyWebsite = meta?.companyWebsite?.trim() || guessCompanyWebsite(jobWebsite);
  const hasStoredCompanyIntel = Boolean(meta?.companySummary?.trim() || meta?.companyWebsite?.trim());
  const { data: hirebaseCompany, loading: hirebaseLoading } = useHirebaseCompanyProfile({
    companyName: card.company,
    website: companyWebsite,
    slugHint: meta?.companySlug ?? null,
    enabled: prospectMode || !hasStoredCompanyIntel,
  });

  const linkedinForCompany =
    hirebaseCompany?.profile?.linkedin_link?.trim() ||
    hirebaseCompany?.enrichment?.hirebase?.linkedinLink?.trim() ||
    companyLinkedinUrl;

  const jobDescription = resolveJobDescriptionText(meta, card.role, card.company);
  const fullDescriptionText = meta?.description?.trim() || jobDescription;
  const hasFullPosting = (meta?.description?.trim().length ?? 0) >= 200;
  const networkJob = meta?.networkJob ?? null;
  const displayFit = card.fit > 0 ? card.fit : (meta?.vectorMatch?.matchScore ?? 0);
  const scrollSections: ScrollSection[] = networkJob
    ? ["overview", "recruiter", "company"]
    : ["overview", "company"];
  const externalPostUrl = networkJob?.internalView === false
    ? null
    : (networkJob?.topEchelonUrl ?? networkJob?.sourceUrl ?? applicationUrl);
  const networkSourceLabel =
    networkJob?.source === "EXECTHREAD" ? "ExecThread posting ↗" : "Top Echelon posting ↗";
  const networkOpenLabel = networkJob?.source === "EXECTHREAD" ? "OPEN ON EXECTHREAD" : "OPEN IN TE";
  const canRunMatch = Boolean(dbId || fullDescriptionText.length >= 40);
  const showParsedSections = hasStructuredSections;
  const showFullDescriptionBlob = hasFullPosting && !showParsedSections;
  const backdropZ = elevated ? 210 : 60;
  const drawerZ = elevated ? 211 : 70;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.18)", zIndex: backdropZ }} />
      <div
        style={{
          position: "fixed",
          top: isMobile ? 0 : 8,
          right: isMobile ? 0 : 8,
          bottom: isMobile ? 0 : 8,
          left: isMobile ? 0 : undefined,
          width: isMobile ? "100vw" : DRAWER_WIDTH,
          maxWidth: isMobile ? "100vw" : "calc(100vw - 16px)",
          background: surface.inset,
          borderRadius: "var(--scout-radius)",
          overflow: "hidden",
          zIndex: drawerZ,
          boxShadow: isMobile ? "none" : "3px 3px 0 rgba(17,17,17,0.08)",
          transform: visible ? "translateX(0)" : "translateX(calc(100% + 16px))",
          transition: "transform 0.25s ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Top bar — scroll anchors + actions */}
        <div style={{ padding: isMobile ? "12px 16px" : "14px 28px", background: cardBg, borderBottom: line, display: "flex", alignItems: "center", gap: isMobile ? 10 : 16, flexShrink: 0, overflow: "hidden" }}>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: "#8A8278", padding: 0, lineHeight: 1, marginRight: 4, flexShrink: 0 }}
          >
            ×
          </button>
          <div style={{ display: "flex", gap: isMobile ? 16 : 24, overflowX: isMobile ? "auto" : "visible", flex: isMobile ? 1 : undefined, minWidth: 0 }}>
            {scrollSections.map((t) => {
              const active = activeSection === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => scrollToSection(t)}
                  style={{
                    background: "none",
                    border: "none",
                    borderBottom: active ? `2px solid ${color.forest}` : "2px solid transparent",
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
          {!isMobile && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            {externalPostUrl && (
              <a
                href={externalPostUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: sans, fontSize: 14, color: "#5C534A", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
              >
                {networkJob ? networkSourceLabel : "Original job post ↗"}
              </a>
            )}
            {externalPostUrl && (
              <a
                href={externalPostUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "10px 20px",
                  background: color.forest,
                  color: color.gold,
                  borderRadius: "var(--scout-radius)",
                  fontFamily: sans,
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: "none",
                  letterSpacing: "0.2px",
                  border: lineStrong,
                }}
              >
                {networkJob ? networkOpenLabel : "APPLY NOW"}
              </a>
            )}
          </div>
          )}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: 0, overflow: isMobile ? "auto" : "hidden" }}>
          <div ref={scrollRef} style={{ flex: isMobile ? "none" : 1, minWidth: 0, overflowY: isMobile ? "visible" : "auto", overflowX: "hidden" }}>
            {/* Hero — title + match score */}
            <div style={{ padding: isMobile ? "20px 16px 18px" : "28px 32px 24px", background: cardBg, borderBottom: line }}>
              <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 16 : 24, alignItems: isMobile ? "stretch" : "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
                    <CompanyLogo
                      name={networkJob?.agencyName ?? card.company}
                      website={networkJob?.agencyWebsite ?? companyWebsite ?? jobWebsite}
                      enrichmentWebsiteUrl={hirebaseCompany?.profile?.company_link ?? hirebaseCompany?.enrichment?.websiteUrl}
                      logoUrl={networkJob?.agencyLogoUrl ?? meta?.companyLogo ?? hirebaseCompany?.profile?.company_logo ?? hirebaseCompany?.enrichment?.hirebase?.logo}
                      size={isMobile ? 48 : 56}
                    />
                    <div>
                      <p style={{ fontFamily: sans, fontSize: 14, color: "var(--scout-muted)", margin: 0, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                        <a href={linkedinForCompany} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none", fontWeight: 600 }}>
                          {card.company}
                        </a>
                        {meta?.datePosted ? (
                          <JobFreshnessIndicator datePosted={meta.datePosted} variant="compact" />
                        ) : (
                          <span>· Saved {daysLabel(card.days)}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <h2 style={displayTitleStyle(isMobile ? 22 : 28, { margin: "0 0 16px", lineHeight: 1.2 })}>
                    {card.role}
                  </h2>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: "10px 24px" }}>
                    {location && <MetaRow icon={<IconPin />} label={location} />}
                    {remoteLabel && <MetaRow icon={<IconHome />} label={remoteLabel} />}
                    {salary && <MetaRow icon={<IconDollar />} label={salary} />}
                    {jobType && <MetaRow icon={<IconClock />} label={jobType} />}
                    {expLevel && <MetaRow icon={<IconBriefcase />} label={expLevel} />}
                  </div>
                </div>
                <JobMatchScorePanel
                  vectorFit={displayFit}
                  jobTitle={card.role}
                  company={card.company}
                  description={jobDescription}
                  jobId={dbId}
                  onMatchChange={handleResumeMatchChange}
                  onRunFullMatch={canRunMatch ? () => setMatchDrawerOpen(true) : undefined}
                  fullWidth={isMobile}
                />
              </div>
            </div>

            {/* Main job content — match first, then posting, recruiter, company */}
            <div style={{ padding: isMobile ? "20px 16px 28px" : "28px 32px 36px" }}>
              {networkJob && <JobDrawerNetworkAdminSection networkJob={networkJob} />}

              {(meta?.vectorMatch?.matchScore ?? 0) > 0 || resumeMatchForJob ? (
                <JobDrawerMatchSection
                  meta={meta}
                  resumeMatch={resumeMatchForJob}
                  resumeMatchLoading={resumeMatchLoading}
                  resumeName={resumeMatchName}
                />
              ) : null}

              {(!showParsedSections || (detailLoading && !hasFullPosting)) && (
                <JobDescriptionPanel
                  text={fullDescriptionText}
                  loading={detailLoading && !hasFullPosting}
                  editable={!prospectMode && tool === null && !hasFullPosting && !showParsedSections}
                  value={descValue}
                  onChange={setDescValue}
                  onBlur={() => patchDescription(descValue)}
                />
              )}

              {showParsedSections && jobSummary && (
                <div style={{ marginBottom: 22 }}>
                  <SectionTitle icon={<IconBriefcase />}>About the role</SectionTitle>
                  <p style={{ fontFamily: sans, fontSize: 15, color: "#2A2218", lineHeight: 1.7, margin: 0 }}>{jobSummary}</p>
                </div>
              )}

              {showParsedSections && responsibilities.length > 0 && (
                <div style={{ marginBottom: 22 }}>
                  <SectionTitle icon={<IconBriefcase />}>Responsibilities</SectionTitle>
                  <BulletList items={responsibilities} />
                </div>
              )}

              {showParsedSections && (skills.length > 0 || requiredQualifications.length > 0 || preferredQualifications.length > 0) && (
                <div style={{ marginBottom: 22 }}>
                  <SectionTitle icon={<IconTarget />}>Qualifications</SectionTitle>
                  {skills.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: requiredQualifications.length > 0 || preferredQualifications.length > 0 ? 16 : 0 }}>
                      {skills.map((s, i) => (
                        <span
                          key={i}
                          style={{
                            padding: "6px 13px",
                            background: displayFit >= 70 ? mintLight : "rgba(0,0,0,0.05)",
                            border: displayFit >= 70 ? "1px solid rgba(74,139,106,0.25)" : line,
                            borderRadius: "var(--scout-radius)",
                            fontFamily: sans,
                            fontSize: 13,
                            fontWeight: 500,
                            color: displayFit >= 70 ? "#2A4A3A" : "#5C534A",
                          }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  {requiredQualifications.length > 0 && (
                    <div style={{ marginBottom: preferredQualifications.length > 0 ? 14 : 0 }}>
                      <p style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: "#5C534A", margin: "0 0 8px" }}>Required</p>
                      <BulletList items={requiredQualifications} />
                    </div>
                  )}
                  {preferredQualifications.length > 0 && (
                    <div>
                      <p style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: "#5C534A", margin: "0 0 8px" }}>Preferred</p>
                      <BulletList items={preferredQualifications} />
                    </div>
                  )}
                </div>
              )}

              {showParsedSections && benefits.length > 0 && (
                <div style={{ marginBottom: 22 }}>
                  <SectionTitle icon={<IconGift />}>Benefits</SectionTitle>
                  <BulletList items={benefits} />
                </div>
              )}

              <JobDrawerDetailsSection meta={meta} />

              {networkJob?.recruiterNotes && networkJob.internalView && (
                <div style={{ marginBottom: 22 }}>
                  <SectionTitle icon={<IconBriefcase />}>Recruiter notes</SectionTitle>
                  <ScoutBox padding={18} style={{ borderLeft: `3px solid ${mint}`, background: cardBg }}>
                    <p style={{ fontFamily: sans, fontSize: 15, color: "#2A2218", lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" }}>
                      {networkJob.recruiterNotes}
                    </p>
                  </ScoutBox>
                </div>
              )}

              {!showParsedSections && !hasFullPosting && jobSummary && (
                <div style={{ marginBottom: 22 }}>
                  <p style={{ fontFamily: sans, fontSize: 15, color: "#2A2218", lineHeight: 1.7, margin: 0 }}>{jobSummary}</p>
                  {tags.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                      {tags.map((t, i) => (
                        <span key={i} style={{ padding: "6px 12px", background: mintLight, borderRadius: "var(--scout-radius)", fontFamily: sans, fontSize: 13, fontWeight: 500, color: color.forest }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {networkJob && (
                <div
                  ref={recruiterSectionRef}
                  id="job-drawer-recruiter"
                  style={{ marginTop: 28, paddingTop: 24, borderTop: line }}
                >
                  <SectionTitle icon={<IconTarget />}>Recruiter</SectionTitle>
                  <JobDrawerRecruiterSection networkJob={networkJob} />
                </div>
              )}

              {tool !== null && !job && (
                <div style={{ padding: 16, background: cardBg, border: line, borderRadius: "var(--scout-radius)", marginBottom: 14 }}>
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
                  <div style={{ padding: 16, background: cardBg, border: line, borderRadius: "var(--scout-radius)", borderLeft: `3px solid ${mint}` }}>
                    <p style={{ fontFamily: sans, fontSize: 15, lineHeight: 1.75, whiteSpace: "pre-wrap", margin: 0 }}>{job.coverLetter}</p>
                  </div>
                </div>
              )}

              {tool === "fit" && job && (
                <div style={{ marginBottom: 18 }}>
                  <SectionTitle>Fit analysis</SectionTitle>
                  <p style={{ fontFamily: sans, fontSize: 15, lineHeight: 1.7, marginBottom: 12 }}>{job.fitSummary}</p>
                  {job.fitWorks.map((w, i) => (
                    <div key={i} style={{ padding: "10px 12px", background: mintLight, borderRadius: "var(--scout-radius)", marginBottom: 8, fontSize: 14 }}>✓ {w}</div>
                  ))}
                </div>
              )}

              {tool === null && job ? (
                <div style={{ marginBottom: 18 }}>
                  <SectionTitle>Kimchi&apos;s fit summary</SectionTitle>
                  <p style={{ fontFamily: sans, fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>{job.fitSummary}</p>
                </div>
              ) : null}

              <div
                ref={companySectionRef}
                id="job-drawer-company"
                style={{ marginTop: 28, paddingTop: 24, borderTop: line }}
              >
                <SectionTitle icon={<IconBuilding />}>Company</SectionTitle>
                <JobDrawerCompanySection
                  companyName={card.company}
                  location={location}
                  parsedSummary={companySummary}
                  jobUrl={companyWebsite}
                  hirebase={hirebaseCompany}
                  loading={hirebaseLoading}
                  trackPanel={
                    <CompanyTrackPanel
                      companyName={card.company}
                      jobUrl={companyWebsite ?? applicationUrl}
                      hqLocation={location ?? null}
                    />
                  }
                />
              </div>

              {prospectMode && applicationUrl ? (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: line }}>
                  <a
                    href={applicationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontFamily: sans,
                      fontSize: 14,
                      fontWeight: 600,
                      color: color.forest,
                      textDecoration: "none",
                    }}
                  >
                    Apply on company site ↗
                  </a>
                </div>
              ) : !prospectMode && dbId ? (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: line }}>
                  <input
                    value={urlValue}
                    onChange={(e) => setUrlValue(e.target.value)}
                    onBlur={() => patchField({ url: urlValue || null })}
                    placeholder="Job URL…"
                    style={{ width: "100%", fontSize: 13, fontFamily: sans, color: "#8A8278", background: "transparent", border: "none", borderBottom: "1px solid rgba(0,0,0,0.1)", outline: "none", padding: "4px 0" }}
                  />
                </div>
              ) : null}
            </div>
          </div>

          {/* Right — pipeline, notes, AI tools */}
          <div
            style={{
              width: isMobile ? "100%" : AI_SIDEBAR_WIDTH,
              flexShrink: 0,
              padding: isMobile ? "20px 16px 24px" : "24px 20px 32px",
              borderLeft: isMobile ? "none" : line,
              borderTop: isMobile ? line : "none",
              background: cardBg,
              overflowY: isMobile ? "visible" : "auto",
              overflowX: "hidden",
              display: "flex",
              flexDirection: "column",
              gap: 24,
              boxSizing: "border-box",
            }}
          >
            {/* Save job */}
            <div>
              <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, color: color.muted, textTransform: "uppercase", letterSpacing: "0.8px", margin: "0 0 12px" }}>
                Save this job
              </p>
              {prospectMode && !dbId ? (
                <>
                  {existingPipelineCardId != null ? (
                    <>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", background: mintLight, borderRadius: "var(--scout-radius)", marginBottom: 12 }}>
                        <span style={{ fontSize: 12, color: mint }}>✓</span>
                        <span style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: color.forest }}>Already saved</span>
                      </div>
                      <p style={{ fontFamily: sans, fontSize: 14, color: "var(--scout-muted)", lineHeight: 1.55, margin: "0 0 14px" }}>
                        Track your progress, add notes, and use AI tools for this role.
                      </p>
                      {onOpenInPipeline && (
                        <button type="button" onClick={onOpenInPipeline} style={{ width: "100%", padding: "11px 16px", background: color.forest, color: color.gold, border: lineStrong, borderRadius: "var(--scout-radius)", fontFamily: sans, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                          Open saved job →
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <p style={{ fontFamily: sans, fontSize: 14, color: "var(--scout-muted)", lineHeight: 1.55, margin: "0 0 14px" }}>
                        Save this job to track your progress, see how you match, and create a tailored resume or cover letter.
                      </p>
                      {onAddToPipeline && (
                        <button type="button" onClick={() => void onAddToPipeline()} disabled={addingToPipeline} style={{ width: "100%", padding: "11px 16px", background: addingToPipeline ? "rgba(26,58,47,0.35)" : color.forest, color: color.gold, border: lineStrong, borderRadius: "var(--scout-radius)", fontFamily: sans, fontSize: 14, fontWeight: 600, cursor: addingToPipeline ? "default" : "pointer", marginBottom: 10 }}>
                          {addingToPipeline ? "Saving…" : "Save this job"}
                        </button>
                      )}
                    </>
                  )}
                </>
              ) : (
                <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                <span style={{
                  padding: "5px 12px",
                  borderRadius: "var(--scout-radius)",
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
                    onClick={() => { if (window.confirm("Remove this job from your saved list?")) onDelete(); }}
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
                      background: surface.inset,
                      border: line,
                      borderRadius: "var(--scout-radius)",
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
                style={{ width: "100%", padding: "10px 12px", minHeight: isMobile ? 44 : undefined, border: line, borderRadius: "var(--scout-radius)", fontFamily: sans, fontSize: 13, outline: "none", background: surface.inset, marginBottom: 8, boxSizing: "border-box" }}
              />
              <input
                type="date"
                value={nextStepDueValue}
                onChange={(e) => setNextStepDueValue(e.target.value)}
                onBlur={() => patchNextStep(nextStepValue, nextStepDueValue)}
                style={{ width: "100%", padding: "10px 12px", minHeight: isMobile ? 44 : undefined, border: line, borderRadius: "var(--scout-radius)", fontFamily: sans, fontSize: 13, outline: "none", background: surface.inset, boxSizing: "border-box" }}
              />
                </>
              )}
            </div>

            {/* Notes */}
            {(!prospectMode || dbId) && (
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
                  background: surface.inset,
                  border: line,
                  borderRadius: "var(--scout-radius)",
                  padding: "12px 14px",
                  resize: "vertical",
                  outline: "none",
                  lineHeight: 1.55,
                  boxSizing: "border-box",
                  minHeight: 100,
                }}
              />
            </div>
            )}

            {/* AI tools — desktop sidebar only; mobile uses sticky footer */}
            {!isMobile && (
            <div>
              <p style={displayTitleStyle(15, { margin: "0 0 14px", lineHeight: 1.3 })}>
                Boost your interview chances
              </p>
              <CreditsStatusBar />
              <AiToolCard
                creditCost={1}
                title="Analyze how well you fit"
                subtitle="Understand your strengths and gaps for this role."
                buttonLabel="Analyze fit"
                onClick={() => openFitChat(card)}
              />
              <AiToolCard
                highlighted
                creditCost={1}
                title="Improve resume match"
                subtitle={
                  displayFit > 0
                    ? `You're at ${displayFit}% for this role — tailor your resume to strengthen your fit.`
                    : "See your match score and tailor your resume for this role."
                }
                buttonLabel={displayFit > 0 ? `Optimize (${displayFit}%)` : "Optimize my resume"}
                onClick={() => setMatchDrawerOpen(true)}
              />
              <AiToolCard
                creditCost={1}
                title="Build cover letter"
                subtitle="Make your application stand out with a tailored letter."
                buttonLabel="Build cover letter"
                onClick={() => setCoverDrawerOpen(true)}
              />
            </div>
            )}
          </div>
        </div>

        {isMobile && (
          <div style={{ padding: "12px 16px max(12px, env(safe-area-inset-bottom))", borderTop: line, background: cardBg, flexShrink: 0 }}>
            {canRunMatch ? (
              <button
                type="button"
                onClick={() => setMatchDrawerOpen(true)}
                style={{ width: "100%", padding: "14px 16px", minHeight: 48, background: color.forest, color: color.gold, border: lineStrong, borderRadius: "var(--scout-radius)", fontFamily: sans, fontSize: 15, fontWeight: 700, cursor: "pointer" }}
              >
                {displayFit <= 0 ? "See how you match →" : `Improve match (${displayFit}%) →`}
              </button>
            ) : externalPostUrl ? (
              <a
                href={externalPostUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "block", width: "100%", padding: "14px 16px", minHeight: 48, background: color.forest, color: color.gold, border: lineStrong, borderRadius: "var(--scout-radius)", fontFamily: sans, fontSize: 15, fontWeight: 700, textDecoration: "none", textAlign: "center", boxSizing: "border-box" }}
              >
                {networkJob ? networkOpenLabel : "APPLY NOW"}
              </a>
            ) : prospectMode && onAddToPipeline && existingPipelineCardId == null ? (
              <button
                type="button"
                onClick={() => void onAddToPipeline()}
                disabled={addingToPipeline}
                style={{ width: "100%", padding: "14px 16px", minHeight: 48, background: addingToPipeline ? "rgba(26,58,47,0.35)" : color.forest, color: color.gold, border: lineStrong, borderRadius: "var(--scout-radius)", fontFamily: sans, fontSize: 15, fontWeight: 700, cursor: addingToPipeline ? "default" : "pointer" }}
              >
                {addingToPipeline ? "Saving…" : "Save this job"}
              </button>
            ) : null}
            {mobileToolsOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                <button type="button" onClick={() => setCoverDrawerOpen(true)} style={{ width: "100%", padding: "12px 16px", minHeight: 44, background: surface.card, border: line, borderRadius: "var(--scout-radius)", fontFamily: sans, fontSize: 14, fontWeight: 600, color: "#1A1A1A", cursor: "pointer" }}>
                  Build cover letter
                </button>
                <button type="button" onClick={() => openFitChat(card)} style={{ width: "100%", padding: "12px 16px", minHeight: 44, background: surface.card, border: line, borderRadius: "var(--scout-radius)", fontFamily: sans, fontSize: 14, fontWeight: 600, color: "#1A1A1A", cursor: "pointer" }}>
                  Analyze fit
                </button>
                {externalPostUrl && (
                  <a href={externalPostUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", width: "100%", padding: "12px 16px", minHeight: 44, background: surface.card, border: line, borderRadius: "var(--scout-radius)", fontFamily: sans, fontSize: 14, fontWeight: 600, color: "#1A1A1A", textDecoration: "none", textAlign: "center", boxSizing: "border-box" }}>
                    {networkJob ? networkSourceLabel : "Original job post ↗"}
                  </a>
                )}
              </div>
            )}
            {(canRunMatch || dbId) && (
              <button
                type="button"
                onClick={() => setMobileToolsOpen((v) => !v)}
                style={{ width: "100%", marginTop: 8, padding: "10px 16px", minHeight: 40, background: "transparent", border: "none", fontFamily: sans, fontSize: 14, fontWeight: 500, color: "#8A8278", cursor: "pointer" }}
              >
                {mobileToolsOpen ? "Hide tools" : "More tools"}
              </button>
            )}
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
          description={jobDescription}
          jobId={dbId ?? undefined}
          initialMatchData={(() => {
            if (!cardExt._fitAnalysis) return null;
            try {
              const parsed = JSON.parse(cardExt._fitAnalysis) as Partial<MatchData>;
              if (typeof parsed.score === "number" && Array.isArray(parsed.keywords)) {
                return parsed as MatchData;
              }
            } catch {
              /* partial fitAnalysis from vector score only */
            }
            return null;
          })()}
          initialAssetId={null}
          onClose={() => setMatchDrawerOpen(false)}
          onTailorResume={() => {
            if (dbId) setResumeEditorOpen(true);
            else if (onAddToPipeline) void onAddToPipeline();
          }}
        />
      )}

      {coverDrawerOpen && (
        <CoverLetterDrawer
          jobTitle={card.role}
          company={card.company}
          description={jobDescription}
          jobId={dbId ?? undefined}
          initialLetter={cardExt._coverLetter ?? null}
          onClose={() => setCoverDrawerOpen(false)}
        />
      )}
    </>
  );
}
