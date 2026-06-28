import {
  COMPANY_CATALOG,
  getCatalogCompany,
  normalizeCompanySlug,
  ONBOARDING_COMPANY_PICKS,
  type CatalogCompany,
} from "@/lib/company-catalog";
import {
  mergeParsedWithReadback,
  normalizeParsedResumeData,
  type ParsedResumeData,
} from "@/lib/resume-parse";
import type { ReadbackPayload } from "@/lib/readback-display";

export type CompanyRecommendation = {
  catalogSlug: string;
  name: string;
  website: string | null;
  careersUrl: string | null;
  type: string | null;
  score: number;
  reasons: string[];
  aiBlurb?: string | null;
};

export type CompanyRecommendationsCache = {
  fingerprint: string;
  recommendations: CompanyRecommendation[];
  aiEnriched?: boolean;
};

export type RecommendationProfileSignals = {
  targetRoles: string[];
  prioritizedRoles: string[];
  parsedData: ParsedResumeData | null;
  readbackData: ReadbackPayload | null;
  watchlistSlugs: string[];
  pastEmployerSlugs: string[];
};

const MAX_RECOMMENDATIONS = 8;
const AI_BLURB_COUNT = 5;

/** Role / skill tokens → catalog industry types (partial match on company.type). */
const SIGNAL_TYPE_HINTS: { pattern: RegExp; types: string[]; label: string }[] = [
  {
    pattern: /\b(software|engineer|developer|swe|frontend|backend|full.?stack|platform|devops|sre|infrastructure)\b/i,
    types: ["Technology", "Developer Tools", "Developer Infrastructure", "Software", "Enterprise Software"],
    label: "tech & engineering",
  },
  {
    pattern: /\b(product manager|product lead|pm\b|product owner)\b/i,
    types: ["Technology", "E-commerce", "Enterprise Software", "Productivity", "Marketplace"],
    label: "product",
  },
  {
    pattern: /\b(data scientist|machine learning|ml engineer|ai engineer|analytics)\b/i,
    types: ["Data / AI", "Data / Cloud", "Technology", "Semiconductors"],
    label: "data & AI",
  },
  {
    pattern: /\b(designer|ux|ui|product design|creative)\b/i,
    types: ["Design Tools", "Technology", "Media / Technology", "Consumer / Retail"],
    label: "design",
  },
  {
    pattern: /\b(finance|financial analyst|investment|banking|trader|portfolio)\b/i,
    types: ["Fintech", "Financial Services", "Investment Banking", "Asset Management", "Payments"],
    label: "finance",
  },
  {
    pattern: /\b(consultant|consulting|strategy)\b/i,
    types: ["Consulting", "Consulting / Technology", "Professional Services", "Technology / Consulting"],
    label: "consulting",
  },
  {
    pattern: /\b(marketing|growth|brand|content|communications)\b/i,
    types: ["Marketing Software", "Media", "Media / Technology", "Consumer Goods", "E-commerce"],
    label: "marketing",
  },
  {
    pattern: /\b(sales|account executive|business development|partnerships)\b/i,
    types: ["Enterprise Software", "Technology", "Financial Services", "Consulting"],
    label: "sales & GTM",
  },
  {
    pattern: /\b(operations|supply chain|logistics|program manager)\b/i,
    types: ["Marketplace", "Retail", "Technology / Retail", "Mobility / Marketplace", "E-commerce"],
    label: "operations",
  },
  {
    pattern: /\b(healthcare|clinical|pharma|biotech|medical)\b/i,
    types: ["Healthcare", "Pharma", "Healthcare / Retail"],
    label: "healthcare",
  },
  {
    pattern: /\b(media|entertainment|video|streaming|journalism)\b/i,
    types: ["Media", "Media / Technology", "Media / Music", "Media / Entertainment"],
    label: "media",
  },
  {
    pattern: /\b(retail|merchandising|store|ecommerce|e-commerce)\b/i,
    types: ["Retail", "E-commerce", "Consumer / Retail", "Marketplace"],
    label: "retail & commerce",
  },
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

function normalizeEmployerSlug(name: string): string {
  return normalizeCompanySlug(name.replace(/\([^)]*\)/g, "").trim());
}

function companyMatchesSlug(company: CatalogCompany, slug: string): boolean {
  if (company.slug === slug) return true;
  const normalizedName = normalizeCompanySlug(company.name);
  return normalizedName === slug || company.name.toLowerCase() === slug.replace(/-/g, " ");
}

function typeMatchesHint(companyType: string | undefined, hintTypes: string[]): boolean {
  if (!companyType) return false;
  const lower = companyType.toLowerCase();
  return hintTypes.some((t) => lower.includes(t.toLowerCase()) || t.toLowerCase().includes(lower));
}

function collectSignalText(signals: RecommendationProfileSignals): string {
  const parts: string[] = [
    ...signals.targetRoles,
    ...signals.prioritizedRoles,
    ...(signals.parsedData?.skills ?? []),
    ...(signals.parsedData?.tools ?? []),
    ...(signals.readbackData?.strengths ?? []),
    ...(signals.readbackData?.targetRoles?.map((r) => r.role) ?? []),
  ];
  for (const entry of signals.parsedData?.workExperience ?? []) {
    parts.push(entry.title, entry.company);
    parts.push(...entry.bullets);
  }
  return parts.filter(Boolean).join(" ");
}

export function buildRecommendationFingerprint(signals: RecommendationProfileSignals): string {
  const payload = {
    targetRoles: [...signals.targetRoles].sort(),
    prioritizedRoles: [...signals.prioritizedRoles].sort(),
    skills: [...(signals.parsedData?.skills ?? [])].sort(),
    tools: [...(signals.parsedData?.tools ?? [])].sort(),
    readbackRoles: [...(signals.readbackData?.targetRoles?.map((r) => r.role) ?? [])].sort(),
    watchlist: [...signals.watchlistSlugs].sort(),
    employers: [...signals.pastEmployerSlugs].sort(),
  };
  return JSON.stringify(payload);
}

export function extractPastEmployerSlugs(parsedData: ParsedResumeData | null): string[] {
  if (!parsedData?.workExperience?.length) return [];
  const slugs = new Set<string>();
  for (const entry of parsedData.workExperience) {
    const slug = normalizeEmployerSlug(entry.company);
    if (slug) slugs.add(slug);
  }
  return [...slugs];
}

export function buildRecommendationSignals(input: {
  targetRoles?: string[] | null;
  prioritizedRoles?: string[] | null;
  parsedData?: unknown;
  readbackData?: unknown;
  watchlistSlugs?: string[];
}): RecommendationProfileSignals {
  const parsedData = mergeParsedWithReadback(
    normalizeParsedResumeData(input.parsedData ?? null),
    input.readbackData,
  );
  const readback =
    input.readbackData && typeof input.readbackData === "object"
      ? (input.readbackData as ReadbackPayload)
      : null;

  return {
    targetRoles: input.targetRoles ?? [],
    prioritizedRoles: input.prioritizedRoles ?? [],
    parsedData,
    readbackData: readback,
    watchlistSlugs: input.watchlistSlugs ?? [],
    pastEmployerSlugs: extractPastEmployerSlugs(parsedData),
  };
}

function scoreCompany(company: CatalogCompany, signals: RecommendationProfileSignals): CompanyRecommendation | null {
  const excludedSlugs = new Set([
    ...signals.watchlistSlugs,
    ...signals.pastEmployerSlugs,
  ]);
  if ([...excludedSlugs].some((slug) => companyMatchesSlug(company, slug))) {
    return null;
  }

  const signalText = collectSignalText(signals);
  const tokens = new Set(tokenize(signalText));
  let score = 0;
  const reasons: string[] = [];

  for (const role of signals.prioritizedRoles) {
    const roleLower = role.toLowerCase();
    if (company.type?.toLowerCase().includes(roleLower) || company.name.toLowerCase().includes(roleLower)) {
      score += 12;
      reasons.push(`Top priority role: ${role}`);
    }
  }

  for (const role of signals.targetRoles) {
    const roleLower = role.toLowerCase();
    for (const hint of SIGNAL_TYPE_HINTS) {
      if (hint.pattern.test(role) && typeMatchesHint(company.type, hint.types)) {
        score += 10;
        if (!reasons.some((r) => r.includes(role))) {
          reasons.push(`Fits your target role: ${role}`);
        }
        break;
      }
    }
    if (company.name.toLowerCase().includes(roleLower) || company.slug.includes(normalizeCompanySlug(role))) {
      score += 6;
    }
  }

  for (const hint of SIGNAL_TYPE_HINTS) {
    if (hint.pattern.test(signalText) && typeMatchesHint(company.type, hint.types)) {
      score += 8;
      if (!reasons.some((r) => r.toLowerCase().includes(hint.label))) {
        reasons.push(`Strong ${hint.label} fit`);
      }
    }
  }

  if (company.type) {
    const typeTokens = tokenize(company.type);
    for (const token of typeTokens) {
      if (tokens.has(token)) score += 4;
    }
  }

  for (const skill of [...(signals.parsedData?.skills ?? []), ...(signals.parsedData?.tools ?? [])]) {
    const skillLower = skill.toLowerCase();
    if (company.name.toLowerCase().includes(skillLower) || company.slug.includes(normalizeCompanySlug(skill))) {
      score += 3;
    }
  }

  if (signals.readbackData?.targetRoles?.length) {
    for (const { role, fit } of signals.readbackData.targetRoles) {
      for (const hint of SIGNAL_TYPE_HINTS) {
        if (hint.pattern.test(role) && typeMatchesHint(company.type, hint.types)) {
          score += fit?.toLowerCase().includes("strong") ? 7 : 4;
          if (!reasons.some((r) => r.includes(role))) {
            reasons.push(`Aligns with suggested role: ${role}`);
          }
          break;
        }
      }
    }
  }

  if (score <= 0) return null;

  const trimmedReasons = reasons.slice(0, 2);
  if (!trimmedReasons.length && company.type) {
    trimmedReasons.push(`${company.type} — matches your profile signals`);
  }

  return {
    catalogSlug: company.slug,
    name: company.name,
    website: company.website ?? null,
    careersUrl: company.careersUrl ?? null,
    type: company.type ?? null,
    score,
    reasons: trimmedReasons,
  };
}

export function hasRecommendationSignals(signals: RecommendationProfileSignals): boolean {
  return (
    signals.targetRoles.length > 0 ||
    signals.prioritizedRoles.length > 0 ||
    (signals.parsedData?.skills.length ?? 0) > 0 ||
    (signals.parsedData?.tools.length ?? 0) > 0 ||
    (signals.parsedData?.workExperience.length ?? 0) > 0 ||
    (signals.readbackData?.targetRoles?.length ?? 0) > 0
  );
}

function buildPopularRecommendations(signals: RecommendationProfileSignals): CompanyRecommendation[] {
  const excludedSlugs = new Set([...signals.watchlistSlugs, ...signals.pastEmployerSlugs]);
  const picks = ONBOARDING_COMPANY_PICKS.filter(
    (c) => ![...excludedSlugs].some((slug) => companyMatchesSlug(c, slug)),
  );
  const catalogFallback = COMPANY_CATALOG.filter(
    (c) =>
      !picks.some((p) => p.slug === c.slug) &&
      ![...excludedSlugs].some((slug) => companyMatchesSlug(c, slug)),
  );
  return [...picks, ...catalogFallback]
    .slice(0, MAX_RECOMMENDATIONS)
    .map((c) => ({
      catalogSlug: c.slug,
      name: c.name,
      website: c.website ?? null,
      careersUrl: c.careersUrl ?? null,
      type: c.type ?? null,
      score: 1,
      reasons: ["Popular dream company"],
    }));
}

export function computeCompanyRecommendations(
  signals: RecommendationProfileSignals,
): CompanyRecommendation[] {
  if (!hasRecommendationSignals(signals)) {
    return buildPopularRecommendations(signals);
  }

  const scored = COMPANY_CATALOG.map((company) => scoreCompany(company, signals)).filter(
    (row): row is CompanyRecommendation => row !== null,
  );

  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  if (scored.length === 0) {
    return buildPopularRecommendations(signals);
  }

  return scored.slice(0, MAX_RECOMMENDATIONS);
}

export function mergeAiBlurbs(
  recommendations: CompanyRecommendation[],
  blurbs: Record<string, string>,
): CompanyRecommendation[] {
  return recommendations.map((rec) => ({
    ...rec,
    aiBlurb: blurbs[rec.catalogSlug]?.trim() || rec.aiBlurb || null,
  }));
}

export function recommendationsForAiBlurbs(
  recommendations: CompanyRecommendation[],
): CompanyRecommendation[] {
  return recommendations.slice(0, AI_BLURB_COUNT);
}

export function catalogCompanyFromRecommendation(rec: CompanyRecommendation): CatalogCompany | undefined {
  return getCatalogCompany(rec.catalogSlug);
}
