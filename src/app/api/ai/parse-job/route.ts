import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { logAiUsage } from "@/lib/ai-usage";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

// ── HTML → plain text ────────────────────────────────────────────────────────
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Greenhouse ───────────────────────────────────────────────────────────────
function parseGreenhouseUrl(url: string): { company: string; jobId: string } | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("greenhouse.io")) return null;
    const forParam = u.searchParams.get("for");
    const tokenParam = u.searchParams.get("token");
    if (forParam && tokenParam) return { company: forParam, jobId: tokenParam };
    const parts = u.pathname.split("/").filter(Boolean);
    const jobsIdx = parts.lastIndexOf("jobs");
    if (jobsIdx >= 0 && parts[jobsIdx + 1]) {
      const company = parts[jobsIdx - 1];
      const jobId = parts[jobsIdx + 1];
      if (company && jobId && company !== "embed") return { company, jobId };
    }
  } catch { /* ignore */ }
  return null;
}

async function fetchGreenhouseJob(company: string, jobId: string) {
  const res = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${company}/jobs/${jobId}`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`Greenhouse API ${res.status}`);
  return res.json() as Promise<{
    title: string;
    content: string;
    location?: { name?: string };
    departments?: { name: string }[];
    offices?: { name: string; location?: string }[];
  }>;
}

// ── Lever ────────────────────────────────────────────────────────────────────
function parseLeverUrl(url: string): { company: string; jobId: string } | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("lever.co")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) return { company: parts[0], jobId: parts[1] };
  } catch { /* ignore */ }
  return null;
}

async function fetchLeverJob(company: string, jobId: string) {
  const res = await fetch(
    `https://api.lever.co/v0/postings/${company}/${jobId}`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`Lever API ${res.status}`);
  return res.json() as Promise<{
    text: string;
    descriptionPlain: string;
    categories: { commitment?: string; department?: string; location?: string; team?: string };
    lists: { text: string; content: string }[];
    additionalPlain?: string;
  }>;
}

// ── Jina Reader (JS-rendering fallback) ──────────────────────────────────────
async function fetchViaJina(url: string): Promise<string> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: {
      "Accept": "text/plain",
      "X-With-Images-Summary": "false",
      "X-No-Cache": "true",
      ...(process.env.JINA_API_KEY ? { "Authorization": `Bearer ${process.env.JINA_API_KEY}` } : {}),
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Jina ${res.status}`);
  return res.text();
}

// ── AI parse helper ───────────────────────────────────────────────────────────
async function aiParseJobContent(
  pageText: string,
  url: string,
  anthropic: Anthropic
): Promise<Record<string, unknown>> {
  const prompt = `Extract job posting details from this content. Return ONLY valid JSON, no other text.

Page URL: ${url}
Content:
${pageText.slice(0, 15000)}

Return this exact JSON shape (all fields required, use null if not found):
{
  "company": "company name",
  "role": "job title",
  "location": "city, state or Remote or null",
  "salary": "e.g. $130K-$150K/yr or null",
  "jobType": "Full-time or Part-time or Contract or null",
  "remote": true or false or null,
  "seniority": "Senior or Mid or Entry or Director or VP or null",
  "description": "complete job description as plain text — include all overview paragraphs, responsibilities, requirements, and qualifications. Do NOT summarize. Minimum 200 words if available.",
  "requirements": ["key skill or requirement 1", "key skill or requirement 2"],
  "tags": ["department or industry tag"]
}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in AI response");
  return JSON.parse(jsonMatch[0]);
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const dbUser = await prisma.user.findUnique({ where: { email: user.email! }, select: { id: true } });

  const { url } = await request.json();
  if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });

  const anthropic = getAnthropic();

  // ── 1. Greenhouse API ─────────────────────────────────────────────────────
  const ghMatch = parseGreenhouseUrl(url);
  if (ghMatch) {
    try {
      const gh = await fetchGreenhouseJob(ghMatch.company, ghMatch.jobId);
      const descText = htmlToText(gh.content ?? "");
      const location = gh.location?.name ?? gh.offices?.[0]?.name ?? null;
      const dept = gh.departments?.[0]?.name ?? null;
      const companyName = ghMatch.company
        .split(/[-_]/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      return NextResponse.json({
        company: companyName,
        role: gh.title,
        location: location ?? null,
        salary: null,
        jobType: null,
        remote: location ? location.toLowerCase().includes("remote") : null,
        seniority: null,
        description: descText,
        requirements: [],
        tags: dept ? [dept] : [],
        _source: "greenhouse",
      });
    } catch (err) {
      console.error("Greenhouse API failed, falling back:", err);
    }
  }

  // ── 2. Lever API ──────────────────────────────────────────────────────────
  const leverMatch = parseLeverUrl(url);
  if (leverMatch) {
    try {
      const lv = await fetchLeverJob(leverMatch.company, leverMatch.jobId);
      const sections = (lv.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`);
      const descText = [lv.descriptionPlain, ...sections, lv.additionalPlain ?? ""].filter(Boolean).join("\n\n");
      const companyName = leverMatch.company
        .split(/[-_]/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      return NextResponse.json({
        company: companyName,
        role: lv.text,
        location: lv.categories?.location ?? null,
        salary: null,
        jobType: lv.categories?.commitment ?? null,
        remote: lv.categories?.location ? lv.categories.location.toLowerCase().includes("remote") : null,
        seniority: null,
        description: descText,
        requirements: [],
        tags: lv.categories?.department ? [lv.categories.department] : [],
        _source: "lever",
      });
    } catch (err) {
      console.error("Lever API failed, falling back:", err);
    }
  }

  // ── 3. Jina Reader (handles JS-rendered pages, LinkedIn, Workday, etc.) ───
  let pageText = "";
  let scrapeSource = "html";

  try {
    const jinaText = await fetchViaJina(url);
    if (jinaText && jinaText.length > 200) {
      pageText = jinaText;
      scrapeSource = "jina";
    }
  } catch (err) {
    console.warn("Jina fetch failed, trying plain HTML:", err);
  }

  // ── 4. Plain HTML fetch (last resort) ────────────────────────────────────
  if (!pageText) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const html = await res.text();
        pageText = html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        scrapeSource = "html";
      }
    } catch (err) {
      console.warn("Plain HTML fetch also failed:", err);
    }
  }

  if (!pageText || pageText.length < 150) {
    return NextResponse.json(
      { error: "Could not load this page. It may require login (LinkedIn) or be a protected site. Try pasting the job description instead." },
      { status: 422 }
    );
  }

  // ── 5. AI parse ───────────────────────────────────────────────────────────
  try {
    const parsed = await aiParseJobContent(pageText, url, anthropic);
    if (dbUser) {
      // token logging is approximate since we refactored to a helper
      logAiUsage(dbUser.id, "JOB_PARSE", "claude-haiku-4-5-20251001", 0, 0);
    }
    return NextResponse.json({ ...parsed, _source: scrapeSource });
  } catch {
    return NextResponse.json(
      { error: "Could not extract job details. Try pasting the description instead." },
      { status: 422 }
    );
  }
}
