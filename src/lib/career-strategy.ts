/** Career Strategy document stored in Profile.strategyData (editable narrative sections). */

export type ReadinessScore = "Strong" | "Moderate" | "At Risk" | "High Risk" | "Good";

export interface CareerStrategyDocument {
  executiveSummary: string;
  placementReadiness: {
    categories: Array<{ category: string; score: ReadinessScore; assessment: string }>;
    overallReadiness: string;
    overallAssessment: string;
  };
  positioningStrategy: {
    coreDirective: string;
    positioningStatement: string;
    angles: Array<{ title: string; description: string; whenToUse: string }>;
  };
  targetRolesStrategy: {
    intro: string;
    tiers: Array<{
      tier: string;
      allocationPercent?: number;
      roles: Array<{ title: string; typicalEmployer?: string; whyItFits: string }>;
    }>;
  };
  searchExecutionStrategy: {
    intro: string;
    channelMix: Array<{
      channel: string;
      effortPercent: number;
      weeklyTarget: string;
      keyActions: string;
    }>;
    addressingSearchGap?: { title: string; narrative: string; tips: string[] };
    networkingStrategy?: { intro: string; assets: Array<{ asset: string; approach: string }> };
  };
  actionPlan: {
    phases: Array<{ label: string; items: string[] }>;
  };
  competitiveDifferentiators: Array<{ differentiator: string; howToArticulate: string }>;
  salaryMarketContext?: {
    intro: string;
    benchmarks: Array<{ roleType: string; range: string; notes?: string }>;
  };
  risksAndMitigations: Array<{ risk: string; impact: string; mitigation: string }>;
  pathForward: {
    summary: string;
    keyChanges: string[];
    closing: string;
  };
}

export const EMPTY_STRATEGY: CareerStrategyDocument = {
  executiveSummary: "",
  placementReadiness: {
    categories: [],
    overallReadiness: "",
    overallAssessment: "",
  },
  positioningStrategy: {
    coreDirective: "",
    positioningStatement: "",
    angles: [],
  },
  targetRolesStrategy: { intro: "", tiers: [] },
  searchExecutionStrategy: { intro: "", channelMix: [] },
  actionPlan: { phases: [] },
  competitiveDifferentiators: [],
  risksAndMitigations: [],
  pathForward: { summary: "", keyChanges: [], closing: "" },
};

export type StrategySourceSnapshot = {
  capturedAt: string;
  targetRoles: string[];
  targetSalary: string | null;
  currentSalary: string | null;
  employmentStatus: string | null;
  jobTimeline: string | null;
  careerMotivation: string | null;
  priorities: string[];
  targetMarket: string | null;
  relocationOpenness: string | null;
  workAuthorization: string | null;
  securityClearance: string | null;
  searchDuration: string | null;
  positioningStatement: string | null;
  headline: string | null;
  summary: string | null;
  resumeUpdatedAt: string | null;
  readbackUpdatedAt: string | null;
  intakeNotesHash: string | null;
  trackedCompanyNames: string[];
  /** Set when AI output was truncated but salvaged for review */
  isPartialGeneration?: boolean;
};

export type StrategyProfileFields = {
  targetRoles?: string[];
  targetSalary?: string | null;
  currentSalary?: string | null;
  employmentStatus?: string | null;
  jobTimeline?: string | null;
  careerMotivation?: string | null;
  priorities?: string[];
  targetMarket?: string | null;
  relocationOpenness?: string | null;
  workAuthorization?: string | null;
  securityClearance?: string | null;
  searchDuration?: string | null;
  positioningStatement?: string | null;
  headline?: string | null;
  summary?: string | null;
  name?: string | null;
};

export type IntakeParseResult = {
  proposed: StrategyProfileFields;
  summary: string;
  fieldsFound: string[];
};

const SNAPSHOT_LABELS: Record<keyof Omit<StrategySourceSnapshot, "capturedAt" | "trackedCompanyNames" | "intakeNotesHash">, string> = {
  targetRoles: "Target roles",
  targetSalary: "Target salary",
  currentSalary: "Current salary",
  employmentStatus: "Employment status",
  jobTimeline: "Job timeline",
  careerMotivation: "Career motivation",
  priorities: "Job priorities",
  targetMarket: "Target market",
  relocationOpenness: "Relocation",
  workAuthorization: "Work authorization",
  securityClearance: "Security clearance",
  searchDuration: "Search duration",
  positioningStatement: "Positioning statement",
  headline: "Headline",
  summary: "Professional summary",
  resumeUpdatedAt: "Resume",
  readbackUpdatedAt: "Profile readback",
};

function simpleHash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return String(h);
}

export function buildStrategySnapshot(input: {
  profile: {
    targetRoles: string[];
    targetSalary: string | null;
    currentSalary: string | null;
    employmentStatus: string | null;
    jobTimeline: string | null;
    careerMotivation: string | null;
    priorities: string[];
    targetMarket: string | null;
    relocationOpenness: string | null;
    workAuthorization: string | null;
    securityClearance: string | null;
    searchDuration: string | null;
    positioningStatement: string | null;
    headline: string | null;
    summary: string | null;
    updatedAt?: Date | null;
    readbackUpdatedAt?: Date | null;
    strategyIntakeNotes?: string | null;
  };
  trackedCompanyNames: string[];
}): StrategySourceSnapshot {
  return {
    capturedAt: new Date().toISOString(),
    targetRoles: [...input.profile.targetRoles],
    targetSalary: input.profile.targetSalary,
    currentSalary: input.profile.currentSalary,
    employmentStatus: input.profile.employmentStatus,
    jobTimeline: input.profile.jobTimeline,
    careerMotivation: input.profile.careerMotivation,
    priorities: [...input.profile.priorities],
    targetMarket: input.profile.targetMarket,
    relocationOpenness: input.profile.relocationOpenness,
    workAuthorization: input.profile.workAuthorization,
    securityClearance: input.profile.securityClearance,
    searchDuration: input.profile.searchDuration,
    positioningStatement: input.profile.positioningStatement,
    headline: input.profile.headline,
    summary: input.profile.summary,
    resumeUpdatedAt: input.profile.updatedAt?.toISOString() ?? null,
    readbackUpdatedAt: input.profile.readbackUpdatedAt?.toISOString() ?? null,
    intakeNotesHash: input.profile.strategyIntakeNotes
      ? simpleHash(input.profile.strategyIntakeNotes)
      : null,
    trackedCompanyNames: [...input.trackedCompanyNames].sort(),
  };
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export function diffStrategySnapshot(
  snapshot: StrategySourceSnapshot | null | undefined,
  current: StrategySourceSnapshot,
): string[] {
  if (!snapshot) return [];
  const changes: string[] = [];

  for (const key of Object.keys(SNAPSHOT_LABELS) as (keyof typeof SNAPSHOT_LABELS)[]) {
    const prev = snapshot[key];
    const next = current[key];
    if (key === "targetRoles" || key === "priorities") {
      if (!arraysEqual((prev as string[]) ?? [], (next as string[]) ?? [])) {
        changes.push(SNAPSHOT_LABELS[key]);
      }
    } else if (prev !== next) {
      changes.push(SNAPSHOT_LABELS[key]);
    }
  }

  if (!arraysEqual(snapshot.trackedCompanyNames ?? [], current.trackedCompanyNames ?? [])) {
    changes.push("Target companies watchlist");
  }

  const prevIntake = snapshot.intakeNotesHash;
  const nextIntake = current.intakeNotesHash;
  if (prevIntake !== nextIntake) {
    changes.push("Intake notes");
  }

  return changes;
}

/** Pull the outermost JSON object from model text (handles fences and preamble). */
export function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();

  const start = candidate.indexOf("{");
  if (start === -1) throw new Error("No JSON found");

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < candidate.length; i++) {
    const c = candidate[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\" && inString) {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  throw new Error("Incomplete JSON");
}

function scanUnclosedJsonStructure(jsonFragment: string): ("{" | "[")[] {
  const stack: ("{" | "[")[] = [];
  let inString = false;
  let escape = false;
  for (let i = 0; i < jsonFragment.length; i++) {
    const c = jsonFragment[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\" && inString) {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === "{") stack.push("{");
    else if (c === "[") stack.push("[");
    else if (c === "}" && stack[stack.length - 1] === "{") stack.pop();
    else if (c === "]" && stack[stack.length - 1] === "[") stack.pop();
  }
  return stack;
}

function endsInsideJsonString(text: string): boolean {
  let inString = false;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\" && inString) {
      escape = true;
      continue;
    }
    if (c === '"') inString = !inString;
  }
  return inString;
}

function strategyHasContent(doc: CareerStrategyDocument): boolean {
  return !!(
    doc.executiveSummary.trim() ||
    doc.positioningStrategy.coreDirective.trim() ||
    doc.placementReadiness.categories.length ||
    doc.pathForward.summary.trim()
  );
}

/** Best-effort parse when model output was truncated mid-JSON. */
export function salvagePartialStrategyJson(text: string): CareerStrategyDocument | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let candidate = (fenced?.[1] ?? trimmed).trim();
  const start = candidate.indexOf("{");
  if (start === -1) return null;
  candidate = candidate.slice(start);

  if (endsInsideJsonString(candidate)) candidate += '"';

  const unclosed = scanUnclosedJsonStructure(candidate);
  for (let i = unclosed.length - 1; i >= 0; i--) {
    candidate += unclosed[i] === "{" ? "}" : "]";
  }

  try {
    const doc = normalizeStrategyDocument(JSON.parse(candidate));
    return strategyHasContent(doc) ? doc : null;
  } catch {
    return null;
  }
}

export function parseStrategyFromAi(text: string): { document: CareerStrategyDocument; isPartial: boolean } {
  try {
    return { document: parseStrategyJson(text), isPartial: false };
  } catch {
    const salvaged = salvagePartialStrategyJson(text);
    if (salvaged) return { document: salvaged, isPartial: true };
    throw new Error("Failed to parse strategy response");
  }
}

export function normalizeStrategyDocument(raw: unknown): CareerStrategyDocument {
  if (!raw || typeof raw !== "object") return { ...EMPTY_STRATEGY };
  const d = raw as Partial<CareerStrategyDocument>;
  return {
    executiveSummary: d.executiveSummary ?? "",
    placementReadiness: {
      categories: d.placementReadiness?.categories ?? [],
      overallReadiness: d.placementReadiness?.overallReadiness ?? "",
      overallAssessment: d.placementReadiness?.overallAssessment ?? "",
    },
    positioningStrategy: {
      coreDirective: d.positioningStrategy?.coreDirective ?? "",
      positioningStatement: d.positioningStrategy?.positioningStatement ?? "",
      angles: d.positioningStrategy?.angles ?? [],
    },
    targetRolesStrategy: {
      intro: d.targetRolesStrategy?.intro ?? "",
      tiers: d.targetRolesStrategy?.tiers ?? [],
    },
    searchExecutionStrategy: {
      intro: d.searchExecutionStrategy?.intro ?? "",
      channelMix: d.searchExecutionStrategy?.channelMix ?? [],
      addressingSearchGap: d.searchExecutionStrategy?.addressingSearchGap,
      networkingStrategy: d.searchExecutionStrategy?.networkingStrategy,
    },
    actionPlan: { phases: d.actionPlan?.phases ?? [] },
    competitiveDifferentiators: d.competitiveDifferentiators ?? [],
    salaryMarketContext: d.salaryMarketContext,
    risksAndMitigations: d.risksAndMitigations ?? [],
    pathForward: {
      summary: d.pathForward?.summary ?? "",
      keyChanges: d.pathForward?.keyChanges ?? [],
      closing: d.pathForward?.closing ?? "",
    },
  };
}

export function parseStrategyJson(text: string): CareerStrategyDocument {
  return normalizeStrategyDocument(JSON.parse(extractJsonObject(text)));
}

export function parseIntakeJson(text: string): IntakeParseResult {
  const parsed = JSON.parse(extractJsonObject(text)) as IntakeParseResult;
  return {
    proposed: parsed.proposed ?? {},
    summary: parsed.summary ?? "",
    fieldsFound: parsed.fieldsFound ?? [],
  };
}
