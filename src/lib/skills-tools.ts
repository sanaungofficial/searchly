export const SKILLS_GROUP_LABEL = "Skills";
export const TOOLS_GROUP_LABEL = "Tools & tech stack";

export type SkillGroupLike = {
  id: string;
  label: string;
  skills: string[];
};

export type SkillsToolsBuckets = {
  skills: string[];
  tools: string[];
};

export type MatchableKind = "skill" | "technology";

const KNOWN_TECHNOLOGIES = new Set(
  [
    "sql", "python", "javascript", "typescript", "java", "go", "golang", "rust", "c++", "c#", "ruby", "php",
    "swift", "kotlin", "scala", "r", "matlab", "excel", "tableau", "power bi", "looker", "dbt", "snowflake",
    "bigquery", "redshift", "postgres", "postgresql", "mysql", "mongodb", "redis", "dynamodb", "aws", "gcp",
    "azure", "kubernetes", "docker", "terraform", "ansible", "jenkins", "react", "vue", "angular", "next.js",
    "nextjs", "node.js", "nodejs", "django", "flask", "fastapi", "spring boot", "spring", "graphql", "html",
    "css", "sass", "tailwind", "figma", "sketch", "jira", "confluence", "salesforce", "hubspot", "marketo",
    "google analytics", "ga4", "amplitude", "mixpanel", "segment", "airflow", "spark", "kafka", "linux",
    "bash", "git", "github", "gitlab", "sap", "oracle", "workday", "servicenow", "notion", "slack", "asana",
    "trello", "airtable", "zapier", "shopify", "stripe", "vercel", "netlify", "firebase", "supabase", "prisma",
    "elasticsearch", "splunk", "datadog", "grafana", "postman", "selenium", "cypress", "playwright", "jest",
    "pytest", "webpack", "vite", "pandas", "numpy", "tensorflow", "pytorch", "databricks", "alteryx", "qlik",
    "retool", "wordpress", "cms", "crm", "erp", "etl", "lambda", "s3", "oauth", "okta", "auth0", "miro",
    "lucidchart", "photoshop", "illustrator", "after effects", "premiere pro", "autocad", "revit", "unity",
    "unreal engine", "vscode", "visual studio code", "intellij", "pycharm", "xcode", "android studio",
  ].map((s) => s.toLowerCase()),
);

const SOFT_SKILL_RE =
  /\b(management|leadership|communication|collaboration|negotiation|strategy|planning|analysis|research|writing|presentation|mentoring|coaching|problem[\s-]?solving|decision[\s-]?making|stakeholder|cross[\s-]?functional|organizational|interpersonal|creative|critical thinking|time management|project management|people management|team building|conflict resolution|emotional intelligence|public speaking|customer service|relationship building|business development|operating model|go[\s-]?to[\s-]?market|product strategy|market research|competitive analysis|financial modeling|budgeting|forecasting|vendor management|change management|process improvement|continuous improvement|quality assurance|risk management|compliance|governance|policy|regulatory|due diligence|partnership|alliance|fundraising|investor relations|talent acquisition|recruiting|hiring|onboarding|training|facilitation|workshop|facilitation|facilitation skills)\b/i;

const TECHNOLOGY_TOKEN_RE =
  /^[a-z][a-z0-9+#.-]*(?:\.(?:js|ts|py|go|rb|net|io|ai|ml|db|sql|css|html))?$/i;

export function classifyMatchableKind(term: string): MatchableKind {
  const trimmed = term.trim();
  if (!trimmed) return "skill";

  const lower = trimmed.toLowerCase();
  if (KNOWN_TECHNOLOGIES.has(lower)) return "technology";

  if (SOFT_SKILL_RE.test(trimmed)) return "skill";

  if (/^[A-Z0-9+#.]{2,10}$/.test(trimmed) && !/^(CEO|CFO|COO|CTO|CPO|CMO|VP|SVP|EVP|PM|PO|BA|QA|HR|IT|UX|UI|AI|ML|BI|DB|API|SDK|SaaS|PaaS|IaaS)$/.test(trimmed)) {
    return "technology";
  }

  if (/\d+\.\d+/.test(trimmed)) return "technology";
  if (/\.(?:js|ts|py|go|rb|net|io|ai|ml|css|html|sql|db)$/i.test(trimmed)) return "technology";
  if (/^(?:c\+\+|c#|f#|\.net|node\.js|vue\.js|react\.js|next\.js|express\.js)$/i.test(trimmed)) return "technology";

  const words = trimmed.split(/\s+/);
  if (words.length >= 3 && !TECHNOLOGY_TOKEN_RE.test(words[0] ?? "")) return "skill";

  if (words.length === 1 && TECHNOLOGY_TOKEN_RE.test(trimmed) && trimmed.length <= 20) {
    return "technology";
  }

  if (/\b(?:software|platform|tool|framework|library|database|language|cloud|stack|system|suite|application|app|sdk|api|saas|paas|iaas)\b/i.test(trimmed)) {
    return "technology";
  }

  return "skill";
}

export function splitMatchablesByKind(terms: string[]): SkillsToolsBuckets {
  const skills: string[] = [];
  const tools: string[] = [];
  for (const term of terms) {
    const trimmed = term.trim();
    if (!trimmed) continue;
    if (classifyMatchableKind(trimmed) === "technology") tools.push(trimmed);
    else skills.push(trimmed);
  }
  return { skills: dedupeList(skills), tools: dedupeList(tools) };
}

export function addMatchableToBuckets(
  buckets: SkillsToolsBuckets,
  term: string,
  kind?: MatchableKind,
): SkillsToolsBuckets {
  const trimmed = term.trim();
  if (!trimmed) return buckets;
  const key = trimmed.toLowerCase();
  if (allMatchableSkills(buckets).some((s) => s.toLowerCase() === key)) return buckets;
  const resolved = kind ?? classifyMatchableKind(trimmed);
  if (resolved === "technology") {
    return { skills: buckets.skills, tools: dedupeList([...(buckets.tools ?? []), trimmed]) };
  }
  return { skills: dedupeList([...(buckets.skills ?? []), trimmed]), tools: buckets.tools };
}

const TOOLS_LABEL_RE =
  /technical|tools?|technologies|tech stack|platforms|software|languages?|frameworks?|programming|stack/i;

export function isToolsGroupLabel(label: string): boolean {
  return TOOLS_LABEL_RE.test(label.trim());
}

function dedupeList(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function bucketsFromSkillGroups(groups: SkillGroupLike[]): SkillsToolsBuckets {
  const skills: string[] = [];
  const tools: string[] = [];
  for (const group of groups) {
    if (isToolsGroupLabel(group.label)) {
      tools.push(...group.skills);
    } else {
      skills.push(...group.skills);
    }
  }
  return { skills: dedupeList(skills), tools: dedupeList(tools) };
}

export function syncSkillGroupsFromBuckets(skills: string[], tools: string[]): SkillGroupLike[] {
  const groups: SkillGroupLike[] = [];
  if (skills.length) {
    groups.push({ id: "sg_skills", label: SKILLS_GROUP_LABEL, skills: dedupeList(skills) });
  }
  if (tools.length) {
    groups.push({ id: "sg_tools", label: TOOLS_GROUP_LABEL, skills: dedupeList(tools) });
  }
  return groups;
}

export function allMatchableSkills(buckets: SkillsToolsBuckets): string[] {
  return dedupeList([...(buckets.skills ?? []), ...(buckets.tools ?? [])]);
}

export function reconcileSkillsToolsFields(input: {
  skills?: string[];
  tools?: string[];
  skillGroups?: SkillGroupLike[];
}): SkillsToolsBuckets & { skillGroups: SkillGroupLike[] } {
  const rawGroups = input.skillGroups ?? [];
  const fromGroups = rawGroups.length ? bucketsFromSkillGroups(rawGroups) : null;

  let skills = dedupeList(fromGroups?.skills.length ? fromGroups.skills : input.skills ?? []);
  let tools = dedupeList(fromGroups?.tools.length ? fromGroups.tools : input.tools ?? []);

  if (rawGroups.length && !fromGroups?.tools.length && !fromGroups?.skills.length) {
    const split = bucketsFromSkillGroups(rawGroups);
    skills = dedupeList([...skills, ...split.skills]);
    tools = dedupeList([...tools, ...split.tools]);
  }

  const toolKeys = new Set(tools.map((t) => t.toLowerCase()));
  skills = skills.filter((s) => !toolKeys.has(s.toLowerCase()));

  const skillGroups =
    rawGroups.length > 0
      ? rawGroups.map((group, index) => ({
          id: group.id || `sg_${index}`,
          label: group.label.trim() || SKILLS_GROUP_LABEL,
          skills: dedupeList(group.skills),
        }))
      : syncSkillGroupsFromBuckets(skills, tools);

  return { skills, tools, skillGroups };
}

export function skillGroupsForEditor(input: SkillsToolsBuckets & { skillGroups?: SkillGroupLike[] }): SkillGroupLike[] {
  const reconciled = reconcileSkillsToolsFields(input);
  if (reconciled.skillGroups.length >= 2) return reconciled.skillGroups;
  if (reconciled.skillGroups.length === 1) {
    const only = reconciled.skillGroups[0]!;
    if (isToolsGroupLabel(only.label)) {
      return [
        { id: "sg_skills", label: SKILLS_GROUP_LABEL, skills: [] },
        only,
      ];
    }
    return [only, { id: "sg_tools", label: TOOLS_GROUP_LABEL, skills: reconciled.tools }];
  }
  return syncSkillGroupsFromBuckets(reconciled.skills, reconciled.tools);
}

export function patchFromSkillGroups(skillGroups: SkillGroupLike[]): SkillsToolsBuckets & { skillGroups: SkillGroupLike[] } {
  return reconcileSkillsToolsFields({ skillGroups });
}
