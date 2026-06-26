import type { DrawerTool } from "@/contexts/workspace-context";
import type { CachedJob } from "@/lib/cached-job";
import { normalizeJobUrl } from "@/lib/cached-job";

export type OppTab = "pipeline" | "network";
export type AboutSectionSlug = "personal" | "education" | "experience" | "skills";

const JOB_TOOLS = new Set(["resume", "cover", "fit"]);

const PROSPECT_URL_PREFIX = "url:";

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): string {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function prospectPathId(job: CachedJob): string {
  if (job.hirebaseId?.trim()) return job.hirebaseId.trim();
  const url = normalizeJobUrl(job.url);
  if (!url) return `tmp-${Date.now()}`;
  return `${PROSPECT_URL_PREFIX}${base64UrlEncode(url)}`;
}

export function decodeProspectPathId(id: string): { hirebaseId?: string; url?: string } {
  if (id.startsWith(PROSPECT_URL_PREFIX)) {
    try {
      return { url: base64UrlDecode(id.slice(PROSPECT_URL_PREFIX.length)) };
    } catch {
      return {};
    }
  }
  return { hirebaseId: id };
}

export function pipelineJobUrl(jobId: string, tool?: DrawerTool | null): string {
  const base = `/opportunities/pipeline/jobs/${encodeURIComponent(jobId)}`;
  if (tool && tool !== null && JOB_TOOLS.has(tool)) return `${base}/${tool}`;
  return base;
}

export function pipelineProspectUrl(prospectId: string): string {
  return `/opportunities/pipeline/prospects/${encodeURIComponent(prospectId)}`;
}

export function companiesUrl(companyId?: string | null): string {
  return profileTargetCompaniesUrl(companyId);
}

export function profileTargetCompaniesUrl(companyId?: string | null): string {
  if (!companyId) return "/profile/target-companies";
  return `/profile/target-companies/${encodeURIComponent(companyId)}`;
}

export function networkJobUrl(jobId: string): string {
  return `/opportunities/network/jobs/${encodeURIComponent(jobId)}`;
}

export function opportunitiesTabUrl(tab: OppTab): string {
  if (tab === "network") return "/opportunities/network";
  return "/opportunities/pipeline";
}

export function profileAssetsUrl(assetId?: string | null): string {
  if (!assetId) return "/profile/assets";
  return `/profile/assets/${encodeURIComponent(assetId)}`;
}

export function profileLearningPathUrl(skill?: string | null): string {
  const base = "/profile/learning-path";
  if (!skill?.trim()) return base;
  return `${base}?skill=${encodeURIComponent(skill.trim())}`;
}

export function profileAboutSectionUrl(section: AboutSectionSlug): string {
  if (section === "personal") return "/profile";
  return `/profile/about/${section}`;
}

export type OpportunitiesLocation = {
  tab: OppTab;
  jobId?: string;
  tool?: DrawerTool;
  prospectId?: string;
  companyId?: string;
  networkJobId?: string;
};

/** @deprecated Legacy opportunities companies URLs — use profileTargetCompaniesUrl */
export function parseLegacyCompaniesRedirect(pathname: string): string | null {
  if (pathname === "/opportunities/companies") return profileTargetCompaniesUrl();
  if (pathname.startsWith("/opportunities/companies/")) {
    const companyId = decodeURIComponent(pathname.slice("/opportunities/companies/".length).split("/")[0] ?? "");
    return companyId ? profileTargetCompaniesUrl(companyId) : profileTargetCompaniesUrl();
  }
  return null;
}

export function parseOpportunitiesLocation(pathname: string): OpportunitiesLocation {
  const legacyCompanies = parseLegacyCompaniesRedirect(pathname);
  if (legacyCompanies) {
    const companyId = pathname.startsWith("/opportunities/companies/")
      ? decodeURIComponent(pathname.slice("/opportunities/companies/".length).split("/")[0] ?? "")
      : undefined;
    return { tab: "pipeline", companyId: companyId || undefined };
  }

  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] !== "opportunities") {
    return { tab: "pipeline" };
  }

  const section = segments[1];
  if (section === "network") {
    if (segments[2] === "jobs" && segments[3]) {
      return { tab: "network", networkJobId: decodeURIComponent(segments[3]) };
    }
    return { tab: "network" };
  }

  if (section === "pipeline") {
    if (segments[2] === "jobs" && segments[3]) {
      const tool = segments[4];
      return {
        tab: "pipeline",
        jobId: decodeURIComponent(segments[3]),
        tool: tool && JOB_TOOLS.has(tool) ? (tool as DrawerTool) : undefined,
      };
    }
    if (segments[2] === "prospects" && segments[3]) {
      return {
        tab: "pipeline",
        prospectId: decodeURIComponent(segments[3]),
      };
    }
  }

  return { tab: "pipeline" };
}

export type ProfileLocation = {
  page: "about" | "dreamrole" | "targetcompanies" | "learning" | "assets" | "preferences" | "linkedin" | "strategy";
  aboutSection?: AboutSectionSlug;
  assetId?: string;
  companyId?: string;
};

export function parseProfileLocation(pathname: string): ProfileLocation {
  if (pathname === "/profile/dream-role") return { page: "dreamrole" };
  if (pathname === "/profile/learning-path") return { page: "learning" };
  if (pathname === "/profile/preferences") return { page: "preferences" };
  if (pathname === "/profile/linkedin") return { page: "linkedin" };
  if (pathname === "/profile/career-strategy") return { page: "strategy" };

  if (pathname.startsWith("/profile/target-companies/") && pathname !== "/profile/target-companies") {
    const companyId = decodeURIComponent(pathname.slice("/profile/target-companies/".length).split("/")[0] ?? "");
    return { page: "targetcompanies", companyId: companyId || undefined };
  }
  if (pathname === "/profile/target-companies") return { page: "targetcompanies" };

  if (pathname.startsWith("/profile/assets/") && pathname !== "/profile/assets") {
    const assetId = decodeURIComponent(pathname.slice("/profile/assets/".length).split("/")[0] ?? "");
    return { page: "assets", assetId: assetId || undefined };
  }
  if (pathname === "/profile/assets") return { page: "assets" };

  if (pathname.startsWith("/profile/about/")) {
    const section = pathname.slice("/profile/about/".length).split("/")[0] as AboutSectionSlug;
    if (section === "personal" || section === "education" || section === "experience" || section === "skills") {
      return { page: "about", aboutSection: section };
    }
  }

  return { page: "about", aboutSection: "personal" };
}

/** Legacy query links (?job=…&tool=…) → path URLs */
export function legacyOpportunitiesQueryToPath(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const jobId = params.get("job");
  if (!jobId) return null;
  const tool = params.get("tool");
  const drawerTool = tool === "resume" || tool === "cover" || tool === "fit" ? tool : null;
  return pipelineJobUrl(jobId, drawerTool);
}

export function findKanbanCardByDbId(
  cards: { id: number; _dbId?: string }[],
  jobId: string
): { id: number; _dbId?: string } | undefined {
  return cards.find((c) => c._dbId === jobId);
}
