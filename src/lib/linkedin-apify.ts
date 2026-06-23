import { normalizeLinkedInUrl } from "@/lib/linkedin-url";

export interface LinkedInApifyProfile {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  headline?: string | null;
  summary?: string | null;
  location?: string | null;
  profileUrl?: string | null;
  workExperience: Array<{
    company: string;
    title: string;
    description?: string | null;
    from?: string | null;
    to?: string | null;
  }>;
  education: Array<{
    school: string;
    degree?: string | null;
    field?: string | null;
    from?: string | null;
    to?: string | null;
  }>;
  skills: string[];
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = asString(obj[key]);
    if (value) return value;
  }
  return null;
}

function nestedString(obj: unknown, ...path: string[]): string | null {
  let current: unknown = obj;
  for (const key of path) {
    if (!current || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[key];
  }
  return asString(current);
}

function mapExperienceRow(row: Record<string, unknown>) {
  const company =
    pickString(row, "companyName", "company", "organization", "company_name") ?? "";
  const title = pickString(row, "title", "position", "jobTitle", "role") ?? "";
  if (!company && !title) return null;

  const startDate = row.startDate as Record<string, unknown> | undefined;
  const endDate = row.endDate as Record<string, unknown> | undefined;

  return {
    company: company || "Unknown company",
    title: title || "Role",
    description: pickString(row, "description", "jobDescription", "summary"),
    from: pickString(startDate ?? {}, "text", "year") ?? pickString(row, "startDate", "startedOn", "from", "duration"),
    to: pickString(endDate ?? {}, "text", "year") ?? pickString(row, "endDate", "endedOn", "to"),
  };
}

function mapExperience(raw: unknown): LinkedInApifyProfile["workExperience"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      return mapExperienceRow(entry as Record<string, unknown>);
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

function mapEducationRow(row: Record<string, unknown>) {
  const school =
    pickString(row, "schoolName", "school", "institution", "school_name") ?? "";
  if (!school) return null;

  const startDate = row.startDate as Record<string, unknown> | undefined;
  const endDate = row.endDate as Record<string, unknown> | undefined;

  return {
    school,
    degree: pickString(row, "degreeName", "degree", "degree_name"),
    field: pickString(row, "fieldOfStudy", "field", "field_of_study"),
    from: pickString(startDate ?? {}, "text", "year") ?? pickString(row, "from", "period"),
    to: pickString(endDate ?? {}, "text", "year"),
  };
}

function mapEducation(raw: unknown): LinkedInApifyProfile["education"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      return mapEducationRow(entry as Record<string, unknown>);
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

function mapSkills(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const skills: string[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const value = item.trim();
      if (value) skills.push(value);
      continue;
    }
    if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      const value = pickString(row, "name", "skill", "title");
      if (value) skills.push(value);
    }
  }
  return skills;
}

function mapHarvestApiItem(row: Record<string, unknown>): LinkedInApifyProfile | null {
  if (asString(row.error)) return null;

  const firstName = pickString(row, "firstName", "first_name");
  const lastName = pickString(row, "lastName", "last_name");
  const fullName =
    pickString(row, "fullName", "full_name", "name") ??
    ([firstName, lastName].filter(Boolean).join(" ") || null);

  const headline = pickString(row, "headline", "title", "jobTitle");
  const summary = pickString(row, "summary", "about", "aboutText", "description");
  const location =
    nestedString(row, "location", "linkedinText") ??
    nestedString(row, "location", "parsed", "text") ??
    pickString(row, "location");
  const profileUrl =
    pickString(row, "profileUrl", "linkedinUrl", "url", "linkedinPublicUrl") ??
    (pickString(row, "publicIdentifier")
      ? `https://www.linkedin.com/in/${pickString(row, "publicIdentifier")}`
      : null);

  const workExperience = mapExperience(
    row.experience ?? row.experiences ?? row.positions ?? row.workExperience ?? row.currentPosition,
  );
  const education = mapEducation(
    row.education ?? row.educations ?? row.schools ?? row.profileTopEducation,
  );
  const skills = mapSkills(row.skills ?? row.topSkills);

  const hasContent =
    !!fullName ||
    !!headline ||
    !!summary ||
    !!location ||
    workExperience.length > 0 ||
    education.length > 0 ||
    skills.length > 0;

  if (!hasContent) return null;

  return {
    firstName,
    lastName,
    fullName,
    headline,
    summary,
    location,
    profileUrl,
    workExperience,
    education,
    skills,
  };
}

/** Map common Apify LinkedIn actor output shapes into a normalized profile. */
export function mapApifyLinkedInItem(item: unknown): LinkedInApifyProfile | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  return mapHarvestApiItem(row);
}

function apifyActorId(): string {
  return (
    process.env.APIFY_LINKEDIN_ACTOR_ID?.trim() ||
    "harvestapi/linkedin-profile-scraper"
  );
}

function apifyToken(): string | null {
  return process.env.APIFY_API_TOKEN?.trim() || null;
}

function actorInput(profileUrl: string): Record<string, unknown> {
  const actorId = apifyActorId();
  const inputKey =
    process.env.APIFY_LINKEDIN_INPUT_KEY?.trim() ||
    (actorId.includes("harvestapi") ? "urls" : "profileUrls");
  return { [inputKey]: [profileUrl] };
}

export function isLinkedInApifyConfigured(): boolean {
  return !!apifyToken();
}

export function defaultLinkedInActorId(): string {
  return apifyActorId();
}

/** Run the configured Apify actor and return the first mapped profile row. */
export async function fetchLinkedInProfileViaApify(
  linkedinUrl: string,
): Promise<LinkedInApifyProfile> {
  const token = apifyToken();
  if (!token) {
    throw new Error("LinkedIn scrape is not configured");
  }

  const profileUrl = normalizeLinkedInUrl(linkedinUrl);
  if (!profileUrl) {
    throw new Error("Invalid LinkedIn profile URL");
  }

  const actorId = apifyActorId();
  const timeoutSecs = Number(process.env.APIFY_LINKEDIN_TIMEOUT_SECS ?? "90");
  const encodedActor = encodeURIComponent(actorId.replace("/", "~"));
  const endpoint = new URL(
    `https://api.apify.com/v2/acts/${encodedActor}/run-sync-get-dataset-items`,
  );
  endpoint.searchParams.set("token", token);
  endpoint.searchParams.set("timeout", String(Math.min(Math.max(timeoutSecs, 30), 300)));

  const response = await fetch(endpoint.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(actorInput(profileUrl)),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      detail
        ? `Apify request failed (${response.status})`
        : `Apify request failed (${response.status})`,
    );
  }

  const items = (await response.json()) as unknown;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Apify returned no profile data");
  }

  for (const item of items) {
    const row = item as Record<string, unknown>;
    if (asString(row.error)) {
      throw new Error(asString(row.error)!);
    }
    const mapped = mapApifyLinkedInItem(item);
    if (mapped) return mapped;
  }

  throw new Error("Apify returned an unreadable profile payload");
}
