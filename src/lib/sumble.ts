import { formatApiErrorMessage } from "@/lib/api-error-message";

const SUMBLE_BASE = "https://api.sumble.com/v6";

export type SumbleOrganizationAttributes = {
  id?: number | null;
  slug?: string | null;
  name?: string | null;
  url?: string | null;
  employee_count?: number | null;
  industry?: string | null;
  jobs_count?: number | null;
  teams_count?: number | null;
  headquarters_country?: string | null;
  sumble_score?: number | null;
  sumble_url?: string | null;
  funding_total_raised?: number | null;
  funding_last_round_type?: string | null;
  funding_last_round_date?: string | null;
};

export type SumbleEntityResult = {
  type: string;
  term: string;
  job_post_count?: number | null;
  job_post_count_url?: string | null;
  people_count?: number | null;
  people_count_url?: string | null;
  team_count?: number | null;
  job_post_count_growth_1y?: number | null;
  people_count_growth_1y?: number | null;
};

export type SumbleOrganizationRow = {
  input?: { name?: string | null; url?: string | null } | null;
  attributes?: SumbleOrganizationAttributes | null;
  entities?: SumbleEntityResult[];
};

export type SumbleSignal = {
  title: string;
  subtitle?: string | null;
  explanation?: string | null;
  date: string;
  display_type: string;
  type?: string | null;
  organization_name?: string | null;
  job_function?: string | null;
  sumble_url?: string | null;
  linkedin_url?: string | null;
};

export type SumblePersonAttributes = {
  name?: string | null;
  linkedin_url?: string | null;
  job_title?: string | null;
  job_function?: string | null;
  job_level?: string | null;
  location?: string | null;
};

export type SumblePersonRow = {
  person_id?: number | null;
  sumble_url?: string | null;
  attributes?: SumblePersonAttributes | null;
};

type SumbleEnvelope<T> = {
  id?: string;
  credits_used?: number;
  credits_remaining?: number;
  organizations?: SumbleOrganizationRow[];
  signals?: SumbleSignal[];
  people?: SumblePersonRow[];
  matched_count?: number | null;
  total?: number;
};

export function isSumbleConfigured(): boolean {
  return !!process.env.SUMBLE_API_KEY?.trim();
}

function getApiKey(): string {
  const key = process.env.SUMBLE_API_KEY?.trim();
  if (!key) throw new Error("SUMBLE_API_KEY is not configured.");
  return key;
}

async function sumbleFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SUMBLE_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
      ...(init?.headers ?? {}),
    },
    signal: init?.signal ?? AbortSignal.timeout(45000),
  });

  if (res.status === 404) {
    throw new SumbleNotFoundError(path);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let message = `Sumble request failed (${res.status})`;
    if (body.trim()) {
      try {
        message = formatApiErrorMessage(JSON.parse(body), message);
      } catch {
        message = body.trim();
      }
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export class SumbleNotFoundError extends Error {
  constructor(path: string) {
    super(`Sumble resource not found: ${path}`);
    this.name = "SumbleNotFoundError";
  }
}

/** Map Kimchi target role labels to Sumble job_function entity terms. */
export function sumbleJobFunctionTerm(role: string): string {
  const r = role.trim();
  if (!r) return "Product Management";
  const lower = r.toLowerCase();
  if (lower.includes("product")) return "Product Management";
  if (lower.includes("engineer") || lower.includes("developer") || lower.includes("software")) {
    return "Software Engineering";
  }
  if (lower.includes("design")) return "Design";
  if (lower.includes("data")) return "Data";
  if (lower.includes("marketing")) return "Marketing";
  if (lower.includes("sales")) return "Sales";
  if (lower.includes("operations")) return "Operations";
  return r;
}

export async function fetchSumbleOrganization(input: {
  domain?: string | null;
  name?: string | null;
  slug?: string | null;
  jobFunctionTerms?: string[];
}): Promise<{
  organization: SumbleOrganizationRow | null;
  creditsUsed: number;
  creditsRemaining: number | null;
}> {
  const orgInput: Record<string, string> = {};
  if (input.slug?.trim()) orgInput.slug = input.slug.trim();
  else if (input.domain?.trim()) orgInput.url = input.domain.trim();
  else if (input.name?.trim()) orgInput.name = input.name.trim();
  else throw new Error("Organization domain, name, or slug is required.");

  const entities = (input.jobFunctionTerms ?? ["Product Management"]).slice(0, 3).map((term) => ({
    type: "job_function" as const,
    term,
    metrics: ["job_post_count", "people_count", "job_post_count_growth_1y"],
  }));

  const data = await sumbleFetch<SumbleEnvelope<unknown>>("/organizations", {
    method: "POST",
    body: JSON.stringify({
      organizations: [orgInput],
      select: {
        attributes: [
          "employee_count",
          "industry",
          "jobs_count",
          "teams_count",
          "headquarters_country",
          "sumble_score",
          "sumble_url",
          "funding_total_raised",
          "funding_last_round_type",
          "funding_last_round_date",
        ],
        entities,
      },
    }),
  });

  const organization = data.organizations?.[0] ?? null;
  if (!organization?.attributes?.id && !organization?.attributes?.name) {
    return {
      organization: null,
      creditsUsed: data.credits_used ?? 0,
      creditsRemaining: data.credits_remaining ?? null,
    };
  }

  return {
    organization,
    creditsUsed: data.credits_used ?? 0,
    creditsRemaining: data.credits_remaining ?? null,
  };
}

export async function fetchSumbleOrganizationSignals(organizationId: number): Promise<{
  signals: SumbleSignal[];
  creditsUsed: number;
  creditsRemaining: number | null;
}> {
  const data = await sumbleFetch<SumbleEnvelope<unknown>>(
    `/organizations/${organizationId}/signals`,
    { method: "GET" }
  );

  return {
    signals: data.signals ?? [],
    creditsUsed: data.credits_used ?? 0,
    creditsRemaining: data.credits_remaining ?? null,
  };
}

export async function fetchSumblePeopleAtOrganization(input: {
  organizationId: number;
  limit?: number;
}): Promise<{
  people: SumblePersonRow[];
  total: number;
  creditsUsed: number;
  creditsRemaining: number | null;
  sourceDataUrl: string | null;
}> {
  const limit = Math.max(1, Math.min(input.limit ?? 5, 10));

  const data = await sumbleFetch<SumbleEnvelope<unknown>>("/people", {
    method: "POST",
    body: JSON.stringify({
      filter: { organization_ids: [input.organizationId] },
      limit,
      order_by_column: "job_level",
      order_by_direction: "DESC",
      select: {
        attributes: ["name", "job_title", "linkedin_url", "job_level", "job_function"],
      },
    }),
  });

  return {
    people: data.people ?? [],
    total: data.total ?? 0,
    creditsUsed: data.credits_used ?? 0,
    creditsRemaining: data.credits_remaining ?? null,
    sourceDataUrl: (data as { source_data_url?: string | null }).source_data_url ?? null,
  };
}

export function formatSumbleFunding(amount: number | null | undefined): string | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${Math.round(amount / 1_000_000)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${amount.toLocaleString()}`;
}

export function formatSumbleGrowth(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const pct = Math.round(value * 100);
  if (pct > 0) return `+${pct}% YoY`;
  if (pct < 0) return `${pct}% YoY`;
  return "Flat YoY";
}
