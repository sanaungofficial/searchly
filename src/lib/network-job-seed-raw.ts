import type { TopEchelonNetworkJobRaw } from "@/lib/topechelon/types";

/**
 * Preview seed payloads shaped like Top Echelon `GET /network/jobs/:id.json` detail rows.
 * Values mirror TE field names; HTML fields use the markup recruiters enter in Big Biller.
 */
export const SEED_RAW_NETWORK_JOBS: TopEchelonNetworkJobRaw[] = [
  {
    id: 2755901,
    uuid: "a1b2c3d4-e5f6-4789-a012-275590100001",
    network_id: "BU82-2755901",
    position_title: "Phlebotomist 5288",
    city: "Liverpool",
    state: { abbreviation: "NY", name: "New York" },
    minimum_compensation: 22.23,
    maximum_compensation: 22.23,
    job_type: "Contract",
    remote_option: "On-site",
    fee: null,
    fee_type: null,
    network_status: "active",
    most_recently_shared_at: "2026-06-18T14:22:00.000Z",
    description:
      "<p><strong>Phlebotomist – Contract – Liverpool, NY</strong></p><p>High-volume outpatient lab client seeking an experienced phlebotomist for a contract assignment.</p><ul><li>Perform venipuncture and capillary collections</li><li>Label and process specimens per lab protocol</li><li>Maintain HIPAA / OSHA / CLIA compliance</li><li>Document in LIS accurately</li></ul><p><strong>Requirements:</strong> Active CPT (or equivalent), 1+ year recent clinical phlebotomy experience.</p>",
    comments:
      "<p>Client needs start within 2 weeks. Outpatient or mobile phlebotomy experience preferred. Flexible schedule but prefer early AM coverage. Local candidates only — no relocation.</p>",
    recruiter: {
      id: 8821,
      first_name: "Mario",
      last_name: "Fidanzi",
      email: "mario.fidanzi@bu82recruiting.com",
      phone: "(315) 555-0142",
    },
    agency_detail: {
      name: "BU82 Recruiting",
    },
    guarantee: null,
    guarantee_period: null,
    industries: ["Healthcare", "Laboratory"],
  },
  {
    id: 2755376,
    uuid: "b2c3d4e5-f6a7-4890-b123-275537600002",
    network_id: "NJ142-2755376",
    position_title: "Key Account Manager",
    city: "Sacramento",
    state: { abbreviation: "CA", name: "California" },
    minimum_compensation: 230000,
    maximum_compensation: 250000,
    job_type: "Full-time",
    remote_option: "Hybrid",
    fee: 20000,
    fee_type: "flat",
    network_status: "on_hold",
    most_recently_shared_at: "2026-06-15T09:10:00.000Z",
    description:
      "<p>Growth-stage B2B SaaS company hiring a <strong>Key Account Manager</strong> for Western US strategic accounts.</p><p><strong>Responsibilities:</strong></p><ul><li>Own 8–12 enterprise accounts ($500K–$2M ARR)</li><li>Drive renewals, upsells, and executive QBRs</li><li>Partner with CS and Product on outcomes</li></ul><p><strong>Profile:</strong> 7+ years enterprise AM/CS; seven-figure account growth track record; Sacramento hybrid.</p><p>OTE $230K–$250K + equity.</p>",
    comments:
      "<p>Repeat client. Prior submissions lacked enterprise SaaS depth — need $1M+ account ownership. 3-round interview, fast process for strong fits. $20K flat fee.</p>",
    recruiter: {
      id: 44102,
      first_name: "Steve",
      last_name: "Dooling",
      email: "steve.dooling@nj142search.com",
      phone: "(916) 555-0198",
    },
    agency_detail: {
      name: "NJ142 Search Partners",
    },
    guarantee: "90 days",
    guarantee_period: 90,
    industries: ["Software", "SaaS"],
  },
  {
    id: 2755899,
    uuid: "c3d4e5f6-a7b8-4901-c234-275589900003",
    network_id: "AH98-2755899",
    position_title: "Attorney – Creditors' Rights / Litigation REMOTE",
    city: "San Diego",
    state: { abbreviation: "CA", name: "California" },
    minimum_compensation: 115000,
    maximum_compensation: 145000,
    job_type: "Full-time",
    remote_option: "Remote",
    fee: 20,
    fee_type: "percentage",
    network_status: "active",
    most_recently_shared_at: "2026-06-17T16:45:00.000Z",
    description:
      "<p>Creditors' rights firm seeking litigation attorney for consumer and commercial collection matters. <strong>Remote</strong> with occasional court travel.</p><ul><li>Manage litigation caseload start to finish</li><li>Draft pleadings, motions, discovery</li><li>FDCPA / TCPA compliance</li></ul><p>JD required; 3–6 years creditors' rights or commercial litigation. CA bar preferred.</p><p>Salary $115K–$145K DOE.</p>",
    comments:
      "<p>Must have actual courtroom experience, not motion practice only. CA bar ideal; adjacent states OK if willing to get admitted. 20% fee, 90-day guarantee. No general corporate-only profiles.</p>",
    recruiter: {
      id: 33019,
      first_name: "Scarlett",
      last_name: "Wells",
      email: "scarlett.wells@ah98legal.com",
      phone: "(619) 555-0173",
    },
    agency_detail: {
      name: "AH98 Legal Search",
    },
    guarantee: "90 days",
    guarantee_period: 90,
    industries: ["Legal", "Collections"],
  },
];
