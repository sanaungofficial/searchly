/** JobRight-style parent groups for Hirebase flat `job_categories` values. */

export type JobFunctionGroup = {
  id: string;
  label: string;
  /** Match Hirebase category labels (case-insensitive substring). */
  patterns: RegExp[];
};

export const JOB_FUNCTION_GROUPS: JobFunctionGroup[] = [
  {
    id: "creative",
    label: "Creative & Arts",
    patterns: [/\barts\b/i, /creative/i, /entertainment/i, /performing/i, /fine art/i, /music/i, /film/i],
  },
  {
    id: "software",
    label: "Software / Internet / AI",
    patterns: [/engineering/i, /\bproduct\b/i, /\bdata\b/i, /design/i, /software/i, /internet/i, /\bai\b/i],
  },
  {
    id: "marketing",
    label: "Marketing",
    patterns: [/marketing/i, /communications/i, /content/i],
  },
  {
    id: "finance",
    label: "Finance & Accounting",
    patterns: [/finance/i, /accounting/i, /investment/i, /audit/i],
  },
  {
    id: "sales",
    label: "Sales & BD",
    patterns: [/sales/i, /business development/i, /\baccount executive\b/i, /\baccount manager\b/i],
  },
  {
    id: "operations",
    label: "Operations & PM",
    patterns: [/operations/i, /project management/i, /supply/i, /logistics/i],
  },
  {
    id: "people",
    label: "People & HR",
    patterns: [/human resources/i, /recruiting/i, /people/i],
  },
  {
    id: "customer",
    label: "Customer & Support",
    patterns: [/customer success/i, /customer support/i, /support/i],
  },
  {
    id: "consulting",
    label: "Consulting & Strategy",
    patterns: [/consulting/i, /strategy/i],
  },
  {
    id: "legal",
    label: "Legal & Compliance",
    patterns: [/legal/i, /compliance/i],
  },
  {
    id: "other",
    label: "Other",
    patterns: [],
  },
];

function groupForCategory(category: string): string {
  const trimmed = category.trim();
  if (!trimmed) return "other";
  for (const group of JOB_FUNCTION_GROUPS) {
    if (group.id === "other") continue;
    if (group.patterns.some((p) => p.test(trimmed))) return group.id;
  }
  return "other";
}

export type GroupedJobFunctions = {
  id: string;
  label: string;
  categories: string[];
};

/** Strip Hirebase " Jobs" suffix for display (Jobright title line). */
export function displayJobFunctionLabel(category: string): string {
  return category.trim().replace(/ Jobs$/i, "");
}

const TOP_LEVEL_JOB_FUNCTION_NAMES = new Set([
  "engineering",
  "product",
  "design",
  "data",
  "marketing",
  "sales",
  "finance",
  "accounting",
  "operations",
  "legal",
  "consulting",
  "customer success",
  "customer support",
  "support",
  "human resources",
  "recruiting",
  "content",
  "communications",
  "arts",
  "creative",
  "entertainment",
  "software",
  "project management",
  "security",
  "other",
]);

/** Jobright breadcrumb: parent group, or `Parent > Child` for specific roles. */
export function jobFunctionBreadcrumb(category: string, groupLabel: string): string {
  const display = displayJobFunctionLabel(category);
  if (TOP_LEVEL_JOB_FUNCTION_NAMES.has(display.toLowerCase())) {
    return groupLabel;
  }
  return `${groupLabel} > ${display}`;
}

export function groupLabelForJobFunction(
  category: string,
  groups: GroupedJobFunctions[],
): string | null {
  for (const g of groups) {
    if (g.categories.some((c) => c.toLowerCase() === category.trim().toLowerCase())) {
      return g.label;
    }
  }
  return null;
}

/** Assign Hirebase categories into display groups (stable sort). */
export function groupHirebaseJobCategories(categories: string[]): GroupedJobFunctions[] {
  const byGroup = new Map<string, string[]>();
  for (const group of JOB_FUNCTION_GROUPS) {
    byGroup.set(group.id, []);
  }

  const seen = new Set<string>();
  for (const raw of categories) {
    const cat = raw.trim();
    if (!cat) continue;
    const key = cat.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const gid = groupForCategory(cat);
    byGroup.get(gid)!.push(cat);
  }

  return JOB_FUNCTION_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    categories: (byGroup.get(g.id) ?? []).sort((a, b) => a.localeCompare(b)),
  })).filter((g) => g.categories.length > 0 || g.id === "other");
}
