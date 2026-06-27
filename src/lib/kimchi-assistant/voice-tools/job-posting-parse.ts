import { logAiUsage } from "@/lib/ai-usage";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { PARSE_JOB_JSON_SHAPE, parsedJobToMeta } from "@/lib/job-meta";
import { normalizeJobListingUrl } from "@/lib/job-listing-url";

async function fetchViaJina(url: string): Promise<string> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: {
      Accept: "text/plain",
      "X-With-Images-Summary": "false",
      ...(process.env.JINA_API_KEY ? { Authorization: `Bearer ${process.env.JINA_API_KEY}` } : {}),
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Could not fetch posting (${res.status})`);
  return res.text();
}

export type ParsedJobPosting = {
  company: string | null;
  role: string | null;
  location: string | null;
  description: string | null;
  tags: string[];
  source: string;
};

/** Lightweight job URL parse for voice tools (Jina + AI). */
export async function parseJobPostingFromUrl(
  userId: string,
  rawUrl: string,
): Promise<ParsedJobPosting> {
  if (!isKimchiAiConfigured()) {
    return { company: null, role: null, location: null, description: null, tags: [], source: "unavailable" };
  }

  const normalized = normalizeJobListingUrl(String(rawUrl));
  if (!normalized.ok) {
    throw new Error(normalized.error);
  }
  const url = normalized.url;

  const pageText = await fetchViaJina(url);
  if (!pageText || pageText.length < 100) {
    throw new Error("Could not read enough text from that job URL.");
  }

  const prompt = `Extract job posting details. Return ONLY valid JSON:
${PARSE_JOB_JSON_SHAPE}

Page URL: ${url}
Content:
${pageText.slice(0, 12000)}`;

  const { text, usage, modelId } = await kimchiGenerateText({
    tier: "analyze",
    prompt,
    maxOutputTokens: 2048,
    userId,
    tags: ["feature:voice-job-parse"],
  });
  logAiUsage(userId, "JOB_PARSE", modelId, usage.inputTokens, usage.outputTokens);

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Could not parse job posting.");

  const structured = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  const meta = parsedJobToMeta(structured);

  return {
    company: typeof structured.company === "string" ? structured.company : null,
    role: typeof structured.role === "string" ? structured.role : null,
    location: meta.location ?? null,
    description: meta.description ?? pageText.slice(0, 4000),
    tags: meta.tags ?? [],
    source: "jina+ai",
  };
}
