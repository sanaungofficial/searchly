import { hostnameFromUrl } from "@/lib/company-domain";
import type { TopEchelonNetworkJobRaw } from "@/lib/topechelon/types";

const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);

export type AgencyBranding = {
  agencyName: string | null;
  agencyWebsite: string | null;
  agencyLogoUrl: string | null;
  /** Best label for logo / card header */
  displayName: string | null;
};

function readString(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function domainFromEmail(email: string | null | undefined): string | null {
  if (!email?.includes("@")) return null;
  const domain = email.split("@")[1]?.trim().toLowerCase();
  if (!domain || GENERIC_EMAIL_DOMAINS.has(domain)) return null;
  return domain;
}

function websiteFromDomain(domain: string | null): string | null {
  if (!domain) return null;
  return `https://${domain}`;
}

export function mapAgencyBranding(job: TopEchelonNetworkJobRaw): AgencyBranding {
  const agencyRaw = (job.agency_detail ?? job.agencyDetail) as Record<string, unknown> | null | undefined;
  const recruiter = job.recruiter as Record<string, unknown> | null | undefined;

  const agencyName =
    (agencyRaw ? readString(agencyRaw, "name", "company_name", "companyName") : null) ?? null;

  const agencyWebsite =
    (agencyRaw
      ? readString(agencyRaw, "website", "url", "company_website", "companyWebsite", "web_site", "webSite")
      : null) ??
    websiteFromDomain(domainFromEmail(typeof recruiter?.email === "string" ? recruiter.email : null));

  const agencyLogoUrl = agencyRaw
    ? readString(
        agencyRaw,
        "logo_url",
        "logoUrl",
        "logo",
        "company_logo",
        "companyLogo",
        "image_url",
        "imageUrl"
      )
    : null;

  return {
    agencyName,
    agencyWebsite,
    agencyLogoUrl,
    displayName: agencyName,
  };
}

export function agencyLogoDomain(branding: AgencyBranding): string | null {
  return hostnameFromUrl(branding.agencyWebsite);
}
