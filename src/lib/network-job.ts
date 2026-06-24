/** In-network / second-tier recruiter network roles (Top Echelon Big Biller). */

export type NetworkJobTier = "in-network" | "second-tier";

export type NetworkJobListing = {
  id: string;
  externalId: string;
  networkId: string;
  positionTitle: string;
  companyName: string | null;
  location: string;
  salary: string;
  jobType: string | null;
  remoteOption: string | null;
  fee: string | null;
  feeType: string | null;
  recruiterName: string;
  recruiterAgency: string | null;
  sharedAt: string;
  description: string;
  recruiterNotes: string | null;
  networkTier: NetworkJobTier;
};

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatNetworkJobSalary(min?: number | null, max?: number | null, jobType?: string | null): string {
  if (min == null && max == null) return "Compensation TBD";
  const isHourly = jobType?.toLowerCase().includes("contract") || (min != null && min < 500);
  const fmt = (n: number) =>
    isHourly
      ? `$${n.toFixed(2)}/hr`
      : n >= 1000
        ? `$${Math.round(n / 1000)}K`
        : `$${n.toLocaleString()}`;
  if (min != null && max != null && min !== max) return `${fmt(min)}–${fmt(max)}`;
  const single = min ?? max!;
  return fmt(single);
}

export function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - then) / (1000 * 60 * 60 * 24)));
}

export function networkTierLabel(tier: NetworkJobTier): string {
  return tier === "in-network" ? "In-network" : "Second-tier network";
}

/** Frontend preview seed — three live Top Echelon network roles. */
export const SEED_NETWORK_JOBS: NetworkJobListing[] = [
  {
    id: "net-2755901",
    externalId: "2755901",
    networkId: "BU82-2755901",
    positionTitle: "Phlebotomist 5288",
    companyName: "Regional Medical Lab Services",
    location: "Liverpool, NY",
    salary: "$22.23/hr",
    jobType: "Contract",
    remoteOption: "On-site",
    fee: null,
    feeType: null,
    recruiterName: "Mario Fidanzi",
    recruiterAgency: "BU82 Recruiting",
    sharedAt: "2026-06-18T14:22:00.000Z",
    description: `We are seeking an experienced Phlebotomist for a contract assignment supporting a high-volume outpatient lab in the Liverpool, NY area.

Responsibilities:
• Perform venipuncture and capillary blood collection on patients of all ages
• Label, process, and prepare specimens according to laboratory protocols
• Maintain patient comfort and safety during collection procedures
• Follow HIPAA, OSHA, and CLIA compliance standards
• Document collections accurately in the lab information system

Requirements:
• Active phlebotomy certification (CPT or equivalent)
• Minimum 1 year of recent phlebotomy experience in a clinical setting
• Strong attention to detail and patient communication skills
• Ability to work a flexible schedule including early mornings

This is a contract role with immediate start availability. Competitive hourly rate with potential for extension based on performance.`,
    recruiterNotes: `Mario notes: Client needs someone who can start within 2 weeks. Prior experience in outpatient or mobile phlebotomy is a strong plus. They are flexible on schedule but prefer candidates who can cover early AM draws. No relocation — local candidates only.`,
    networkTier: "in-network",
  },
  {
    id: "net-2755376",
    externalId: "2755376",
    networkId: "NJ142-2755376",
    positionTitle: "Key Account Manager",
    companyName: "Confidential — B2B SaaS",
    location: "Sacramento, CA",
    salary: "$230K–$250K",
    jobType: "Full-time",
    remoteOption: "Hybrid",
    fee: "$20,000",
    feeType: "flat",
    recruiterName: "Steve Dooling",
    recruiterAgency: "NJ142 Search Partners",
    sharedAt: "2026-06-15T09:10:00.000Z",
    description: `Our client, a growth-stage B2B SaaS company, is hiring a Key Account Manager to own and expand relationships with their largest enterprise customers in the Western US.

What you'll do:
• Manage a portfolio of 8–12 strategic accounts ($500K–$2M ARR each)
• Drive renewals, upsells, and cross-sells with C-suite and VP-level stakeholders
• Partner with Customer Success and Product to deliver measurable business outcomes
• Build account plans, QBRs, and executive relationships that reduce churn
• Identify expansion opportunities and coordinate with sales on new logos

Ideal profile:
• 7+ years in enterprise account management or strategic customer success
• Track record of retaining and growing seven-figure accounts
• Experience selling into mid-market or enterprise SaaS buyers
• Based in or willing to relocate to the Sacramento region (hybrid 2–3 days onsite)

Compensation includes base + variable with OTE in the $230K–$250K range, plus equity and full benefits.`,
    recruiterNotes: `Steve: Strong role with a repeat client. They rejected two candidates last month for lacking enterprise SaaS experience — please prioritize candidates with $1M+ account ownership. Interview process is 3 rounds, can move fast for the right person. $20K flat fee on placement.`,
    networkTier: "in-network",
  },
  {
    id: "net-2755899",
    externalId: "2755899",
    networkId: "AH98-2755899",
    positionTitle: "Attorney – Creditors' Rights / Litigation",
    companyName: "National Creditor Services Firm",
    location: "San Diego, CA (Remote)",
    salary: "$115K–$145K",
    jobType: "Full-time",
    remoteOption: "Remote",
    fee: "20%",
    feeType: "percentage",
    recruiterName: "Scarlett Wells",
    recruiterAgency: "AH98 Legal Search",
    sharedAt: "2026-06-17T16:45:00.000Z",
    description: `A well-established creditors' rights firm is seeking a litigation attorney to handle consumer and commercial collection matters across multiple jurisdictions. Fully remote with occasional travel for court appearances.

Key responsibilities:
• Manage a caseload of creditors' rights litigation from filing through resolution
• Draft pleadings, motions, and discovery in state and federal courts
• Represent clients in hearings, mediations, and settlement negotiations
• Ensure compliance with FDCPA, TCPA, and state collection regulations
• Collaborate with paralegals and support staff on document production

Qualifications:
• JD and active bar membership (CA preferred; multi-state a plus)
• 3–6 years of creditors' rights, collections, or commercial litigation experience
• Strong legal writing and courtroom presence
• Comfortable working independently in a remote environment

Benefits include health/dental/vision, 401(k) match, PTO, and professional development stipend. Salary range $115K–$145K depending on experience and bar admissions.`,
    recruiterNotes: `Scarlett: Remote-friendly firm with a stable book of business. They want someone who has actually appeared in court — not just motion practice. Barred in CA is ideal; will consider adjacent states with willingness to get admitted. 20% fee, 90-day guarantee. Please do not send candidates who only have general corporate experience.`,
    networkTier: "second-tier",
  },
];
