import type { DrawerTool } from "@/contexts/workspace-context";
import type { CachedJob } from "@/lib/cached-job";
import { normalizeJobUrl } from "@/lib/cached-job";

export type OppTab = "pipeline" | "network";
export type AboutSectionSlug = "personal" | "education" | "experience" | "skills";

export type OpportunitiesNavItem = {
  id: string;
  label: string;
  path: string;
  match: (pathname: string) => boolean;
};

export const INBOX_PATH = "/inbox";

export const OPPORTUNITIES_NAV: OpportunitiesNavItem[] = [
  {
    id: "pipeline",
    label: "Open Roles",
    path: "/opportunities/pipeline",
    match: (p) => p.startsWith("/opportunities/pipeline") || p === "/opportunities",
  },
  {
    id: "network",
    label: "In-Network Roles",
    path: "/opportunities/network",
    match: (p) => p.startsWith("/opportunities/network"),
  },
];

export function matchOpportunitiesNavPath(pathname: string): boolean {
  return pathname.startsWith("/opportunities");
}

export function matchInboxPath(pathname: string): boolean {
  return pathname === INBOX_PATH || pathname.startsWith(`${INBOX_PATH}/`);
}

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
  return `/opportunities/pipeline/network/${encodeURIComponent(jobId)}`;
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
  if (section === "pipeline") {
    if (segments[2] === "network" && segments[3]) {
      return { tab: "pipeline", networkJobId: decodeURIComponent(segments[3]) };
    }
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
  page: "about" | "dreamrole" | "targetcompanies" | "learning" | "assets" | "preferences" | "linkedin" | "strategy" | "discoveryscore";
  preferencesSection?: "import";
  aboutSection?: AboutSectionSlug;
  assetId?: string;
  companyId?: string;
  /** Set when admin is reviewing a client profile without impersonating */
  clientId?: string;
};

const ADMIN_CLIENT_PROFILE_PREFIX = "/dashboard/clients/";

export function adminClientProfileBase(clientId: string): string {
  return `${ADMIN_CLIENT_PROFILE_PREFIX}${encodeURIComponent(clientId)}/profile`;
}

export function parseAdminClientProfilePath(pathname: string): { clientId: string; suffix: string } | null {
  if (!pathname.startsWith(ADMIN_CLIENT_PROFILE_PREFIX)) return null;
  const rest = pathname.slice(ADMIN_CLIENT_PROFILE_PREFIX.length);
  const slash = rest.indexOf("/profile");
  if (slash === -1) return null;
  const clientId = decodeURIComponent(rest.slice(0, slash));
  const suffix = rest.slice(slash + "/profile".length);
  return { clientId, suffix };
}

/** Admin reviewing a client profile — not the expert portal (coach tools). */
export function isAdminClientReviewPath(pathname: string): boolean {
  return parseAdminClientProfilePath(pathname) !== null;
}

function parseProfileLocationInner(pathname: string): ProfileLocation {
  if (pathname === "/profile/dream-role") return { page: "dreamrole" };
  if (pathname === "/profile/learning-path") return { page: "learning" };
  if (pathname === "/profile/preferences/import") return { page: "preferences", preferencesSection: "import" };
  if (pathname === "/profile/preferences") return { page: "preferences" };
  if (pathname === "/profile/linkedin") return { page: "linkedin" };
  if (pathname === "/profile/career-strategy") return { page: "strategy" };
  if (pathname === "/profile/discovery-score") return { page: "discoveryscore" };

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

export function parseProfileLocation(pathname: string): ProfileLocation {
  const admin = parseAdminClientProfilePath(pathname);
  if (admin) {
    const pseudo =
      admin.suffix === "" || admin.suffix === "/"
        ? "/profile"
        : `/profile${admin.suffix}`;
    return { ...parseProfileLocationInner(pseudo), clientId: admin.clientId };
  }
  return parseProfileLocationInner(pathname);
}

export function profileBasePath(clientId?: string, opts?: { sessionScoped?: boolean }): string {
  if (clientId && !opts?.sessionScoped) return adminClientProfileBase(clientId);
  return "/profile";
}

/** Query param for admin profile review — survives refresh and deep links. */
export const CLIENT_USER_ID_PARAM = "clientUserId";

export function readClientUserIdFromBrowserSearch(search?: string): string | null {
  if (typeof window === "undefined") return null;
  const raw = search ?? window.location.search;
  const id = new URLSearchParams(raw).get(CLIENT_USER_ID_PARAM);
  return id?.trim() || null;
}

/** Append clientUserId for admin profile-review API calls (no impersonation). */
export function withClientUserId(path: string, clientUserId?: string | null): string {
  if (!clientUserId) return path;
  const sep = path.includes("?") ? "&" : "?";
  if (path.includes(`${CLIENT_USER_ID_PARAM}=`)) return path;
  return `${path}${sep}${CLIENT_USER_ID_PARAM}=${encodeURIComponent(clientUserId)}`;
}

/** Keep clientUserId on workspace page navigations during admin review. */
export function withClientReviewPagePath(path: string, clientUserId?: string | null): string {
  if (!clientUserId) return path;
  const [base, hash = ""] = path.split("#");
  const withParam = withClientUserId(base, clientUserId);
  return hash ? `${withParam}#${hash}` : withParam;
}

export function profileTabPath(
  base: string,
  tab: ProfileLocation["page"],
  opts?: {
    aboutSection?: AboutSectionSlug;
    assetId?: string;
    companyId?: string;
    skill?: string | null;
    preferencesSection?: "import";
  },
): string {
  switch (tab) {
    case "about":
      if (opts?.aboutSection && opts.aboutSection !== "personal") {
        return `${base}/about/${opts.aboutSection}`;
      }
      return base;
    case "dreamrole":
      return `${base}/dream-role`;
    case "targetcompanies":
      return opts?.companyId
        ? `${base}/target-companies/${encodeURIComponent(opts.companyId)}`
        : `${base}/target-companies`;
    case "learning":
      if (opts?.skill?.trim()) {
        return `${base}/learning-path?skill=${encodeURIComponent(opts.skill.trim())}`;
      }
      return `${base}/learning-path`;
    case "assets":
      return opts?.assetId
        ? `${base}/assets/${encodeURIComponent(opts.assetId)}`
        : `${base}/assets`;
    case "preferences":
      if (opts?.preferencesSection === "import") {
        return `${base}/preferences/import`;
      }
      return `${base}/preferences`;
    case "linkedin":
      return `${base}/linkedin`;
    case "strategy":
      return `${base}/career-strategy`;
    case "discoveryscore":
      return `${base}/discovery-score`;
    default:
      return base;
  }
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
