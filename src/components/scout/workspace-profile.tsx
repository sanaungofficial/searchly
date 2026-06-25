"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  clearOnboardingFinishPayload,
  readOnboardingFinishPayload,
  type OnboardingFinishPayload,
} from "@/lib/onboarding-finish";
import {
  parseProfileLocation,
  profileAboutSectionUrl,
  profileAssetsUrl,
} from "@/lib/workspace-urls";
import {
  AVAILABLE_ROLES,
  UPSKILL_CATEGORIES,
} from "./workspace-data";
import {
  defaultResumeAssetId,
  getRoleResumeAssetId,
  normalizeTargetRoleSettings,
  type TargetRoleSettingsMap,
} from "@/lib/target-role-settings";
import {
  buildSkillGoal,
  findProgramsForSkill,
  normalizeSkillGoals,
  type SkillGoalRecord,
  type UpskillProgram,
  type UpskillProgressMap,
} from "@/lib/upskill-programs";
import {
  buildResumeFingerprint,
  getStoredRoleAnalysis,
  LEGACY_ANALYSIS_CACHE_KEY,
  normalizeRoleAnalysesMap,
  normalizeRoleGapAnalysis,
  setStoredRoleAnalysis,
  type RoleAnalysesMap,
  type StoredRoleAnalysis,
} from "@/lib/role-gap";

interface AISuggestion {
  priority: "high" | "medium" | "low";
  category: string;
  title: string;
  detail: string;
  impact: string;
}
import { SparkleIcon } from "./workspace-icons";
import { ProfileResumeEditor } from "./profile-resume-editor";
import { ProfileLinkedInEditor } from "./profile-linkedin-editor";
import { CareerStrategyPanel } from "./career-strategy-panel";
import { LinkedInOrgPicker } from "./linkedin-org-picker";
import { CompanyLogo } from "./company-logo";
import type { LinkedInOrgRef } from "@/lib/linkedin-profile";
import { GrowthUpgradeModal } from "./growth-upgrade-modal";
import { ProfileMyCoachCard } from "./coach-ui";
import { useCoachMatches } from "@/hooks/use-coach-matches";
import { notifyCreditsChanged } from "@/lib/credits";
import { useCredits } from "@/hooks/useCredits";
import { useWorkspace } from "@/contexts/workspace-context";
import { ScoutBox, ScoutDisplayTitle, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { WorkspaceMobileTopBar } from "./workspace-mobile-top-bar";
import { ScoreExplainerLabel, ScoreExplainerPopover } from "./score-explainer-popover";
import { KimchiProcessLoader } from "./kimchi-process-loader";
import { fontSans, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EducationEntry {
  id: string;
  school: string;
  degree: string;
  field?: string | null;
  from?: string | null;
  to?: string | null;
  schoolRef?: LinkedInOrgRef | null;
}

interface WorkEntry {
  id: string;
  company: string;
  title: string;
  description?: string | null;
  location?: string | null;
  from?: string | null;
  to?: string | null;
  bullets: string[];
  companyRef?: LinkedInOrgRef | null;
}

interface ParsedData {
  name?: string | null;
  phone?: string | null;
  location?: string | null;
  website?: string | null;
  summary?: string | null;
  education: EducationEntry[];
  workExperience: WorkEntry[];
  skills: string[];
}

interface UserAssetRow {
  id: string;
  type: "RESUME" | "COVER_LETTER" | "JOB_SEARCH_STRATEGY" | "OTHER";
  name: string;
  url: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserProfile {
  name: string;
  email: string | null;
  resumeUrl: string | null;
  linkedinUrl: string | null;
  headline: string | null;
  summary?: string | null;
  targetRoles: string[];
  parsedData: ParsedData | null;
  employmentStatus: string | null;
  currentSalary: string | null;
  targetSalary: string | null;
  careerMotivation: string | null;
  jobTimeline: string | null;
  priorities: string[];
  roleAnalyses?: RoleAnalysesMap;
  skillGoals?: SkillGoalRecord[];
  upskillProgress?: UpskillProgressMap;
  targetRoleSettings?: TargetRoleSettingsMap;
  targetMarket?: string | null;
  relocationOpenness?: string | null;
  workAuthorization?: string | null;
  securityClearance?: string | null;
  searchDuration?: string | null;
  positioningStatement?: string | null;
  strategyIntakeNotes?: string | null;
}

type RoleAnalysisView = {
  fitScore: number;
  summary: string;
  requiredSkills: string[];
  gaps: { skill: string; why: string }[];
  nextSteps: string[];
  _cachedAt?: string;
  _stale?: boolean;
};

function toRoleAnalysisView(stored: StoredRoleAnalysis, stale = false): RoleAnalysisView {
  return { ...stored, _cachedAt: stored.analyzedAt, _stale: stale };
}

function formatLastRefreshed(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const SKILL_GOALS_KEY = "kimchi_skill_goals";

async function migrateLegacyProfileData(
  userProfile: UserProfile,
  patchProfileFn: (patch: Record<string, unknown>) => Promise<void>,
): Promise<{ roleAnalyses: RoleAnalysesMap; skillGoals: SkillGoal[] }> {
  const patch: Record<string, unknown> = {};
  let skillGoals = userProfile.skillGoals ?? [];
  let roleAnalyses = normalizeRoleAnalysesMap(userProfile.roleAnalyses);

  if (!skillGoals.length) {
    try {
      const stored = localStorage.getItem(SKILL_GOALS_KEY);
      if (stored) {
        const legacy = normalizeSkillGoals(JSON.parse(stored));
        if (legacy.length) {
          skillGoals = legacy;
          patch.skillGoals = legacy;
        }
      }
    } catch {}
  }

  const roles = userProfile.targetRoles || [];
  const fingerprint = buildResumeFingerprint(
    null,
    userProfile.resumeUrl,
    userProfile.parsedData?.skills ?? [],
  );
  let migratedAnalyses = { ...roleAnalyses };
  for (const role of roles) {
    if (getStoredRoleAnalysis(migratedAnalyses, role, null)) continue;
    try {
      const cached = localStorage.getItem(LEGACY_ANALYSIS_CACHE_KEY(role));
      if (!cached) continue;
      const { data, cachedAt } = JSON.parse(cached) as { data: unknown; cachedAt?: string };
      const normalized = normalizeRoleGapAnalysis(data);
      if (!normalized) continue;
      migratedAnalyses = setStoredRoleAnalysis(migratedAnalyses, role, {
        ...normalized,
        analyzedAt: cachedAt ?? new Date().toISOString(),
        resumeFingerprint: fingerprint,
        resumeAssetId: null,
      });
    } catch {}
  }
  if (JSON.stringify(migratedAnalyses) !== JSON.stringify(roleAnalyses)) {
    roleAnalyses = migratedAnalyses;
    patch.roleAnalyses = migratedAnalyses;
  }

  if (Object.keys(patch).length > 0) {
    await patchProfileFn(patch);
  }

  return { roleAnalyses, skillGoals };
}

type SkillGoal = SkillGoalRecord;

interface ReadbackData {
  picture: string;
  strengths: string[];
  targetRoles: { role: string; fit: string }[];
  honestNote: string;
}

interface CustomLearningItem {
  id: string;
  name: string;
  url?: string;
  platform?: string;
  duration?: string;
  status: "none" | "inprogress" | "completed";
  addedAt: string;
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateRange(from?: string | null, to?: string | null) {
  if (!from && !to) return null;
  const fmt = (d: string) => {
    const [y, m] = d.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return m ? `${months[parseInt(m, 10) - 1]} ${y}` : y;
  };
  const start = from ? fmt(from) : "";
  const end = to === "Present" ? "Present" : to ? fmt(to) : "Present";
  return `${start}${start && end ? " – " : ""}${end}`;
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function profileCompleteness(p: UserProfile): number {
  let score = 0;
  if (p.name) score++;
  if (p.email) score++;
  if (p.parsedData?.phone) score++;
  if (p.parsedData?.location) score++;
  if (p.linkedinUrl) score++;
  if (p.resumeUrl) score += 2;
  if ((p.parsedData?.education || []).length > 0) score++;
  if ((p.parsedData?.workExperience || []).length > 0) score++;
  if ((p.parsedData?.skills || []).length > 0) score++;
  if (p.jobTimeline) score++;
  if (p.targetSalary) score++;
  if ((p.priorities || []).length > 0) score++;
  return Math.round((score / 13) * 100);
}

// ─── Shared small components ──────────────────────────────────────────────────

function SectionHeader({ title, onEdit }: { title: string; onEdit?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 style={displayTitleStyle(T.heading)}>{title}</h3>
      {onEdit && (
        <button onClick={onEdit} className="p-1.5 rounded-none hover:bg-[#E8D5A3]/40 transition-colors" aria-label={`Edit ${title}`}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9.5 1.5L12.5 4.5L5 12H2V9L9.5 1.5Z" stroke="#52493F" strokeWidth="1.2" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
    </div>
  );
}

function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-sm text-[var(--scout-muted)]">{message}</p>
      {sub && <p className="text-xs text-[#C0B8B0] mt-1">{sub}</p>}
    </div>
  );
}

function SkillChip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-none bg-[#E8D5A3]/50 text-xs font-medium text-[#52493F]">
      {label}
      {onRemove && <button onClick={onRemove} className="ml-0.5 text-[var(--scout-muted)] hover:text-[#52493F]">x</button>}
    </span>
  );
}

// ─── Tab: Personal ────────────────────────────────────────────────────────────

function PersonalTab({ profile, onSave }: {
  profile: UserProfile;
  onSave: (patch: Omit<Partial<UserProfile>, "parsedData"> & { parsedData?: Partial<ParsedData> }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.parsedData?.phone || "");
  const [location, setLocation] = useState(profile.parsedData?.location || "");
  const [website, setWebsite] = useState(profile.parsedData?.website || "");
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedinUrl || profile.parsedData?.linkedinUrl || "");
  const [summary, setSummary] = useState(profile.parsedData?.summary || profile.summary || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(profile.name);
    setPhone(profile.parsedData?.phone || "");
    setLocation(profile.parsedData?.location || "");
    setWebsite(profile.parsedData?.website || "");
    setLinkedinUrl(profile.linkedinUrl || profile.parsedData?.linkedinUrl || "");
    setSummary(profile.parsedData?.summary || profile.summary || "");
  }, [
    profile.name,
    profile.linkedinUrl,
    profile.summary,
    profile.parsedData?.phone,
    profile.parsedData?.location,
    profile.parsedData?.website,
    profile.parsedData?.linkedinUrl,
    profile.parsedData?.summary,
  ]);

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      name,
      linkedinUrl: linkedinUrl || null,
      summary: summary.trim() || null,
      parsedData: {
        phone: phone || null,
        location: location || null,
        website: website || null,
        summary: summary.trim() || null,
      } as Partial<ParsedData>,
    });
    setSaving(false);
    setEditing(false);
  };

  const fields = [
    { label: "Email", value: profile.email || "—" },
    { label: "Phone", value: phone || "—" },
    { label: "Location", value: location || "—" },
    { label: "LinkedIn", value: linkedinUrl || "—", href: linkedinUrl || undefined },
    { label: "Website", value: website || "—", href: website || undefined },
  ];

  return (
    <div>
      <SectionHeader title="Personal Information" onEdit={() => setEditing(!editing)} />
      {editing ? (
        <div className="space-y-3">
          {([["Full Name", name, setName], ["Phone", phone, setPhone], ["Location", location, setLocation], ["LinkedIn URL", linkedinUrl, setLinkedinUrl], ["Website", website, setWebsite]] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
            <div key={label}>
              <label className="block text-xs text-[var(--scout-muted)] mb-1">{label}</label>
              <input value={val} onChange={(e) => setter(e.target.value)}
                className="w-full px-3 py-2.5 text-base sm:text-sm rounded-none border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" />
            </div>
          ))}
          <div>
            <label className="block text-xs text-[var(--scout-muted)] mb-1">Professional summary</label>
            <textarea
              rows={5}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Your About story — this is the source of truth for your LinkedIn About section."
              className="w-full px-3 py-2.5 text-base sm:text-sm rounded-none border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F] resize-y"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving}
              className="min-h-11 px-4 py-2 text-xs font-medium bg-[#1C3A2F] text-[#F2EDE3] rounded-none hover:bg-[#1C3A2F]/90 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)} className="min-h-11 px-4 py-2 text-xs font-medium text-[#52493F] hover:bg-[#F7F5F2] rounded-none">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 pb-3 border-b border-[#E5DDD0]">
            <div className="w-12 h-12 rounded-none bg-[#1C3A2F] flex items-center justify-center text-[#E8D5A3] text-base font-semibold shrink-0">
              {initials(profile.name)}
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1C3A2F]">{profile.name}</p>
              {profile.headline && <p className="text-xs text-[var(--scout-muted)]">{profile.headline}</p>}
            </div>
          </div>
          {fields.map(({ label, value, href }) => (
            <div key={label} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
              <span className="text-xs text-[var(--scout-muted)] sm:w-20 shrink-0 pt-0.5">{label}</span>
              {href && value !== "—" ? (
                <a href={href.startsWith("http") ? href : `https://${href}`} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-[#1C3A2F] underline underline-offset-2 break-all">{value}</a>
              ) : value === "—" ? (
                <button onClick={() => setEditing(true)} className="text-sm text-[#C0B8B0] hover:text-[#C4A86A] transition-colors" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "var(--font-ui)" }}>
                  Add →
                </button>
              ) : (
                <span className="text-sm break-all text-[#1C3A2F]">{value}</span>
              )}
            </div>
          ))}
          {(summary || profile.parsedData?.summary || profile.summary) && (
            <div className="pt-3 border-t border-[#E5DDD0]">
              <p className="text-xs text-[var(--scout-muted)] mb-1">Professional summary</p>
              <p className="text-sm text-[#52493F] leading-relaxed whitespace-pre-wrap">{summary || profile.parsedData?.summary || profile.summary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EducationTab({ entries, onSave }: { entries: EducationEntry[]; onSave: (entries: EducationEntry[]) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [list, setList] = useState<EducationEntry[]>(entries);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setList(entries);
  }, [entries, editing]);

  const addEntry = () => setList((p) => [...p, { id: `edu_${Date.now()}`, school: "", degree: "", field: "", from: "", to: "", schoolRef: null }]);
  const removeEntry = (id: string) => setList((p) => p.filter((e) => e.id !== id));
  const updateEntry = (id: string, key: keyof EducationEntry, value: string) =>
    setList((p) => p.map((e) => e.id === id ? { ...e, [key]: value } : e));
  const updateSchool = (id: string, name: string, ref: LinkedInOrgRef | null) =>
    setList((p) => p.map((e) => e.id === id ? { ...e, school: name, schoolRef: ref } : e));
  const handleSave = async () => { setSaving(true); await onSave(list); setSaving(false); setEditing(false); };

  if (editing) return (
    <div>
      <SectionHeader title="Education" />
      <div className="space-y-4">
        {list.map((entry) => (
          <div key={entry.id} className="rounded-none border border-[#E5DDD0] p-3 space-y-2 relative">
            <button onClick={() => removeEntry(entry.id)} className="absolute top-2 right-2 text-[#C0B8B0] hover:text-[#52493F] text-base leading-none">x</button>
            <div><label className="block text-xs text-[var(--scout-muted)] mb-1">School</label>
              <LinkedInOrgPicker
                value={entry.school}
                orgRef={entry.schoolRef}
                placeholder="Search schools…"
                hintLabel="school"
                showLogo={false}
                logoSize={40}
                onChange={(name, ref) => updateSchool(entry.id, name, ref)}
                inputStyle={{ width: "100%", padding: "8px 12px", fontSize: 14, border: "1px solid #E5DDD0", background: "#FFFDF9" }}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div><label className="block text-xs text-[var(--scout-muted)] mb-1">Degree</label>
                <input value={entry.degree} onChange={(e) => updateEntry(entry.id, "degree", e.target.value)} className="w-full px-3 py-2.5 text-base sm:text-sm rounded-none border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" /></div>
              <div><label className="block text-xs text-[var(--scout-muted)] mb-1">Field</label>
                <input value={entry.field || ""} onChange={(e) => updateEntry(entry.id, "field", e.target.value)} className="w-full px-3 py-2.5 text-base sm:text-sm rounded-none border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div><label className="block text-xs text-[var(--scout-muted)] mb-1">From (YYYY-MM)</label>
                <input value={entry.from || ""} onChange={(e) => updateEntry(entry.id, "from", e.target.value)} placeholder="2018-09" className="w-full px-3 py-2 text-sm rounded-none border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" /></div>
              <div><label className="block text-xs text-[var(--scout-muted)] mb-1">To</label>
                <input value={entry.to || ""} onChange={(e) => updateEntry(entry.id, "to", e.target.value)} placeholder="2022-05" className="w-full px-3 py-2 text-sm rounded-none border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" /></div>
            </div>
          </div>
        ))}
        <button onClick={addEntry} className="w-full py-2 text-xs text-[#1C3A2F] border border-dashed border-[#C0B8B0] rounded-none hover:border-[#1C3A2F]/40 transition-colors">+ Add education</button>
        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 text-xs font-medium bg-[#1C3A2F] text-[#F2EDE3] rounded-none hover:bg-[#1C3A2F]/90 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
          <button onClick={() => { setList(entries); setEditing(false); }} className="px-4 py-1.5 text-xs font-medium text-[#52493F] hover:bg-[#F7F5F2] rounded-none">Cancel</button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <SectionHeader title="Education" onEdit={() => setEditing(true)} />
      {entries.length === 0 ? (
        <EmptyState message="No education history" sub="Resume upload auto-fills this. Kimchi uses it to verify your credentials when scoring job fit." />
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div key={entry.id} className="flex gap-3 items-start">
              <CompanyLogo name={entry.schoolRef?.name || entry.school} logoUrl={entry.schoolRef?.logoUrl} website={entry.schoolRef?.website} size={40} />
              <div className="pb-4 flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1C3A2F]">{entry.school}</p>
                <p className="text-xs text-[#52493F] mt-0.5">{entry.degree}{entry.field ? `, ${entry.field}` : ""}</p>
                {formatDateRange(entry.from, entry.to) && <p className="text-xs text-[var(--scout-muted)] mt-0.5">{formatDateRange(entry.from, entry.to)}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Work Experience ─────────────────────────────────────────────────────

function ExperienceTab({ entries, onSave }: { entries: WorkEntry[]; onSave: (entries: WorkEntry[]) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [list, setList] = useState<WorkEntry[]>(entries);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setList(entries);
  }, [entries, editing]);

  const addEntry = () => setList((p) => [...p, { id: `exp_${Date.now()}`, company: "", title: "", description: "", from: "", to: "", bullets: [], companyRef: null, location: "" }]);
  const removeEntry = (id: string) => setList((p) => p.filter((e) => e.id !== id));
  const updateEntry = (id: string, key: keyof WorkEntry, value: string) =>
    setList((p) => p.map((e) => e.id === id ? { ...e, [key]: value } : e));
  const updateCompany = (id: string, name: string, ref: LinkedInOrgRef | null) =>
    setList((p) => p.map((e) => e.id === id ? { ...e, company: name, companyRef: ref } : e));
  const updateBullets = (id: string, value: string) =>
    setList((p) => p.map((e) => e.id === id ? { ...e, bullets: value.split("\n").filter(Boolean) } : e));
  const handleSave = async () => { setSaving(true); await onSave(list); setSaving(false); setEditing(false); };

  if (editing) return (
    <div>
      <SectionHeader title="Work Experience" />
      <div className="space-y-4">
        {list.map((entry) => (
          <div key={entry.id} className="rounded-none border border-[#E5DDD0] p-3 space-y-2 relative">
            <button onClick={() => removeEntry(entry.id)} className="absolute top-2 right-2 text-[#C0B8B0] hover:text-[#52493F] text-base leading-none">x</button>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div><label className="block text-xs text-[var(--scout-muted)] mb-1">Company</label>
                <LinkedInOrgPicker
                  value={entry.company}
                  orgRef={entry.companyRef}
                  placeholder="Search companies…"
                  hintLabel="company"
                  onChange={(name, ref) => updateCompany(entry.id, name, ref)}
                  inputStyle={{ width: "100%", padding: "8px 12px", fontSize: 14, border: "1px solid #E5DDD0", background: "#FFFDF9" }}
                />
              </div>
              <div><label className="block text-xs text-[var(--scout-muted)] mb-1">Title</label>
                <input value={entry.title} onChange={(e) => updateEntry(entry.id, "title", e.target.value)} className="w-full px-3 py-2.5 text-base sm:text-sm rounded-none border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div><label className="block text-xs text-[var(--scout-muted)] mb-1">From (YYYY-MM)</label>
                <input value={entry.from || ""} onChange={(e) => updateEntry(entry.id, "from", e.target.value)} placeholder="2020-01" className="w-full px-3 py-2.5 text-base sm:text-sm rounded-none border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" /></div>
              <div><label className="block text-xs text-[var(--scout-muted)] mb-1">To (YYYY-MM or Present)</label>
                <input value={entry.to || ""} onChange={(e) => updateEntry(entry.id, "to", e.target.value)} placeholder="Present" className="w-full px-3 py-2 text-sm rounded-none border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" /></div>
            </div>
            <div><label className="block text-xs text-[var(--scout-muted)] mb-1">Bullet points (one per line)</label>
              <textarea rows={4} value={entry.bullets.join("\n")} onChange={(e) => updateBullets(entry.id, e.target.value)} className="w-full px-3 py-2 text-sm rounded-none border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F] resize-none" /></div>
          </div>
        ))}
        <button onClick={addEntry} className="w-full py-2 text-xs text-[#1C3A2F] border border-dashed border-[#C0B8B0] rounded-none hover:border-[#1C3A2F]/40 transition-colors">+ Add experience</button>
        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 text-xs font-medium bg-[#1C3A2F] text-[#F2EDE3] rounded-none hover:bg-[#1C3A2F]/90 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
          <button onClick={() => { setList(entries); setEditing(false); }} className="px-4 py-1.5 text-xs font-medium text-[#52493F] hover:bg-[#F7F5F2] rounded-none">Cancel</button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <SectionHeader title="Work Experience" onEdit={() => setEditing(true)} />
      {entries.length === 0 ? (
        <EmptyState message="No work experience" sub="Resume upload auto-fills this. Kimchi scores job fit based on your background and years of experience." />
      ) : (
        <div className="space-y-5">
          {entries.map((entry) => (
            <div key={entry.id} className="flex gap-3 items-start">
              <CompanyLogo name={entry.companyRef?.name || entry.company} logoUrl={entry.companyRef?.logoUrl} website={entry.companyRef?.website} size={40} />
              <div className="pb-5 flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#1C3A2F]">{entry.title}</p>
                    <p className="text-xs text-[#52493F]">{entry.company}</p>
                  </div>
                  {formatDateRange(entry.from, entry.to) && (
                    <span className="text-xs text-[var(--scout-muted)] whitespace-nowrap shrink-0">{formatDateRange(entry.from, entry.to)}</span>
                  )}
                </div>
                {entry.bullets.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {entry.bullets.map((b, bi) => (
                      <li key={bi} className="text-xs text-[#52493F] flex gap-1.5">
                        <span className="mt-1 w-1 h-1 rounded-none bg-[var(--scout-muted)] shrink-0" />{b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Skills (real data) ──────────────────────────────────────────────────

function SkillsTab({ skills, onSave, skillGoals, onGraduate }: {
  skills: string[];
  onSave: (skills: string[]) => Promise<void>;
  skillGoals: SkillGoal[];
  onGraduate: (skill: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [list, setList] = useState<string[]>(skills);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [graduating, setGraduating] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) setList(skills);
  }, [skills, editing]);

  const addSkill = () => { const v = input.trim(); if (v && !list.includes(v)) setList((p) => [...p, v]); setInput(""); };
  const handleSave = async () => { setSaving(true); await onSave(list); setSaving(false); setEditing(false); };

  const handleGraduate = async (skill: string) => {
    setGraduating(skill);
    await onGraduate(skill);
    setGraduating(null);
  };

  return (
    <div>
      <SectionHeader title="Skills" onEdit={() => setEditing(!editing)} />
      {!editing && skills.length === 0 && skillGoals.length === 0 && (
        <EmptyState message="No skills listed yet" sub="Kimchi uses your skills to calculate fit scores for each target role. Resume upload extracts them automatically." />
      )}
      {editing ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
              placeholder="Add a skill and press Enter"
              className="flex-1 px-3 py-2 text-sm rounded-none border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" />
            <button onClick={addSkill} className="px-3 py-2 text-xs bg-[#1C3A2F] text-[#F2EDE3] rounded-none hover:bg-[#1C3A2F]/90">Add</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {list.map((s) => <SkillChip key={s} label={s} onRemove={() => setList((p) => p.filter((x) => x !== s))} />)}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 text-xs font-medium bg-[#1C3A2F] text-[#F2EDE3] rounded-none hover:bg-[#1C3A2F]/90 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
            <button onClick={() => { setList(skills); setEditing(false); }} className="px-4 py-1.5 text-xs font-medium text-[#52493F] hover:bg-[#F7F5F2] rounded-none">Cancel</button>
          </div>
        </div>
      ) : (
        skills.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[var(--scout-muted)] uppercase tracking-wide mb-2" style={{ fontSize: 14, letterSpacing: "1px" }}>My skills</p>
            <div className="flex flex-wrap gap-2">{skills.map((s) => <SkillChip key={s} label={s} />)}</div>
          </div>
        )
      )}

      {!editing && skillGoals.length > 0 && (
        <div style={{ marginTop: skills.length > 0 ? 24 : 0 }}>
          <p className="text-xs font-semibold text-[var(--scout-muted)] uppercase tracking-wide mb-3" style={{ fontSize: 14, letterSpacing: "1px" }}>Working on</p>
          <div className="space-y-2">
            {skillGoals.map((g) => (
              <div key={`${g.skill}-${g.role}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(196,168,106,0.08)", border: "1px solid rgba(196,168,106,0.25)", borderRadius: 0 }}>
                <div>
                  <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "#1A1A1A", marginBottom: 2 }}>{g.skill}</p>
                  <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#7A6020" }}>for {g.role}</p>
                </div>
                <button
                  onClick={() => handleGraduate(g.skill)}
                  disabled={graduating === g.skill}
                  style={{ padding: "6px 12px", background: "#1A3A2F", color: "#E8D5A3", border: "none", borderRadius: 0, fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500, cursor: "pointer", opacity: graduating === g.skill ? 0.6 : 1 }}
                >
                  {graduating === g.skill ? "Saving…" : "Mark as acquired"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Dream Role ──────────────────────────────────────────────────────────

function DreamRoleTab({
  dreamList,
  setDreamList,
  onSave,
  resumeAssets,
  userSkills,
  skillGoals,
  roleAnalyses,
  targetRoleSettings,
  onTargetRoleSettingsChange,
  onRoleAnalysisUpdate,
  onClearRoleAnalysis,
  onAddToPortfolio,
  onObtainSkill,
  onInitRoleSettings,
}: {
  dreamList: string[];
  setDreamList: (l: string[]) => void;
  onSave: (list: string[]) => void;
  resumeAssets: UserAssetRow[];
  userSkills: string[];
  skillGoals: SkillGoal[];
  roleAnalyses: RoleAnalysesMap;
  targetRoleSettings: TargetRoleSettingsMap;
  onTargetRoleSettingsChange: (role: string, resumeAssetId: string | null) => void;
  onRoleAnalysisUpdate: (role: string, analysis: StoredRoleAnalysis) => void;
  onClearRoleAnalysis: (role: string) => void;
  onAddToPortfolio: (skill: string) => void;
  onObtainSkill: (skill: string, role: string) => void;
  onInitRoleSettings: (role: string) => void;
}) {
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, RoleAnalysisView | "loading" | "error">>({});
  const [analysisErrors, setAnalysisErrors] = useState<Record<string, string>>({});
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [skillMenu, setSkillMenu] = useState<{ role: string; skill: string } | null>(null);
  const analyzingRef = useRef(new Set<string>());
  const isMobile = useIsMobile();
  const hasResume = resumeAssets.length > 0;

  const resumeIdForRole = (role: string) =>
    getRoleResumeAssetId(role, targetRoleSettings, resumeAssets);

  const storedForRole = (role: string) =>
    getStoredRoleAnalysis(roleAnalyses, role, resumeIdForRole(role));

  const isStoredStale = (stored: StoredRoleAnalysis, role: string) => {
    const assetId = resumeIdForRole(role);
    const asset = resumeAssets.find((a) => a.id === assetId);
    const fingerprint = buildResumeFingerprint(assetId, asset?.url ?? null, userSkills);
    return stored.resumeFingerprint !== fingerprint;
  };

  const viewFromStored = (stored: StoredRoleAnalysis, role: string) =>
    toRoleAnalysisView(stored, isStoredStale(stored, role));

  const getLoaded = (role: string): RoleAnalysisView | null => {
    const result = analysis[role];
    if (result && result !== "loading" && result !== "error") return result;
    const stored = storedForRole(role);
    if (stored) return viewFromStored(stored, role);
    return null;
  };

  useEffect(() => {
    setAnalysis((prev) => {
      const next = { ...prev };
      for (const role of dreamList) {
        const stored = storedForRole(role);
        if (stored && prev[role] !== "loading") {
          next[role] = viewFromStored(stored, role);
        }
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dreamList, roleAnalyses, targetRoleSettings, resumeAssets, userSkills]);

  const fetchAnalysis = async (role: string, force = false, resumeAssetIdOverride?: string | null) => {
    const assetId = resumeAssetIdOverride ?? resumeIdForRole(role);
    if (!assetId && !hasResume) return;

    const stored = getStoredRoleAnalysis(roleAnalyses, role, assetId);
    if (!force && stored) {
      setAnalysis((prev) => ({ ...prev, [role]: viewFromStored(stored, role) }));
      return;
    }

    setAnalysis((prev) => ({ ...prev, [role]: "loading" }));
    setAnalysisErrors((prev) => {
      const next = { ...prev };
      delete next[role];
      return next;
    });
    try {
      const params = new URLSearchParams({ role });
      if (force) params.set("force", "true");
      if (assetId) params.set("assetId", assetId);
      const res = await fetch(`/api/ai/role-gap?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        const message =
          typeof data.error === "string"
            ? data.error === "AI not configured"
              ? "Full AI analysis needs production — we could not parse your resume for a preview."
              : data.code
                ? `${data.error} (${data.code})`
                : data.error
            : `Analysis failed (${res.status}). Tap to retry.`;
        setAnalysisErrors((prev) => ({ ...prev, [role]: message }));
        if (stored) {
          setAnalysis((prev) => ({ ...prev, [role]: viewFromStored(stored, role) }));
        } else {
          setAnalysis((prev) => ({ ...prev, [role]: "error" }));
        }
        return;
      }
      if (typeof data.fitScore !== "number" || !data.summary) {
        setAnalysisErrors((prev) => ({
          ...prev,
          [role]: "Unexpected analysis response. Tap to retry.",
        }));
        setAnalysis((prev) => ({ ...prev, [role]: "error" }));
        return;
      }
      const storedResult: StoredRoleAnalysis = {
        fitScore: data.fitScore,
        summary: data.summary,
        requiredSkills: data.requiredSkills ?? [],
        gaps: data.gaps ?? [],
        nextSteps: data.nextSteps ?? [],
        analyzedAt: data.analyzedAt ?? new Date().toISOString(),
        resumeFingerprint: data.resumeFingerprint ?? "",
        resumeAssetId: data.resumeAssetId ?? assetId,
      };
      onRoleAnalysisUpdate(role, storedResult);
      setAnalysis((prev) => ({
        ...prev,
        [role]: toRoleAnalysisView(storedResult, Boolean(data.stale)),
      }));
    } catch {
      setAnalysisErrors((prev) => ({
        ...prev,
        [role]: "Network error — check your connection and tap to retry.",
      }));
      setAnalysis((prev) => ({ ...prev, [role]: "error" }));
    }
  };

  const addRole = (title: string) => {
    if (dreamList.includes(title) || dreamList.length >= 3) return;
    const next = [...dreamList, title];
    setDreamList(next);
    onSave(next);
    onInitRoleSettings(title);
    setShowSearch(false);
    setSearchQuery("");
  };

  const removeRole = (title: string) => {
    const next = dreamList.filter((r) => r !== title);
    setDreamList(next);
    onSave(next);
    onClearRoleAnalysis(title);
    if (expandedRole === title) setExpandedRole(null);
  };

  const toggleExpand = async (role: string) => {
    if (expandedRole === role) { setExpandedRole(null); return; }
    setExpandedRole(role);
    setSkillMenu(null);
    if (!hasResume) return;
    const loaded = getLoaded(role);
    const result = analysis[role];
    if (loaded && result !== "error") return;
    if (result === "loading" || analyzingRef.current.has(role)) return;
    analyzingRef.current.add(role);
    try {
      await fetchAnalysis(role, result === "error");
    } finally {
      analyzingRef.current.delete(role);
    }
  };

  const handleResumeChange = async (role: string, assetId: string) => {
    onTargetRoleSettingsChange(role, assetId);
    const cached = getStoredRoleAnalysis(roleAnalyses, role, assetId);
    if (cached) {
      setAnalysis((prev) => ({ ...prev, [role]: viewFromStored(cached, role) }));
      return;
    }
    setAnalysis((prev) => {
      const next = { ...prev };
      delete next[role];
      return next;
    });
    await fetchAnalysis(role, false, assetId);
  };

  const handleRefresh = async (role: string) => {
    await fetchAnalysis(role, true);
  };

  const filteredRoles = AVAILABLE_ROLES.filter(
    (r) => !dreamList.includes(r) && r.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const scoreColor = (score: number) =>
    score >= 70 ? "#1A3A2F" : score >= 50 ? "#C4A86A" : "var(--scout-muted)";

  const scoreLabel = (score: number) =>
    score >= 70 ? "Strong fit" : score >= 50 ? "Good foundation" : "Gap to close";

  const hasSkill = (skill: string) =>
    userSkills.some((s) => s.toLowerCase() === skill.toLowerCase());

  const isInLearning = (skill: string) =>
    skillGoals.some((g) => g.skill.toLowerCase() === skill.toLowerCase());

  return (
    <div style={{ width: "100%", paddingBottom: 40 }}>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, marginBottom: 24, lineHeight: 1.7 }}>
        Add up to 3 roles you&apos;re targeting. Pick a resume per role — each resume keeps its own saved fit score. Tap a role to run analysis; use Refresh for an updated score.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {dreamList.map((role) => {
          const isOpen = expandedRole === role;
          const result = analysis[role];
          const loaded = getLoaded(role);
          const isLoading = result === "loading";

          return (
            <div key={role} style={{ background: surface.card, border: isOpen ? border.lineStrong : border.line, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }} onClick={() => toggleExpand(role)}>
                {loaded ? (
                  <div style={{ width: 40, height: 40, borderRadius: 0, background: scoreColor(loaded.fitScore), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontFamily: "var(--font-mono-ui)", fontSize: 14, fontWeight: 600, color: "#FFFFFF" }}>{loaded.fitScore}%</span>
                  </div>
                ) : isLoading ? (
                  <div style={{ width: 40, height: 40, borderRadius: 0, background: "rgba(26,58,47,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontFamily: "var(--font-mono-ui)", fontSize: 11, fontWeight: 600, color: color.forest }}>…</span>
                  </div>
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 0, background: "rgba(0,0,0,0.04)", flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={displayTitleStyle(T.body, { marginBottom: 2 })}>{role}</p>
                  {loaded ? (
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: scoreColor(loaded.fitScore) }}>
                      {scoreLabel(loaded.fitScore)}
                      {loaded._cachedAt ? ` · Last refreshed ${formatLastRefreshed(loaded._cachedAt)}` : ""}
                      {loaded._stale ? " · resume or skills changed" : ""}
                    </p>
                  ) : !hasResume ? (
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>Upload a resume to see your fit score</p>
                  ) : result === "loading" ? (
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>Analyzing…</p>
                  ) : result === "error" ? (
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#C4A86A" }}>
                      {analysisErrors[role] ?? "Analysis unavailable — tap to retry"}
                    </p>
                  ) : (
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>Tap to view fit details</p>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeRole(role); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#C0B8B0", fontSize: 16, lineHeight: 1, padding: "2px 4px" }}
                    aria-label={`Remove ${role}`}
                  >×</button>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s", color: "var(--scout-muted)" }}>
                    <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              {isOpen && (
                <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", padding: "16px 16px 20px" }}>
                  <div style={{ marginBottom: 16 }} onClick={(e) => e.stopPropagation()}>
                    <label style={{ display: "block", fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Resume for this role
                    </label>
                    <select
                      value={resumeIdForRole(role) ?? ""}
                      onChange={(e) => void handleResumeChange(role, e.target.value)}
                      disabled={!resumeAssets.length}
                      style={{
                        width: "100%",
                        maxWidth: 420,
                        padding: "10px 12px",
                        border: border.lineStrong,
                        background: surface.card,
                        fontFamily: fontSans,
                        fontSize: T.bodySm,
                        color: color.ink,
                      }}
                    >
                      {resumeAssets.length === 0 ? (
                        <option value="">Upload a resume in Resumes</option>
                      ) : (
                        resumeAssets.map((asset) => (
                          <option key={asset.id} value={asset.id}>
                            {asset.name}{asset.isPrimary ? " (primary)" : ""}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  {result === "loading" && !loaded && (
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)", textAlign: "center", padding: "16px 0" }}>Analyzing your resume against this role…</p>
                  )}
                  {result === "error" && !loaded && (
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#C4A86A" }}>
                      {analysisErrors[role] ?? "Could not run analysis. Make sure your resume is uploaded and try again."}
                    </p>
                  )}
                  {!hasResume && (
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>Upload your resume in the About tab to unlock gap analysis for this role.</p>
                  )}
                  {loaded && (
                    <>
                      <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#52493F", lineHeight: 1.65, marginBottom: 20 }}>{loaded.summary}</p>

                      {loaded.requiredSkills?.length > 0 && (() => {
                        const gapWhy = new Map(
                          (loaded.gaps ?? []).map((g) => [g.skill.toLowerCase(), g.why]),
                        );
                        const haveSkills = loaded.requiredSkills.filter((s) => hasSkill(s));
                        const learningSkills = loaded.requiredSkills.filter((s) => !hasSkill(s) && isInLearning(s));
                        const missingSkills = loaded.requiredSkills.filter((s) => !hasSkill(s) && !isInLearning(s));
                        return (
                          <div style={{ marginBottom: 20 }}>
                            {haveSkills.length > 0 && (
                              <div style={{ marginBottom: 14 }}>
                                <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 700, color: "#1A3A2F", textTransform: "uppercase", letterSpacing: "1.1px", marginBottom: 8 }}>What you have</p>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {haveSkills.map((skill) => (
                                    <span key={skill} style={{ padding: "5px 11px", background: "rgba(26,58,47,0.08)", border: "1px solid rgba(74,139,106,0.2)", borderRadius: 0, fontFamily: "var(--font-ui)", fontSize: 14, color: "#1A3A2F", display: "inline-flex", alignItems: "center", gap: 5 }}>
                                      <span style={{ fontSize: 14 }}>✓</span> {skill}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {missingSkills.length > 0 && (
                              <div style={{ marginBottom: 14 }}>
                                <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 700, color: "var(--scout-muted)", textTransform: "uppercase", letterSpacing: "1.1px", marginBottom: 8 }}>What you&apos;re missing</p>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                  {missingSkills.map((skill) => (
                                    <div key={skill} style={{ position: "relative" }}>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSkillMenu((prev) =>
                                            prev?.role === role && prev.skill === skill ? null : { role, skill },
                                          );
                                        }}
                                        style={{ alignSelf: "flex-start", padding: "5px 11px", background: "#FFFDF9", border: "1px dashed rgba(0,0,0,0.18)", borderRadius: 0, fontFamily: "var(--font-ui)", fontSize: 14, color: "#52493F", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
                                      >
                                        {skill}
                                        <span style={{ fontSize: 10, color: color.muted }}>▼</span>
                                      </button>
                                      {gapWhy.get(skill.toLowerCase()) && (
                                        <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "#B0A898", margin: "4px 0 0 4px", lineHeight: 1.45 }}>{gapWhy.get(skill.toLowerCase())}</p>
                                      )}
                                      {skillMenu?.role === role && skillMenu.skill === skill && (
                                        <div
                                          style={{
                                            marginTop: 6,
                                            border: border.lineStrong,
                                            background: surface.card,
                                            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                                            minWidth: 220,
                                            zIndex: 2,
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <button
                                            type="button"
                                            onClick={() => {
                                              onAddToPortfolio(skill);
                                              setSkillMenu(null);
                                            }}
                                            style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", border: "none", borderBottom: border.line, background: "transparent", fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, cursor: "pointer" }}
                                          >
                                            Add to my skills
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              onObtainSkill(skill, role);
                                              setSkillMenu(null);
                                            }}
                                            style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", border: "none", background: "transparent", fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, cursor: "pointer" }}
                                          >
                                            Obtain this skill
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#B0A898", marginTop: 8, fontStyle: "italic", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                  <span>Add to skills if you already have it, or obtain it to track learning in Upskill.</span>
                                  <ScoreExplainerPopover variant="upskill-recommendations" />
                                </p>
                              </div>
                            )}
                            {learningSkills.length > 0 && (
                              <div style={{ marginBottom: 14 }}>
                                <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 700, color: "#C4A86A", textTransform: "uppercase", letterSpacing: "1.1px", marginBottom: 8 }}>Working on</p>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {learningSkills.map((skill) => (
                                    <span key={skill} style={{ padding: "5px 11px", background: "rgba(196,168,106,0.12)", border: "1px solid rgba(196,168,106,0.35)", borderRadius: 0, fontFamily: "var(--font-ui)", fontSize: 14, color: "#7A6020", display: "inline-flex", alignItems: "center", gap: 5 }}>
                                      <span style={{ fontSize: 14 }}>→</span> {skill}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div style={{ marginTop: 4, padding: "10px 14px", background: "rgba(0,0,0,0.025)", borderRadius: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                              <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)", margin: 0, lineHeight: 1.5 }}>
                                {loaded._cachedAt
                                  ? `Last refreshed ${formatLastRefreshed(loaded._cachedAt)}. Scores are saved per resume — switch resumes to compare, or refresh for a new analysis.`
                                  : "Scores are saved per resume. Refresh when you want an updated analysis."}
                                {loaded._stale ? " Your profile changed since this score — refresh when ready." : ""}
                              </p>
                              <button onClick={() => handleRefresh(role)} style={{ padding: "5px 12px", background: "#FFFFFF", border: "1px solid #E5DDD0", borderRadius: 0, fontFamily: "var(--font-ui)", fontSize: 14, color: "#52493F", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", flexShrink: 0 }}>
                                ↻ Refresh
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      <div>
                        <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 700, color: "#1A3A2F", textTransform: "uppercase", letterSpacing: "1.1px", marginBottom: 10 }}>Next steps</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {loaded.nextSteps.map((step, i) => (
                            <div key={i} style={{ display: "flex", gap: 8 }}>
                              <span style={{ fontFamily: "var(--font-mono-ui)", fontSize: 14, color: "#1A3A2F", fontWeight: 600, flexShrink: 0, marginTop: 1 }}>{i + 1}.</span>
                              <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#52493F", lineHeight: 1.5 }}>{step}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {dreamList.length < 3 && (
        <div>
          {!showSearch ? (
            <button
              onClick={() => setShowSearch(true)}
              style={{ padding: "10px 18px", background: "transparent", color: "#1A3A2F", border: "1px solid rgba(26,58,47,0.2)", borderRadius: 0, fontFamily: "var(--font-ui)", fontSize: 14, cursor: "pointer" }}
            >+ Add a role</button>
          ) : (
            <div>
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search roles…"
                style={{ width: "100%", padding: "12px 12px", borderRadius: 0, border: "1.5px solid #1A3A2F", fontFamily: "var(--font-ui)", fontSize: isMobile ? 16 : 13, color: "#1A1A1A", background: "#FFFFFF", outline: "none", marginBottom: 10, boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {searchQuery.trim() && !AVAILABLE_ROLES.map(r => r.toLowerCase()).includes(searchQuery.trim().toLowerCase()) && (
                  <button
                    onClick={() => addRole(searchQuery.trim())}
                    style={{ padding: "6px 14px", background: "#1A3A2F", border: "none", borderRadius: 0, fontFamily: "var(--font-ui)", fontSize: 14, color: "#E8D5A3", cursor: "pointer" }}
                  >+ Add &ldquo;{searchQuery.trim()}&rdquo;</button>
                )}
                {filteredRoles.slice(0, 20).map((r) => (
                  <button
                    key={r}
                    onClick={() => addRole(r)}
                    style={{ padding: "6px 14px", background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 0, fontFamily: "var(--font-ui)", fontSize: 14, color: "#1A1A1A", cursor: "pointer" }}
                  >{r}</button>
                ))}
                <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} style={{ padding: "6px 12px", background: "transparent", border: "none", fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)", cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Upskilling ──────────────────────────────────────────────────────────

const CUSTOM_LEARNING_KEY = "kimchi_custom_learning";

function UpskillSectionLabel({ children, variant }: { children: React.ReactNode; variant: "upskill-recommendations" | "upskill-progress" }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <ScoutLabel>{children}</ScoutLabel>
      <ScoreExplainerPopover variant={variant} />
    </span>
  );
}

function ProgramLinks({ programs }: { programs: UpskillProgram[] }) {
  if (!programs.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
      {programs.map((program) => (
        <a
          key={program.id}
          href={program.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            padding: "8px 10px",
            border: border.line,
            background: surface.inset,
            textDecoration: "none",
          }}
        >
          <span style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.forest }}>
            {program.name} →
          </span>
          <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
            {program.platform}
            {program.duration ? ` · ${program.duration}` : ""}
            {program.credential ? ` · ${program.credential}` : ""}
            {program.type === "certification" ? " · Certification" : program.type === "search" ? " · Search" : ""}
          </span>
        </a>
      ))}
    </div>
  );
}

function groupSkillGoalsByRole(goals: SkillGoal[], roleOrder: string[]): { role: string; goals: SkillGoal[] }[] {
  const map = new Map<string, SkillGoal[]>();
  for (const goal of goals) {
    const role = goal.role.trim() || "General";
    const list = map.get(role) ?? [];
    list.push(goal);
    map.set(role, list);
  }
  const orderedRoles = [
    ...roleOrder.filter((role) => map.has(role)),
    ...[...map.keys()].filter((role) => !roleOrder.includes(role)).sort((a, b) => a.localeCompare(b)),
  ];
  return orderedRoles.map((role) => ({ role, goals: map.get(role)! }));
}

function LearningTab({
  progress,
  setProgress,
  skillGoals,
  dreamList,
  onGraduate,
  onAddSkill,
  onDismissSkill,
  highlightSkill,
}: {
  progress: UpskillProgressMap;
  setProgress: (p: UpskillProgressMap) => void;
  skillGoals: SkillGoal[];
  dreamList: string[];
  onGraduate: (skill: string) => Promise<void>;
  onAddSkill: (skill: string, role: string) => void;
  onDismissSkill: (skill: string, role: string) => void;
  highlightSkill?: string | null;
}) {
  const [graduating, setGraduating] = useState<string | null>(null);
  const skillGoalRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const courseRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [customItems, setCustomItems] = useState<CustomLearningItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(CUSTOM_LEARNING_KEY) || "[]"); } catch { return []; }
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddSkillForm, setShowAddSkillForm] = useState(false);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillRole, setNewSkillRole] = useState("");
  const [customSkillRole, setCustomSkillRole] = useState("");
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newPlatform, setNewPlatform] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const isMobile = useIsMobile();

  const skillGroups = groupSkillGoalsByRole(skillGoals, dreamList);
  const resolvedAddRole = newSkillRole === "__custom__"
    ? customSkillRole.trim()
    : newSkillRole.trim() || dreamList[0] || "General";

  useEffect(() => {
    if (!highlightSkill) return;
    const key = highlightSkill.toLowerCase();
    const goalEl = skillGoalRefs.current[key];
    if (goalEl) {
      goalEl.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    for (const item of UPSKILL_CATEGORIES.flatMap((c) => c.items)) {
      if (item.closesGap?.some((s) => s.toLowerCase() === key)) {
        courseRefs.current[String(item.id)]?.scrollIntoView({ behavior: "smooth", block: "center" });
        break;
      }
    }
  }, [highlightSkill]);

  const getProgress = (id: number) => progress[String(id)] ?? "none";
  const setCourseProgress = (id: number, status: "none" | "inprogress" | "completed") => {
    setProgress({ ...progress, [String(id)]: status });
  };

  const doneCount = Object.values(progress).filter((v) => v === "completed").length;
  const customDone = customItems.filter((i) => i.status === "completed").length;
  const total = UPSKILL_CATEGORIES.reduce((a, c) => a + c.items.length, 0);

  const handleGraduate = async (skill: string) => {
    setGraduating(skill);
    await onGraduate(skill);
    setGraduating(null);
  };

  const addSkillToObtain = () => {
    const skill = newSkillName.trim();
    const role = resolvedAddRole || "General";
    if (!skill) return;
    onAddSkill(skill, role);
    setNewSkillName("");
    setNewSkillRole(dreamList[0] ?? "");
    setCustomSkillRole("");
    setShowAddSkillForm(false);
  };

  const saveCustomItems = (items: CustomLearningItem[]) => {
    setCustomItems(items);
    try { localStorage.setItem(CUSTOM_LEARNING_KEY, JSON.stringify(items)); } catch {}
  };

  const addCustomItem = () => {
    if (!newName.trim()) return;
    const item: CustomLearningItem = {
      id: `cl_${Date.now()}`,
      name: newName.trim(),
      url: newUrl.trim() || undefined,
      platform: newPlatform.trim() || undefined,
      duration: newDuration.trim() || undefined,
      status: "none",
      addedAt: new Date().toISOString(),
    };
    saveCustomItems([...customItems, item]);
    setNewName(""); setNewUrl(""); setNewPlatform(""); setNewDuration("");
    setShowAddForm(false);
  };

  const updateCustomStatus = (id: string) => {
    saveCustomItems(customItems.map((i) =>
      i.id === id ? { ...i, status: i.status === "none" ? "inprogress" : i.status === "inprogress" ? "completed" : "inprogress" } : i
    ));
  };

  const removeCustomItem = (id: string) => saveCustomItems(customItems.filter((i) => i.id !== id));

  const obtainSkills = skillGoals.map((g) => g.skill.toLowerCase());
  const programItems = UPSKILL_CATEGORIES.flatMap((cat) =>
    cat.items.filter((item) =>
      item.closesGap?.some((gap) =>
        obtainSkills.some(
          (s) =>
            s === gap.toLowerCase() ||
            gap.toLowerCase().includes(s) ||
            s.includes(gap.toLowerCase()),
        ),
      ),
    ),
  );

  const renderSkillRow = (g: SkillGoal) => {
    const isHighlighted = highlightSkill?.toLowerCase() === g.skill.toLowerCase();
    return (
      <ScoutBox
        key={`${g.skill}-${g.role}`}
        padding="12px 14px"
        style={{
          borderColor: isHighlighted ? color.forest : "rgba(196,168,106,0.35)",
          boxShadow: isHighlighted ? "0 0 0 1px rgba(26,58,47,0.25)" : undefined,
        }}
      >
        <div
          ref={(el) => { skillGoalRefs.current[g.skill.toLowerCase()] = el; }}
          style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: 12 }}
        >
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, margin: 0 }}>{g.skill}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <ScoutPrimaryBtn
              onClick={() => handleGraduate(g.skill)}
              disabled={graduating === g.skill}
              style={{ minHeight: 44, width: isMobile ? "100%" : undefined, opacity: graduating === g.skill ? 0.6 : 1, flexShrink: 0 }}
            >
              {graduating === g.skill ? "Saving…" : "Mark acquired"}
            </ScoutPrimaryBtn>
            <button
              type="button"
              onClick={() => onDismissSkill(g.skill, g.role)}
              aria-label={`Remove ${g.skill}`}
              style={{ background: "none", border: "none", color: color.muted, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "8px 10px", minHeight: 44 }}
            >
              ×
            </button>
          </div>
        </div>
      </ScoutBox>
    );
  };

  return (
    <div style={{ width: "100%", paddingBottom: 40 }}>

      {/* Skills to obtain — grouped by target role */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
          <div>
            <UpskillSectionLabel variant="upskill-recommendations">Skills to obtain</UpskillSectionLabel>
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "6px 0 0", lineHeight: 1.5 }}>
              Grouped by the role they support. Add your own or queue from Target Roles.
            </p>
          </div>
          {!showAddSkillForm && (
            <ScoutSecondaryBtn onClick={() => {
              setShowAddSkillForm(true);
              setNewSkillRole(dreamList[0] ?? "__custom__");
            }}>
              + Add skill
            </ScoutSecondaryBtn>
          )}
        </div>

        {showAddSkillForm && (
          <ScoutBox padding={16} style={{ marginBottom: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginBottom: 4 }}>Skill *</label>
                <input
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  placeholder="e.g. Market analysis"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 0, border: border.lineStrong, fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, background: surface.card, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginBottom: 4 }}>For role</label>
                <select
                  value={newSkillRole || dreamList[0] || "__custom__"}
                  onChange={(e) => setNewSkillRole(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 0, border: border.lineStrong, fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, background: surface.card }}
                >
                  {dreamList.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                  <option value="__custom__">Other role…</option>
                  {!dreamList.length && <option value="General">General</option>}
                </select>
              </div>
              {newSkillRole === "__custom__" && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <input
                    value={customSkillRole}
                    onChange={(e) => setCustomSkillRole(e.target.value)}
                    placeholder="Role name"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 0, border: border.lineStrong, fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, background: surface.card, outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <ScoutPrimaryBtn
                onClick={addSkillToObtain}
                disabled={!newSkillName.trim() || (newSkillRole === "__custom__" && !customSkillRole.trim())}
                style={{ opacity: newSkillName.trim() ? 1 : 0.5 }}
              >
                Add
              </ScoutPrimaryBtn>
              <ScoutSecondaryBtn onClick={() => {
                setShowAddSkillForm(false);
                setNewSkillName("");
                setCustomSkillRole("");
              }}>
                Cancel
              </ScoutSecondaryBtn>
            </div>
          </ScoutBox>
        )}

        {skillGoals.length === 0 ? (
          <ScoutBox padding={16}>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0, lineHeight: 1.6 }}>
              No skills queued yet. Add one above, or on Target Roles choose &ldquo;Obtain this skill&rdquo; on a gap.
            </p>
          </ScoutBox>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 10 }}>
            {skillGroups.map(({ role, goals }) => (
              <div key={role}>
                <ScoutDisplayTitle size={16} style={{ marginBottom: 10 }}>
                  For {role}
                </ScoutDisplayTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {goals.map(renderSkillRow)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <ScoutBox stack padding={isMobile ? "16px" : "18px 20px"} style={{ marginBottom: 24, background: color.forest, border: border.lineStrong }}>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: isMobile ? 16 : 0 }}>
          <div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: fontSans, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(232,213,163,0.75)" }}>Your learning progress</span>
              <ScoreExplainerPopover variant="upskill-progress" light />
            </span>
            <p style={displayTitleStyle(22, { color: color.gold, margin: "6px 0 0" })}>{doneCount + customDone} of {total + customItems.length} complete</p>
          </div>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: `conic-gradient(#E8D5A3 ${((doneCount + customDone) / (total + customItems.length || 1)) * 360}deg, rgba(232,213,163,0.15) 0)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 50, height: 50, borderRadius: "50%", background: "#1A3A2F", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "var(--font-mono-ui)", fontSize: 14, fontWeight: 500, color: "#E8D5A3" }}>{Math.round(((doneCount + customDone) / (total + customItems.length || 1)) * 100)}%</span>
          </div>
        </div>
        </div>
      </ScoutBox>

      {/* Section C — Programs for skills to obtain */}
      <div style={{ marginBottom: 32 }}>
        <UpskillSectionLabel variant="upskill-recommendations">Recommended programs</UpskillSectionLabel>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 16px", lineHeight: 1.6 }}>
          Courses and certifications matched to skills you&apos;re trying to obtain.
        </p>
        {skillGoals.length === 0 ? (
          <ScoutBox padding={16}>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
              Programs appear here once you add skills to obtain.
            </p>
          </ScoutBox>
        ) : (
          <>
            {skillGroups.map(({ role, goals }) => (
              <div key={`programs-${role}`} style={{ marginBottom: 24 }}>
                <ScoutDisplayTitle size={16} style={{ marginBottom: 12 }}>For {role}</ScoutDisplayTitle>
                {goals.map((g) => (
                  <div key={`programs-${g.skill}-${g.role}`} style={{ marginBottom: 16 }}>
                    <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, margin: "0 0 8px" }}>{g.skill}</p>
                    <ProgramLinks programs={g.programs.length ? g.programs : findProgramsForSkill(g.skill)} />
                  </div>
                ))}
              </div>
            ))}
            {programItems.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <ScoutDisplayTitle size={16} style={{ marginBottom: 8 }}>Kimchi picks</ScoutDisplayTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {programItems.map((item) => {
                    const prog = getProgress(item.id);
                    const statusLabel = prog === "completed" ? "Completed ✓" : prog === "inprogress" ? "In progress" : "Not started";
                    const isHighlighted = highlightSkill
                      ? item.closesGap?.some((s) => s.toLowerCase() === highlightSkill.toLowerCase())
                      : false;
                    return (
                      <ScoutBox
                        key={item.id}
                        padding="14px 16px"
                        style={isHighlighted ? { borderColor: color.forest, boxShadow: "0 0 0 1px rgba(26,58,47,0.2)" } : undefined}
                      >
                        <div
                          ref={(el) => { courseRefs.current[String(item.id)] = el; }}
                          style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: 12 }}
                        >
                          <div style={{ flex: 1 }}>
                            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, margin: "0 0 4px" }}>{item.name}</p>
                            <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)", margin: 0 }}>{item.platform} · {item.duration} · {statusLabel}</p>
                          </div>
                          {prog === "completed" ? (
                            <ScoutSecondaryBtn onClick={() => setCourseProgress(item.id, "inprogress")} style={{ minHeight: 44, width: isMobile ? "100%" : undefined, color: color.forest }}>
                              Review →
                            </ScoutSecondaryBtn>
                          ) : (
                            <ScoutPrimaryBtn onClick={() => setCourseProgress(item.id, prog === "none" ? "inprogress" : "completed")} style={{ minHeight: 44, width: isMobile ? "100%" : undefined }}>
                              {prog === "inprogress" ? "Complete →" : "Start →"}
                            </ScoutPrimaryBtn>
                          )}
                        </div>
                      </ScoutBox>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* My Learning */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <ScoutLabel>My learning</ScoutLabel>
          {!showAddForm && (
            <ScoutSecondaryBtn onClick={() => setShowAddForm(true)}>+ Add your own</ScoutSecondaryBtn>
          )}
        </div>

        {showAddForm && (
          <ScoutBox padding={16} style={{ marginBottom: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)", marginBottom: 4 }}>Course / Certification name *</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Google Project Management Certificate"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 0, border: "1px solid #E5DDD0", fontFamily: "var(--font-ui)", fontSize: 14, color: "#1A1A1A", background: "#FFFDF9", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)", marginBottom: 4 }}>Platform</label>
                <input value={newPlatform} onChange={(e) => setNewPlatform(e.target.value)} placeholder="e.g. Coursera, Udemy, LinkedIn"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 0, border: "1px solid #E5DDD0", fontFamily: "var(--font-ui)", fontSize: 14, color: "#1A1A1A", background: "#FFFDF9", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)", marginBottom: 4 }}>Duration</label>
                <input value={newDuration} onChange={(e) => setNewDuration(e.target.value)} placeholder="e.g. 6 weeks"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 0, border: "1px solid #E5DDD0", fontFamily: "var(--font-ui)", fontSize: 14, color: "#1A1A1A", background: "#FFFDF9", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)", marginBottom: 4 }}>URL (optional)</label>
                <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://…"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 0, border: "1px solid #E5DDD0", fontFamily: "var(--font-ui)", fontSize: 14, color: "#1A1A1A", background: "#FFFDF9", outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <ScoutPrimaryBtn onClick={addCustomItem} disabled={!newName.trim()} style={{ opacity: newName.trim() ? 1 : 0.5 }}>Add</ScoutPrimaryBtn>
              <ScoutSecondaryBtn onClick={() => { setShowAddForm(false); setNewName(""); setNewUrl(""); setNewPlatform(""); setNewDuration(""); }}>Cancel</ScoutSecondaryBtn>
            </div>
          </ScoutBox>
        )}

        {customItems.length === 0 && !showAddForm ? (
          <div style={{ padding: "24px 0", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#C0B8B0" }}>No custom items yet. Add courses, certifications, or tools you&apos;re learning on your own.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {customItems.map((item) => {
              const statusLabel = item.status === "completed" ? "Completed ✓" : item.status === "inprogress" ? "In progress" : "Not started";
              const statusColor = item.status === "completed" ? "#1A3A2F" : item.status === "inprogress" ? "#C4A86A" : "var(--scout-muted)";
              return (
                <div key={item.id} style={{ background: "#FFFFFF", borderRadius: 0, padding: "14px 16px", border: "1px solid rgba(0,0,0,0.06)", display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 0, background: "#E8E2D8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 700, color: "var(--scout-muted)" }}>{(item.platform || item.name).charAt(0).toUpperCase()}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "#1A1A1A", textDecoration: "none" }}>{item.name}</a>
                      ) : (
                        <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>{item.name}</p>
                      )}
                    </div>
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)", marginBottom: 3 }}>
                      {[item.platform, item.duration].filter(Boolean).join(" · ")}
                    </p>
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: statusColor }}>{statusLabel}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: isMobile ? "wrap" : undefined }}>
                    <button onClick={() => updateCustomStatus(item.id)}
                      style={{ padding: "10px 14px", minHeight: 44, flex: isMobile ? 1 : undefined, background: item.status === "completed" ? "rgba(26,58,47,0.08)" : "#1A3A2F", color: item.status === "completed" ? "#1A3A2F" : "#E8D5A3", border: "none", borderRadius: 0, fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
                      {item.status === "completed" ? "Review →" : item.status === "inprogress" ? "Complete →" : "Start →"}
                    </button>
                    <button onClick={() => removeCustomItem(item.id)} style={{ background: "none", border: "none", color: "#C0B8B0", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "2px 4px" }}>×</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Resume Assets ───────────────────────────────────────────────────────

function UploadResumeModal({ onClose, onUpload, uploading, inputRef }: {
  onClose: () => void;
  onUpload: () => void;
  uploading: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const isMobile = useIsMobile();
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: isMobile ? 16 : 0,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: surface.card,
          border: border.lineStrong,
          padding: isMobile ? "36px 24px 28px" : "44px 40px 36px",
          width: 540,
          maxWidth: "90vw",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 32,
            height: 32,
            background: color.forest,
            border: border.line,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: color.gold,
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          ✕
        </button>

        <ScoutLabel>Resume upload</ScoutLabel>
        <ScoutDisplayTitle size={22} style={{ margin: "10px 0 28px", textAlign: "center" }}>
          Upload resume to get started
        </ScoutDisplayTitle>

        {/* Drop zone */}
        <div
          onClick={() => inputRef.current?.click()}
          style={{
            width: 140, height: 140, display: "flex",
            alignItems: "center", justifyContent: "center",
            cursor: "pointer", marginBottom: 32,
          }}
        >
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="20" y="10" width="65" height="82" rx="6" fill="#F5F5F5" stroke="#D0D0D0" strokeWidth="2"/>
            <rect x="28" y="24" width="42" height="4" rx="2" fill="#D0D0D0"/>
            <rect x="28" y="34" width="36" height="4" rx="2" fill="#D0D0D0"/>
            <rect x="28" y="44" width="40" height="4" rx="2" fill="#D0D0D0"/>
            <rect x="28" y="54" width="32" height="4" rx="2" fill="#D0D0D0"/>
            <circle cx="85" cy="85" r="20" fill={color.forest}/>
            <path d="M85 77v16M77 85l8-8 8 8" stroke={color.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <p style={{
          fontFamily: fontSans,
          fontSize: T.bodySm,
          color: color.muted,
          textAlign: "center",
          margin: "0 0 24px",
          lineHeight: 1.5,
        }}>
          PDF or Word format · max 10MB
        </p>

        <ScoutPrimaryBtn
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{ width: "100%", padding: "14px 0", minHeight: 44, opacity: uploading ? 0.6 : 1 }}
        >
          {uploading ? "Uploading…" : "Choose file"}
        </ScoutPrimaryBtn>
      </div>
    </div>
  );
}

function AssetsTab({ assets, uploading, onUpload, onDelete, onOpenResume, inputRef, suggestions, suggestionsLoading, onOpenPricing }: {
  assets: UserAssetRow[];
  uploading: boolean;
  onUpload: (file: File) => void;
  onDelete: (id: string) => void;
  onOpenResume: (id: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  suggestions: AISuggestion[];
  suggestionsLoading: boolean;
  onOpenPricing: () => void;
}) {
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const MAX_SLOTS = 5;

  const resumes = assets.filter((a) => a.type === "RESUME");

  const renderResumeMenu = (r: UserAssetRow) => (
    <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setMenuOpen(menuOpen === r.id ? null : r.id)}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--scout-muted)", padding: "8px 10px", minHeight: 44, borderRadius: 4 }}
        aria-label="Resume options"
      >
        ···
      </button>
      {menuOpen === r.id && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            background: surface.card,
            border: border.line,
            boxShadow: "4px 4px 0 rgba(17,17,17,0.06)",
            minWidth: 160,
            zIndex: 100,
            overflow: "hidden",
          }}
        >
          {[
            { label: "View resume", action: () => { onOpenResume(r.id); setMenuOpen(null); } },
            { label: "Replace resume", action: () => { inputRef.current?.click(); setMenuOpen(null); } },
            { label: "Download", action: () => { window.open(r.url, "_blank"); setMenuOpen(null); } },
            { label: "Delete", action: () => { onDelete(r.id); setMenuOpen(null); } },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              style={{ width: "100%", padding: "12px 14px", minHeight: 44, textAlign: "left", background: "none", border: "none", fontSize: 14, color: "#1A1A1A", cursor: "pointer", display: "block", borderBottom: "1px solid #F5F3EF" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F3EF")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", marginBottom: 20, gap: isMobile ? 14 : 0 }}>
        <div>
          <ScoutLabel>Resumes</ScoutLabel>
          <ScoutDisplayTitle size={22} style={{ marginTop: 8, marginBottom: 6 }}>Your files</ScoutDisplayTitle>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
            {resumes.length} of {MAX_SLOTS} slots used
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 10 }}>
          {!isMobile && (
          <button
            type="button"
            onClick={onOpenPricing}
            data-offer="pro"
            data-trigger="profile_assets"
            style={{
              padding: "8px 16px",
              background: surface.card,
              color: color.forest,
              border: border.line,
              fontSize: T.caption,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            Upgrade to Pro ›
          </button>
          )}
          <input ref={inputRef} type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) { onUpload(f); setShowUploadModal(false); } }} />
          <ScoutPrimaryBtn
            onClick={() => setShowUploadModal(true)}
            disabled={uploading || resumes.length >= MAX_SLOTS}
            style={{ width: isMobile ? "100%" : undefined, opacity: uploading ? 0.6 : 1 }}
          >
            {uploading ? "Uploading…" : "+ Upload resume"}
          </ScoutPrimaryBtn>
        </div>
      </div>

      {/* Resume list */}
      {isMobile ? (
        <ScoutBox padding={0} style={{ overflow: "hidden" }}>
          {resumes.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>No resume uploaded yet.</p>
              <ScoutPrimaryBtn
                onClick={() => setShowUploadModal(true)}
                disabled={uploading}
                style={{ marginTop: 12, minHeight: 44 }}
              >
                + Upload resume
              </ScoutPrimaryBtn>
            </div>
          ) : (
            resumes.map((r, index) => (
              <div
                key={r.id}
                style={{
                  padding: "14px 16px",
                  borderBottom: index < resumes.length - 1 ? border.line : "none",
                  position: "relative",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                  <button
                    type="button"
                    onClick={() => onOpenResume(r.id)}
                    style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", flex: 1, minWidth: 0 }}
                  >
                    <div style={{
                      width: 32, height: 32, background: color.forest, border: border.line,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <span style={{ color: color.gold, fontSize: 14, fontWeight: 700 }}>
                        {r.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                  </button>
                  {renderResumeMenu(r)}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {r.isPrimary && (
                    <span style={{ padding: "2px 8px", background: surface.inset, border: border.line, fontSize: T.caption, fontWeight: 600, color: color.forest }}>
                      ★ Primary
                    </span>
                  )}
                  <span style={{ padding: "2px 8px", background: surface.inset, border: border.line, fontSize: T.caption, fontWeight: 500, color: color.forest }}>
                    Analysis complete
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
                    Modified {timeAgo(r.updatedAt)}
                  </span>
                  <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
                    Added {timeAgo(r.createdAt)}
                  </span>
                </div>
              </div>
            ))
          )}
        </ScoutBox>
      ) : (
      <ScoutBox padding={0} style={{ overflow: "visible", position: "relative" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "2fr 1.2fr 1fr 1fr 40px",
          padding: "10px 20px",
          borderBottom: border.line,
          background: surface.inset,
        }}>
          {["Resume", "Target Job Title", "Last Modified", "Created", ""].map((col) => (
            <span key={col} style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{col}</span>
          ))}
        </div>

        {resumes.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>No resume uploaded yet.</p>
            <ScoutPrimaryBtn
              onClick={() => setShowUploadModal(true)}
              disabled={uploading}
              style={{ marginTop: 12 }}
            >
              + Upload resume
            </ScoutPrimaryBtn>
          </div>
        ) : (
          resumes.map((r) => (
            <div
              key={r.id}
              onClick={() => onOpenResume(r.id)}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1.2fr 1fr 1fr 40px",
                padding: "14px 20px",
                alignItems: "center",
                borderBottom: border.line,
                position: "relative",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = surface.inset)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, background: color.forest, border: border.line,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <span style={{ color: color.gold, fontSize: 14, fontWeight: 700 }}>
                    {r.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <span style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink }}>{r.name}</span>
                  <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                    {r.isPrimary && (
                      <span style={{ padding: "2px 8px", background: surface.inset, border: border.line, fontSize: T.caption, fontWeight: 600, color: color.forest, display: "flex", alignItems: "center", gap: 3 }}>
                        ★ Primary
                      </span>
                    )}
                    <span style={{ padding: "2px 8px", background: surface.inset, border: border.line, fontSize: T.caption, fontWeight: 500, color: color.forest }}>
                      Analysis complete
                    </span>
                  </div>
                </div>
              </div>

              <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: "#C0B8B0" }}>
                —
              </span>

              <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>
                {timeAgo(r.updatedAt)}
              </span>

              <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>
                {timeAgo(r.createdAt)}
              </span>

              {/* Options menu */}
              {renderResumeMenu(r)}
            </div>
          ))
        )}
      </ScoutBox>
      )}

      {showUploadModal && (
        <UploadResumeModal
          onClose={() => setShowUploadModal(false)}
          onUpload={() => inputRef.current?.click()}
          uploading={uploading}
          inputRef={inputRef}
        />
      )}
    </div>
  );
}

// ─── AI Readback Card ─────────────────────────────────────────────────────────

function ReadbackCard({ data, loading, onRefresh, embedded, stack }: { data: ReadbackData | null; loading: boolean; onRefresh: () => void; embedded?: boolean; stack?: boolean }) {
  const isMobile = useIsMobile();
  const { showCredits } = useCredits();
  if (!loading && !data) return null;
  return (
    <ScoutBox
      stack={stack}
      padding={isMobile ? "14px 16px" : "16px 20px"}
      style={{ marginBottom: embedded ? 0 : (isMobile ? 16 : 20), height: embedded && !isMobile ? "100%" : undefined }}
    >
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", marginBottom: 10, gap: isMobile ? 10 : 0 }}>
        <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.gold, textTransform: "uppercase" as const, letterSpacing: "0.08em", margin: 0, display: "inline-flex", alignItems: "center", gap: 4, background: color.forest, padding: "4px 10px", border: border.lineStrong }}>
          <SparkleIcon /> Kimchi&apos;s read on you
        </p>
        <div style={{ display: "flex", flexDirection: "column", alignItems: isMobile ? "flex-start" : "flex-end", gap: 4 }}>
          <ScoutSecondaryBtn onClick={onRefresh} disabled={loading} style={{ padding: isMobile ? "10px 14px" : "4px 10px", minHeight: isMobile ? 44 : undefined, opacity: loading ? 0.5 : 1 }}>
            ↻ {loading ? "Refreshing…" : "Refresh"}
          </ScoutSecondaryBtn>
          {showCredits && !loading && (
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--scout-muted)" }}>Uses 1 credit</span>
          )}
        </div>
      </div>
      {loading ? (
        <KimchiProcessLoader preset="profileAnalysis" variant="inline" />
      ) : data ? (
        <>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#1C3A2F", lineHeight: 1.65, marginBottom: 12 }}>{data.picture}</p>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, marginBottom: 12 }}>
            {data.strengths.map((s) => (
              <span key={s} style={{ padding: "4px 10px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.forest }}>{s}</span>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, marginBottom: 12 }}>
            {data.targetRoles.map((r) => {
              const c = r.fit === "Strong match" ? "#1A3A2F" : r.fit === "Good fit" ? "#C4A86A" : "var(--scout-muted)";
              const bg = r.fit === "Strong match" ? "rgba(74,139,106,0.08)" : r.fit === "Good fit" ? "rgba(196,168,106,0.1)" : "rgba(0,0,0,0.04)";
              return (
                <span key={r.role} style={{ padding: "4px 10px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: c }}>{r.role} · {r.fit}</span>
              );
            })}
          </div>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)", fontStyle: "italic" }}>{data.honestNote}</p>
        </>
      ) : null}
    </ScoutBox>
  );
}

// ─── Career Preferences Panel ─────────────────────────────────────────────────

function PrefChip({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>{label}</p>
      <span style={{ display: "inline-block", padding: "6px 12px", borderRadius: 0, background: "#F7F5F2", border: "1px solid rgba(0,0,0,0.08)", fontSize: 14, color: "#1C3A2F", fontFamily: "var(--font-ui)" }}>{value}</span>
    </div>
  );
}

const PREF_EMPLOYMENT = [
  { value: "employed", label: "Employed — not actively looking" },
  { value: "open", label: "Employed — open to opportunities" },
  { value: "searching", label: "Actively searching" },
];

const PREF_JOB_TIMELINES = [
  { value: "asap", label: "As soon as possible" },
  { value: "3-6mo", label: "In the next 3–6 months" },
  { value: "open", label: "Whenever the right role appears" },
];

const PREF_MOTIVATIONS = [
  "Higher compensation",
  "More interesting work",
  "Better work-life balance",
  "Step up in level",
  "A career pivot",
];

const PREF_PRIORITIES = [
  "Remote-first",
  "Hybrid-friendly",
  "Work-life balance",
  "High compensation",
  "Equity / ownership",
  "Mission-driven",
  "Fast growth",
  "Strong team culture",
  "Specific location",
  "Open to relocating within my country",
  "Open to relocating internationally",
];

type CareerPrefPatch = Partial<Pick<UserProfile,
  "careerMotivation" | "jobTimeline" | "currentSalary" | "targetSalary" | "priorities" | "employmentStatus"
  | "targetMarket" | "relocationOpenness" | "workAuthorization" | "securityClearance" | "searchDuration" | "positioningStatement"
>>;

function CareerPreferencesPanel({ profile, onSave }: {
  profile: UserProfile;
  onSave: (patch: CareerPrefPatch) => Promise<void>;
}) {
  const isMobile = useIsMobile();
  const [editing, setEditing] = useState(false);
  const [empStatus, setEmpStatus] = useState(profile.employmentStatus || "");
  const [timeline, setTimeline] = useState(profile.jobTimeline || "");
  const [currentSalary, setCurrentSalary] = useState(profile.currentSalary || "");
  const [targetSalary, setTargetSalary] = useState(profile.targetSalary || "");
  const [motivation, setMotivation] = useState(profile.careerMotivation || "");
  const [priorities, setPriorities] = useState<string[]>(profile.priorities || []);
  const [targetMarket, setTargetMarket] = useState(profile.targetMarket || "");
  const [relocationOpenness, setRelocationOpenness] = useState(profile.relocationOpenness || "");
  const [workAuthorization, setWorkAuthorization] = useState(profile.workAuthorization || "");
  const [securityClearance, setSecurityClearance] = useState(profile.securityClearance || "");
  const [searchDuration, setSearchDuration] = useState(profile.searchDuration || "");
  const [positioningStatement, setPositioningStatement] = useState(profile.positioningStatement || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEmpStatus(profile.employmentStatus || "");
    setTimeline(profile.jobTimeline || "");
    setCurrentSalary(profile.currentSalary || "");
    setTargetSalary(profile.targetSalary || "");
    setMotivation(profile.careerMotivation || "");
    setPriorities(profile.priorities || []);
    setTargetMarket(profile.targetMarket || "");
    setRelocationOpenness(profile.relocationOpenness || "");
    setWorkAuthorization(profile.workAuthorization || "");
    setSecurityClearance(profile.securityClearance || "");
    setSearchDuration(profile.searchDuration || "");
    setPositioningStatement(profile.positioningStatement || "");
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      employmentStatus: empStatus || null,
      jobTimeline: timeline || null,
      currentSalary: currentSalary || null,
      targetSalary: targetSalary || null,
      careerMotivation: motivation || null,
      priorities,
      targetMarket: targetMarket || null,
      relocationOpenness: relocationOpenness || null,
      workAuthorization: workAuthorization || null,
      securityClearance: securityClearance || null,
      searchDuration: searchDuration || null,
      positioningStatement: positioningStatement || null,
    });
    setSaving(false);
    setEditing(false);
  };

  const handleCancel = () => {
    setEmpStatus(profile.employmentStatus || "");
    setTimeline(profile.jobTimeline || "");
    setCurrentSalary(profile.currentSalary || "");
    setTargetSalary(profile.targetSalary || "");
    setMotivation(profile.careerMotivation || "");
    setPriorities(profile.priorities || []);
    setTargetMarket(profile.targetMarket || "");
    setRelocationOpenness(profile.relocationOpenness || "");
    setWorkAuthorization(profile.workAuthorization || "");
    setSecurityClearance(profile.securityClearance || "");
    setSearchDuration(profile.searchDuration || "");
    setPositioningStatement(profile.positioningStatement || "");
    setEditing(false);
  };

  const statusLabel = PREF_EMPLOYMENT.find(e => e.value === profile.employmentStatus)?.label;
  const timelineLabel = PREF_JOB_TIMELINES.find(t => t.value === profile.jobTimeline)?.label;
  const hasAnyData = profile.employmentStatus || profile.jobTimeline || profile.currentSalary || profile.targetSalary || profile.careerMotivation || (profile.priorities || []).length > 0 || profile.targetMarket || profile.relocationOpenness || profile.workAuthorization || profile.securityClearance || profile.searchDuration || profile.positioningStatement;

  const inputStyle: React.CSSProperties = { width: "100%", padding: isMobile ? "12px 10px" : "8px 10px", fontSize: isMobile ? 16 : 13, borderRadius: 0, border: border.line, background: surface.inset, color: color.forest, fontFamily: fontSans, outline: "none", boxSizing: "border-box" };

  return (
    <ScoutBox padding={isMobile ? "18px 16px" : "22px 24px"}>
      <SectionHeader title="Career Preferences" onEdit={() => setEditing(!editing)} />

      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Status */}
          <div>
            <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 6 }}>Status</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {PREF_EMPLOYMENT.map(({ value, label }) => (
                <button key={value} onClick={() => setEmpStatus(empStatus === value ? "" : value)}
                  style={{ textAlign: "left", padding: isMobile ? "12px 12px" : "8px 12px", minHeight: isMobile ? 44 : undefined, borderRadius: 0, border: empStatus === value ? border.lineStrong : border.line, background: empStatus === value ? "rgba(26,58,47,0.06)" : surface.inset, fontSize: T.bodySm, color: color.forest, fontFamily: fontSans, cursor: "pointer" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div>
            <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 6 }}>Timeline</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {PREF_JOB_TIMELINES.map(({ value, label }) => (
                <button key={value} onClick={() => setTimeline(timeline === value ? "" : value)}
                  style={{ textAlign: "left", padding: isMobile ? "12px 12px" : "8px 12px", minHeight: isMobile ? 44 : undefined, borderRadius: 0, border: timeline === value ? border.lineStrong : border.line, background: timeline === value ? "rgba(26,58,47,0.06)" : surface.inset, fontSize: T.bodySm, color: color.forest, fontFamily: fontSans, cursor: "pointer" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Salary */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
            {([["Current salary", currentSalary, setCurrentSalary], ["Target salary", targetSalary, setTargetSalary]] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
              <div key={label}>
                <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 6 }}>{label}</p>
                <input value={val} onChange={(e) => setter(e.target.value)} placeholder="e.g. $120K" style={inputStyle} />
              </div>
            ))}
          </div>

          {/* Motivation */}
          <div>
            <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 6 }}>Primary motivation</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {PREF_MOTIVATIONS.map((m) => (
                <button key={m} onClick={() => setMotivation(motivation === m ? "" : m)}
                  style={{ padding: "5px 12px", borderRadius: 0, border: motivation === m ? border.lineStrong : border.line, background: motivation === m ? "rgba(26,58,47,0.08)" : surface.inset, fontSize: T.bodySm, color: motivation === m ? color.forest : color.muted, fontFamily: fontSans, cursor: "pointer" }}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Priorities */}
          <div>
            <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 6 }}>What matters most</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {PREF_PRIORITIES.map((p) => (
                <button key={p} onClick={() => setPriorities(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                  style={{ padding: "5px 12px", borderRadius: 0, border: priorities.includes(p) ? border.lineStrong : border.line, background: priorities.includes(p) ? "rgba(26,58,47,0.08)" : surface.inset, fontSize: T.bodySm, color: priorities.includes(p) ? color.forest : color.muted, fontFamily: fontSans, cursor: "pointer" }}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 6 }}>Search strategy details</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {([
                ["Target market (geo)", targetMarket, setTargetMarket, "e.g. Greater Philadelphia / Southern NJ"],
                ["Relocation", relocationOpenness, setRelocationOpenness, "e.g. Open depending on role"],
                ["Work authorization", workAuthorization, setWorkAuthorization, "e.g. U.S. Citizen"],
                ["Security clearance", securityClearance, setSecurityClearance, "e.g. Secret (verify status)"],
                ["Search duration", searchDuration, setSearchDuration, "e.g. 6+ months actively searching"],
              ] as [string, string, (v: string) => void, string][]).map(([label, val, setter, placeholder]) => (
                <div key={label}>
                  <p style={{ fontSize: 13, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 4 }}>{label}</p>
                  <input value={val} onChange={(e) => setter(e.target.value)} placeholder={placeholder} style={inputStyle} />
                </div>
              ))}
              <div>
                <p style={{ fontSize: 13, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 4 }}>Positioning statement</p>
                <textarea value={positioningStatement} onChange={(e) => setPositioningStatement(e.target.value)} placeholder="First-person positioning narrative…" style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, paddingTop: 2 }}>
            <ScoutPrimaryBtn onClick={handleSave} disabled={saving} style={{ opacity: saving ? 0.5 : 1 }}>
              {saving ? "Saving…" : "Save"}
            </ScoutPrimaryBtn>
            <ScoutSecondaryBtn onClick={handleCancel}>Cancel</ScoutSecondaryBtn>
          </div>
        </div>
      ) : !hasAnyData ? (
        <div style={{ paddingTop: 4 }}>
          <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 6 }}>
            No preferences set yet.{" "}
            <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", color: "#C4A86A", fontSize: 14, cursor: "pointer", fontFamily: "var(--font-ui)", padding: 0 }}>
              Add them →
            </button>
          </p>
          <p style={{ fontSize: 14, color: "#C0B8B0", fontFamily: "var(--font-ui)" }}>
            Kimchi uses these to filter and rank matched roles by what matters to you.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {profile.employmentStatus && (
            <div>
              <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>Status</p>
              <span style={{ display: "inline-block", padding: "6px 12px", borderRadius: 0, background: "#F7F5F2", border: "1px solid rgba(0,0,0,0.08)", fontSize: 14, color: "#1C3A2F", fontFamily: "var(--font-ui)" }}>{statusLabel || profile.employmentStatus}</span>
            </div>
          )}
          {profile.jobTimeline && (
            <div>
              <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>Timeline</p>
              <span style={{ display: "inline-block", padding: "6px 12px", borderRadius: 0, background: "#F7F5F2", border: "1px solid rgba(0,0,0,0.08)", fontSize: 14, color: "#1C3A2F", fontFamily: "var(--font-ui)" }}>{timelineLabel || profile.jobTimeline}</span>
            </div>
          )}
          {(profile.currentSalary || profile.targetSalary) && (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
              {profile.currentSalary && (
                <div>
                  <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>Current</p>
                  <span style={{ display: "inline-block", padding: "6px 12px", borderRadius: 0, background: "#F7F5F2", border: "1px solid rgba(0,0,0,0.08)", fontSize: 14, color: "#1C3A2F", fontFamily: "var(--font-ui)" }}>{profile.currentSalary}</span>
                </div>
              )}
              {profile.targetSalary && (
                <div>
                  <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>Target</p>
                  <span style={{ display: "inline-block", padding: "6px 12px", borderRadius: 0, background: "#F7F5F2", border: "1px solid rgba(0,0,0,0.08)", fontSize: 14, color: "#1C3A2F", fontFamily: "var(--font-ui)" }}>{profile.targetSalary}</span>
                </div>
              )}
            </div>
          )}
          {profile.careerMotivation && (
            <div>
              <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>Looking for</p>
              <span style={{ display: "inline-block", padding: "6px 12px", borderRadius: 0, background: "#F7F5F2", border: "1px solid rgba(0,0,0,0.08)", fontSize: 14, color: "#1C3A2F", fontFamily: "var(--font-ui)" }}>{profile.careerMotivation}</span>
            </div>
          )}
          {(profile.priorities || []).length > 0 && (
            <div>
              <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>Priorities</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {profile.priorities.map((p) => (
                  <span key={p} style={{ padding: "5px 11px", borderRadius: 0, background: "#F7F5F2", border: "1px solid rgba(0,0,0,0.08)", fontSize: 14, color: "#1C3A2F", fontFamily: "var(--font-ui)" }}>{p}</span>
                ))}
              </div>
            </div>
          )}
          {(profile.targetMarket || profile.relocationOpenness || profile.workAuthorization || profile.securityClearance || profile.searchDuration) && (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
              {profile.targetMarket && <PrefChip label="Target market" value={profile.targetMarket} />}
              {profile.relocationOpenness && <PrefChip label="Relocation" value={profile.relocationOpenness} />}
              {profile.workAuthorization && <PrefChip label="Work auth" value={profile.workAuthorization} />}
              {profile.securityClearance && <PrefChip label="Clearance" value={profile.securityClearance} />}
              {profile.searchDuration && <PrefChip label="Search duration" value={profile.searchDuration} />}
            </div>
          )}
          {profile.positioningStatement && (
            <div>
              <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>Positioning</p>
              <p style={{ fontSize: 14, color: "#1C3A2F", fontFamily: "var(--font-ui)", margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{profile.positioningStatement}</p>
            </div>
          )}
        </div>
      )}
    </ScoutBox>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type PageTab = "dreamrole" | "about" | "learning" | "assets" | "preferences" | "linkedin" | "strategy";
type AboutSection = "personal" | "education" | "experience" | "skills";

const ABOUT_SECTIONS: AboutSection[] = ["personal", "experience", "education", "skills"];
const ABOUT_LABEL: Record<AboutSection, string> = { personal: "Personal information", experience: "Work experience", education: "Education", skills: "Skills" };
const ABOUT_NUM: Record<AboutSection, string> = { personal: "01", experience: "02", education: "03", skills: "04" };

function AboutSectionCard({
  section,
  stack,
  children,
  gridColumn,
  sectionRef,
  padding,
}: {
  section: AboutSection;
  stack?: boolean;
  children: React.ReactNode;
  gridColumn?: string;
  sectionRef?: (el: HTMLDivElement | null) => void;
  padding?: number;
}) {
  return (
    <div ref={sectionRef} style={{ gridColumn, minWidth: 0 }}>
      <ScoutBox stack={stack} padding={padding ?? 22}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <ScoutLabel>{ABOUT_NUM[section]}</ScoutLabel>
          <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
        </div>
      </ScoutBox>
    </div>
  );
}

export function WorkspaceProfile() {
  const isMobile = useIsMobile();
  const [activeSection, setActiveSection] = useState<AboutSection>("personal");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const profileLoc = parseProfileLocation(pathname);
  const page = profileLoc.page;
  const setPage = (tab: PageTab) => {
    if (tab === "about") router.push("/profile");
    else if (tab === "dreamrole") router.push("/profile/dream-role");
    else if (tab === "learning") router.push("/profile/learning-path");
    else if (tab === "assets") router.push("/profile/assets");
    else if (tab === "preferences") router.push("/profile/preferences");
    else if (tab === "linkedin") router.push("/profile/linkedin");
    else if (tab === "strategy") router.push("/profile/career-strategy");
  };
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [dreamList, setDreamList] = useState<string[]>([]);
  const [roleAnalyses, setRoleAnalyses] = useState<RoleAnalysesMap>({});
  const [upskillProgress, setUpskillProgress] = useState<UpskillProgressMap>({});
  const [skillGoals, setSkillGoals] = useState<SkillGoal[]>([]);
  const [targetRoleSettings, setTargetRoleSettings] = useState<TargetRoleSettingsMap>({});
  const [upskillToast, setUpskillToast] = useState<string | null>(null);
  const legacyMigratedRef = useRef(false);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeUploadError, setResumeUploadError] = useState<string | null>(null);
  const [assets, setAssets] = useState<UserAssetRow[]>([]);
  const [readback, setReadback] = useState<ReadbackData | null>(null);
  const [readbackLoading, setReadbackLoading] = useState(false);
  const [profileSuggestions, setProfileSuggestions] = useState<AISuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [readbackNudge, setReadbackNudge] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const { openPricing } = useWorkspace();
  const { myCoach, loading: coachLoading, needsProfile: coachNeedsProfile, profileHint: coachProfileHint } = useCoachMatches();
  const [editorAssetId, setEditorAssetId] = useState<string | null>(null);
  const [onboardingFinish, setOnboardingFinish] = useState<OnboardingFinishPayload | null>(null);
  const openResumeEditor = (assetId: string) => {
    setEditorAssetId(assetId);
    router.push(profileAssetsUrl(assetId));
  };
  const closeResumeEditor = () => {
    setEditorAssetId(null);
    setOnboardingFinish(null);
    router.push("/profile/assets");
  };
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<AboutSection, HTMLDivElement | null>>({ personal: null, education: null, experience: null, skills: null });

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((d) => { if (d.isPro) setIsPro(true); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/profile")
      .then(async (r) => {
        const text = await r.text();
        if (!text) return { error: "Empty response" };
        try {
          return JSON.parse(text) as Record<string, unknown>;
        } catch {
          return { error: "Invalid response" };
        }
      })
      .then(async (data) => {
        if (data.error) return;
        const userProfile = data as UserProfile;
        setProfile(userProfile);
        setDreamList(userProfile.targetRoles || []);
        setRoleAnalyses(normalizeRoleAnalysesMap(userProfile.roleAnalyses));
        setSkillGoals(normalizeSkillGoals(userProfile.skillGoals));
        setUpskillProgress(userProfile.upskillProgress ?? {});
        setTargetRoleSettings(normalizeTargetRoleSettings(userProfile.targetRoleSettings));

        if (!legacyMigratedRef.current) {
          legacyMigratedRef.current = true;
          const migrated = await migrateLegacyProfileData(userProfile, patchProfile);
          setRoleAnalyses(migrated.roleAnalyses);
          setSkillGoals(migrated.skillGoals);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!profile?.resumeUrl) return;
    setReadbackLoading(true);
    fetch("/api/ai/readback")
      .then((r) => r.json())
      .then((data) => { if (!data.error) setReadback(data); })
      .catch(() => {})
      .finally(() => setReadbackLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.resumeUrl]);

  const refreshReadback = () => {
    if (!profile?.resumeUrl) return;
    setReadbackLoading(true);
    fetch("/api/ai/readback?force=true")
      .then(async (r) => {
        if (r.status === 402) {
          notifyCreditsChanged();
          setShowUpgrade(true);
          return;
        }
        const data = await r.json();
        if (!data.error) {
          setReadback(data);
          notifyCreditsChanged();
        }
      })
      .catch(() => {})
      .finally(() => setReadbackLoading(false));
  };

  useEffect(() => {
    if (!profile?.resumeUrl) return;
    setSuggestionsLoading(true);
    fetch("/api/ai/profile-suggestions")
      .then((r) => r.json())
      .then((data) => { if (data.suggestions) setProfileSuggestions(data.suggestions); })
      .catch(() => {})
      .finally(() => setSuggestionsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.resumeUrl]);

  const refreshProfileSuggestions = () => {
    if (!profile?.resumeUrl) return;
    setSuggestionsLoading(true);
    fetch("/api/ai/profile-suggestions?force=true")
      .then(async (r) => {
        if (r.status === 402) {
          notifyCreditsChanged();
          setShowUpgrade(true);
          return;
        }
        const data = await r.json();
        if (data.suggestions) {
          setProfileSuggestions(data.suggestions);
          notifyCreditsChanged();
        }
      })
      .catch(() => {})
      .finally(() => setSuggestionsLoading(false));
  };

  const patchProfile = async (patch: Record<string, unknown>) => {
    await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).catch(() => {});
  };

  const handleRoleAnalysisUpdate = (role: string, analysis: StoredRoleAnalysis) => {
    setRoleAnalyses((prev) => {
      const next = setStoredRoleAnalysis(prev, role, analysis);
      void patchProfile({ roleAnalyses: next });
      return next;
    });
  };

  const handleClearRoleAnalysis = (role: string) => {
    setRoleAnalyses((prev) => {
      const next = { ...prev };
      delete next[role];
      void patchProfile({ roleAnalyses: next });
      return next;
    });
    void fetch(`/api/ai/role-gap?role=${encodeURIComponent(role)}`, { method: "DELETE" }).catch(() => {});
  };

  const handleTargetRoleSettingsChange = (role: string, resumeAssetId: string | null) => {
    setTargetRoleSettings((prev) => {
      const next = { ...prev, [role]: { resumeAssetId } };
      void patchProfile({ targetRoleSettings: next });
      return next;
    });
  };

  const initRoleSettings = (role: string) => {
    const resumes = assets.filter((a) => a.type === "RESUME");
    if (targetRoleSettings[role]) return;
    const resumeAssetId = defaultResumeAssetId(resumes);
    setTargetRoleSettings((prev) => {
      const next = { ...prev, [role]: { resumeAssetId } };
      void patchProfile({ targetRoleSettings: next });
      return next;
    });
  };

  const addSkillToPortfolio = async (skill: string) => {
    const currentSkills = profile?.parsedData?.skills || [];
    if (currentSkills.some((s) => s.toLowerCase() === skill.toLowerCase())) return;
    await handleSkillsSave([...currentSkills, skill]);
  };

  const hasSkillGoal = (skill: string, role: string) =>
    skillGoals.some(
      (g) => g.skill.toLowerCase() === skill.toLowerCase() && g.role === role,
    );

  const obtainSkill = (skill: string, role: string) => {
    if (!hasSkillGoal(skill, role)) {
      const next = [...skillGoals, buildSkillGoal(skill, role)];
      setSkillGoals(next);
      void patchProfile({ skillGoals: next });
    }
    setUpskillToast(skill);
    window.setTimeout(() => setUpskillToast(null), 4500);
  };

  const addSkillGoal = (skill: string, role: string) => {
    if (hasSkillGoal(skill, role)) return;
    const next = [...skillGoals, buildSkillGoal(skill, role)];
    setSkillGoals(next);
    void patchProfile({ skillGoals: next });
  };

  const dismissSkillGoal = (skill: string, role: string) => {
    setSkillGoals((prev) => {
      const next = prev.filter(
        (g) => !(g.skill.toLowerCase() === skill.toLowerCase() && g.role === role),
      );
      void patchProfile({ skillGoals: next });
      return next;
    });
  };

  const persistUpskillProgress = (next: UpskillProgressMap) => {
    setUpskillProgress(next);
    void patchProfile({ upskillProgress: next });
  };

  const refreshAssets = () => {
    fetch("/api/assets")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setAssets(data); })
      .catch(() => {});
  };

  useEffect(() => {
    if (page === "assets" || page === "dreamrole" || page === "learning") refreshAssets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    if (profileLoc.assetId) {
      setEditorAssetId(profileLoc.assetId);
      return;
    }
    if (page === "assets") {
      setEditorAssetId(null);
    }
  }, [profileLoc.assetId, page]);

  useEffect(() => {
    if (profileLoc.aboutSection) {
      setActiveSection(profileLoc.aboutSection);
    }
  }, [profileLoc.aboutSection]);

  useEffect(() => {
    if (page !== "assets" || searchParams.get("open") !== "primary") return;

    const payload = readOnboardingFinishPayload();
    if (payload && !onboardingFinish) setOnboardingFinish(payload);

    const primaryFromPayload = payload?.primaryAssetId ?? onboardingFinish?.primaryAssetId;
    const primaryFromAssets = assets.find((a) => a.type === "RESUME" && a.isPrimary)?.id
      ?? assets.find((a) => a.type === "RESUME")?.id;
    const assetToOpen = primaryFromPayload ?? primaryFromAssets;
    if (!assetToOpen) return;

    setEditorAssetId(assetToOpen);
    if (payload) clearOnboardingFinishPayload();

    router.replace(profileAssetsUrl(assetToOpen));
  }, [page, searchParams, assets, router, onboardingFinish]);

  const handlePersonalSave = async (patch: Omit<Partial<UserProfile>, "parsedData"> & { parsedData?: Partial<ParsedData> }) => {
    if (!profile) return;
    const { parsedData: pdPatch, ...rest } = patch;
    const newParsedData = pdPatch ? { ...(profile.parsedData || { education: [], workExperience: [], skills: [] }), ...pdPatch } : profile.parsedData;
    await patchProfile({ ...rest, parsedData: newParsedData });
    setProfile((p) => p ? { ...p, ...rest, parsedData: newParsedData } : p);
  };

  const handleEducationSave = async (entries: EducationEntry[]) => {
    if (!profile) return;
    const newParsedData = { ...(profile.parsedData || { workExperience: [], skills: [] }), education: entries };
    await patchProfile({ parsedData: newParsedData });
    setProfile((p) => p ? { ...p, parsedData: newParsedData } : p);
  };

  const handleExperienceSave = async (entries: WorkEntry[]) => {
    if (!profile) return;
    const newParsedData = { ...(profile.parsedData || { education: [], skills: [] }), workExperience: entries };
    await patchProfile({ parsedData: newParsedData });
    setProfile((p) => p ? { ...p, parsedData: newParsedData } : p);
  };

  const handleSkillsSave = async (skills: string[]) => {
    if (!profile) return;
    const newParsedData = { ...(profile.parsedData || { education: [], workExperience: [] }), skills };
    await patchProfile({ parsedData: newParsedData });
    setProfile((p) => p ? { ...p, parsedData: newParsedData } : p);
  };

  const handleCareerPrefSave = async (patch: CareerPrefPatch) => {
    await patchProfile(patch as Record<string, unknown>);
    setProfile((p) => p ? { ...p, ...patch } : p);
  };

  const graduateSkill = async (skill: string) => {
    const currentSkills = profile?.parsedData?.skills || [];
    if (!currentSkills.some((s) => s.toLowerCase() === skill.toLowerCase())) {
      await handleSkillsSave([...currentSkills, skill]);
    }
    setSkillGoals((prev) => {
      const next = prev.filter((g) => g.skill.toLowerCase() !== skill.toLowerCase());
      void patchProfile({ skillGoals: next });
      return next;
    });
  };

  const handleResumeUpload = async (file: File) => {
    setResumeUploading(true);
    setResumeUploadError(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/resume", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setResumeUploadError(data.error || "Upload failed. Please try again.");
        return;
      }
      if (data.url) {
        const profileRes = await fetch("/api/profile");
        const profileData = await profileRes.json();
        if (!profileData.error) {
          setProfile(profileData);
          setRoleAnalyses(normalizeRoleAnalysesMap(profileData.roleAnalyses));
        } else {
          setProfile((p) => p ? { ...p, resumeUrl: data.url } : p);
        }
        refreshAssets();
        if (data.asset?.id) openResumeEditor(data.asset.id);
        setReadbackNudge(true);
        setTimeout(() => setReadbackNudge(false), 8000);
      }
    } catch {
      setResumeUploadError("Upload failed. Please try again.");
    } finally {
      setResumeUploading(false);
    }
  };

  const handleAssetDelete = async (id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    try {
      const res = await fetch(`/api/assets?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        const profileRes = await fetch("/api/profile");
        const profileData = await profileRes.json();
        if (!profileData.error) setProfile(profileData);
      } else {
        refreshAssets();
      }
    } catch {
      refreshAssets();
    }
  };

  const goToSection = (section: AboutSection) => {
    router.push(profileAboutSectionUrl(section));
    setActiveSection(section);
    // Wait for render if switching from another page, then scroll
    setTimeout(() => {
      const el = sectionRefs.current[section];
      const container = scrollRef.current;
      if (el && container) {
        const top = el.offsetTop - 16;
        container.scrollTo({ top, behavior: "smooth" });
      }
    }, 50);
  };

  const pd = profile?.parsedData;
  const education = pd?.education || [];
  const workExperience = pd?.workExperience || [];
  const skills = pd?.skills || [];
  const highlightSkill = searchParams.get("skill");
  const resumeAssets = assets.filter((a) => a.type === "RESUME");

  const PAGE_TABS: { id: PageTab; label: string }[] = [
    { id: "about", label: "About" },
    { id: "linkedin", label: "LinkedIn" },
    { id: "dreamrole", label: isMobile ? "Roles" : "Target Roles" },
    { id: "strategy", label: isMobile ? "Strategy" : "Career Strategy" },
    { id: "learning", label: "Upskill" },
    { id: "assets", label: "Resumes" },
    { id: "preferences", label: isMobile ? "Prefs" : "Preferences" },
  ];

  const scrollPad = isMobile ? "24px 16px 40px 16px" : "32px 36px 48px";
  const sectionCardPad = isMobile ? 18 : 22;
  const contentShell: React.CSSProperties = {
    width: "100%",
    maxWidth: isMobile ? undefined : 1120,
    margin: "0 auto",
  };
  const showReadback = !!(readback || readbackLoading);

  return (
    <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: surface.page, animation: "fadeIn 0.3s ease both" }}>
      {isMobile && (
        <WorkspaceMobileTopBar center={<ScoutLabel>Your profile</ScoutLabel>} />
      )}
      <div ref={scrollRef} style={{ padding: scrollPad, overflowY: "auto", flex: 1, minHeight: 0, WebkitOverflowScrolling: "touch" }}>
        <div style={contentShell}>
        {upskillToast && (
          <ScoutBox
            padding="12px 16px"
            style={{ marginBottom: 16, background: "rgba(26,58,47,0.06)", borderColor: color.forest }}
          >
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.forest, margin: 0, lineHeight: 1.5 }}>
              Added &ldquo;{upskillToast}&rdquo; to Upskill — view it under Skills to obtain.
            </p>
          </ScoutBox>
        )}
        {/* Header */}
        <div style={{ marginBottom: isMobile ? 24 : 28 }}>
          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ width: 8, height: 8, background: color.forest, display: "inline-block", flexShrink: 0 }} />
              <ScoutLabel>Your profile</ScoutLabel>
            </div>
          )}
          <ScoutDisplayTitle size={isMobile ? 28 : 36} style={{ marginBottom: 8 }}>
            {loading ? "Loading…" : profile?.name || "Your story, through Kimchi"}
          </ScoutDisplayTitle>
          {profile?.headline && (
            <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.muted, margin: "0 0 12px", lineHeight: 1.5 }}>
              {profile.headline}
            </p>
          )}
          {!profile?.headline && !loading && (
            <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.muted, margin: "0 0 12px", lineHeight: 1.6, maxWidth: 520 }}>
              Resume, preferences, and target roles — white boxes on cream, same as Opportunities.
            </p>
          )}
          {profile && (() => {
            const pct = profileCompleteness(profile);
            const missing: { label: string; points: number; action: () => void }[] = [];
            if (!profile.resumeUrl) missing.push({ label: "Upload your resume", points: 2, action: () => setPage("assets") });
            if (!profile.parsedData?.phone) missing.push({ label: "Add phone number", points: 1, action: () => goToSection("personal") });
            if (!profile.parsedData?.location) missing.push({ label: "Add your location", points: 1, action: () => goToSection("personal") });
            if (!profile.linkedinUrl) missing.push({ label: "Link your LinkedIn", points: 1, action: () => goToSection("personal") });
            if (!(profile.parsedData?.education || []).length) missing.push({ label: "Add education history", points: 1, action: () => goToSection("education") });
            if (!(profile.parsedData?.workExperience || []).length) missing.push({ label: "Add work experience", points: 1, action: () => goToSection("experience") });
            if (!(profile.parsedData?.skills || []).length) missing.push({ label: "Add your skills", points: 1, action: () => goToSection("skills") });
            if (!profile.jobTimeline) missing.push({ label: "Set your job timeline", points: 1, action: () => setPage("preferences") });
            if (!profile.targetSalary) missing.push({ label: "Set your target salary", points: 1, action: () => setPage("preferences") });
            if (!(profile.priorities || []).length) missing.push({ label: "Add job priorities", points: 1, action: () => setPage("preferences") });

            return (
              <ScoutBox style={{ marginTop: 14 }} padding={16}>
                <button
                  onClick={() => missing.length > 0 && setShowChecklist(s => !s)}
                  style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, cursor: missing.length > 0 ? "pointer" : "default" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <ScoreExplainerLabel variant="profile-completeness">
                      <ScoutLabel>Profile completeness</ScoutLabel>
                    </ScoreExplainerLabel>
                    <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: pct >= 80 ? color.forest : "#C4A86A" }}>
                      {pct}%{missing.length > 0 ? (showChecklist ? " ▲" : " ▼") : " ✓"}
                    </span>
                  </div>
                  <div style={{ height: 3, background: "rgba(17,17,17,0.08)" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: pct >= 80 ? color.forest : "#C4A86A", transition: "width 0.4s ease" }} />
                  </div>
                  {missing.length > 0 && (
                    <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "8px 0 0" }}>
                      {missing.length} item{missing.length !== 1 ? "s" : ""} to complete
                    </p>
                  )}
                </button>

                {showChecklist && missing.length > 0 && (
                  <div style={{ marginTop: 12, borderTop: border.line, paddingTop: 8 }}>
                    {missing.map((item, i) => (
                      <button
                        key={item.label}
                        onClick={() => { item.action(); setShowChecklist(false); }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          width: "100%",
                          padding: "10px 0",
                          border: "none",
                          borderBottom: i < missing.length - 1 ? border.line : "none",
                          background: "transparent",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink }}>{item.label}</span>
                        <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>+{item.points}%</span>
                      </button>
                    ))}
                  </div>
                )}
              </ScoutBox>
            );
          })()}
        </div>

        {/* Resume upload nudge */}
        {readbackNudge && (
          <ScoutBox style={{ marginBottom: 16, borderColor: "rgba(74,139,106,0.35)" }} padding={14}>
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", gap: 12 }}>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.forest, margin: 0, lineHeight: 1.5 }}>
                ✓ Resume uploaded — Kimchi extracted your experience, education, and skills. Review them in the About tab.
              </p>
              <button onClick={() => setReadbackNudge(false)} style={{ background: "none", border: "none", color: color.forest, cursor: "pointer", fontSize: 16, padding: isMobile ? "8px 4px" : "0 4px", opacity: 0.6, flexShrink: 0, alignSelf: isMobile ? "flex-end" : undefined, minHeight: isMobile ? 44 : undefined }}>✕</button>
            </div>
          </ScoutBox>
        )}

        <ProfileMyCoachCard
          coach={myCoach}
          loading={coachLoading}
          needsProfile={coachNeedsProfile}
          profileHint={coachProfileHint}
          isPro={isPro}
          isMobile={isMobile}
          onSubscribe={openPricing}
        />

        {/* Main tab bar */}
        <div style={{ display: "flex", border: border.line, overflowX: "auto", marginBottom: page === "about" && isMobile ? 0 : 24, WebkitOverflowScrolling: "touch", scrollbarWidth: "none", flexShrink: 0 }}>
          {PAGE_TABS.map(({ id, label }, i) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              style={{
                padding: isMobile ? "10px 14px" : "8px 16px",
                minHeight: 44,
                border: "none",
                borderRight: i < PAGE_TABS.length - 1 ? border.line : "none",
                background: page === id ? color.forest : surface.card,
                color: page === id ? color.gold : color.muted,
                fontFamily: fontSans,
                fontSize: T.bodySm,
                fontWeight: page === id ? 600 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sub-tabs — mobile About only; desktop uses side nav */}
        {page === "about" && isMobile && (
          <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
            {ABOUT_SECTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => goToSection(s)}
                style={{
                  padding: "6px 12px",
                  minHeight: 44,
                  border: activeSection === s ? border.lineStrong : border.line,
                  background: activeSection === s ? surface.card : "transparent",
                  color: activeSection === s ? color.forest : color.muted,
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  fontWeight: activeSection === s ? 600 : 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {({ personal: "Personal", education: "Education", experience: "Experience", skills: "Skills" } as const)[s]}
              </button>
            ))}
          </div>
        )}

        {/* Tab content */}
        {page === "dreamrole" && (
          <DreamRoleTab
            dreamList={dreamList}
            setDreamList={setDreamList}
            onSave={(list) => patchProfile({ targetRoles: list })}
            resumeAssets={resumeAssets}
            userSkills={skills}
            skillGoals={skillGoals}
            roleAnalyses={roleAnalyses}
            targetRoleSettings={targetRoleSettings}
            onTargetRoleSettingsChange={handleTargetRoleSettingsChange}
            onRoleAnalysisUpdate={handleRoleAnalysisUpdate}
            onClearRoleAnalysis={handleClearRoleAnalysis}
            onAddToPortfolio={addSkillToPortfolio}
            onObtainSkill={obtainSkill}
            onInitRoleSettings={initRoleSettings}
          />
        )}

        {page === "about" && loading && (
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>Loading…</p>
        )}
        {page === "about" && !loading && !profile && (
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>Could not load profile. Please refresh.</p>
        )}
        {page === "about" && profile && (
          <div style={{ paddingBottom: 40 }}>
            {showReadback && (
              <div style={{ marginBottom: isMobile ? 16 : 20 }}>
                <ReadbackCard data={readback} loading={readbackLoading} onRefresh={refreshReadback} stack embedded />
              </div>
            )}
            <div style={{ display: isMobile ? "block" : "flex", gap: 24, alignItems: "flex-start" }}>
            {!isMobile && (
              <ScoutBox padding={0} style={{ width: 196, flexShrink: 0, position: "sticky", top: 16, alignSelf: "flex-start" }}>
                <div style={{ padding: "14px 18px", borderBottom: border.line, background: surface.inset }}>
                  <ScoutLabel>Sections</ScoutLabel>
                </div>
                {ABOUT_SECTIONS.map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => goToSection(s)}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "11px 18px",
                      minHeight: 44,
                      border: "none",
                      borderBottom: i < ABOUT_SECTIONS.length - 1 ? border.line : "none",
                      background: activeSection === s ? surface.inset : surface.card,
                      color: activeSection === s ? color.ink : color.muted,
                      fontFamily: fontSans,
                      fontSize: T.bodySm,
                      fontWeight: activeSection === s ? 600 : 500,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {ABOUT_LABEL[s]}
                  </button>
                ))}
              </ScoutBox>
            )}
            <div style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}>
            <AboutSectionCard section="personal" stack sectionRef={(el) => { sectionRefs.current.personal = el; }} padding={sectionCardPad}>
              <PersonalTab profile={profile} onSave={handlePersonalSave} />
            </AboutSectionCard>
            <AboutSectionCard section="experience" sectionRef={(el) => { sectionRefs.current.experience = el; }} padding={sectionCardPad}>
              <ExperienceTab entries={workExperience} onSave={handleExperienceSave} />
            </AboutSectionCard>
            <AboutSectionCard section="education" sectionRef={(el) => { sectionRefs.current.education = el; }} padding={sectionCardPad}>
              <EducationTab entries={education} onSave={handleEducationSave} />
            </AboutSectionCard>
            <AboutSectionCard section="skills" sectionRef={(el) => { sectionRefs.current.skills = el; }} padding={sectionCardPad}>
              <SkillsTab skills={skills} onSave={handleSkillsSave} skillGoals={skillGoals} onGraduate={graduateSkill} />
            </AboutSectionCard>
            </div>
            </div>
          </div>
        )}

        {page === "preferences" && !profile && !loading && (
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>Could not load profile. Please refresh.</p>
        )}
        {page === "preferences" && profile && (
          <div style={{ paddingBottom: 40, paddingTop: 8 }}>
            <CareerPreferencesPanel profile={profile} onSave={handleCareerPrefSave} />
          </div>
        )}

        {page === "strategy" && !profile && !loading && (
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>Could not load profile. Please refresh.</p>
        )}
        {page === "strategy" && profile && (
          <div style={{ paddingBottom: 40, paddingTop: 8 }}>
            <CareerStrategyPanel
              profile={profile}
              isMobile={isMobile}
              onPatchProfile={async (patch) => {
                await patchProfile(patch);
                setProfile((p) => (p ? { ...p, ...patch } as UserProfile : p));
              }}
            />
          </div>
        )}

        {page === "learning" && (
          <LearningTab
            progress={upskillProgress}
            setProgress={persistUpskillProgress}
            skillGoals={skillGoals}
            dreamList={dreamList}
            onGraduate={graduateSkill}
            onAddSkill={addSkillGoal}
            onDismissSkill={dismissSkillGoal}
            highlightSkill={highlightSkill}
          />
        )}

        {page === "assets" && !profile && !loading && (
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>Could not load profile. Please refresh.</p>
        )}
        {page === "assets" && profile && (
          <>
            {resumeUploadError && (
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#C05050", marginBottom: 12 }}>
                {resumeUploadError}
              </p>
            )}
            <AssetsTab assets={assets} uploading={resumeUploading} onUpload={handleResumeUpload} onDelete={handleAssetDelete} onOpenResume={openResumeEditor} inputRef={resumeInputRef} suggestions={profileSuggestions} suggestionsLoading={suggestionsLoading} onOpenPricing={openPricing} />
          </>
        )}

        {page === "linkedin" && (
          <ProfileLinkedInEditor isMobile={isMobile} />
        )}
        </div>
      </div>
      <ProfileResumeEditor
        open={!!editorAssetId}
        assetId={editorAssetId}
        onClose={closeResumeEditor}
        onUpdated={() => {
          refreshAssets();
          fetch("/api/profile")
            .then((r) => r.json())
            .then((data) => { if (!data.error) setProfile(data); })
            .catch(() => {});
        }}
        initialJobDescription={onboardingFinish?.jobDescription}
        autoRunMatch={!!onboardingFinish?.autoRunMatch}
        onboardingJobLabel={
          onboardingFinish?.jobTitle
            ? `${onboardingFinish.jobTitle}${onboardingFinish.company ? ` @ ${onboardingFinish.company}` : ""}`
            : null
        }
      />
      {showUpgrade && (
        <GrowthUpgradeModal trigger="limit_hit" onClose={() => setShowUpgrade(false)} onOpenPricing={openPricing} />
      )}
    </div>
  );
}
