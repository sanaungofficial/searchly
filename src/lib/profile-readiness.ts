import { profileCompletenessPct, type ProfileCompletenessInput } from "@/lib/profile-completeness";
import type { ProfileSidebarTab } from "@/components/scout/profile-layout-sidebar";

export type ReadinessItem = {
  id: "resume" | "linkedin" | "strategy";
  label: string;
  ready: boolean;
  detail: string;
  tab: ProfileSidebarTab;
  score?: number;
};

export type ProfileTabGap = {
  tab: ProfileSidebarTab;
  label: string;
  missingPoints: number;
  topAction: string;
};

export function profileReadiness(input: {
  resumeUrl?: string | null;
  linkedinUrl?: string | null;
  hasStrategy?: boolean;
  linkedInScore?: number | null;
  strategyFileCount?: number;
}): { items: ReadinessItem[]; overallPct: number } {
  const resumeReady = Boolean(input.resumeUrl?.trim());
  const linkedInReady = Boolean(input.linkedinUrl?.trim()) && (input.linkedInScore ?? 0) >= 60;
  const strategyReady = Boolean(input.hasStrategy) || (input.strategyFileCount ?? 0) > 0;

  const items: ReadinessItem[] = [
    {
      id: "resume",
      label: "Resume",
      ready: resumeReady,
      detail: resumeReady ? "Primary resume on file" : "Upload a resume in Resumes",
      tab: "assets",
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      ready: linkedInReady,
      detail: input.linkedInScore != null
        ? `Quality score ${input.linkedInScore}%${input.linkedinUrl ? "" : " · add your URL"}`
        : input.linkedinUrl
          ? "Build or refresh your LinkedIn preview"
          : "Link LinkedIn and build your preview",
      tab: "linkedin",
      score: input.linkedInScore ?? undefined,
    },
    {
      id: "strategy",
      label: "Career strategy",
      ready: strategyReady,
      detail: strategyReady
        ? "Strategy doc or Kimchi-generated plan on file"
        : "Add a strategy doc or generate one",
      tab: "strategy",
    },
  ];

  const readyCount = items.filter((i) => i.ready).length;
  return { items, overallPct: Math.round((readyCount / items.length) * 100) };
}

export function profileTabGaps(p: ProfileCompletenessInput): ProfileTabGap[] {
  const gaps: ProfileTabGap[] = [];

  if (!p.resumeUrl) gaps.push({ tab: "assets", label: "Resumes", missingPoints: 2, topAction: "Upload resume" });
  if (!p.parsedData?.phone || !p.parsedData?.location || !p.linkedinUrl) {
    gaps.push({
      tab: "about",
      label: "About",
      missingPoints:
        (!p.parsedData?.phone ? 1 : 0) +
        (!p.parsedData?.location ? 1 : 0) +
        (!p.linkedinUrl ? 1 : 0),
      topAction: "Complete personal info",
    });
  }
  if (!(p.parsedData?.workExperience || []).length || !(p.parsedData?.skills || []).length) {
    gaps.push({
      tab: "about",
      label: "About",
      missingPoints:
        (!(p.parsedData?.workExperience || []).length ? 1 : 0) +
        (!(p.parsedData?.skills || []).length && !(p.parsedData?.tools || []).length ? 1 : 0),
      topAction: "Add experience or skills",
    });
  }
  if (!p.linkedinUrl) {
    gaps.push({ tab: "linkedin", label: "LinkedIn", missingPoints: 1, topAction: "Set up LinkedIn preview" });
  }
  if (!p.jobTimeline || !p.targetSalary || !(p.priorities || []).length) {
    gaps.push({
      tab: "preferences",
      label: "Preferences",
      missingPoints:
        (!p.jobTimeline ? 1 : 0) + (!p.targetSalary ? 1 : 0) + (!(p.priorities || []).length ? 1 : 0),
      topAction: "Set search preferences",
    });
  }

  const merged = new Map<ProfileSidebarTab, ProfileTabGap>();
  for (const gap of gaps) {
    const existing = merged.get(gap.tab);
    if (!existing || gap.missingPoints > existing.missingPoints) {
      merged.set(gap.tab, gap);
    } else if (existing) {
      merged.set(gap.tab, { ...existing, missingPoints: existing.missingPoints + gap.missingPoints });
    }
  }

  return [...merged.values()].sort((a, b) => b.missingPoints - a.missingPoints);
}

export function weakestProfileTab(p: ProfileCompletenessInput): ProfileTabGap | null {
  const gaps = profileTabGaps(p);
  return gaps[0] ?? null;
}

export function profileCompletenessWithWeakest(p: ProfileCompletenessInput) {
  return {
    pct: profileCompletenessPct(p),
    weakest: weakestProfileTab(p),
  };
}
