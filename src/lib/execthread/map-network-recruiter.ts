import type { ExecThreadContactRaw, ExecThreadListingRaw } from "@/lib/execthread/types";

export type MappedExecThreadContact = {
  externalId: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedInUrl: string | null;
  agencyName: string | null;
  raw: object;
};

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function contactName(contact: ExecThreadContactRaw): string | null {
  const direct = str(contact.name);
  if (direct) return direct;
  const parts = [str(contact.firstName), str(contact.lastName)].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

function contactExternalId(
  listingId: string,
  contact: ExecThreadContactRaw,
  index: number,
): string {
  const id = contact._id ?? contact.id;
  if (id != null) return `EXECTHREAD:${listingId}:${String(id)}`;
  const email = str(contact.email);
  if (email) return `EXECTHREAD:${listingId}:${email.toLowerCase()}`;
  const name = contactName(contact);
  if (name) return `EXECTHREAD:${listingId}:${name.toLowerCase().replace(/\s+/g, "-")}`;
  return `EXECTHREAD:${listingId}:contact-${index}`;
}

function normalizeContact(
  listingId: string,
  contact: ExecThreadContactRaw,
  index: number,
  agencyFallback: string | null,
): MappedExecThreadContact | null {
  const email = str(contact.email);
  const name = contactName(contact);
  const title = str(contact.title);
  const phone = str(contact.phone);
  const linkedInUrl = str(contact.linkedInUrl ?? contact.linkedinUrl);
  const agencyName = str(contact.agencyName ?? contact.firmName) ?? agencyFallback;

  if (!email && !name && !phone && !linkedInUrl) return null;

  const firstName = str(contact.firstName);
  const lastName = str(contact.lastName);

  return {
    externalId: contactExternalId(listingId, contact, index),
    firstName,
    lastName,
    name: name ?? ([firstName, lastName].filter(Boolean).join(" ") || null),
    title,
    email,
    phone,
    linkedInUrl,
    agencyName,
    raw: contact as object,
  };
}

function collectRawContacts(job: ExecThreadListingRaw): ExecThreadContactRaw[] {
  const out: ExecThreadContactRaw[] = [];
  const pushAll = (value: unknown) => {
    if (!Array.isArray(value)) return;
    for (const item of value) {
      if (item && typeof item === "object") out.push(item as ExecThreadContactRaw);
    }
  };

  pushAll(job.recruiters);
  pushAll(job.contacts);
  pushAll(job.notificationRecipients);
  pushAll(job.hiringManagers);

  if (job.companyContact && typeof job.companyContact === "object") {
    out.push(job.companyContact);
  }

  const exportBundle = job._kimchiExport as { redeem?: Record<string, unknown>; memberJob?: Record<string, unknown> } | undefined;
  if (exportBundle?.redeem) {
    pushAll(exportBundle.redeem.recruiters);
    pushAll(exportBundle.redeem.contacts);
    pushAll(exportBundle.redeem.notificationRecipients);
    if (exportBundle.redeem.companyContact && typeof exportBundle.redeem.companyContact === "object") {
      out.push(exportBundle.redeem.companyContact as ExecThreadContactRaw);
    }
  }

  const memberListing =
    exportBundle?.memberJob?.listing ?? exportBundle?.memberJob?.listingPreview;
  if (memberListing && typeof memberListing === "object") {
    const listing = memberListing as ExecThreadListingRaw;
    pushAll(listing.recruiters);
    pushAll(listing.contacts);
    pushAll(listing.notificationRecipients);
    pushAll(listing.hiringManagers);
    if (listing.companyContact && typeof listing.companyContact === "object") {
      out.push(listing.companyContact);
    }
  }

  return out;
}

export function recruitingFirmName(job: ExecThreadListingRaw): string | null {
  const firm = job.recruitingFirm;
  if (!firm || typeof firm !== "object") return null;
  return str(firm.name);
}

/** All recruiter / hiring-manager contacts on an ExecThread listing. */
export function mapExecThreadListingContacts(job: ExecThreadListingRaw): MappedExecThreadContact[] {
  const listingId = String(job._id);
  const agencyFallback = recruitingFirmName(job);
  const seen = new Set<string>();
  const contacts: MappedExecThreadContact[] = [];

  for (const raw of collectRawContacts(job)) {
    const mapped = normalizeContact(listingId, raw, contacts.length, agencyFallback);
    if (!mapped) continue;
    const key = `${mapped.email ?? ""}|${mapped.name ?? ""}|${mapped.externalId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    contacts.push(mapped);
  }

  return contacts;
}

export function mapExecThreadPrimaryRecruiter(
  job: ExecThreadListingRaw,
): MappedExecThreadContact | null {
  return mapExecThreadListingContacts(job)[0] ?? null;
}

export type MappedNetworkRecruiter = {
  externalId: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  agencyName: string | null;
  raw: object;
};

export function toNetworkRecruiterRecord(contact: MappedExecThreadContact): MappedNetworkRecruiter {
  return {
    externalId: contact.externalId,
    firstName: contact.firstName,
    lastName: contact.lastName,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    agencyName: contact.agencyName,
    raw: contact.raw,
  };
}
