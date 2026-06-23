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
    // Embed form: ?for=company&token=jobId
    const forParam = u.searchParams.get("for");
    const tokenParam = u.searchParams.get("token");
    if (forParam && tokenParam) return { company: forParam, jobId: tokenParam };
    // Board URL: /company/jobs/jobId
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
    metadata?: { name: string; value: string | string[] | null }[];
  }>;
}

// ── Lever ────────────────────────────────────────────────────────────────────
function parseLeverUrl(url: string): { company: string; jobId: string } | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("lever.co")) return null;
    // https://jobs.lever.co/company/job-uuid
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

  // ── 3. Generic HTML fetch + AI parse ─────────────────────────────────────
  let pageText = "";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Could not fetch page (${res.status}). Try pasting the job details manually.` }, { status: 422 });
    }

    const html = await res.text();
    pageText = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 15000);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("timeout") || message.includes("abort")) {
      return NextResponse.json({ error: "Page took too long to load. Try a different URL." }, { status: 422 });
    }
    return NextResponse.json({ error: "Could not reach that URL. It may require login." }, { status: 422 });
  }

  if (!pageText || pageText.length < 100) {
    return NextResponse.json({ error: "Page content too short — may require login (LinkedIn, Workday)." }, { status: 422 });
  }

  const promptContent = `Extract job posting details from this page content. Return ONLY valid JSON, no other text.

Page URL: ${url}
Page content:
${pageText}

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

  const PARSE_MODEL = "claude-haiku-4-5-20251001";
  const message = await getAnthropic().messages.create({
    model: PARSE_MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: promptContent }],
  });

  if (dbUser) logAiUsage(dbUser.id, "JOB_PARSE", PARSE_MODEL, message.usage.input_tokens, message.usage.output_tokens);

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "Could not parse job details. Try adding manually." }, { status: 422 });
  }
}
