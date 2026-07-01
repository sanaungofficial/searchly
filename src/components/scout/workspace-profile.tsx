"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  clearOnboardingFinishPayload,
  readOnboardingFinishPayload,
  type OnboardingFinishPayload,
} from "@/lib/onboarding-finish";
import {
  DEPRIORITIZED_CATEGORY_SUGGESTIONS,
  DEPRIORITIZED_ROLE_SUGGESTIONS,
  PRIORITIZED_CATEGORY_SUGGESTIONS,
} from "@/lib/role-title-preferences";
import { migrateLegacyRoleFields } from "@/lib/target-roles-unified";
import { JobCategoryPicker, RoleTitlePicker } from "./role-title-picker";
import { SearchPreferencesExperienceEditor } from "./search-preferences-profile-section";
import {
  patchParsedDataSearchPreferences,
  searchPreferencesFromParsedData,
} from "@/lib/search-preferences";
import { RoleListBulkPaste } from "./role-list-bulk-paste";
import {
  parseProfileLocation,
  profileBasePath,
  profileTabPath,
  pipelineProspectUrl,
  prospectPathId,
} from "@/lib/workspace-urls";
import { withClientUserId } from "@/lib/workspace-urls";
import type { CachedJob } from "@/lib/cached-job";
import { writeProspectJobCache } from "@/lib/prospect-jobs-cache";
import { WorkspaceCompanies } from "./workspace-companies";
import { AVAILABLE_ROLES } from "./workspace-data";
import { UpskillLearningTab } from "./upskill-learning-tab";
import {
  defaultResumeAssetId,
  getRoleResumeAssetId,
  normalizeTargetRoleSettings,
  type TargetRoleSettingsMap,
} from "@/lib/target-role-settings";
import {
  buildSkillGoal,
  normalizeSkillGoals,
  skillGoalGapSourceLabel,
  type SkillGoalGapSource,
  type SkillGoalRecord,
  type UpskillProgressMap,
} from "@/lib/upskill-programs";
import {
  corpusGapSourceLabel,
  corpusGapsForRole,
  readRoleCorpusGaps,
  type RoleCorpusGapsCache,
} from "@/lib/job-corpus-gaps";
import {
  addMatchableToBuckets,
  allMatchableSkills,
  classifyMatchableKind,
  reconcileSkillsToolsFields,
  SKILLS_GROUP_LABEL,
  TOOLS_GROUP_LABEL,
  type MatchableKind,
} from "@/lib/skills-tools";
import { profileHasResumeMaterial } from "@/lib/master-resume-shared";
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
import { ProfileDiscoveryScorePanel } from "./profile-discovery-score-panel";
import { DISCOVERY_BENCHMARK_CATEGORY_KEY } from "@/lib/discovery-score/constants";
import { CareerStrategyPanel } from "./career-strategy-panel";
import { UserAssetsList } from "./user-assets-list";
import { LibraryDocumentUploadModal } from "./library-document-upload-modal";
import { assetTypeLabel, LIBRARY_DOCUMENT_FILTER_TYPES, type LibraryDocumentType, type UserAssetType } from "@/lib/asset-types";
import { CareerPreferencesPanel, type CareerPrefPatch } from "./career-preferences-panel";
import { ApplicationQaPanel } from "./application-qa-bank";
import { ProfileImportPanel } from "./profile-import-panel";
import { LinkedInOrgPicker } from "./linkedin-org-picker";
import { CompanyLogo } from "./company-logo";
import type { LinkedInOrgRef } from "@/lib/linkedin-profile";
import { GrowthUpgradeModal } from "./growth-upgrade-modal";
import { notifyCreditsChanged } from "@/lib/credits";
import { formatReadbackForDisplay } from "@/lib/readback-display";
import { useCredits } from "@/hooks/useCredits";
import { useWorkspace } from "@/contexts/workspace-context";
import { ScoutBox, ScoutDisplayTitle, ScoutGoldBtn, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { WORKSPACE_MAX_WIDTH, WorkspaceContent, WorkspaceScroll } from "./workspace-content";
import { ProfileLayoutSidebar, type ProfileSidebarTab } from "./profile-layout-sidebar";
import { ProfileReadinessPanel } from "./profile-readiness-panel";
import { profileCompletenessWithWeakest } from "@/lib/profile-readiness";
import { ScoreExplainerLabel, ScoreExplainerPopover } from "./score-explainer-popover";
import { KimchiProcessLoader } from "./kimchi-process-loader";
import {
  ResumeAnalyzingModal,
  ResumeUploadSuccessModal,
  useResumeUploadFlow,
} from "./resume-upload-flow";
import { fontSans, fontDisplay, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";

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
  tools?: string[];
}

interface UserAssetRow {
  id: string;
  type: UserAssetType;
  name: string;
  url: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
  targetJobTitle?: string | null;
  parseStatus?: "running" | "complete" | "failed" | null;
  parseError?: string | null;
}

function dedupeRoles(roles: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const role of roles) {
    const key = role.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(role.trim());
  }
  return out;
}

function TargetRoleSelect({
  value,
  roles,
  onChange,
  disabled,
  onClickStop,
}: {
  value: string | null | undefined;
  roles: string[];
  onChange: (role: string | null) => void;
  disabled?: boolean;
  onClickStop?: (e: React.MouseEvent) => void;
}) {
  return (
    <select
      value={value ?? ""}
      disabled={disabled || roles.length === 0}
      onClick={onClickStop}
      onChange={(e) => {
        onChange(e.target.value || null);
      }}
      style={{
        width: "100%",
        maxWidth: 220,
        padding: "8px 10px",
        border: "var(--scout-border)",
        background: surface.card,
        fontFamily: fontSans,
        fontSize: T.bodySm,
        color: value ? color.ink : color.muted,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <option value="">{roles.length === 0 ? "Add target roles first" : "Select target role…"}</option>
      {roles.map((role) => (
        <option key={role} value={role}>{role}</option>
      ))}
    </select>
  );
}

function resumeAnalysisBadge(asset: UserAssetRow): { label: string; bg: string; border: string; color: string } {
  if (asset.parseStatus === "running") {
    return { label: "Analyzing…", bg: "#FFF8E8", border: "#E8D5A3", color: "#A08030" };
  }
  if (asset.parseStatus === "failed") {
    return { label: "Analysis failed", bg: "#FFF0F0", border: "#E8B4B4", color: "#A04040" };
  }
  return { label: "Analysis Complete", bg: "#F0FFF8", border: "#A8DFC0", color: "#1A7A4A" };
}

function UpskillNextStepCard({
  skill,
  role,
  skills,
  variant = "prompt",
  onGoToUpskill,
  onDismiss,
  isMobile,
}: {
  skill?: string;
  role?: string;
  skills?: string[];
  variant?: "prompt" | "next-steps";
  onGoToUpskill: (skill: string) => void;
  onDismiss?: () => void;
  isMobile?: boolean;
}) {
  const skillList = skills?.length ? skills : skill ? [skill] : [];
  const primarySkill = skill ?? skillList[0] ?? "";
  const title =
    variant === "prompt"
      ? "Skill queued for Upskill"
      : "Close these gaps with learning";
  const body =
    variant === "prompt" ? (
      <>
        We added <strong style={{ color: color.ink }}>{skill}</strong> to your Upskill queue
        {role ? (
          <>
            {" "}
            for <strong style={{ color: color.ink }}>{role}</strong>
          </>
        ) : null}
        . Pick a course when you&apos;re ready — no deadline.
      </>
    ) : (
      <>
        Upskill matches courses to your role gaps. Pick a skill to see paths
        {role ? (
          <>
            {" "}
            for <strong style={{ color: color.ink }}>{role}</strong>
          </>
        ) : null}
        .
      </>
    );

  return (
    <ScoutBox
      padding={isMobile ? "14px 16px" : "16px 18px"}
      style={{
        marginBottom: variant === "next-steps" ? 14 : 0,
        background: "rgba(26,58,47,0.04)",
        borderColor: color.forest,
      }}
    >
      <p style={{ fontFamily: fontDisplay, fontSize: T.bodySm, fontWeight: 600, fontStyle: "italic", color: color.forest, margin: "0 0 8px", lineHeight: 1.35 }}>
        {title}
      </p>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 12px", lineHeight: 1.6 }}>
        {body}
      </p>
      {variant === "next-steps" && skillList.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {skillList.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onGoToUpskill(s)}
              style={{
                padding: "6px 12px",
                background: surface.card,
                border: "var(--scout-border)",
                fontFamily: fontSans,
                fontSize: T.caption,
                color: color.forest,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {s}
              <span style={{ color: color.muted }}>→ Learn</span>
            </button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 8 }}>
        <ScoutPrimaryBtn
          onClick={() => primarySkill && onGoToUpskill(primarySkill)}
          disabled={!primarySkill}
          style={{ minHeight: 44, width: isMobile ? "100%" : undefined, justifyContent: "center" }}
        >
          {variant === "prompt" ? "Explore learning paths" : "Go to Upskill"}
        </ScoutPrimaryBtn>
        {onDismiss && (
          <ScoutSecondaryBtn
            onClick={onDismiss}
            style={{ minHeight: 44, width: isMobile ? "100%" : undefined, justifyContent: "center" }}
          >
            {variant === "prompt" ? "Stay on Target Roles" : "Maybe later"}
          </ScoutSecondaryBtn>
        )}
      </div>
    </ScoutBox>
  );
}

interface ReadbackData {
  picture: string;
  strengths: string[];
  targetRoles: { role: string; fit: string }[];
  honestNote: string;
}

interface UserProfile {
  userId?: string;
  name: string;
  email: string | null;
  avatarUrl?: string | null;
  resumeUrl: string | null;
  linkedinUrl: string | null;
  headline: string | null;
  summary?: string | null;
  targetRoles: string[];
  prioritizedRoles?: string[];
  prioritizedCategories?: string[];
  deprioritizedRoles?: string[];
  deprioritizedCategories?: string[];
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
  readbackData?: ReadbackData | null;
  readbackUpdatedAt?: string | null;
  primaryResumeUpdatedAt?: string | null;
  hasStrategy?: boolean;
  linkedInAnalysisScore?: number | null;
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
): Promise<{ roleAnalyses: RoleAnalysesMap; skillGoals: SkillGoal[]; targetRoles?: string[] }> {
  const patch: Record<string, unknown> = {};
  let skillGoals = userProfile.skillGoals ?? [];
  let roleAnalyses = normalizeRoleAnalysesMap(userProfile.roleAnalyses);
  const storageScope = userProfile.userId ?? "self";

  if (!skillGoals.length) {
    try {
      const stored =
        localStorage.getItem(`${SKILL_GOALS_KEY}:${storageScope}`) ??
        (storageScope === "self" ? localStorage.getItem(SKILL_GOALS_KEY) : null);
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
    allMatchableSkills({
      skills: userProfile.parsedData?.skills ?? [],
      tools: userProfile.parsedData?.tools ?? [],
    }),
  );
  let migratedAnalyses = { ...roleAnalyses };
  for (const role of roles) {
    if (getStoredRoleAnalysis(migratedAnalyses, role, null)) continue;
    try {
      const scopedKey = `${LEGACY_ANALYSIS_CACHE_KEY(role)}:${storageScope}`;
      const cached =
        localStorage.getItem(scopedKey) ??
        (storageScope === "self" ? localStorage.getItem(LEGACY_ANALYSIS_CACHE_KEY(role)) : null);
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

  const roleMigration = migrateLegacyRoleFields({
    targetRoles: userProfile.targetRoles,
    prioritizedRoles: userProfile.prioritizedRoles,
  });
  if (roleMigration.migrated) {
    await patchProfileFn({
      targetRoles: roleMigration.targetRoles,
      prioritizedRoles: roleMigration.prioritizedRoles,
    });
  }

  return { roleAnalyses, skillGoals, targetRoles: roleMigration.targetRoles };
}

type SkillGoal = SkillGoalRecord;

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
  if ((p.parsedData?.skills || []).length > 0 || (p.parsedData?.tools || []).length > 0) score++;
  if (p.jobTimeline) score++;
  if (p.targetSalary) score++;
  if ((p.priorities || []).length > 0) score++;
  return Math.round((score / 13) * 100);
}

function primaryEducationLabel(education: EducationEntry[]): string | null {
  if (!education.length) return null;
  const e = education[0];
  return e.degree || e.field || e.school || null;
}

// ─── Shared small components ──────────────────────────────────────────────────

function SectionHeader({ title, onEdit }: { title: string; onEdit?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 style={displayTitleStyle(T.heading)}>{title}</h3>
      {onEdit && (
        <button onClick={onEdit} className="p-1.5 rounded-[var(--scout-radius)] hover:bg-[#E8D5A3]/40 transition-colors" aria-label={`Edit ${title}`}>
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
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--scout-radius)] bg-[#E8D5A3]/50 text-xs font-medium text-[#52493F]">
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
                className="w-full px-3 py-2.5 text-base sm:text-sm rounded-[var(--scout-radius)] border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" />
            </div>
          ))}
          <div>
            <label className="block text-xs text-[var(--scout-muted)] mb-1">Professional summary</label>
            <textarea
              rows={5}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Your About story — this is the source of truth for your LinkedIn About section."
              className="w-full px-3 py-2.5 text-base sm:text-sm rounded-[var(--scout-radius)] border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F] resize-y"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving}
              className="min-h-11 px-4 py-2 text-xs font-medium bg-[#1C3A2F] text-[#F2EDE3] rounded-[var(--scout-radius)] hover:bg-[#1C3A2F]/90 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)} className="min-h-11 px-4 py-2 text-xs font-medium text-[#52493F] hover:bg-[var(--scout-inset)] rounded-[var(--scout-radius)]">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 pb-3 border-b border-[#E5DDD0]">
            <div className="w-12 h-12 rounded-[var(--scout-radius)] bg-[#1C3A2F] flex items-center justify-center text-[#E8D5A3] text-base font-semibold shrink-0">
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
          <div key={entry.id} className="rounded-[var(--scout-radius)] border border-[#E5DDD0] p-3 space-y-2 relative">
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
                <input value={entry.degree} onChange={(e) => updateEntry(entry.id, "degree", e.target.value)} className="w-full px-3 py-2.5 text-base sm:text-sm rounded-[var(--scout-radius)] border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" /></div>
              <div><label className="block text-xs text-[var(--scout-muted)] mb-1">Field</label>
                <input value={entry.field || ""} onChange={(e) => updateEntry(entry.id, "field", e.target.value)} className="w-full px-3 py-2.5 text-base sm:text-sm rounded-[var(--scout-radius)] border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div><label className="block text-xs text-[var(--scout-muted)] mb-1">From (YYYY-MM)</label>
                <input value={entry.from || ""} onChange={(e) => updateEntry(entry.id, "from", e.target.value)} placeholder="2018-09" className="w-full px-3 py-2 text-sm rounded-[var(--scout-radius)] border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" /></div>
              <div><label className="block text-xs text-[var(--scout-muted)] mb-1">To</label>
                <input value={entry.to || ""} onChange={(e) => updateEntry(entry.id, "to", e.target.value)} placeholder="2022-05" className="w-full px-3 py-2 text-sm rounded-[var(--scout-radius)] border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" /></div>
            </div>
          </div>
        ))}
        <button onClick={addEntry} className="w-full py-2 text-xs text-[#1C3A2F] border border-dashed border-[#C0B8B0] rounded-[var(--scout-radius)] hover:border-[#1C3A2F]/40 transition-colors">+ Add education</button>
        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 text-xs font-medium bg-[#1C3A2F] text-[#F2EDE3] rounded-[var(--scout-radius)] hover:bg-[#1C3A2F]/90 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
          <button onClick={() => { setList(entries); setEditing(false); }} className="px-4 py-1.5 text-xs font-medium text-[#52493F] hover:bg-[var(--scout-inset)] rounded-[var(--scout-radius)]">Cancel</button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <SectionHeader title="Education" onEdit={() => setEditing(true)} />
      {entries.length === 0 ? (
        <EmptyState message="No education yet" sub="Upload a resume and we&apos;ll pull this in. We use it when scoring job fit." />
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
          <div key={entry.id} className="rounded-[var(--scout-radius)] border border-[#E5DDD0] p-3 space-y-2 relative">
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
                <input value={entry.title} onChange={(e) => updateEntry(entry.id, "title", e.target.value)} className="w-full px-3 py-2.5 text-base sm:text-sm rounded-[var(--scout-radius)] border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div><label className="block text-xs text-[var(--scout-muted)] mb-1">From (YYYY-MM)</label>
                <input value={entry.from || ""} onChange={(e) => updateEntry(entry.id, "from", e.target.value)} placeholder="2020-01" className="w-full px-3 py-2.5 text-base sm:text-sm rounded-[var(--scout-radius)] border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" /></div>
              <div><label className="block text-xs text-[var(--scout-muted)] mb-1">To (YYYY-MM or Present)</label>
                <input value={entry.to || ""} onChange={(e) => updateEntry(entry.id, "to", e.target.value)} placeholder="Present" className="w-full px-3 py-2 text-sm rounded-[var(--scout-radius)] border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" /></div>
            </div>
            <div><label className="block text-xs text-[var(--scout-muted)] mb-1">Bullet points (one per line)</label>
              <textarea rows={4} value={entry.bullets.join("\n")} onChange={(e) => updateBullets(entry.id, e.target.value)} className="w-full px-3 py-2 text-sm rounded-[var(--scout-radius)] border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F] resize-none" /></div>
          </div>
        ))}
        <button onClick={addEntry} className="w-full py-2 text-xs text-[#1C3A2F] border border-dashed border-[#C0B8B0] rounded-[var(--scout-radius)] hover:border-[#1C3A2F]/40 transition-colors">+ Add experience</button>
        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 text-xs font-medium bg-[#1C3A2F] text-[#F2EDE3] rounded-[var(--scout-radius)] hover:bg-[#1C3A2F]/90 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
          <button onClick={() => { setList(entries); setEditing(false); }} className="px-4 py-1.5 text-xs font-medium text-[#52493F] hover:bg-[var(--scout-inset)] rounded-[var(--scout-radius)]">Cancel</button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <SectionHeader title="Work Experience" onEdit={() => setEditing(true)} />
      {entries.length === 0 ? (
        <EmptyState message="No work experience yet" sub="Upload a resume and we&apos;ll fill this in. Fit scores use your background and years of experience." />
      ) : (
        <div className="space-y-5">
          {entries.map((entry) => (
            <div key={entry.id} className="flex gap-3 items-start">
              <CompanyLogo name={entry.companyRef?.name || entry.company} logoUrl={entry.companyRef?.logoUrl} website={entry.companyRef?.website} size={40} />
              <div className="pb-5 flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold text-[#1C3A2F]">{entry.title}</p>
                    <p className="text-sm text-[#52493F] mt-0.5">{entry.company}</p>
                  </div>
                  {formatDateRange(entry.from, entry.to) && (
                    <span className="text-sm text-[var(--scout-muted)] whitespace-nowrap shrink-0">{formatDateRange(entry.from, entry.to)}</span>
                  )}
                </div>
                {entry.bullets.length > 0 && (
                  <ul className="mt-2.5 space-y-1.5">
                    {entry.bullets.map((b, bi) => (
                      <li key={bi} className="text-sm text-[#52493F] leading-relaxed flex gap-2">
                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[var(--scout-muted)] shrink-0" />{b}
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

function SkillsTab({
  skills,
  tools,
  onSave,
  skillGoals,
  onGraduate,
}: {
  skills: string[];
  tools: string[];
  onSave: (skills: string[], tools: string[]) => Promise<void>;
  skillGoals: SkillGoal[];
  onGraduate: (skill: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [skillList, setSkillList] = useState<string[]>(skills);
  const [toolList, setToolList] = useState<string[]>(tools);
  const [skillInput, setSkillInput] = useState("");
  const [toolInput, setToolInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [graduating, setGraduating] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) {
      setSkillList(skills);
      setToolList(tools);
    }
  }, [skills, tools, editing]);

  const addSkill = () => {
    const v = skillInput.trim();
    if (v && !skillList.includes(v)) setSkillList((p) => [...p, v]);
    setSkillInput("");
  };
  const addTool = () => {
    const v = toolInput.trim();
    if (v && !toolList.includes(v)) setToolList((p) => [...p, v]);
    setToolInput("");
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(skillList, toolList);
    setSaving(false);
    setEditing(false);
  };

  const handleGraduate = async (skill: string) => {
    setGraduating(skill);
    await onGraduate(skill);
    setGraduating(null);
  };

  const hasAny = skills.length > 0 || tools.length > 0 || skillGoals.length > 0;

  return (
    <div>
      <SectionHeader title="Skills & tools" onEdit={() => setEditing(!editing)} />
      {!editing && !hasAny && (
        <EmptyState
          message="No skills or tools yet"
          sub="Add functional skills and your tech stack here, or upload a resume — we use both for target role fit."
        />
      )}
      {editing ? (
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[var(--scout-muted)] uppercase tracking-wide" style={{ fontSize: 13, letterSpacing: "0.06em" }}>
              Skills
            </p>
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--scout-muted)", margin: "0 0 8px", lineHeight: 1.5 }}>
              Leadership, domain expertise, and capabilities — not software or languages.
            </p>
            <div className="flex gap-2">
              <input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill();
                  }
                }}
                placeholder="Add a skill and press Enter"
                className="flex-1 px-3 py-2 text-sm rounded-[var(--scout-radius)] border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]"
              />
              <button onClick={addSkill} className="px-3 py-2 text-xs bg-[#1C3A2F] text-[#F2EDE3] rounded-[var(--scout-radius)] hover:bg-[#1C3A2F]/90">
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {skillList.map((s) => (
                <SkillChip key={s} label={s} onRemove={() => setSkillList((p) => p.filter((x) => x !== s))} />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-[var(--scout-muted)] uppercase tracking-wide" style={{ fontSize: 13, letterSpacing: "0.06em" }}>
              Tools & tech stack
            </p>
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--scout-muted)", margin: "0 0 8px", lineHeight: 1.5 }}>
              Software, platforms, programming languages, and frameworks.
            </p>
            <div className="flex gap-2">
              <input
                value={toolInput}
                onChange={(e) => setToolInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTool();
                  }
                }}
                placeholder="Add a tool and press Enter"
                className="flex-1 px-3 py-2 text-sm rounded-[var(--scout-radius)] border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]"
              />
              <button onClick={addTool} className="px-3 py-2 text-xs bg-[#1C3A2F] text-[#F2EDE3] rounded-[var(--scout-radius)] hover:bg-[#1C3A2F]/90">
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {toolList.map((s) => (
                <SkillChip key={s} label={s} onRemove={() => setToolList((p) => p.filter((x) => x !== s))} />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 text-xs font-medium bg-[#1C3A2F] text-[#F2EDE3] rounded-[var(--scout-radius)] hover:bg-[#1C3A2F]/90 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => {
                setSkillList(skills);
                setToolList(tools);
                setEditing(false);
              }}
              className="px-4 py-1.5 text-xs font-medium text-[#52493F] hover:bg-[var(--scout-inset)] rounded-[var(--scout-radius)]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {skills.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[var(--scout-muted)] uppercase tracking-wide mb-2" style={{ fontSize: 14, letterSpacing: "1px" }}>
                Skills
              </p>
              <div className="flex flex-wrap gap-2">{skills.map((s) => <SkillChip key={s} label={s} />)}</div>
            </div>
          )}
          {tools.length > 0 && (
            <div style={{ marginTop: skills.length > 0 ? 20 : 0 }}>
              <p className="text-xs font-semibold text-[var(--scout-muted)] uppercase tracking-wide mb-2" style={{ fontSize: 14, letterSpacing: "1px" }}>
                Tools & tech stack
              </p>
              <div className="flex flex-wrap gap-2">{tools.map((s) => <SkillChip key={s} label={s} />)}</div>
            </div>
          )}
        </>
      )}

      {!editing && skillGoals.length > 0 && (
        <div style={{ marginTop: skills.length > 0 || tools.length > 0 ? 24 : 0 }}>
          <p className="text-xs font-semibold text-[var(--scout-muted)] uppercase tracking-wide mb-3" style={{ fontSize: 14, letterSpacing: "1px" }}>Working on</p>
          <div className="space-y-2">
            {skillGoals.map((g) => (
              <div key={`${g.skill}-${g.role}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(196,168,106,0.08)", border: "1px solid rgba(196,168,106,0.25)", borderRadius: "var(--scout-radius)" }}>
                <div>
                  <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "#1A1A1A", marginBottom: 2 }}>{g.skill}</p>
                  <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#7A6020" }}>for {g.role}</p>
                </div>
                <button
                  onClick={() => handleGraduate(g.skill)}
                  disabled={graduating === g.skill}
                  style={{ padding: "6px 12px", background: "#1A3A2F", color: "#E8D5A3", border: "none", borderRadius: "var(--scout-radius)", fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500, cursor: "pointer", opacity: graduating === g.skill ? 0.6 : 1 }}
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
  prioritizedCategories,
  setPrioritizedCategories,
  onPrioritizedCategoriesSave,
  experienceLevelLabels,
  onExperienceLevelsSave,
  deprioritizedList,
  setDeprioritizedList,
  onDeprioritizedSave,
  deprioritizedCategories,
  setDeprioritizedCategories,
  onDeprioritizedCategoriesSave,
  resumeAssets,
  userSkills,
  skillGoals,
  roleAnalyses,
  roleCorpusGaps,
  corpusGapsRefreshing,
  onRefreshCorpusGaps,
  targetRoleSettings,
  onTargetRoleSettingsChange,
  onRoleAnalysisUpdate,
  onClearRoleAnalysis,
  onAddToPortfolio,
  onObtainSkill,
  onGoToUpskill,
  onClearUpskillPrompt,
  onInitRoleSettings,
  clientUserId,
}: {
  dreamList: string[];
  setDreamList: (l: string[]) => void;
  onSave: (list: string[]) => void;
  prioritizedCategories: string[];
  setPrioritizedCategories: (l: string[]) => void;
  onPrioritizedCategoriesSave: (list: string[]) => void;
  experienceLevelLabels: string[];
  onExperienceLevelsSave: (labels: string[]) => void;
  deprioritizedList: string[];
  setDeprioritizedList: (l: string[]) => void;
  onDeprioritizedSave: (list: string[]) => void;
  deprioritizedCategories: string[];
  setDeprioritizedCategories: (l: string[]) => void;
  onDeprioritizedCategoriesSave: (list: string[]) => void;
  resumeAssets: UserAssetRow[];
  userSkills: string[];
  skillGoals: SkillGoal[];
  roleAnalyses: RoleAnalysesMap;
  roleCorpusGaps: RoleCorpusGapsCache | null;
  corpusGapsRefreshing: boolean;
  onRefreshCorpusGaps: () => void;
  targetRoleSettings: TargetRoleSettingsMap;
  onTargetRoleSettingsChange: (role: string, resumeAssetId: string | null) => void;
  onRoleAnalysisUpdate: (role: string, analysis: StoredRoleAnalysis) => void;
  onClearRoleAnalysis: (role: string) => void;
  onAddToPortfolio: (skill: string, kind?: MatchableKind) => void;
  onObtainSkill: (
    skill: string,
    role: string,
    opts?: { gapSource?: SkillGoalGapSource; kind?: MatchableKind },
  ) => void;
  onGoToUpskill: (skill: string) => void;
  onClearUpskillPrompt?: () => void;
  onInitRoleSettings: (role: string) => void;
  clientUserId?: string;
}) {
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, RoleAnalysisView | "loading" | "error">>({});
  const [analysisErrors, setAnalysisErrors] = useState<Record<string, string>>({});
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [skillMenu, setSkillMenu] = useState<{ role: string; skill: string } | null>(null);
  const [obtainNudge, setObtainNudge] = useState<{ role: string; skill: string } | null>(null);
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
      const res = await fetch(withClientUserId(`/api/ai/role-gap?${params.toString()}`, clientUserId));
      const data = await res.json().catch(() => ({}));
      if (res.status === 402) {
        notifyCreditsChanged();
        setAnalysisErrors((prev) => ({
          ...prev,
          [role]: typeof data.error === "string" ? data.error : "Out of credits for this month",
        }));
        if (stored) {
          setAnalysis((prev) => ({ ...prev, [role]: viewFromStored(stored, role) }));
        } else {
          setAnalysis((prev) => ({ ...prev, [role]: "error" }));
        }
        return;
      }
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
      if (!data.cached) notifyCreditsChanged();
    } catch {
      setAnalysisErrors((prev) => ({
        ...prev,
        [role]: "Network error — check your connection and tap to retry.",
      }));
      setAnalysis((prev) => ({ ...prev, [role]: "error" }));
    }
  };

  const addRole = (title: string) => {
    if (dreamList.includes(title)) return;
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

  const moveRole = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= dreamList.length) return;
    const next = [...dreamList];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setDreamList(next);
    onSave(next);
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
      <ScoutLabel>Role ranking</ScoutLabel>
      <ScoutDisplayTitle size={22} style={{ marginTop: 8, marginBottom: 8 }}>
        Target roles &amp; fit analysis
      </ScoutDisplayTitle>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, marginBottom: 24, lineHeight: 1.7 }}>
        Control how jobs rank in your feed, define target roles for fit scores, and pick which resume to assess against each role.
      </p>

      <ScoutBox padding={isMobile ? 16 : 22} style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <ScoutLabel>Feed ranking</ScoutLabel>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 0", lineHeight: 1.7 }}>
              Order matters — your top role gets the strongest feed boost. Deprioritized patterns sort lower; nothing is hidden.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefreshCorpusGaps}
            disabled={corpusGapsRefreshing || !dreamList.length}
            style={{
              padding: "8px 14px",
              background: corpusGapsRefreshing ? "rgba(0,0,0,0.04)" : "transparent",
              color: color.forest,
              border: "1px solid rgba(26,58,47,0.25)",
              borderRadius: "var(--scout-radius)",
              fontFamily: fontSans,
              fontSize: T.caption,
              cursor: corpusGapsRefreshing || !dreamList.length ? "default" : "pointer",
              opacity: !dreamList.length ? 0.5 : 1,
              flexShrink: 0,
            }}
          >
            {corpusGapsRefreshing ? "Refreshing gaps…" : "Refresh gaps"}
          </button>
        </div>
        {roleCorpusGaps?.refreshedAt && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "10px 0 0", lineHeight: 1.5 }}>
            Market skill gaps last refreshed {formatLastRefreshed(roleCorpusGaps.refreshedAt)} — from Hirebase postings and saved jobs.
          </p>
        )}
        <div style={{ marginTop: 16 }}>
        <RoleListBulkPaste
        dreamList={dreamList}
        onTargetChange={(next) => {
          setDreamList(next);
          onSave(next);
        }}
        deprioritizedList={deprioritizedList}
        onDeprioritizedChange={(next) => {
          setDeprioritizedList(next);
          onDeprioritizedSave(next);
        }}
        prioritizedCategories={prioritizedCategories}
        onPrioritizedCategoriesChange={(next) => {
          setPrioritizedCategories(next);
          onPrioritizedCategoriesSave(next);
        }}
        deprioritizedCategories={deprioritizedCategories}
        onDeprioritizedCategoriesChange={(next) => {
          setDeprioritizedCategories(next);
          onDeprioritizedCategoriesSave(next);
        }}
        onInitRoleSettings={onInitRoleSettings}
      />
        </div>
      </ScoutBox>

      <ScoutBox padding={isMobile ? 16 : 22} style={{ marginBottom: 24 }}>
        <ScoutLabel>Target roles</ScoutLabel>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 16px", lineHeight: 1.7 }}>
          Roles you want at the top of Recommended and In-network. List order sets feed priority — drag with arrows to reorder.
        </p>
        {!showSearch ? (
          <button
            type="button"
            onClick={() => setShowSearch(true)}
            style={{ padding: "10px 18px", background: "transparent", color: "#1A3A2F", border: "1px solid rgba(26,58,47,0.2)", borderRadius: "var(--scout-radius)", fontFamily: fontSans, fontSize: 14, cursor: "pointer", marginBottom: 16 }}
          >
            + Add target role
          </button>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search roles…"
              style={{ width: "100%", padding: "12px 12px", borderRadius: "var(--scout-radius)", border: "1.5px solid #1A3A2F", fontFamily: fontSans, fontSize: isMobile ? 16 : 13, color: "#1A1A1A", background: "#FFFFFF", outline: "none", marginBottom: 10, boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {searchQuery.trim() && !AVAILABLE_ROLES.map(r => r.toLowerCase()).includes(searchQuery.trim().toLowerCase()) && (
                <button
                  type="button"
                  onClick={() => addRole(searchQuery.trim())}
                  style={{ padding: "6px 14px", background: "#1A3A2F", border: "none", borderRadius: "var(--scout-radius)", fontFamily: fontSans, fontSize: 14, color: "#E8D5A3", cursor: "pointer" }}
                >
                  + Add &ldquo;{searchQuery.trim()}&rdquo;
                </button>
              )}
              {filteredRoles.slice(0, 20).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => addRole(r)}
                  style={{ padding: "6px 14px", background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "var(--scout-radius)", fontFamily: fontSans, fontSize: 14, color: "#1A1A1A", cursor: "pointer" }}
                >
                  {r}
                </button>
              ))}
              <button type="button" onClick={() => { setShowSearch(false); setSearchQuery(""); }} style={{ padding: "6px 12px", background: "transparent", border: "none", fontFamily: fontSans, fontSize: 14, color: "var(--scout-muted)", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {dreamList.map((role, roleIndex) => {
          const isOpen = expandedRole === role;
          const result = analysis[role];
          const loaded = getLoaded(role);
          const isLoading = result === "loading";

          return (
            <ScoutBox key={role} padding={0} style={{ overflow: "hidden", borderColor: isOpen ? color.forest : "var(--scout-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }} onClick={() => toggleExpand(role)}>
                {loaded ? (
                  <div style={{ width: 44, height: 44, background: scoreColor(loaded.fitScore), border: "var(--scout-border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontFamily: "var(--font-mono-ui)", fontSize: 14, fontWeight: 700, color: loaded.fitScore >= 50 ? color.gold : "#FFFFFF" }}>{loaded.fitScore}%</span>
                  </div>
                ) : isLoading ? (
                  <div style={{ width: 40, height: 40, borderRadius: "var(--scout-radius)", background: "rgba(26,58,47,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontFamily: "var(--font-mono-ui)", fontSize: 11, fontWeight: 600, color: color.forest }}>…</span>
                  </div>
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: "var(--scout-radius)", background: "rgba(0,0,0,0.04)", flexShrink: 0 }} />
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
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>Upload a resume to get a fit score</p>
                  ) : result === "loading" ? (
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>Analyzing…</p>
                  ) : result === "error" ? (
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#C4A86A" }}>
                      {analysisErrors[role] ?? "Analysis failed — expand to retry"}
                    </p>
                  ) : (
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>Expand to see fit details</p>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); moveRole(roleIndex, -1); }}
                      disabled={roleIndex === 0}
                      aria-label={`Move ${role} up`}
                      style={{ background: "none", border: "none", cursor: roleIndex === 0 ? "default" : "pointer", color: roleIndex === 0 ? "#E0E0E0" : color.muted, fontSize: 12, lineHeight: 1, padding: "2px 4px" }}
                    >↑</button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); moveRole(roleIndex, 1); }}
                      disabled={roleIndex === dreamList.length - 1}
                      aria-label={`Move ${role} down`}
                      style={{ background: "none", border: "none", cursor: roleIndex === dreamList.length - 1 ? "default" : "pointer", color: roleIndex === dreamList.length - 1 ? "#E0E0E0" : color.muted, fontSize: 12, lineHeight: 1, padding: "2px 4px" }}
                    >↓</button>
                  </div>
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
                    <div style={{ padding: 12, background: surface.inset, border: "var(--scout-border)" }}>
                      <select
                        value={resumeIdForRole(role) ?? ""}
                        onChange={(e) => void handleResumeChange(role, e.target.value)}
                        disabled={!resumeAssets.length}
                        style={{
                          width: "100%",
                          maxWidth: 420,
                          padding: "10px 12px",
                          border: "var(--scout-border)",
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
                              {asset.name}{asset.isPrimary ? " · primary" : ""}{asset.targetJobTitle ? ` · ${asset.targetJobTitle}` : ""}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>
                  {result === "loading" && !loaded && (
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)", textAlign: "center", padding: "16px 0" }}>Analyzing your resume against this role…</p>
                  )}
                  {result === "error" && !loaded && (
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#C4A86A" }}>
                      {analysisErrors[role] ?? "Couldn't run analysis — upload a resume and try again."}
                    </p>
                  )}
                  {!hasResume && (
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>Upload a resume under Resumes to unlock gap analysis.</p>
                  )}
                  {loaded && (
                    <>
                      <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#52493F", lineHeight: 1.65, marginBottom: 20 }}>{loaded.summary}</p>

                      {loaded.requiredSkills?.length > 0 && (() => {
                        const gapWhy = new Map(
                          (loaded.gaps ?? []).map((g) => [g.skill.toLowerCase(), g.why]),
                        );
                        const marketGaps = corpusGapsForRole(roleCorpusGaps, role).filter(
                          (g) => !hasSkill(g.skill) && !isInLearning(g.skill),
                        );
                        const useMarketGaps = marketGaps.length > 0;
                        const haveSkills = loaded.requiredSkills.filter((s) => hasSkill(s));
                        const learningSkills = useMarketGaps
                          ? marketGaps.filter((g) => isInLearning(g.skill)).map((g) => g.skill)
                          : loaded.requiredSkills.filter((s) => !hasSkill(s) && isInLearning(s));
                        const missingRows = useMarketGaps
                          ? marketGaps.map((g) => ({
                              skill: g.skill,
                              kind: g.kind,
                              sources: g.sources,
                            }))
                          : loaded.requiredSkills
                              .filter((s) => !hasSkill(s) && !isInLearning(s))
                              .map((skill) => ({
                                skill,
                                kind: classifyMatchableKind(skill),
                                why: gapWhy.get(skill.toLowerCase()),
                              }));
                        const missingGroups = [
                          { label: SKILLS_GROUP_LABEL, rows: missingRows.filter((row) => row.kind === "skill") },
                          { label: TOOLS_GROUP_LABEL, rows: missingRows.filter((row) => row.kind === "technology") },
                        ].filter((group) => group.rows.length > 0);
                        const renderGapRow = (row: (typeof missingRows)[number]) => {
                          const skill = row.skill;
                          return (
                            <div key={skill} style={{ position: "relative" }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSkillMenu((prev) =>
                                    prev?.role === role && prev.skill === skill ? null : { role, skill },
                                  );
                                }}
                                style={{ alignSelf: "flex-start", padding: "5px 11px", background: "#FFFDF9", border: "1px dashed rgba(0,0,0,0.18)", borderRadius: "var(--scout-radius)", fontFamily: "var(--font-ui)", fontSize: 14, color: "#52493F", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}
                              >
                                {skill}
                                {"sources" in row && row.sources?.map((source) => (
                                  <span key={source} style={{ fontSize: 10, color: color.muted, background: "rgba(0,0,0,0.04)", padding: "2px 6px", borderRadius: 999 }}>
                                    {corpusGapSourceLabel(source)}
                                  </span>
                                ))}
                                <span style={{ fontSize: 10, color: color.muted }}>▼</span>
                              </button>
                              {"why" in row && row.why && (
                                <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "#B0A898", margin: "4px 0 0 4px", lineHeight: 1.45 }}>{row.why}</p>
                              )}
                              {skillMenu?.role === role && skillMenu.skill === skill && (
                                <div
                                  style={{
                                    marginTop: 6,
                                    border: "var(--scout-border)",
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
                                      onAddToPortfolio(skill, row.kind);
                                      setSkillMenu(null);
                                    }}
                                    style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", border: "none", borderBottom: "var(--scout-border)", background: "transparent", fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, cursor: "pointer" }}
                                  >
                                    {row.kind === "technology" ? "Add to my tools" : "Add to my skills"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const sources = "sources" in row ? row.sources : undefined;
                                      const gapSource: SkillGoalGapSource | undefined = sources?.includes("saved_job")
                                        ? "saved_job"
                                        : sources?.includes("corpus")
                                          ? "corpus"
                                          : useMarketGaps
                                            ? "corpus"
                                            : "archetype";
                                      onObtainSkill(skill, role, { gapSource, kind: row.kind });
                                      setObtainNudge({ skill, role });
                                      setSkillMenu(null);
                                    }}
                                    style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", border: "none", background: "transparent", fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, cursor: "pointer" }}
                                  >
                                    Obtain this {row.kind === "technology" ? "tool" : "skill"}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        };
                        return (
                          <div style={{ marginBottom: 20 }}>
                            {haveSkills.length > 0 && (
                              <div style={{ marginBottom: 14 }}>
                                <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 700, color: "#1A3A2F", textTransform: "uppercase", letterSpacing: "1.1px", marginBottom: 8 }}>What you have</p>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {haveSkills.map((skill) => (
                                    <span key={skill} style={{ padding: "5px 11px", background: "rgba(26,58,47,0.08)", border: "1px solid rgba(74,139,106,0.2)", borderRadius: "var(--scout-radius)", fontFamily: "var(--font-ui)", fontSize: 14, color: "#1A3A2F", display: "inline-flex", alignItems: "center", gap: 5 }}>
                                      <span style={{ fontSize: 14 }}>✓</span> {skill}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {missingGroups.length > 0 && (
                              <div style={{ marginBottom: 14 }}>
                                <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 700, color: "var(--scout-muted)", textTransform: "uppercase", letterSpacing: "1.1px", marginBottom: 8 }}>
                                  {useMarketGaps ? "Market gaps" : "What you\u2019re missing"}
                                </p>
                                {missingGroups.map((group) => (
                                  <div key={group.label} style={{ marginBottom: 12 }}>
                                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: color.muted, margin: "0 0 8px" }}>{group.label}</p>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                      {group.rows.map((row) => renderGapRow(row))}
                                    </div>
                                  </div>
                                ))}
                                <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#B0A898", marginTop: 8, fontStyle: "italic", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                  <span>Add to your profile if you already have it, or obtain it to track learning in Upskill.</span>
                                  <ScoreExplainerPopover variant="upskill-recommendations" />
                                </p>
                              </div>
                            )}
                            {learningSkills.length > 0 && (
                              <div style={{ marginBottom: 14 }}>
                                <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 700, color: "#C4A86A", textTransform: "uppercase", letterSpacing: "1.1px", marginBottom: 8 }}>Working on</p>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {learningSkills.map((skill) => (
                                    <span key={skill} style={{ padding: "5px 11px", background: "rgba(196,168,106,0.12)", border: "1px solid rgba(196,168,106,0.35)", borderRadius: "var(--scout-radius)", fontFamily: "var(--font-ui)", fontSize: 14, color: "#7A6020", display: "inline-flex", alignItems: "center", gap: 5 }}>
                                      <span style={{ fontSize: 14 }}>→</span> {skill}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div style={{ marginTop: 4, padding: "10px 14px", background: "rgba(0,0,0,0.025)", borderRadius: "var(--scout-radius)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                              <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)", margin: 0, lineHeight: 1.5 }}>
                                {loaded._cachedAt
                                  ? `Last refreshed ${formatLastRefreshed(loaded._cachedAt)}. Scores are saved per resume — switch resumes to compare, or refresh for a new analysis.`
                                  : "Scores are saved per resume. Refresh when you want an updated analysis."}
                                {loaded._stale ? " Your profile changed since this score — refresh when ready." : ""}
                              </p>
                              <button onClick={() => handleRefresh(role)} style={{ padding: "5px 12px", background: "#FFFFFF", border: "1px solid #E5DDD0", borderRadius: "var(--scout-radius)", fontFamily: "var(--font-ui)", fontSize: 14, color: "#52493F", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", flexShrink: 0 }}>
                                ↻ Refresh
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {obtainNudge?.role === role && (
                        <div style={{ marginBottom: 20 }}>
                          <UpskillNextStepCard
                            skill={obtainNudge.skill}
                            role={obtainNudge.role}
                            onGoToUpskill={(s) => {
                              onGoToUpskill(s);
                              setObtainNudge(null);
                              onClearUpskillPrompt?.();
                            }}
                            onDismiss={() => {
                              setObtainNudge(null);
                              onClearUpskillPrompt?.();
                            }}
                            isMobile={isMobile}
                          />
                        </div>
                      )}

                      <div>
                        <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 700, color: "#1A3A2F", textTransform: "uppercase", letterSpacing: "1.1px", marginBottom: 10 }}>Next steps</p>
                        {(() => {
                          const marketGaps = corpusGapsForRole(roleCorpusGaps, role)
                            .filter((g) => !hasSkill(g.skill))
                            .map((g) => g.skill);
                          const required = loaded.requiredSkills ?? [];
                          const gapSkills = marketGaps.length
                            ? marketGaps
                            : required.filter((s) => !hasSkill(s));
                          const queuedSkills = skillGoals
                            .filter((g) => g.role === role)
                            .map((g) => g.skill)
                            .filter((s) => !gapSkills.some((g) => g.toLowerCase() === s.toLowerCase()));
                          const upskillSkills = [...gapSkills, ...queuedSkills];
                          if (upskillSkills.length === 0) return null;
                          return (
                            <UpskillNextStepCard
                              variant="next-steps"
                              role={role}
                              skills={upskillSkills}
                              onGoToUpskill={onGoToUpskill}
                              isMobile={isMobile}
                            />
                          );
                        })()}
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
            </ScoutBox>
          );
        })}
      </div>
      </ScoutBox>

      <ScoutBox padding={isMobile ? 16 : 22} style={{ marginBottom: 24 }}>
        <ScoutLabel>Feed filters</ScoutLabel>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 16px", lineHeight: 1.7 }}>
          Narrow which jobs rank higher by job function and experience level.
        </p>
        <div>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Job functions
          </p>
          <JobCategoryPicker
            selected={prioritizedCategories}
            onChange={(next) => {
              setPrioritizedCategories(next);
              onPrioritizedCategoriesSave(next);
            }}
            suggestions={PRIORITIZED_CATEGORY_SUGGESTIONS}
            addButtonLabel="+ Add prioritized category"
          />
        </div>
        <div style={{ marginTop: 20 }}>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Experience levels
          </p>
          <SearchPreferencesExperienceEditor
            selected={experienceLevelLabels}
            onChange={onExperienceLevelsSave}
          />
        </div>
      </ScoutBox>

      <ScoutBox padding={isMobile ? 16 : 22}>
        <ScoutLabel>Deprioritized roles</ScoutLabel>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 16px", lineHeight: 1.7 }}>
          Title patterns that should sort lower — sales AE, product manager/management, etc. Matching includes related wording (e.g. &ldquo;Product Manager&rdquo; also deprioritizes &ldquo;Product Management&rdquo;).
        </p>
        <RoleTitlePicker
          selected={deprioritizedList}
          onChange={(next) => {
            setDeprioritizedList(next);
            onDeprioritizedSave(next);
          }}
          placeholder="e.g. Account Executive, Product Manager…"
          addButtonLabel="+ Add deprioritized role"
          quickSuggestions={DEPRIORITIZED_ROLE_SUGGESTIONS}
          enableRelatedExpand
        />
        <div style={{ marginTop: 20 }}>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Deprioritized categories
          </p>
          <JobCategoryPicker
            selected={deprioritizedCategories}
            onChange={(next) => {
              setDeprioritizedCategories(next);
              onDeprioritizedCategoriesSave(next);
            }}
            suggestions={DEPRIORITIZED_CATEGORY_SUGGESTIONS}
            addButtonLabel="+ Add deprioritized category"
          />
        </div>
      </ScoutBox>
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
          border: "var(--scout-border)",
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
            border: "var(--scout-border)",
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
          Upload a resume
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
          PDF or Word format · max 10MB · we&apos;ll scan and parse it into your profile
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

function AssetsTab({ assets, uploading, onUpload, onDelete, onOpenResume, inputRef, suggestions, suggestionsLoading, onOpenPricing, onUploadDocument, documentUploading, targetRoles, onMakePrimary, onUpdateTargetRole, canCreateFromProfile, onCreateFromProfile, creatingFromProfile }: {
  assets: UserAssetRow[];
  uploading: boolean;
  onUpload: (file: File) => void;
  onDelete: (id: string) => void;
  onOpenResume: (id: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  suggestions: AISuggestion[];
  suggestionsLoading: boolean;
  onOpenPricing: () => void;
  onUploadDocument?: (file: File, type: LibraryDocumentType) => void;
  documentUploading?: boolean;
  targetRoles: string[];
  onMakePrimary: (id: string) => void;
  onUpdateTargetRole: (id: string, role: string | null) => void;
  canCreateFromProfile?: boolean;
  onCreateFromProfile?: () => void;
  creatingFromProfile?: boolean;
}) {
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDocUploadModal, setShowDocUploadModal] = useState(false);
  const [docFilter, setDocFilter] = useState<"all" | UserAssetType>("all");
  const [makingPrimary, setMakingPrimary] = useState<string | null>(null);

  const resumes = assets.filter((a) => a.type === "RESUME");
  const otherDocs = assets.filter((a) => a.type !== "RESUME");
  const filteredOther =
    docFilter === "all" ? otherDocs : otherDocs.filter((a) => a.type === docFilter);

  const emptyResumeCopy = canCreateFromProfile
    ? "No master resume yet — upload a file and we'll scan it, or create one from your profile data."
    : "No resume yet — upload one to unlock fit scores and tailoring.";

  const emptyResumeActions = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center", marginTop: 12 }}>
      {canCreateFromProfile && onCreateFromProfile && (
        <ScoutPrimaryBtn
          onClick={onCreateFromProfile}
          disabled={creatingFromProfile || uploading}
          style={{ minHeight: 44, opacity: creatingFromProfile ? 0.7 : 1 }}
        >
          {creatingFromProfile ? "Creating…" : "Create as a resume"}
        </ScoutPrimaryBtn>
      )}
      <ScoutPrimaryBtn
        onClick={() => setShowUploadModal(true)}
        disabled={uploading || creatingFromProfile}
        style={{
          minHeight: 44,
          opacity: uploading ? 0.6 : 1,
          ...(canCreateFromProfile
            ? { background: surface.card, color: color.forest, border: "var(--scout-border)" }
            : {}),
        }}
      >
        {uploading ? "Uploading…" : "+ Upload resume"}
      </ScoutPrimaryBtn>
    </div>
  );
  const primaryBadge = (
    <span style={{ padding: "2px 8px", background: "rgba(196,168,106,0.18)", border: `1px solid ${color.gold}`, fontSize: T.caption, fontWeight: 700, color: "#7A6020" }}>
      ★ Primary
    </span>
  );

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
            border: "var(--scout-border)",
            boxShadow: "4px 4px 0 rgba(17,17,17,0.06)",
            minWidth: 180,
            zIndex: 100,
            overflow: "hidden",
          }}
        >
          {[
            { label: "View resume", action: () => { onOpenResume(r.id); setMenuOpen(null); } },
            { label: "Download", action: () => { window.open(r.url, "_blank"); setMenuOpen(null); } },
            ...(!r.isPrimary ? [{
              label: "Make primary",
              action: () => {
                setMakingPrimary(r.id);
                onMakePrimary(r.id);
                setMenuOpen(null);
                setMakingPrimary(null);
              },
            }] : []),
            { label: "Delete", action: () => { onDelete(r.id); setMenuOpen(null); } },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              style={{
                width: "100%",
                padding: "12px 14px",
                minHeight: 44,
                textAlign: "left",
                background: item.label === "Make primary" ? "rgba(196,168,106,0.12)" : "none",
                border: "none",
                fontSize: 14,
                fontWeight: item.label === "Make primary" ? 700 : 400,
                color: item.label === "Make primary" ? "#7A6020" : "#1A1A1A",
                cursor: "pointer",
                display: "block",
                borderBottom: "1px solid #F5F3EF",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = item.label === "Make primary" ? "rgba(196,168,106,0.2)" : "#F5F3EF")}
              onMouseLeave={(e) => (e.currentTarget.style.background = item.label === "Make primary" ? "rgba(196,168,106,0.12)" : "none")}
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
          <ScoutLabel>Documents</ScoutLabel>
          <ScoutDisplayTitle size={22} style={{ marginTop: 8, marginBottom: 6 }}>Your file library</ScoutDisplayTitle>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
            Resumes and supporting documents — tagged by type in one place.
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
              border: "var(--scout-border)",
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
          <input ref={inputRef} type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) { onUpload(f); setShowUploadModal(false); } e.target.value = ""; }} />
          <ScoutPrimaryBtn
            onClick={() => setShowUploadModal(true)}
            disabled={uploading}
            style={{ width: isMobile ? "100%" : undefined, opacity: uploading ? 0.6 : 1 }}
          >
            {uploading ? "Uploading…" : "+ Upload resume"}
          </ScoutPrimaryBtn>
        </div>
      </div>

      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 12px" }}>
        {resumes.length} resume{resumes.length === 1 ? "" : "s"} saved
      </p>
      {isMobile ? (
        <ScoutBox padding={0} style={{ overflow: "hidden" }}>
          {resumes.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>{emptyResumeCopy}</p>
              {emptyResumeActions}
            </div>
          ) : (
            resumes.map((r, index) => (
              <div
                key={r.id}
                style={{
                  padding: "14px 16px",
                  borderBottom: index < resumes.length - 1 ? "var(--scout-border)" : "none",
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
                      width: 32, height: 32, background: color.forest, border: "var(--scout-border)",
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
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
                  {r.isPrimary && primaryBadge}
                  {(() => {
                    const badge = resumeAnalysisBadge(r);
                    return (
                      <span style={{ padding: "2px 8px", background: badge.bg, border: `1px solid ${badge.border}`, fontSize: T.caption, fontWeight: 500, color: badge.color }}>
                        {badge.label}
                      </span>
                    );
                  })()}
                  {!r.isPrimary && (
                    <ScoutGoldBtn
                      disabled={makingPrimary === r.id}
                      onClick={() => onMakePrimary(r.id)}
                      style={{ padding: "4px 10px", fontSize: T.caption, minHeight: 32 }}
                    >
                      {makingPrimary === r.id ? "Setting…" : "Make primary"}
                    </ScoutGoldBtn>
                  )}
                </div>
                <div style={{ marginBottom: 10 }} onClick={(e) => e.stopPropagation()}>
                  <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.muted, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Target role
                  </p>
                  <TargetRoleSelect
                    value={r.targetJobTitle}
                    roles={targetRoles}
                    onChange={(role) => onUpdateTargetRole(r.id, role)}
                  />
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
          borderBottom: "var(--scout-border)",
          background: surface.inset,
        }}>
          {["Resume", "Target role", "Last modified", "Created", ""].map((col) => (
            <span key={col} style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{col}</span>
          ))}
        </div>

        {resumes.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>{emptyResumeCopy}</p>
            {emptyResumeActions}
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
                borderBottom: "var(--scout-border)",
                position: "relative",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = surface.inset)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, background: color.forest, border: "var(--scout-border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <span style={{ color: color.gold, fontSize: 14, fontWeight: 700 }}>
                    {r.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <span style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink }}>{r.name}</span>
                  <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
                    {r.isPrimary && primaryBadge}
                    {(() => {
                      const badge = resumeAnalysisBadge(r);
                      return (
                        <span style={{ padding: "2px 8px", background: badge.bg, border: `1px solid ${badge.border}`, fontSize: T.caption, fontWeight: 500, color: badge.color }}>
                          {badge.label}
                        </span>
                      );
                    })()}
                    {!r.isPrimary && (
                      <ScoutGoldBtn
                        disabled={makingPrimary === r.id}
                        onClick={(e) => { e.stopPropagation(); onMakePrimary(r.id); }}
                        style={{ padding: "3px 8px", fontSize: 11, minHeight: 28 }}
                      >
                        Make primary
                      </ScoutGoldBtn>
                    )}
                  </div>
                </div>
              </div>

              <div onClick={(e) => e.stopPropagation()}>
                <TargetRoleSelect
                  value={r.targetJobTitle}
                  roles={targetRoles}
                  onChange={(role) => onUpdateTargetRole(r.id, role)}
                  onClickStop={(e) => e.stopPropagation()}
                />
              </div>

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

      {(otherDocs.length > 0 || onUploadDocument) && (
        <ScoutBox padding={isMobile ? 16 : 22} style={{ marginTop: 24 }}>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
            <div>
              <p style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: color.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                Other documents
              </p>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
                {otherDocs.length} document{otherDocs.length === 1 ? "" : "s"} — strategy, cover letters, portfolios, and more
              </p>
            </div>
            {onUploadDocument && (
              <ScoutSecondaryBtn onClick={() => setShowDocUploadModal(true)} disabled={documentUploading}>
                {documentUploading ? "Uploading…" : "+ Upload document"}
              </ScoutSecondaryBtn>
            )}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {LIBRARY_DOCUMENT_FILTER_TYPES.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setDocFilter(key)}
                style={{
                  padding: "6px 12px",
                  border: "var(--scout-border)",
                  background: docFilter === key ? "rgba(26,58,47,0.08)" : surface.card,
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  fontWeight: docFilter === key ? 600 : 500,
                  color: docFilter === key ? color.forest : color.muted,
                  cursor: "pointer",
                }}
              >
                {key === "all" ? "All" : assetTypeLabel(key)}
              </button>
            ))}
          </div>

          <UserAssetsList
            assets={filteredOther.map((a) => ({
              id: a.id,
              type: a.type,
              name: a.name,
              url: a.url,
              createdAt: a.createdAt,
              isPrimary: a.isPrimary,
              targetJobTitle: a.targetJobTitle,
              parseStatus: a.parseStatus,
            }))}
            showTypeBadge
            isMobile={isMobile}
            emptyMessage="No documents yet — upload one and pick its type."
            onDelete={onDelete}
          />
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
      {onUploadDocument && (
        <LibraryDocumentUploadModal
          open={showDocUploadModal}
          onClose={() => setShowDocUploadModal(false)}
          uploading={documentUploading}
          onUpload={(file, type) => {
            onUploadDocument(file, type);
            setShowDocUploadModal(false);
          }}
        />
      )}
    </div>
  );
}

// ─── AI Readback Card ─────────────────────────────────────────────────────────

function ReadbackCard({
  data,
  loading,
  onRefresh,
  embedded,
  stack,
  candidateName,
  readbackUpdatedAt,
  primaryResumeUpdatedAt,
}: {
  data: ReadbackData | null;
  loading: boolean;
  onRefresh: () => void;
  embedded?: boolean;
  stack?: boolean;
  candidateName?: string | null;
  readbackUpdatedAt?: string | null;
  primaryResumeUpdatedAt?: string | null;
}) {
  const isMobile = useIsMobile();
  const { showCredits } = useCredits();
  const displayData = data && candidateName ? formatReadbackForDisplay(data, candidateName) : data;
  const resumeNewerThanReadback =
    primaryResumeUpdatedAt &&
    readbackUpdatedAt &&
    new Date(primaryResumeUpdatedAt).getTime() > new Date(readbackUpdatedAt).getTime();
  if (!loading && !displayData) return null;
  return (
    <ScoutBox
      stack={stack}
      padding={isMobile ? "14px 16px" : "16px 20px"}
      style={{
        marginBottom: embedded ? 0 : (isMobile ? 16 : 20),
        height: embedded && !isMobile ? "100%" : undefined,
        ...(embedded ? { borderColor: "var(--scout-border)", background: "#FFFFFF" } : {}),
      }}
    >
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", marginBottom: 10, gap: isMobile ? 10 : 0 }}>
        <div>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.forest, textTransform: "uppercase" as const, letterSpacing: "0.08em", margin: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <SparkleIcon /> Quick snapshot
          </p>
          {readbackUpdatedAt && !loading && (
            <p style={{ fontFamily: fontSans, fontSize: 11, color: color.muted, margin: "4px 0 0" }}>
              Last updated {formatLastRefreshed(readbackUpdatedAt)}
            </p>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: isMobile ? "flex-start" : "flex-end", gap: 4 }}>
          <ScoutSecondaryBtn onClick={onRefresh} disabled={loading} style={{ padding: isMobile ? "10px 14px" : "4px 10px", minHeight: isMobile ? 44 : undefined, opacity: loading ? 0.5 : 1 }}>
            ↻ {loading ? "Refreshing…" : "Refresh"}
          </ScoutSecondaryBtn>
          {showCredits && !loading && (
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--scout-muted)" }}>Uses 1 credit</span>
          )}
        </div>
      </div>
      {resumeNewerThanReadback && !loading && (
        <div style={{ fontFamily: fontSans, fontSize: 13, color: color.ink, background: "#FFF8E8", border: "1px solid #E8D5A3", borderRadius: "var(--scout-radius)", padding: "10px 12px", marginBottom: 12, lineHeight: 1.5 }}>
          Your resume changed since this snapshot was generated.{" "}
          <button type="button" onClick={onRefresh} style={{ background: "none", border: "none", padding: 0, color: color.forest, textDecoration: "underline", cursor: "pointer", font: "inherit" }}>
            Refresh snapshot
          </button>
        </div>
      )}
      {loading && !displayData ? (
        <KimchiProcessLoader preset="profileAnalysis" variant="inline" />
      ) : displayData ? (
        <>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#1C3A2F", lineHeight: 1.65, marginBottom: 12 }}>{displayData.picture}</p>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, marginBottom: 12 }}>
            {displayData.strengths.map((s) => (
              <span key={s} style={{ padding: "4px 10px", border: "var(--scout-border)", fontFamily: fontSans, fontSize: T.caption, color: color.forest }}>{s}</span>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, marginBottom: 12 }}>
            {displayData.targetRoles.map((r) => {
              const c = r.fit === "Strong match" ? "#1A3A2F" : r.fit === "Good fit" ? "#C4A86A" : "var(--scout-muted)";
              const bg = r.fit === "Strong match" ? "rgba(74,139,106,0.08)" : r.fit === "Good fit" ? "rgba(196,168,106,0.1)" : "rgba(0,0,0,0.04)";
              return (
                <span key={r.role} style={{ padding: "4px 10px", border: "var(--scout-border)", fontFamily: fontSans, fontSize: T.caption, color: c }}>{r.role} · {r.fit}</span>
              );
            })}
          </div>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)", fontStyle: "italic" }}>{displayData.honestNote}</p>
        </>
      ) : null}
    </ScoutBox>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type PageTab = "dreamrole" | "targetcompanies" | "about" | "learning" | "assets" | "preferences" | "linkedin" | "strategy" | "discoveryscore";
type AboutSection = "personal" | "education" | "experience" | "skills";

const ABOUT_SECTIONS: AboutSection[] = ["personal", "experience", "education", "skills"];
const ABOUT_STACK_ORDER: AboutSection[] = ["experience", "personal", "education", "skills"];
const ABOUT_LABEL: Record<AboutSection, string> = { personal: "Personal information", experience: "Work experience", education: "Education", skills: "Skills & tools" };
const ABOUT_NUM: Record<AboutSection, string> = { personal: "01", experience: "02", education: "03", skills: "04" };

type ProfileMissingItem = { label: string; points: number; action: () => void };

function profileMissingItems(
  p: UserProfile,
  actions: {
    goToAssets: () => void;
    goToSection: (s: AboutSection) => void;
    goToPreferences: () => void;
  },
): ProfileMissingItem[] {
  const missing: ProfileMissingItem[] = [];
  if (!p.resumeUrl) missing.push({ label: "Upload your resume", points: 2, action: actions.goToAssets });
  if (!p.parsedData?.phone) missing.push({ label: "Add phone number", points: 1, action: () => actions.goToSection("personal") });
  if (!p.parsedData?.location) missing.push({ label: "Add your location", points: 1, action: () => actions.goToSection("personal") });
  if (!p.linkedinUrl) missing.push({ label: "Link your LinkedIn", points: 1, action: () => actions.goToSection("personal") });
  if (!(p.parsedData?.education || []).length) missing.push({ label: "Add education history", points: 1, action: () => actions.goToSection("education") });
  if (!(p.parsedData?.workExperience || []).length) missing.push({ label: "Add work experience", points: 1, action: () => actions.goToSection("experience") });
  if (!(p.parsedData?.skills || []).length && !(p.parsedData?.tools || []).length) {
    missing.push({ label: "Add your skills & tools", points: 1, action: () => actions.goToSection("skills") });
  }
  if (!p.jobTimeline) missing.push({ label: "Set your job timeline", points: 1, action: actions.goToPreferences });
  if (!p.targetSalary) missing.push({ label: "Set your target salary", points: 1, action: actions.goToPreferences });
  if (!(p.priorities || []).length) missing.push({ label: "Add job priorities", points: 1, action: actions.goToPreferences });
  return missing;
}

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

type WorkspaceProfileProps = {
  /** When set (admin client review route), load this user's profile — not the logged-in admin. */
  adminClientUserId?: string;
};

export function WorkspaceProfile({ adminClientUserId }: WorkspaceProfileProps = {}) {
  const isMobile = useIsMobile();
  const [activeSection, setActiveSection] = useState<AboutSection>("personal");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { adminReviewClientId, withClientScope, isAdminReviewing, openPricing, user, showAdminUi, isImpersonating, isAdmin } = useWorkspace();
  const profileLoc = parseProfileLocation(pathname);
  const urlClientId = searchParams.get("clientUserId")?.trim() || undefined;
  const [profileReviewClientId, setProfileReviewClientId] = useState<string | undefined>();
  const clientId = isImpersonating
    ? undefined
    : (adminClientUserId ?? profileLoc.clientId ?? adminReviewClientId ?? urlClientId ?? profileReviewClientId ?? undefined);
  const profileScopeKey = isImpersonating ? "impersonate" : (clientId ?? "self");
  const canAccessImport = Boolean(clientId) && isAdmin && !isImpersonating;
  const preferencesSection = profileLoc.preferencesSection;
  const profileBase = profileBasePath(clientId, { sessionScoped: isAdminReviewing });
  const api = withClientScope;
  const page = profileLoc.page;
  const setPage = (tab: PageTab) => {
    router.push(profileTabPath(profileBase, tab));
  };
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [dreamList, setDreamList] = useState<string[]>([]);
  const [prioritizedCategories, setPrioritizedCategories] = useState<string[]>([]);
  const [deprioritizedList, setDeprioritizedList] = useState<string[]>([]);
  const [deprioritizedCategories, setDeprioritizedCategories] = useState<string[]>([]);
  const [experienceLevelLabels, setExperienceLevelLabels] = useState<string[]>([]);
  const [roleAnalyses, setRoleAnalyses] = useState<RoleAnalysesMap>({});
  const [upskillProgress, setUpskillProgress] = useState<UpskillProgressMap>({});
  const [skillGoals, setSkillGoals] = useState<SkillGoal[]>([]);
  const [roleCorpusGaps, setRoleCorpusGaps] = useState<RoleCorpusGapsCache | null>(null);
  const [corpusGapsRefreshing, setCorpusGapsRefreshing] = useState(false);
  const [targetRoleSettings, setTargetRoleSettings] = useState<TargetRoleSettingsMap>({});
  const [upskillPrompt, setUpskillPrompt] = useState<{ skill: string; role: string } | null>(null);
  const legacyMigratedRef = useRef(false);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [documentUploading, setDocumentUploading] = useState(false);
  const [resumeUploadError, setResumeUploadError] = useState<string | null>(null);
  const [creatingFromProfile, setCreatingFromProfile] = useState(false);
  const [assets, setAssets] = useState<UserAssetRow[]>([]);
  const [readback, setReadback] = useState<ReadbackData | null>(null);
  const [readbackLoading, setReadbackLoading] = useState(false);
  const [profileSuggestions, setProfileSuggestions] = useState<AISuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [readbackNudge, setReadbackNudge] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [editorAssetId, setEditorAssetId] = useState<string | null>(null);
  const [onboardingFinish, setOnboardingFinish] = useState<OnboardingFinishPayload | null>(null);
  const openResumeEditor = (assetId: string) => {
    setEditorAssetId(assetId);
    router.push(profileTabPath(profileBase, "assets", { assetId }));
  };
  const closeResumeEditor = () => {
    setEditorAssetId(null);
    setOnboardingFinish(null);
    router.push(profileTabPath(profileBase, "assets"));
  };
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<AboutSection, HTMLDivElement | null>>({ personal: null, education: null, experience: null, skills: null });

  useEffect(() => {
    fetch(api("/api/subscription"))
      .then((r) => r.json())
      .then((d) => { if (d.isPro) setIsPro(true); })
      .catch(() => {});
  }, [withClientScope]);

  useEffect(() => {
    setLoading(true);
    setProfile(null);
    setReadback(null);
    setProfileReviewClientId(undefined);
    legacyMigratedRef.current = false;
    fetch(api("/api/profile"), { cache: "no-store" })
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
        const adminReview = data.adminReview as { clientId?: string } | undefined;
        if (adminReview?.clientId) setProfileReviewClientId(adminReview.clientId);
        const userProfile = data as UserProfile;
        setProfile(userProfile);
        setDreamList(userProfile.targetRoles || []);
        setPrioritizedCategories(userProfile.prioritizedCategories || []);
        setDeprioritizedList(userProfile.deprioritizedRoles || []);
        setDeprioritizedCategories(userProfile.deprioritizedCategories || []);
        setExperienceLevelLabels(
          searchPreferencesFromParsedData(userProfile.parsedData).experienceLevelLabels ?? [],
        );
        setRoleAnalyses(normalizeRoleAnalysesMap(userProfile.roleAnalyses));
        setSkillGoals(normalizeSkillGoals(userProfile.skillGoals));
        setRoleCorpusGaps(readRoleCorpusGaps(userProfile.parsedData));
        setUpskillProgress(userProfile.upskillProgress ?? {});
        setTargetRoleSettings(normalizeTargetRoleSettings(userProfile.targetRoleSettings));

        if (userProfile.readbackData) {
          setReadback(userProfile.readbackData);
        }

        if (!legacyMigratedRef.current) {
          legacyMigratedRef.current = true;
          const migrated = await migrateLegacyProfileData(userProfile, patchProfile);
          setRoleAnalyses(migrated.roleAnalyses);
          setSkillGoals(migrated.skillGoals);
          if (migrated.targetRoles?.length) {
            setDreamList(migrated.targetRoles);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileScopeKey, withClientScope]);

  useEffect(() => {
    if (!profile?.resumeUrl) return;
    if (profile.readbackData) return;

    setReadbackLoading(true);
    fetch(api("/api/ai/readback"))
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setReadback(data);
          setProfile((p) =>
            p ? { ...p, readbackData: data, readbackUpdatedAt: data._cachedAt ?? p.readbackUpdatedAt ?? null } : p,
          );
        }
      })
      .catch(() => {})
      .finally(() => setReadbackLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.resumeUrl, profile?.readbackData]);

  const refreshReadback = () => {
    if (!profile?.resumeUrl) return;
    setReadbackLoading(true);
    fetch(api("/api/ai/readback?force=true"))
      .then(async (r) => {
        if (r.status === 402) {
          notifyCreditsChanged();
          setShowUpgrade(true);
          return;
        }
        const data = await r.json();
        if (!data.error) {
          setReadback(data);
          setProfile((p) =>
            p ? { ...p, readbackData: data, readbackUpdatedAt: data._cachedAt ?? new Date().toISOString() } : p,
          );
          notifyCreditsChanged();
        }
      })
      .catch(() => {})
      .finally(() => setReadbackLoading(false));
  };

  useEffect(() => {
    if (!profile?.resumeUrl) return;
    setSuggestionsLoading(true);
    fetch(api("/api/ai/profile-suggestions"))
      .then((r) => r.json())
      .then((data) => { if (data.suggestions) setProfileSuggestions(data.suggestions); })
      .catch(() => {})
      .finally(() => setSuggestionsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.resumeUrl]);

  const refreshProfileSuggestions = () => {
    if (!profile?.resumeUrl) return;
    setSuggestionsLoading(true);
    fetch(api("/api/ai/profile-suggestions?force=true"))
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
    await fetch(api("/api/profile"), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).catch(() => {});
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
    void fetch(api(`/api/ai/role-gap?role=${encodeURIComponent(role)}`), { method: "DELETE" }).catch(() => {});
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

  const addSkillToPortfolio = async (skill: string, kind?: MatchableKind) => {
    const currentSkills = profile?.parsedData?.skills || [];
    const currentTools = profile?.parsedData?.tools || [];
    const buckets = addMatchableToBuckets({ skills: currentSkills, tools: currentTools }, skill, kind);
    if (
      allMatchableSkills({ skills: currentSkills, tools: currentTools }).some(
        (s) => s.toLowerCase() === skill.toLowerCase(),
      )
    ) {
      return;
    }
    await handleSkillsToolsSave(buckets.skills, buckets.tools);
  };

  const hasSkillGoal = (skill: string, role: string) =>
    skillGoals.some(
      (g) => g.skill.toLowerCase() === skill.toLowerCase() && g.role === role,
    );

  const obtainSkill = (
    skill: string,
    role: string,
    opts?: { gapSource?: SkillGoalGapSource; kind?: MatchableKind },
  ) => {
    const kind = opts?.kind ?? classifyMatchableKind(skill);
    if (!hasSkillGoal(skill, role)) {
      const next = [...skillGoals, buildSkillGoal(skill, role, opts?.gapSource ?? "manual", kind)];
      setSkillGoals(next);
      void patchProfile({ skillGoals: next });
    }
    setUpskillPrompt({ skill, role });
  };

  const refreshCorpusGaps = useCallback(async () => {
    setCorpusGapsRefreshing(true);
    try {
      const res = await fetch(api("/api/profile/role-corpus-gaps"), { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.roleCorpusGaps) {
        setRoleCorpusGaps(data.roleCorpusGaps as RoleCorpusGapsCache);
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                parsedData: {
                  ...(prev.parsedData && typeof prev.parsedData === "object" ? prev.parsedData : {}),
                  roleCorpusGaps: data.roleCorpusGaps,
                },
              }
            : prev,
        );
      }
    } finally {
      setCorpusGapsRefreshing(false);
    }
  }, [api]);

  const goToUpskill = (skill: string) => {
    setUpskillPrompt(null);
    router.push(profileTabPath(profileBase, "learning", { skill }));
  };

  const openCompanyProspectJob = useCallback((companyName: string, job: CachedJob) => {
    const prospectId = prospectPathId(job);
    writeProspectJobCache({
      prospectId,
      job,
      companyName,
      fetchedAt: Date.now(),
    });
    router.push(pipelineProspectUrl(prospectId));
  }, [router]);

  const addSkillGoal = (
    skill: string,
    role: string,
    gapSource?: SkillGoalGapSource,
    kind?: MatchableKind,
  ) => {
    if (hasSkillGoal(skill, role)) return;
    const next = [...skillGoals, buildSkillGoal(skill, role, gapSource ?? "manual", kind ?? classifyMatchableKind(skill))];
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
    fetch(api("/api/assets"))
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

    router.replace(profileTabPath(profileBase, "assets", { assetId: assetToOpen }));
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

  const handleSkillsToolsSave = async (skills: string[], tools: string[]) => {
    if (!profile) return;
    const reconciled = reconcileSkillsToolsFields({ skills, tools });
    const newParsedData = {
      ...(profile.parsedData || { education: [], workExperience: [] }),
      skills: reconciled.skills,
      tools: reconciled.tools,
      skillGroups: reconciled.skillGroups,
    };
    await patchProfile({ parsedData: newParsedData });
    setProfile((p) => (p ? { ...p, parsedData: newParsedData } : p));
  };

  const handleCareerPrefSave = async (patch: CareerPrefPatch) => {
    await patchProfile(patch as Record<string, unknown>);
    setProfile((p) => (p ? { ...p, ...patch } : p));
  };

  const graduateSkill = async (skill: string) => {
    const currentSkills = profile?.parsedData?.skills || [];
    const currentTools = profile?.parsedData?.tools || [];
    const goalKind = skillGoals.find((g) => g.skill.toLowerCase() === skill.toLowerCase())?.kind;
    const kind = goalKind ?? classifyMatchableKind(skill);
    if (
      !allMatchableSkills({ skills: currentSkills, tools: currentTools }).some(
        (s) => s.toLowerCase() === skill.toLowerCase(),
      )
    ) {
      const buckets = addMatchableToBuckets({ skills: currentSkills, tools: currentTools }, skill, kind);
      await handleSkillsToolsSave(buckets.skills, buckets.tools);
    }
    setSkillGoals((prev) => {
      const next = prev.filter((g) => g.skill.toLowerCase() !== skill.toLowerCase());
      void patchProfile({ skillGoals: next });
      return next;
    });
  };

  const handleAssetDelete = async (id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    try {
      const res = await fetch(api(`/api/assets?id=${id}`), { method: "DELETE" });
      if (res.ok) {
        const profileRes = await fetch(api("/api/profile"));
        const profileData = await profileRes.json();
        if (!profileData.error) setProfile(profileData);
      } else {
        refreshAssets();
      }
    } catch {
      refreshAssets();
    }
  };

  const refreshProfileAfterResume = useCallback(() => {
    refreshAssets();
    fetch(api("/api/profile"))
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setProfile(data);
          setRoleAnalyses(normalizeRoleAnalysesMap(data.roleAnalyses));
        }
      })
      .catch(() => {});
    setReadbackNudge(true);
    setTimeout(() => setReadbackNudge(false), 8000);
  }, [clientId]);

  const uploadFlow = useResumeUploadFlow({
    onComplete: refreshProfileAfterResume,
    onFailed: (message) => {
      setResumeUploadError(message);
      refreshAssets();
    },
    onCancel: handleAssetDelete,
    assetApiUrl: (id) => api(`/api/assets/${id}`),
  });

  const handleDocumentUpload = async (file: File, type: LibraryDocumentType) => {
    setDocumentUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("type", type);
      const res = await fetch(api("/api/assets/upload"), { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      refreshAssets();
    } catch {
      // silent — user can retry
    } finally {
      setDocumentUploading(false);
    }
  };

  const handleMakePrimary = async (id: string) => {
    setAssets((prev) =>
      prev.map((a) =>
        a.type === "RESUME" ? { ...a, isPrimary: a.id === id } : a,
      ),
    );
    try {
      const res = await fetch(api(`/api/assets/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrimary: true }),
      });
      if (res.ok) {
        refreshProfileAfterResume();
      } else {
        refreshAssets();
      }
    } catch {
      refreshAssets();
    }
  };

  const handleUpdateTargetRole = async (id: string, targetJobTitle: string | null) => {
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, targetJobTitle } : a)));
    try {
      await fetch(api(`/api/assets/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetJobTitle }),
      });
    } catch {
      refreshAssets();
    }
  };

  const targetRolesForResumes = dedupeRoles(dreamList);

  const handleResumeUpload = async (file: File) => {
    setResumeUploading(true);
    setResumeUploadError(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(api("/api/resume"), { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setResumeUploadError(data.error || "Upload failed — try again.");
        return;
      }
      if (res.status === 202 && data.asset?.id) {
        refreshAssets();
        uploadFlow.startJob(data.asset.id, data.defaultName || data.asset.name || file.name.replace(/\.[^/.]+$/, ""));
        return;
      }
      if (data.url) {
        refreshProfileAfterResume();
        if (data.asset?.id) openResumeEditor(data.asset.id);
      }
    } catch {
      setResumeUploadError("Upload failed — try again.");
    } finally {
      setResumeUploading(false);
    }
  };

  const handleCreateFromProfile = async () => {
    setCreatingFromProfile(true);
    setResumeUploadError(null);
    try {
      const res = await fetch(api("/api/resume/create-from-profile"), { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setResumeUploadError(data.error || "Could not create resume from profile.");
        return;
      }
      if (data.asset?.id) {
        refreshProfileAfterResume();
        openResumeEditor(data.asset.id);
      }
    } catch {
      setResumeUploadError("Could not create resume from profile — try again.");
    } finally {
      setCreatingFromProfile(false);
    }
  };

  const goToSection = (section: AboutSection) => {
    router.push(profileTabPath(profileBase, "about", { aboutSection: section }));
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
  const tools = pd?.tools || [];
  const matchableSkills = allMatchableSkills({ skills, tools });
  const highlightSkill = searchParams.get("skill");
  const resumeAssets = assets.filter((a) => a.type === "RESUME");
  const canCreateFromProfile =
    resumeAssets.length === 0 &&
    !!profile &&
    profileHasResumeMaterial(profile, { name: profile.name, email: profile.email });

  const PAGE_TABS: { id: PageTab; label: string }[] = [
    { id: "about", label: "About" },
    { id: "linkedin", label: "LinkedIn" },
    { id: "discoveryscore", label: isMobile ? "Score" : "Discovery Score" },
    { id: "dreamrole", label: isMobile ? "Roles" : "Role ranking" },
    { id: "targetcompanies", label: isMobile ? "Cos." : "Target Companies" },
    { id: "strategy", label: isMobile ? "Strategy" : "Career Strategy" },
    { id: "learning", label: "Upskill" },
    { id: "assets", label: "Resumes" },
    { id: "preferences", label: isMobile ? "Prefs" : "Preferences" },
  ];

  const sectionCardPad = isMobile ? 18 : 22;
  const showReadback = !!(readback || readbackLoading);
  const completenessPct = profile ? profileCompleteness(profile) : 0;
  const { weakest: weakestTab } = profile ? profileCompletenessWithWeakest(profile) : { weakest: null };
  const strategyFileCount = assets.filter((a) => a.type === "JOB_SEARCH_STRATEGY").length;
  const missingItems = profile
    ? profileMissingItems(profile, {
        goToAssets: () => setPage("assets"),
        goToSection,
        goToPreferences: () => setPage("preferences"),
      })
    : [];

  const SIDEBAR_TABS: { id: ProfileSidebarTab; label: string }[] = [
    { id: "about", label: "About" },
    { id: "linkedin", label: "LinkedIn" },
    { id: "discoveryscore", label: "Discovery Score" },
    { id: "dreamrole", label: "Role ranking" },
    { id: "targetcompanies", label: "Target Companies" },
    { id: "strategy", label: "Career Strategy" },
    { id: "learning", label: "Upskill" },
    { id: "assets", label: "Resumes" },
    { id: "preferences", label: "Preferences" },
  ];

  const renderAboutSection = (s: AboutSection) => {
    switch (s) {
      case "personal":
        return (
          <AboutSectionCard key={s} section="personal" stack={isMobile} sectionRef={(el) => { sectionRefs.current.personal = el; }} padding={sectionCardPad}>
            <PersonalTab profile={profile!} onSave={handlePersonalSave} />
          </AboutSectionCard>
        );
      case "experience":
        return (
          <AboutSectionCard key={s} section="experience" sectionRef={(el) => { sectionRefs.current.experience = el; }} padding={sectionCardPad}>
            <ExperienceTab entries={workExperience} onSave={handleExperienceSave} />
          </AboutSectionCard>
        );
      case "education":
        return (
          <AboutSectionCard key={s} section="education" sectionRef={(el) => { sectionRefs.current.education = el; }} padding={sectionCardPad}>
            <EducationTab entries={education} onSave={handleEducationSave} />
          </AboutSectionCard>
        );
      case "skills":
        return (
          <AboutSectionCard key={s} section="skills" sectionRef={(el) => { sectionRefs.current.skills = el; }} padding={sectionCardPad}>
            <SkillsTab skills={skills} tools={tools} onSave={handleSkillsToolsSave} skillGoals={skillGoals} onGraduate={graduateSkill} />
          </AboutSectionCard>
        );
    }
  };

  const completenessChecklist = profile && missingItems.length > 0 && showChecklist ? (
    <ScoutBox style={{ marginBottom: 20 }} padding={16}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <ScoreExplainerLabel variant="profile-completeness">
          <ScoutLabel>Complete your profile</ScoutLabel>
        </ScoreExplainerLabel>
        <button
          type="button"
          onClick={() => setShowChecklist(false)}
          style={{ background: "none", border: "none", color: color.muted, cursor: "pointer", fontSize: 16, padding: "0 4px" }}
          aria-label="Close checklist"
        >
          ✕
        </button>
      </div>
      {missingItems.map((item, i) => (
        <button
          key={item.label}
          type="button"
          onClick={() => { item.action(); setShowChecklist(false); }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "10px 0",
            border: "none",
            borderBottom: i < missingItems.length - 1 ? "var(--scout-border)" : "none",
            background: "transparent",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink }}>{item.label}</span>
          <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>+{item.points}%</span>
        </button>
      ))}
    </ScoutBox>
  ) : null;

  return (
    <div className="bruddle" style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: surface.page, animation: "fadeIn 0.3s ease both" }}>
      <WorkspaceScroll ref={scrollRef}>
        <WorkspaceContent style={{ maxWidth: WORKSPACE_MAX_WIDTH }}>
        {upskillPrompt && page !== "learning" && page !== "dreamrole" && (
          <div style={{ marginBottom: 16 }}>
            <UpskillNextStepCard
              skill={upskillPrompt.skill}
              role={upskillPrompt.role}
              onGoToUpskill={goToUpskill}
              onDismiss={() => setUpskillPrompt(null)}
              isMobile={isMobile}
            />
          </div>
        )}

        {/* Mobile header */}
        {isMobile && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ width: 8, height: 8, background: color.forest, display: "inline-block", flexShrink: 0 }} />
              <ScoutLabel>{clientId ? "Client profile" : "Your profile"}</ScoutLabel>
            </div>
            <ScoutDisplayTitle size={28} style={{ marginBottom: 8 }}>
              {loading ? "Loading…" : profile?.name || "Your profile"}
            </ScoutDisplayTitle>
            {profile?.headline && (
              <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.muted, margin: "0 0 12px", lineHeight: 1.5 }}>
                {profile.headline}
              </p>
            )}
            {profile && (
              <ScoutBox style={{ marginTop: 14 }} padding={16}>
                <button
                  type="button"
                  onClick={() => missingItems.length > 0 && setShowChecklist((s) => !s)}
                  style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, cursor: missingItems.length > 0 ? "pointer" : "default" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <ScoreExplainerLabel variant="profile-completeness">
                      <ScoutLabel>Profile completeness</ScoutLabel>
                    </ScoreExplainerLabel>
                    <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: completenessPct >= 80 ? color.forest : "#C4A86A" }}>
                      {completenessPct}%{missingItems.length > 0 ? (showChecklist ? " ▲" : " ▼") : " ✓"}
                    </span>
                  </div>
                  <div style={{ height: 3, background: "rgba(17,17,17,0.08)" }}>
                    <div style={{ height: "100%", width: `${completenessPct}%`, background: completenessPct >= 80 ? color.forest : "#C4A86A", transition: "width 0.4s ease" }} />
                  </div>
                  {missingItems.length > 0 && (
                    <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "8px 0 0" }}>
                      {missingItems.length} item{missingItems.length !== 1 ? "s" : ""} left — tap to fix
                    </p>
                  )}
                </button>
                {showChecklist && missingItems.length > 0 && (
                  <div style={{ marginTop: 12, borderTop: "var(--scout-border)", paddingTop: 8 }}>
                    {missingItems.map((item, i) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => { item.action(); setShowChecklist(false); }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          width: "100%",
                          padding: "10px 0",
                          border: "none",
                          borderBottom: i < missingItems.length - 1 ? "var(--scout-border)" : "none",
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
            )}
          </div>
        )}

        {readbackNudge && (
          <ScoutBox style={{ marginBottom: 16, borderColor: "rgba(74,139,106,0.35)" }} padding={14}>
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", gap: 12 }}>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.forest, margin: 0, lineHeight: 1.5 }}>
                ✓ Resume uploaded — we pulled your experience, education, and skills. Review them under About.
              </p>
              <button onClick={() => setReadbackNudge(false)} style={{ background: "none", border: "none", color: color.forest, cursor: "pointer", fontSize: 16, padding: isMobile ? "8px 4px" : "0 4px", opacity: 0.6, flexShrink: 0, alignSelf: isMobile ? "flex-end" : undefined, minHeight: isMobile ? 44 : undefined }}>✕</button>
            </div>
          </ScoutBox>
        )}

        {isMobile && (
          <div style={{ display: "flex", border: "var(--scout-border)", overflowX: "auto", marginBottom: page === "about" ? 0 : 24, WebkitOverflowScrolling: "touch", scrollbarWidth: "none", flexShrink: 0 }}>
            {PAGE_TABS.map(({ id, label }, i) => (
              <button
                key={id}
                onClick={() => setPage(id)}
                style={{
                  padding: "10px 14px",
                  minHeight: 44,
                  border: "none",
                  borderRight: i < PAGE_TABS.length - 1 ? "var(--scout-border)" : "none",
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
        )}

        {resumeUploadError && (
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#C05050", marginBottom: 12 }}>
            {resumeUploadError}
          </p>
        )}

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
                  border: activeSection === s ? "var(--scout-border)" : "var(--scout-border)",
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

        <div style={{ display: isMobile ? "block" : "flex", gap: 32, alignItems: "flex-start" }}>
          {!isMobile && (
            <ProfileLayoutSidebar
              tabs={SIDEBAR_TABS}
              activePage={page as ProfileSidebarTab}
              onNavigate={(tab) => setPage(tab)}
              name={profile?.name || (clientId ? "Client profile" : user?.name) || "Your profile"}
              headline={profile?.headline || (clientId ? null : user?.headline)}
              location={profile?.parsedData?.location}
              educationLabel={primaryEducationLabel(education)}
              avatarUrl={clientId ? profile?.avatarUrl : user?.avatarUrl}
              completenessPct={completenessPct}
              loading={loading}
              onCompletenessClick={missingItems.length > 0 ? () => setShowChecklist((s) => !s) : undefined}
              weakestTab={weakestTab}
              onWeakestTabClick={weakestTab ? () => setPage(weakestTab.tab) : undefined}
            />
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            {!isMobile && completenessChecklist}

            {page === "dreamrole" && (
              <DreamRoleTab
                dreamList={dreamList}
                setDreamList={setDreamList}
                onSave={(list) => patchProfile({ targetRoles: list })}
                prioritizedCategories={prioritizedCategories}
                setPrioritizedCategories={setPrioritizedCategories}
                onPrioritizedCategoriesSave={(list) => patchProfile({ prioritizedCategories: list })}
                experienceLevelLabels={experienceLevelLabels}
                onExperienceLevelsSave={(labels) => {
                  setExperienceLevelLabels(labels);
                  const base =
                    profile?.parsedData && typeof profile.parsedData === "object"
                      ? (profile.parsedData as Record<string, unknown>)
                      : {};
                  const parsedData = patchParsedDataSearchPreferences(base, {
                    experienceLevelLabels: labels,
                  });
                  void patchProfile({ parsedData });
                }}
                deprioritizedList={deprioritizedList}
                setDeprioritizedList={setDeprioritizedList}
                onDeprioritizedSave={(list) => patchProfile({ deprioritizedRoles: list })}
                deprioritizedCategories={deprioritizedCategories}
                setDeprioritizedCategories={setDeprioritizedCategories}
                onDeprioritizedCategoriesSave={(list) => patchProfile({ deprioritizedCategories: list })}
                resumeAssets={resumeAssets}
                userSkills={matchableSkills}
                skillGoals={skillGoals}
                roleAnalyses={roleAnalyses}
                roleCorpusGaps={roleCorpusGaps}
                corpusGapsRefreshing={corpusGapsRefreshing}
                onRefreshCorpusGaps={() => void refreshCorpusGaps()}
                targetRoleSettings={targetRoleSettings}
                onTargetRoleSettingsChange={handleTargetRoleSettingsChange}
                onRoleAnalysisUpdate={handleRoleAnalysisUpdate}
                onClearRoleAnalysis={handleClearRoleAnalysis}
                onAddToPortfolio={addSkillToPortfolio}
                onObtainSkill={obtainSkill}
                onGoToUpskill={goToUpskill}
                onClearUpskillPrompt={() => setUpskillPrompt(null)}
                onInitRoleSettings={initRoleSettings}
                clientUserId={clientId}
              />
            )}

            {page === "targetcompanies" && (
              <WorkspaceCompanies
                embeddedInProfile
                onOpenProspectJob={openCompanyProspectJob}
                selectedCompanyId={profileLoc.companyId ?? null}
                onCompanySelect={(id) => router.push(profileTabPath(profileBase, "targetcompanies", { companyId: id }))}
              />
            )}

            {page === "about" && loading && (
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>Loading…</p>
            )}
            {page === "about" && !loading && !profile && (
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>Couldn't load profile — refresh the page.</p>
            )}
            {page === "about" && profile && (
              <div style={{ paddingBottom: 40 }}>
                <ProfileReadinessPanel
                  resumeUrl={profile.resumeUrl}
                  linkedinUrl={profile.linkedinUrl}
                  hasStrategy={profile.hasStrategy}
                  linkedInScore={profile.linkedInAnalysisScore}
                  strategyFileCount={strategyFileCount}
                  onNavigate={(tab) => setPage(tab)}
                  compact={isMobile}
                />
                {showReadback && (
                  <div style={{ marginBottom: isMobile ? 16 : 20 }}>
                    <ReadbackCard
                      data={readback}
                      loading={readbackLoading}
                      onRefresh={refreshReadback}
                      stack
                      embedded
                      candidateName={profile.name}
                      readbackUpdatedAt={profile.readbackUpdatedAt}
                      primaryResumeUpdatedAt={profile.primaryResumeUpdatedAt}
                    />
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {(isMobile ? ABOUT_SECTIONS : ABOUT_STACK_ORDER).map(renderAboutSection)}
                </div>
              </div>
            )}

            {page === "preferences" && !profile && !loading && (
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>Couldn't load profile — refresh the page.</p>
            )}
            {page === "preferences" && profile && (
              <div style={{ paddingBottom: 40, paddingTop: 8, display: "flex", flexDirection: "column", gap: 24 }}>
                {canAccessImport && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(
                      [
                        { id: "general" as const, label: "General" },
                        { id: "import" as const, label: "Import" },
                      ] as const
                    ).map(({ id, label }) => {
                      const active = id === "import" ? preferencesSection === "import" : preferencesSection !== "import";
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() =>
                            router.push(
                              profileTabPath(profileBase, "preferences", {
                                preferencesSection: id === "import" ? "import" : undefined,
                              }),
                            )
                          }
                          style={{
                            padding: "8px 14px",
                            minHeight: 44,
                            border: "var(--scout-border)",
                            background: active ? color.forest : surface.card,
                            color: active ? color.gold : color.muted,
                            fontFamily: fontSans,
                            fontSize: T.bodySm,
                            fontWeight: active ? 600 : 500,
                            cursor: "pointer",
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {preferencesSection === "import" && canAccessImport && clientId ? (
                  <ProfileImportPanel
                    clientUserId={clientId}
                    isMobile={isMobile}
                    onPatchProfile={async (patch) => {
                      await patchProfile(patch);
                      setProfile((p) => (p ? { ...p, ...patch } as UserProfile : p));
                    }}
                  />
                ) : (
                  <>
                    <CareerPreferencesPanel profile={profile} onSave={handleCareerPrefSave} />
                    <ApplicationQaPanel scopePath={api} />
                  </>
                )}
              </div>
            )}

            {page === "strategy" && !profile && !loading && (
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>Couldn't load profile — refresh the page.</p>
            )}
            {page === "strategy" && profile && (
              <div style={{ paddingBottom: 40, paddingTop: 8 }}>
                <CareerStrategyPanel
                  profile={profile}
                  isMobile={isMobile}
                  isAdmin={showAdminUi || !!clientId}
                  clientUserId={clientId}
                  onPatchProfile={async (patch) => {
                    await patchProfile(patch);
                    setProfile((p) => (p ? { ...p, ...patch } as UserProfile : p));
                  }}
                />
              </div>
            )}

            {page === "learning" && (
              <UpskillLearningTab
                progress={upskillProgress}
                setProgress={persistUpskillProgress}
                skillGoals={skillGoals}
                dreamList={dreamList}
                onGraduate={graduateSkill}
                onAddSkill={addSkillGoal}
                onDismissSkill={dismissSkillGoal}
                highlightSkill={highlightSkill}
                roleCorpusGaps={roleCorpusGaps}
                corpusGapsRefreshing={corpusGapsRefreshing}
                onRefreshCorpusGaps={() => void refreshCorpusGaps()}
                onGoToTargetRoles={() => setPage("dreamrole")}
              />
            )}

            {page === "assets" && !profile && !loading && (
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>Couldn't load profile — refresh the page.</p>
            )}
            {page === "assets" && profile && (
              <AssetsTab
                assets={assets}
                uploading={resumeUploading}
                onUpload={handleResumeUpload}
                onDelete={handleAssetDelete}
                onOpenResume={openResumeEditor}
                inputRef={resumeInputRef}
                suggestions={profileSuggestions}
                suggestionsLoading={suggestionsLoading}
                onOpenPricing={openPricing}
                onUploadDocument={handleDocumentUpload}
                documentUploading={documentUploading}
                targetRoles={targetRolesForResumes}
                onMakePrimary={handleMakePrimary}
                onUpdateTargetRole={handleUpdateTargetRole}
                canCreateFromProfile={canCreateFromProfile}
                onCreateFromProfile={handleCreateFromProfile}
                creatingFromProfile={creatingFromProfile}
              />
            )}

            {page === "linkedin" && (
              <ProfileLinkedInEditor isMobile={isMobile} coachView={showAdminUi || !!clientId} clientUserId={clientId} />
            )}

            {page === "discoveryscore" && profile && (
              <ProfileDiscoveryScorePanel
                profile={{
                  name: profile.name,
                  headline: profile.headline,
                  targetRoles: profile.targetRoles,
                  prioritizedCategories: profile.prioritizedCategories,
                  benchmarkCategoryOverride:
                    profile.parsedData && typeof profile.parsedData === "object"
                      ? ((profile.parsedData as Record<string, unknown>)[DISCOVERY_BENCHMARK_CATEGORY_KEY] as
                          | string
                          | null
                          | undefined) ?? null
                      : null,
                  avatarUrl: clientId ? profile.avatarUrl : user?.avatarUrl ?? profile.avatarUrl,
                }}
                isMobile={isMobile}
                withClientScope={withClientScope}
                onBenchmarkCategorySave={async (category) => {
                  const existingParsed = (profile.parsedData ?? {}) as Record<string, unknown>;
                  const nextParsed = { ...existingParsed };
                  if (category) nextParsed[DISCOVERY_BENCHMARK_CATEGORY_KEY] = category;
                  else delete nextParsed[DISCOVERY_BENCHMARK_CATEGORY_KEY];
                  await patchProfile({ parsedData: nextParsed });
                  setProfile((prev) =>
                    prev
                      ? {
                          ...prev,
                          parsedData: {
                            ...(prev.parsedData ?? {}),
                            ...nextParsed,
                          },
                        }
                      : prev,
                  );
                }}
              />
            )}
            {page === "discoveryscore" && !profile && !loading && (
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>Couldn&apos;t load profile — refresh the page.</p>
            )}
          </div>
        </div>
        </WorkspaceContent>
      </WorkspaceScroll>
      <ProfileResumeEditor
        open={!!editorAssetId}
        assetId={editorAssetId}
        onClose={closeResumeEditor}
        onUpdated={() => {
          refreshAssets();
          fetch(api("/api/profile"))
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
      {uploadFlow.showAnalyzingModal && (
        <ResumeAnalyzingModal
          isMobile={isMobile}
          onContinueBrowsing={uploadFlow.continueBrowsing}
          onCancel={() => void uploadFlow.cancelUpload()}
        />
      )}
      {uploadFlow.showSuccessModal && uploadFlow.job && (
        <ResumeUploadSuccessModal
          defaultName={uploadFlow.job.defaultName}
          saving={uploadFlow.savingMeta}
          isMobile={isMobile}
          targetRoles={targetRolesForResumes}
          onSave={(name, targetJobTitle) => void uploadFlow.finishSuccess(name, targetJobTitle)}
          onViewResume={() => {
            const assetId = uploadFlow.viewResume();
            if (assetId) openResumeEditor(assetId);
          }}
        />
      )}
    </div>
  );
}
