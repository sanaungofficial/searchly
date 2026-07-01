import { ROLE_ARCHETYPES, UPSKILL_CATEGORIES, type UpskillItem } from "@/components/scout/workspace-data";
import { classifyMatchableKind, type MatchableKind } from "@/lib/skills-tools";

export type RoleCluster = "product" | "strategy" | "ops" | "finance" | "marketing" | "eng";

export interface UpskillCatalogEntry {
  id: string;
  title: string;
  provider: string;
  url: string;
  kind: MatchableKind;
  closesGap: string[];
  roleClusters: RoleCluster[];
  cost?: string;
  estHours?: number;
  kimchiPick: boolean;
  /** Legacy UPSKILL_CATEGORIES numeric id — preserves learning progress keys. */
  legacyNumericId?: number;
  duration?: string;
  credential?: string;
  why?: string;
}

/** Business-relevant tools from skills-tools KNOWN_TECHNOLOGIES, ordered for catalog coverage. */
const PRIORITY_TECHNOLOGIES = [
  "SQL",
  "Python",
  "Tableau",
  "Power BI",
  "Looker",
  "dbt",
  "Snowflake",
  "Excel",
  "Salesforce",
  "HubSpot",
  "Google Analytics",
  "Amplitude",
  "Mixpanel",
  "Figma",
  "Jira",
  "AWS",
  "JavaScript",
  "React",
  "Git",
  "Notion",
  "Stripe",
  "Segment",
  "Airflow",
  "Terraform",
  "Docker",
  "Kubernetes",
] as const;

const PROVIDER_SEARCH_URL: Record<string, (query: string) => string> = {
  Coursera: (q) => `https://www.coursera.org/search?query=${encodeURIComponent(q)}`,
  "LinkedIn Learning": (q) => `https://www.linkedin.com/learning/search?keywords=${encodeURIComponent(q)}`,
  Udemy: (q) => `https://www.udemy.com/courses/search/?q=${encodeURIComponent(q)}`,
  "Wall Street Prep": (q) => `https://www.wallstreetprep.com/?s=${encodeURIComponent(q)}`,
  Google: (q) => `https://grow.google/certificates/#?q=${encodeURIComponent(q)}`,
  Reforge: () => "https://www.reforge.com/",
  "Mode Analytics": (q) => `https://mode.com/sql-tutorial/?q=${encodeURIComponent(q)}`,
  "HBX Online": (q) => `https://online.hbs.edu/search/?q=${encodeURIComponent(q)}`,
  Prosci: () => "https://www.prosci.com/solutions/change-management-certification",
  "Pragmatic Institute": (q) => `https://www.pragmaticinstitute.com/?s=${encodeURIComponent(q)}`,
  Pluralsight: (q) => `https://www.pluralsight.com/search?q=${encodeURIComponent(q)}`,
  DataCamp: (q) => `https://www.datacamp.com/search?q=${encodeURIComponent(q)}`,
};

/** Known deep links keyed by normalized primary gap. */
const DEEP_LINK_OVERRIDES: Record<
  string,
  Pick<UpskillCatalogEntry, "title" | "provider" | "url" | "cost" | "estHours" | "credential" | "duration" | "why">
> = {
  "strategic analysis": {
    title: "Strategic Management & Planning",
    provider: "Coursera",
    url: "https://www.coursera.org/specializations/strategic-management-and-innovation",
    cost: "Subscription",
    estHours: 60,
    credential: "Certificate",
    duration: "8 weeks",
    why: "Competitive analysis and executive decision-making frameworks for strategy roles.",
  },
  "financial modeling": {
    title: "Financial Modeling & Valuation",
    provider: "Wall Street Prep",
    url: "https://www.wallstreetprep.com/knowledge/financial-modeling/",
    cost: "Paid",
    estHours: 60,
    credential: "Certificate",
    duration: "60 hours",
    why: "Industry-standard DCF, LBO, and M&A modeling for finance and corp dev tracks.",
  },
  "product strategy": {
    title: "Product Strategy",
    provider: "Reforge",
    url: "https://www.reforge.com/programs/product-strategy",
    cost: "Paid",
    estHours: 40,
    credential: "Certificate",
    duration: "6 weeks",
    why: "Bet-sizing and market strategy for senior PMs.",
  },
  "stakeholder management": {
    title: "Stakeholder Management & Influence",
    provider: "LinkedIn Learning",
    url: "https://www.linkedin.com/learning/paths/become-a-successful-project-manager",
    cost: "Subscription",
    estHours: 4,
    credential: "Badge",
    duration: "3h 45m",
    why: "Top competency gap in senior-level interviews across every role track.",
  },
  "okr frameworks": {
    title: "Project Management Certificate",
    provider: "Google",
    url: "https://grow.google/certificates/project-management/",
    cost: "Subscription",
    estHours: 240,
    credential: "Certificate",
    duration: "6 months",
    why: "OKR frameworks, planning, and stakeholder communication recognized by major employers.",
  },
  "process design": {
    title: "Lean Six Sigma Green Belt",
    provider: "Coursera",
    url: "https://www.coursera.org/specializations/six-sigma-green-belt",
    cost: "Subscription",
    estHours: 120,
    credential: "Certificate",
    duration: "4 months",
    why: "Process improvement certification with strong signal in Ops and transformation roles.",
  },
  "data analysis": {
    title: "Business Analytics",
    provider: "HBX Online",
    url: "https://online.hbs.edu/courses/business-analytics/",
    cost: "Paid",
    estHours: 50,
    credential: "Certificate",
    duration: "8 weeks",
    why: "Data analysis, regression, and decision modeling for non-technical managers.",
  },
  "change management": {
    title: "Change Management Certification",
    provider: "Prosci",
    url: "https://www.prosci.com/solutions/change-management-certification",
    cost: "Paid",
    estHours: 24,
    credential: "Certification",
    duration: "3 days",
    why: "ADKAR-based change management standard for enterprise transformation.",
  },
  sql: {
    title: "SQL for Analytics",
    provider: "Mode Analytics",
    url: "https://mode.com/sql-tutorial/",
    cost: "Free",
    estHours: 10,
    credential: "Badge",
    duration: "10 hours",
    why: "SQL fluency expected at Senior Manager+ in Strategy, Ops, and PM roles.",
  },
  "executive communication": {
    title: "Executive Communication & Presence",
    provider: "Coursera",
    url: "https://www.coursera.org/search?query=executive%20communication",
    cost: "Subscription",
    estHours: 20,
    credential: "Certificate",
    duration: "4 weeks",
    why: "Board-ready communication for Director+ promotion paths.",
  },
  "market research": {
    title: "Market & Competitive Intelligence",
    provider: "Pragmatic Institute",
    url: "https://www.pragmaticinstitute.com/product-management-certification/",
    cost: "Paid",
    estHours: 16,
    credential: "Badge",
    duration: "2 days",
    why: "Customer research, competitive positioning, and market sizing for strategy and BD.",
  },
  "team management": {
    title: "Managing Teams & Driving Results",
    provider: "LinkedIn Learning",
    url: "https://www.linkedin.com/learning/paths/become-a-manager",
    cost: "Subscription",
    estHours: 5,
    credential: "Badge",
    duration: "4h 20m",
    why: "Delegation, performance management, and leading through change for Director+ roles.",
  },
  "a/b testing": {
    title: "A/B Testing & Experimentation",
    provider: "Coursera",
    url: "https://www.coursera.org/search?query=ab%20testing%20experimentation",
    cost: "Subscription",
    estHours: 15,
    credential: "Certificate",
    duration: "3 weeks",
    why: "Experiment design and statistical rigor for growth and product roles.",
  },
  "gtm strategy": {
    title: "Go-to-Market Strategy",
    provider: "Reforge",
    url: "https://www.reforge.com/programs/go-to-market",
    cost: "Paid",
    estHours: 35,
    credential: "Certificate",
    duration: "5 weeks",
    why: "GTM planning and launch playbooks for product and growth leaders.",
  },
  "m&a diligence": {
    title: "M&A Modeling & Valuation",
    provider: "Wall Street Prep",
    url: "https://www.wallstreetprep.com/knowledge/merger-model/",
    cost: "Paid",
    estHours: 40,
    credential: "Certificate",
    duration: "40 hours",
    why: "Deal evaluation and merger modeling for corp dev and strategy.",
  },
  "business case development": {
    title: "Business Case Development",
    provider: "Coursera",
    url: "https://www.coursera.org/search?query=business%20case%20development",
    cost: "Subscription",
    estHours: 12,
    credential: "Certificate",
    duration: "2 weeks",
    why: "Structured business cases for strategy and FP&A stakeholder buy-in.",
  },
  "p&l ownership": {
    title: "P&L Management for Leaders",
    provider: "LinkedIn Learning",
    url: "https://www.linkedin.com/learning/search?keywords=profit%20and%20loss%20management",
    cost: "Subscription",
    estHours: 6,
    credential: "Badge",
    duration: "5 hours",
    why: "P&L literacy for VP+ and GM-track roles.",
  },
  "revenue operations": {
    title: "Revenue Operations Fundamentals",
    provider: "Coursera",
    url: "https://www.coursera.org/search?query=revenue%20operations",
    cost: "Subscription",
    estHours: 18,
    credential: "Certificate",
    duration: "4 weeks",
    why: "RevOps process design and cross-functional alignment for sales-led orgs.",
  },
  "operational excellence": {
    title: "Operational Excellence & Lean",
    provider: "Coursera",
    url: "https://www.coursera.org/search?query=operational%20excellence%20lean",
    cost: "Subscription",
    estHours: 25,
    credential: "Certificate",
    duration: "5 weeks",
    why: "Lean operations and continuous improvement for BizOps and GM roles.",
  },
  "cross-functional leadership": {
    title: "Leading Cross-Functional Teams",
    provider: "LinkedIn Learning",
    url: "https://www.linkedin.com/learning/search?keywords=cross%20functional%20leadership",
    cost: "Subscription",
    estHours: 4,
    credential: "Badge",
    duration: "3 hours",
    why: "Alignment and influence without direct authority — core for Chiefs of Staff and PMs.",
  },
  "roadmap planning": {
    title: "Product Roadmapping",
    provider: "Coursera",
    url: "https://www.coursera.org/search?query=product%20roadmap%20planning",
    cost: "Subscription",
    estHours: 10,
    credential: "Certificate",
    duration: "2 weeks",
    why: "Prioritization frameworks and roadmap communication for PM tracks.",
  },
  "user research": {
    title: "User Research for Product Teams",
    provider: "Coursera",
    url: "https://www.coursera.org/search?query=user%20research%20product",
    cost: "Subscription",
    estHours: 15,
    credential: "Certificate",
    duration: "3 weeks",
    why: "Qualitative and quantitative research methods for product discovery.",
  },
  "board communication": {
    title: "Board Communication for Executives",
    provider: "LinkedIn Learning",
    url: "https://www.linkedin.com/learning/search?keywords=board%20communication%20executive",
    cost: "Subscription",
    estHours: 3,
    credential: "Badge",
    duration: "2 hours",
    why: "Board prep and investor narrative for C-suite and VP roles.",
  },
  "budget management": {
    title: "Budgeting & Forecasting",
    provider: "Wall Street Prep",
    url: "https://www.wallstreetprep.com/knowledge/budgeting-and-forecasting/",
    cost: "Paid",
    estHours: 20,
    credential: "Certificate",
    duration: "20 hours",
    why: "Budget cycles and variance analysis for FP&A and GM roles.",
  },
  "crm management": {
    title: "Salesforce CRM Administration",
    provider: "Coursera",
    url: "https://www.coursera.org/search?query=salesforce%20crm",
    cost: "Subscription",
    estHours: 30,
    credential: "Certificate",
    duration: "6 weeks",
    why: "CRM architecture and pipeline hygiene for RevOps leaders.",
  },
  mentorship: {
    title: "Mentoring & Developing Others",
    provider: "LinkedIn Learning",
    url: "https://www.linkedin.com/learning/search?keywords=mentoring%20developing%20others",
    cost: "Subscription",
    estHours: 2,
    credential: "Badge",
    duration: "90 min",
    why: "Coaching and mentorship skills for Staff+ IC and Director tracks.",
  },
};

const GENERATED_PROVIDERS = [
  "Coursera",
  "LinkedIn Learning",
  "Udemy",
  "Pluralsight",
  "DataCamp",
] as const;

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function inferRoleClusters(roleTitle: string): RoleCluster[] {
  const r = roleTitle.toLowerCase();
  const clusters = new Set<RoleCluster>();
  if (/product|pm\b|cpo|platform product|ai product/.test(r)) clusters.add("product");
  if (/strategy|corporate development|corp dev|m&a|business development|chief strategy/.test(r)) {
    clusters.add("strategy");
  }
  if (/operations|bizops|chief of staff|revenue|transformation|general manager|gm\b/.test(r)) {
    clusters.add("ops");
  }
  if (/fp&a|finance|private equity|portfolio|pe\b|vc\b/.test(r)) clusters.add("finance");
  if (/growth|go-to-market|gtm|marketing/.test(r)) clusters.add("marketing");
  if (/technical|ai product|platform|engineering/.test(r)) clusters.add("eng");
  if (!clusters.size) clusters.add("ops");
  return [...clusters];
}

type GapStat = {
  skill: string;
  count: number;
  clusters: Set<RoleCluster>;
  kind: MatchableKind;
};

function collectArchetypeGapStats(): GapStat[] {
  const map = new Map<string, GapStat>();
  for (const [role, archetype] of Object.entries(ROLE_ARCHETYPES)) {
    const clusters = inferRoleClusters(role);
    for (const skill of archetype.requires) {
      const key = normalizeKey(skill);
      const kind = classifyMatchableKind(skill);
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        for (const c of clusters) existing.clusters.add(c);
        if (existing.kind === "skill" && kind === "technology") existing.kind = kind;
      } else {
        map.set(key, { skill, count: 1, clusters: new Set(clusters), kind });
      }
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill));
}

function providerForSkill(skill: string): (typeof GENERATED_PROVIDERS)[number] {
  let hash = 0;
  for (let i = 0; i < skill.length; i++) hash = (hash * 31 + skill.charCodeAt(i)) >>> 0;
  return GENERATED_PROVIDERS[hash % GENERATED_PROVIDERS.length]!;
}

function slugId(prefix: string, skill: string): string {
  return `${prefix}_${normalizeKey(skill).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
}

function entryFromUpskillItem(item: UpskillItem, gapStats: GapStat[]): UpskillCatalogEntry {
  const primaryGap = item.closesGap?.[0] ?? item.name;
  const override = DEEP_LINK_OVERRIDES[normalizeKey(primaryGap)];
  const provider = override?.provider ?? item.platform;
  const urlFn = PROVIDER_SEARCH_URL[provider];
  const url =
    override?.url ??
    (urlFn ? urlFn(primaryGap) : `https://www.google.com/search?q=${encodeURIComponent(item.name)}+${encodeURIComponent(provider)}`);

  const clusters = new Set<RoleCluster>();
  for (const gap of item.closesGap ?? []) {
    const stat = gapStats.find((s) => normalizeKey(s.skill) === normalizeKey(gap));
    if (stat) for (const c of stat.clusters) clusters.add(c);
  }
  if (!clusters.size) clusters.add("ops");

  return {
    id: String(item.id),
    legacyNumericId: item.id,
    title: override?.title ?? item.name,
    provider,
    url,
    kind: classifyMatchableKind(primaryGap),
    closesGap: item.closesGap ?? [primaryGap],
    roleClusters: [...clusters],
    cost: override?.cost ?? (item.platform === "Google" ? "Subscription" : item.scoutPick ? "Paid" : "Varies"),
    estHours: override?.estHours,
    kimchiPick: true,
    duration: override?.duration ?? item.duration,
    credential: override?.credential ?? item.credential,
    why: override?.why ?? item.why,
  };
}

function entryFromGapStat(stat: GapStat): UpskillCatalogEntry {
  const key = normalizeKey(stat.skill);
  const override = DEEP_LINK_OVERRIDES[key];
  const provider = override?.provider ?? providerForSkill(stat.skill);
  const urlFn = PROVIDER_SEARCH_URL[provider];
  const url =
    override?.url ??
    (urlFn
      ? urlFn(stat.skill)
      : `https://www.google.com/search?q=${encodeURIComponent(stat.skill)}+professional+training`);

  return {
    id: slugId("gap", stat.skill),
    title: override?.title ?? `${stat.skill} — ${provider}`,
    provider,
    url,
    kind: stat.kind,
    closesGap: [stat.skill],
    roleClusters: [...stat.clusters],
    cost: override?.cost ?? "Varies",
    estHours: override?.estHours,
    kimchiPick: true,
    duration: override?.duration,
    credential: override?.credential,
    why: override?.why,
  };
}

function entryFromTechnology(tech: string): UpskillCatalogEntry {
  const key = normalizeKey(tech);
  const override = DEEP_LINK_OVERRIDES[key];
  const provider =
    override?.provider ??
    (["SQL", "Python", "dbt", "Snowflake", "Tableau", "Power BI", "Looker"].includes(tech)
      ? "DataCamp"
      : ["JavaScript", "React", "AWS", "Git"].includes(tech)
        ? "Pluralsight"
        : providerForSkill(tech));
  const urlFn = PROVIDER_SEARCH_URL[provider];
  const url =
    override?.url ??
    (urlFn ? urlFn(tech) : `https://www.google.com/search?q=${encodeURIComponent(tech)}+course`);

  return {
    id: slugId("tech", tech),
    title: override?.title ?? `${tech} — ${provider}`,
    provider,
    url,
    kind: "technology",
    closesGap: [tech],
    roleClusters: tech === "Figma" ? ["product", "marketing"] : ["ops", "product"],
    cost: override?.cost ?? (provider === "DataCamp" ? "Subscription" : "Varies"),
    estHours: override?.estHours,
    kimchiPick: true,
    duration: override?.duration,
    credential: override?.credential ?? "Certificate",
    why: override?.why ?? `Hands-on ${tech} training for data-forward and product roles.`,
  };
}

/** Build ~50 catalog entries from UPSKILL_CATEGORIES seeds, archetype gap frequency, and priority tools. */
export function buildUpskillCatalog(targetSize = 50): UpskillCatalogEntry[] {
  const gapStats = collectArchetypeGapStats();
  const catalog: UpskillCatalogEntry[] = [];
  const coveredGaps = new Set<string>();

  for (const category of UPSKILL_CATEGORIES) {
    for (const item of category.items) {
      const entry = entryFromUpskillItem(item, gapStats);
      catalog.push(entry);
      for (const gap of entry.closesGap) coveredGaps.add(normalizeKey(gap));
    }
  }

  for (const stat of gapStats) {
    if (catalog.length >= targetSize) break;
    const key = normalizeKey(stat.skill);
    if (coveredGaps.has(key)) continue;
    if (stat.kind === "technology") continue;
    catalog.push(entryFromGapStat(stat));
    coveredGaps.add(key);
  }

  for (const tech of PRIORITY_TECHNOLOGIES) {
    if (catalog.length >= targetSize) break;
    const key = normalizeKey(tech);
    if (coveredGaps.has(key)) continue;
    catalog.push(entryFromTechnology(tech));
    coveredGaps.add(key);
  }

  return catalog.slice(0, targetSize);
}

export const UPSKILL_CATALOG: UpskillCatalogEntry[] = buildUpskillCatalog(50);

export function kimchiPickEntriesForSkills(skills: string[]): UpskillCatalogEntry[] {
  const normalized = skills.map(normalizeKey);
  return UPSKILL_CATALOG.filter(
    (entry) =>
      entry.kimchiPick &&
      entry.closesGap.some((gap) => {
        const g = normalizeKey(gap);
        return normalized.some((s) => s === g || s.includes(g) || g.includes(s));
      }),
  );
}
