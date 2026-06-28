export type DiscoveryScoreBreakdown = {
  resumeStrength: number;
  positioningClarity: number;
  marketReadiness: number;
  competitiveSignals: number;
};

export type DiscoveryBreakdownDimensionId = keyof DiscoveryScoreBreakdown;

export type DiscoveryBreakdownDimension = {
  id: DiscoveryBreakdownDimensionId;
  label: string;
  shortLabel: string;
  max: number;
  description: string;
};

/** Dimension metadata for hover breakdowns and foundation metric tooltips. */
export const DISCOVERY_BREAKDOWN_DIMENSIONS: DiscoveryBreakdownDimension[] = [
  {
    id: "resumeStrength",
    label: "Resume strength",
    shortLabel: "Resume",
    max: 25,
    description: "Quantified impact, clear progression, and relevant experience for your target roles.",
  },
  {
    id: "positioningClarity",
    label: "Positioning clarity",
    shortLabel: "Positioning",
    max: 25,
    description: "Target roles, skills, headline, and experience tell a coherent story.",
  },
  {
    id: "marketReadiness",
    label: "Market readiness",
    shortLabel: "Market fit",
    max: 25,
    description: "Salary expectations, location preference, employment status, and role demand.",
  },
  {
    id: "competitiveSignals",
    label: "Competitive signals",
    shortLabel: "Signals",
    max: 25,
    description: "LinkedIn presence, headline quality, and recruiter-visible differentiators.",
  },
];

export function discoveryDimensionById(id: DiscoveryBreakdownDimensionId): DiscoveryBreakdownDimension {
  return DISCOVERY_BREAKDOWN_DIMENSIONS.find((d) => d.id === id)!;
}

export function discoveryBreakdownRows(breakdown: DiscoveryScoreBreakdown) {
  return DISCOVERY_BREAKDOWN_DIMENSIONS.map((dim) => ({
    ...dim,
    value: breakdown[dim.id],
  }));
}

export type DiscoveryScoreResult = {
  score: number;
  breakdown: DiscoveryScoreBreakdown;
  tier: "low" | "building" | "strong" | "top";
  summary: string;
  topImprovement: string;
};

export type DiscoveryScoreInput = {
  name: string;
  headline: string | null;
  targetRoles: string[];
  resumeUrl: string | null;
  linkedinUrl: string | null;
  experience: unknown[] | null;
  skills: string[] | null;
  targetSalary: string | null;
  location: string | null;
  employmentStatus: string | null;
  summary: string | null;
};

export function tierFromScore(score: number): DiscoveryScoreResult["tier"] {
  if (score >= 80) return "top";
  if (score >= 55) return "strong";
  if (score >= 25) return "building";
  return "low";
}

export function tierLabel(tier: DiscoveryScoreResult["tier"]): string {
  switch (tier) {
    case "top": return "Top 5%";
    case "strong": return "Strong";
    case "building": return "Building";
    case "low": return "Getting started";
  }
}

export function tierPeerCopy(tier: DiscoveryScoreResult["tier"], targetRole?: string | null): string {
  const role = targetRole?.trim() || "your field";
  switch (tier) {
    case "top":
      return `Top 5% of professionals targeting ${role}`;
    case "strong":
      return `Top 25% of professionals targeting ${role}`;
    case "building":
      return `Building among peers targeting ${role}`;
    case "low":
      return `Getting started — room to grow in ${role}`;
  }
}

export function buildDiscoveryPrompt(input: DiscoveryScoreInput): string {
  const roles = input.targetRoles.length > 0
    ? input.targetRoles.join(", ")
    : "not specified";

  return [
    "Name: " + input.name,
    "Headline: " + (input.headline || "none"),
    "Target roles: " + roles,
    "Resume uploaded: " + (input.resumeUrl ? "yes" : "no"),
    "LinkedIn: " + (input.linkedinUrl ? "connected" : "not connected"),
    "Experience entries: " + (Array.isArray(input.experience) ? input.experience.length : 0),
    "Skills: " + (input.skills?.length ? input.skills.join(", ") : "none listed"),
    "Target salary: " + (input.targetSalary || "not set"),
    "Location: " + (input.location || "not set"),
    "Employment status: " + (input.employmentStatus || "not set"),
    "Summary: " + (input.summary ? input.summary.slice(0, 300) : "none"),
  ].join("\n");
}

export const DISCOVERY_SCORE_SYSTEM = "You are a career profile evaluator. You assess how well a job seeker's profile would rank against other professionals targeting similar roles.\n\nScore the profile on 4 dimensions (each 0-25, total 0-100):\n\n1. resumeStrength (0-25): Is there a resume? Does the profile show quantified impact, clear progression, and relevant experience for their target roles?\n2. positioningClarity (0-25): Do the target roles, experience, skills, and headline tell a coherent story? Or is the profile scattered and unfocused?\n3. marketReadiness (0-25): Is the salary expectation realistic? Is the location/remote preference stated? Are they targeting roles that are in demand? Is their employment status clear?\n4. competitiveSignals (0-25): LinkedIn connected? Headline quality? Would this profile stand out to a recruiter compared to others with similar backgrounds?\n\nBe realistic and calibrated:\n- A blank profile with just a name = 5-10 total\n- Profile with resume + target roles but missing details = 25-40\n- Complete profile with clear positioning = 50-70\n- Outstanding profile that would rank in top 10% = 75-90\n- Near-perfect, recruiter-magnet profile = 90-100\n\nRespond ONLY with valid JSON, no markdown:\n{\"resumeStrength\":N,\"positioningClarity\":N,\"marketReadiness\":N,\"competitiveSignals\":N,\"summary\":\"1-2 sentences about their competitive position\",\"topImprovement\":\"single most impactful thing they should do next\"}";

export function parseDiscoveryResponse(text: string): DiscoveryScoreResult | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);

    const breakdown: DiscoveryScoreBreakdown = {
      resumeStrength: clamp(parsed.resumeStrength ?? 0, 0, 25),
      positioningClarity: clamp(parsed.positioningClarity ?? 0, 0, 25),
      marketReadiness: clamp(parsed.marketReadiness ?? 0, 0, 25),
      competitiveSignals: clamp(parsed.competitiveSignals ?? 0, 0, 25),
    };

    const score = breakdown.resumeStrength
      + breakdown.positioningClarity
      + breakdown.marketReadiness
      + breakdown.competitiveSignals;

    return {
      score,
      breakdown,
      tier: tierFromScore(score),
      summary: parsed.summary ?? "",
      topImprovement: parsed.topImprovement ?? "",
    };
  } catch {
    return null;
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}
