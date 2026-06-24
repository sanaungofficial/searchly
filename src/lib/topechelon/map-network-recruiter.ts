import type { TopEchelonNetworkJobRaw } from "@/lib/topechelon/types";

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

function recruiterObject(job: TopEchelonNetworkJobRaw): Record<string, unknown> | null {
  const r = job.recruiter;
  if (!r || typeof r !== "object") return null;
  return r as Record<string, unknown>;
}

function agencyName(job: TopEchelonNetworkJobRaw): string | null {
  const agency = job.agency_detail ?? job.agencyDetail;
  if (!agency || typeof agency !== "object") return null;
  const a = agency as Record<string, unknown>;
  return (
    (typeof a.name === "string" ? a.name : null) ??
    (typeof a.company_name === "string" ? a.company_name : null) ??
    (typeof a.companyName === "string" ? a.companyName : null)
  );
}

export function mapTopEchelonNetworkRecruiter(job: TopEchelonNetworkJobRaw): MappedNetworkRecruiter | null {
  const r = recruiterObject(job);
  if (!r || r.id == null) return null;

  const firstName =
    (typeof r.first_name === "string" ? r.first_name : null) ??
    (typeof r.firstName === "string" ? r.firstName : null);
  const lastName =
    (typeof r.last_name === "string" ? r.last_name : null) ??
    (typeof r.lastName === "string" ? r.lastName : null);
  const name =
    (typeof r.name === "string" && r.name.trim() ? r.name : null) ??
    ([firstName, lastName].filter(Boolean).join(" ") || null);

  return {
    externalId: String(r.id),
    firstName,
    lastName,
    name,
    email: typeof r.email === "string" ? r.email : null,
    phone:
      (typeof r.phone === "string" ? r.phone : null) ??
      (typeof r.phone_number === "string" ? r.phone_number : null) ??
      (typeof r.phoneNumber === "string" ? r.phoneNumber : null),
    agencyName: agencyName(job),
    raw: r,
  };
}
