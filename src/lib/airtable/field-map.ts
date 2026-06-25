import { isAllowedAirtableCoachSyncStatus } from "@/lib/airtable/sync-config";
import type { AirtableAttachment, AirtableRecord, MappedCoachFromAirtable } from "@/lib/airtable/types";

/**
 * First matching Airtable column name wins (case-sensitive).
 * Mapped from MBB/Big 4 Mentors (tblnl8cmFBBynOwg0) via Airtable MCP schema discovery.
 */
const FIELD_ALIASES = {
  displayName: ["Full Name", "Name", "Coach Name", "Display Name", "Coach"],
  firstName: ["First Name", "First ﻿Name", "First Name"],
  lastName: ["Last Name", "Last Name (Abbrivated)"],
  email: ["Email", "Email Address"],
  headline: ["Short Bio", "Headline", "Title", "Tagline"],
  bio: ["Intro Call Notes", "Bio", "Description", "Profile Bio"],
  aboutMe: ["About Me", "About", "Long Bio", "Profile"],
  whyCoach: ["Why Coach", "Why I Coach", "Coaching Philosophy", "Webinar Topics"],
  currentRole: ["Job Title", "Current Role", "Role", "Title (Current)"],
  currentCompany: ["Current Company", "Company", "Employer", "Organization"],
  location: ["Location", "City", "Geo"],
  linkedinUrl: ["LinkedIn URL", "LinkedIn", "LinkedIn Profile", "Linkedin"],
  lelandUrl: ["Coach Profile URL", "Leland URL", "Leland", "Leland Link"],
  calLink: ["Cal Link", "Calendly", "Booking Link", "Scheduler Link", "Cal.com"],
  photo: ["Profile Pic", "Photo", "Headshot", "Profile Photo", "Image", "Avatar", "Picture"],
  firms: ["Associated Firms", "Firms", "Companies", "Past Companies", "Company History"],
  schools: ["Education (Text)", "Education", "Schools", "Universities"],
  specialties: ["Coaching Skills", "Specialties", "Services", "Coaching Services", "Focus Areas"],
  industries: ["Outreach Campaign", "Industries", "Industry", "Sectors"],
  clientSpecializations: ["Exit Paths", "Client Specializations", "Client Types", "Who I Coach"],
  hourlyRate: ["Hourly Rate", "Rate", "Price", "Session Rate", "$/hr"],
  category: ["Outreach Campaign", "Category", "Coach Category", "Tier"],
  featured: ["Featured", "Is Featured", "Highlight"],
  status: ["Status", "Coach Status", "Active"],
  profileStatus: ["Profile Status"],
  isProfessionalCoach: ["Professional Coach", "Is Professional Coach", "Pro Coach"],
  experienceLevel: ["Experience Level", "Seniority"],
  clientTier: ["Credits Required", "Client Tier", "Target Tier"],
  industryYears: ["Industry Years", "Years in Industry", "Years Experience"],
} as const;

function pickField(fields: Record<string, unknown>, aliases: readonly string[]): unknown {
  for (const key of aliases) {
    if (fields[key] !== undefined && fields[key] !== null) return fields[key];
  }
  return undefined;
}

function asString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object" && "name" in value) {
    const name = String((value as { name: string }).name).trim();
    return name || null;
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object" && "name" in item) {
          return String((item as { name: string }).name).trim();
        }
        return "";
      })
      .filter(Boolean);
  }
  const single = asString(value);
  if (!single) return [];
  return single
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseHourlyRate(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const str = asString(value);
  if (!str) return null;
  const match = str.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const str = asString(value)?.toLowerCase();
  if (!str) return false;
  return ["true", "yes", "y", "1", "featured", "active", "profile updated", "updated"].includes(str);
}

function parseCoachStatus(value: unknown): "ACTIVE" | "PENDING" | "INACTIVE" {
  const str = asString(value)?.toLowerCase();
  if (!str) return "ACTIVE";
  if (["inactive", "hidden", "archived", "disabled", "off"].some((k) => str.includes(k))) return "INACTIVE";
  // Curated Airtable pipeline coaches — show in /coaching directory
  if (str === "active" || str === "contract sent" || str === "onboarding email sent") return "ACTIVE";
  if (["pending", "review", "draft", "new", "interested"].some((k) => str.includes(k))) return "PENDING";
  return "ACTIVE";
}

function parseAttachment(value: unknown): AirtableAttachment | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const first = value[0];
  if (!first || typeof first !== "object") return null;
  const att = first as AirtableAttachment;
  if (!att.url || !att.id) return null;
  return att;
}

function parseInteger(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const n = Number(asString(value)?.replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
}

function resolveDisplayName(fields: Record<string, unknown>): string | null {
  const full = asString(pickField(fields, FIELD_ALIASES.displayName));
  if (full) return full;
  const first = asString(pickField(fields, FIELD_ALIASES.firstName));
  const last = asString(pickField(fields, FIELD_ALIASES.lastName));
  const combined = [first, last].filter(Boolean).join(" ").trim();
  return combined || null;
}

export function mapAirtableRecordToCoach(record: AirtableRecord): MappedCoachFromAirtable | null {
  const fields = record.fields;
  const airtableStatus = pickField(fields, FIELD_ALIASES.status);
  if (!isAllowedAirtableCoachSyncStatus(airtableStatus)) return null;

  const displayName = resolveDisplayName(fields);
  if (!displayName) return null;

  const profileStatus = pickField(fields, FIELD_ALIASES.profileStatus);
  const featuredRaw = pickField(fields, FIELD_ALIASES.featured) ?? profileStatus;

  return {
    airtableId: record.id,
    displayName,
    email: asString(pickField(fields, FIELD_ALIASES.email))?.toLowerCase() ?? null,
    headline: asString(pickField(fields, FIELD_ALIASES.headline)),
    bio: asString(pickField(fields, FIELD_ALIASES.bio)),
    currentRole: asString(pickField(fields, FIELD_ALIASES.currentRole)),
    currentCompany: asString(pickField(fields, FIELD_ALIASES.currentCompany)),
    location: asString(pickField(fields, FIELD_ALIASES.location)),
    linkedinUrl: asString(pickField(fields, FIELD_ALIASES.linkedinUrl)),
    lelandUrl: asString(pickField(fields, FIELD_ALIASES.lelandUrl)),
    calLink: asString(pickField(fields, FIELD_ALIASES.calLink)),
    firms: asStringArray(pickField(fields, FIELD_ALIASES.firms)),
    schools: asStringArray(pickField(fields, FIELD_ALIASES.schools)),
    specialties: asStringArray(pickField(fields, FIELD_ALIASES.specialties)),
    industries: asStringArray(pickField(fields, FIELD_ALIASES.industries)),
    clientSpecializations: asStringArray(pickField(fields, FIELD_ALIASES.clientSpecializations)),
    hourlyRate: parseHourlyRate(pickField(fields, FIELD_ALIASES.hourlyRate)),
    category: asString(pickField(fields, FIELD_ALIASES.category)),
    featured: parseBoolean(featuredRaw),
    status: parseCoachStatus(pickField(fields, FIELD_ALIASES.status)),
    isProfessionalCoach: parseBoolean(pickField(fields, FIELD_ALIASES.isProfessionalCoach)),
    whyCoach: asString(pickField(fields, FIELD_ALIASES.whyCoach)),
    aboutMe: asString(pickField(fields, FIELD_ALIASES.aboutMe)),
    experienceLevel: asString(pickField(fields, FIELD_ALIASES.experienceLevel)),
    clientTier: asString(pickField(fields, FIELD_ALIASES.clientTier)),
    industryYears: parseInteger(pickField(fields, FIELD_ALIASES.industryYears)),
    photoAttachment: parseAttachment(pickField(fields, FIELD_ALIASES.photo)),
  };
}

/** Map Kimchi coach profile fields back to Airtable column names (first alias). */
export function mapCoachToAirtableFields(profile: {
  displayName: string;
  email: string | null;
  headline: string | null;
  bio: string | null;
  currentRole: string | null;
  currentCompany: string | null;
  location: string | null;
  linkedinUrl: string | null;
  lelandUrl: string | null;
  calLink: string | null;
  firms: string[];
  schools: string[];
  specialties: string[];
  industries: string[];
  hourlyRate: number | null;
  category: string | null;
  featured: boolean;
  status: string;
  isProfessionalCoach: boolean;
  whyCoach: string | null;
  aboutMe: string | null;
  experienceLevel: string | null;
  clientTier: string | null;
  industryYears: number | null;
  clientSpecializations: string[];
}): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  const set = (aliases: readonly string[], value: unknown) => {
    if (value === undefined) return;
    out[aliases[0]] = value;
  };

  set(FIELD_ALIASES.displayName, profile.displayName);
  if (profile.email) set(FIELD_ALIASES.email, profile.email);
  set(FIELD_ALIASES.headline, profile.headline);
  set(FIELD_ALIASES.bio, profile.bio);
  set(FIELD_ALIASES.aboutMe, profile.aboutMe);
  set(FIELD_ALIASES.whyCoach, profile.whyCoach);
  set(FIELD_ALIASES.currentRole, profile.currentRole);
  set(FIELD_ALIASES.currentCompany, profile.currentCompany);
  set(FIELD_ALIASES.location, profile.location);
  set(FIELD_ALIASES.linkedinUrl, profile.linkedinUrl);
  set(FIELD_ALIASES.lelandUrl, profile.lelandUrl);
  set(FIELD_ALIASES.calLink, profile.calLink);
  if (profile.firms.length) set(FIELD_ALIASES.firms, profile.firms);
  if (profile.schools.length) set(FIELD_ALIASES.schools, profile.schools);
  if (profile.specialties.length) set(FIELD_ALIASES.specialties, profile.specialties);
  if (profile.industries.length) set(FIELD_ALIASES.industries, profile.industries);
  if (profile.clientSpecializations.length) {
    set(FIELD_ALIASES.clientSpecializations, profile.clientSpecializations);
  }
  if (profile.hourlyRate != null) set(FIELD_ALIASES.hourlyRate, profile.hourlyRate);
  set(FIELD_ALIASES.category, profile.category);
  set(FIELD_ALIASES.featured, profile.featured);
  set(FIELD_ALIASES.status, profile.status);
  set(FIELD_ALIASES.isProfessionalCoach, profile.isProfessionalCoach);
  set(FIELD_ALIASES.experienceLevel, profile.experienceLevel);
  set(FIELD_ALIASES.clientTier, profile.clientTier);
  if (profile.industryYears != null) set(FIELD_ALIASES.industryYears, profile.industryYears);

  return out;
}

export function getFieldAliasMap() {
  return FIELD_ALIASES;
}
