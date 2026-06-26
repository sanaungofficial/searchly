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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function pushContactObject(out: ExecThreadContactRaw[], value: unknown): void {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    out.push(value as ExecThreadContactRaw);
  }
}

function pushAllContacts(out: ExecThreadContactRaw[], value: unknown): void {
  if (!Array.isArray(value)) return;
  for (const item of value) {
    pushContactObject(out, item);
  }
}

function collectContactsFromRecord(out: ExecThreadContactRaw[], record: Record<string, unknown>): void {
  pushAllContacts(out, record.recruiters);
  pushAllContacts(out, record.contacts);
  pushAllContacts(out, record.notificationRecipients);
  pushAllContacts(out, record.hiringManagers);
  pushAllContacts(out, record.hiringManagerList);
  pushContactObject(out, record.companyContact);
  pushContactObject(out, record.hiringManager);
  pushContactObject(out, record.hiringManagerContact);
  pushContactObject(out, record.primaryRecruiter);
  pushContactObject(out, record.recruiter);

  const listing = record.listing ?? record.listingPreview;
  if (listing && isRecord(listing)) {
    collectContactsFromRecord(out, listing);
  }
}

function collectRawContacts(job: ExecThreadListingRaw): ExecThreadContactRaw[] {
  const out: ExecThreadContactRaw[] = [];
  collectContactsFromRecord(out, job as Record<string, unknown>);

  const exportBundle = job._kimchiExport as {
    redeem?: Record<string, unknown>;
    memberJob?: Record<string, unknown>;
  } | undefined;

  if (exportBundle?.redeem) {
    collectContactsFromRecord(out, exportBundle.redeem);
  }

  if (exportBundle?.memberJob) {
    collectContactsFromRecord(out, exportBundle.memberJob);
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
