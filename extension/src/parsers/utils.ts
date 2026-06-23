import type { JobStage, ParserId } from "../lib/types";

export function text(el: Element | null | undefined): string {
  return el?.textContent?.trim() ?? "";
}

export function attr(el: Element | null | undefined, name: string): string {
  return el?.getAttribute(name)?.trim() ?? "";
}

export function canonicalUrl(): string {
  const link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (link?.href) return link.href;
  return window.location.href.split("#")[0];
}

export function parseTitleHeuristic(raw: string): { role: string; company: string } {
  const title = raw.trim();
  if (!title) return { role: "Unknown Role", company: "Unknown Company" };

  const atMatch = title.match(/^(.+?)\s+at\s+(.+?)(?:\s*[|\-–—]|$)/i);
  if (atMatch) {
    return { role: atMatch[1].trim(), company: atMatch[2].trim() };
  }

  const pipeParts = title.split(/\s*[|\-–—]\s*/);
  if (pipeParts.length >= 2) {
    return { role: pipeParts[0].trim(), company: pipeParts[1].trim() };
  }

  return { role: title, company: "Unknown Company" };
}

const APPLIED_URL_RE =
  /(?:confirmation|thank(?:-?you)?|success|submitted|applied|complete)/i;
const APPLYING_URL_RE = /\/apply(?:\/|$|\?)/i;

export function detectStage(url: string, isApplicationPage = false): JobStage {
  if (APPLIED_URL_RE.test(url) || isApplicationPage) return "APPLIED";
  if (APPLYING_URL_RE.test(url)) return "APPLYING";
  return "SAVED";
}

export function companyFromUrl(hostname: string, segmentIndex: number): string {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const slug = parts[segmentIndex];
  if (!slug) return "Unknown Company";
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function readJsonLdJobPosting(): {
  title?: string;
  company?: string;
  url?: string;
} | null {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  for (const script of scripts) {
    try {
      const raw = script.textContent?.trim();
      if (!raw) continue;
      const data = JSON.parse(raw) as unknown;
      const posting = findJobPosting(data);
      if (posting) return posting;
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return null;
}

function findJobPosting(data: unknown): {
  title?: string;
  company?: string;
  url?: string;
} | null {
  if (!data || typeof data !== "object") return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return null;
  }

  const obj = data as Record<string, unknown>;
  const type = obj["@type"];
  const types = Array.isArray(type) ? type : type ? [type] : [];

  if (types.some((t) => String(t).toLowerCase() === "jobposting")) {
    const hiringOrg = obj.hiringOrganization as Record<string, unknown> | undefined;
    return {
      title: typeof obj.title === "string" ? obj.title : undefined,
      company:
        typeof hiringOrg?.name === "string"
          ? hiringOrg.name
          : typeof obj.hiringOrganization === "string"
            ? obj.hiringOrganization
            : undefined,
      url: typeof obj.url === "string" ? obj.url : undefined,
    };
  }

  if (obj["@graph"]) return findJobPosting(obj["@graph"]);

  for (const value of Object.values(obj)) {
    const found = findJobPosting(value);
    if (found) return found;
  }

  return null;
}

export function readOpenGraph(): { title?: string; company?: string } {
  return {
    title: attr(document.querySelector('meta[property="og:title"]'), "content"),
    company: attr(document.querySelector('meta[property="og:site_name"]'), "content"),
  };
}

export function buildNotes(parser: ParserId): string {
  return JSON.stringify({
    source: "extension",
    parser,
    capturedAt: new Date().toISOString(),
  });
}

export function firstNonEmpty(...values: Array<string | undefined | null>): string {
  for (const v of values) {
    const trimmed = v?.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

export function logParse(parser: ParserId, result: unknown): void {
  console.info("[Kimchi]", { parser, result, url: window.location.href });
}
