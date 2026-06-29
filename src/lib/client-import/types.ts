import type { JobStage } from "@prisma/client";
import type { StrategyProfileFields } from "@/lib/career-strategy";
import type { SuggestedTrackedCompany } from "@/lib/intake-tracked-companies";

export type ImportRow<T> = {
  id: string;
  selected: boolean;
  source: string;
  data: T;
};

export type ImportPipelineJob = {
  company: string;
  role: string;
  url: string | null;
  stage: JobStage;
  notes: string | null;
  appliedAt: string | null;
  /** Coach Yes/No approval column — no Job.approved field; influences stage on import. */
  approved: boolean | null;
  resumeUrl: string | null;
  hirebaseSlug?: string | null;
  apiLinked?: boolean;
};

export type ImportContact = {
  email: string;
  name: string | null;
  company: string | null;
  linkedinUrl: string | null;
  notes: string | null;
  contacted: boolean | null;
};

export type ImportReferenceDocument = {
  id: string;
  filename: string;
  assetType: string;
  reason: string;
};

export type ImportApplicationQa = {
  question: string;
  answer: string;
  tags: string[];
};

export type ClientImportPreview = {
  sourceFiles: Array<{ filename: string; kind: string }>;
  profile: {
    targetRoles: ImportRow<string>[];
    deprioritizedRoles: ImportRow<string>[];
    prioritizedCategories?: ImportRow<string>[];
    deprioritizedCategories?: ImportRow<string>[];
    searchDuration: string | null;
    avoidNotes: string | null;
    proposed: Partial<StrategyProfileFields>;
  };
  pipelineJobs: ImportRow<ImportPipelineJob>[];
  companies: ImportRow<SuggestedTrackedCompany>[];
  contacts: ImportRow<ImportContact>[];
  applicationQa?: ImportRow<ImportApplicationQa>[];
  referenceDocuments: ImportReferenceDocument[];
  resume?: {
    filename: string;
    assetId: string;
    parsed: boolean;
    summary: string | null;
  } | null;
  warnings: string[];
};

export type ClientImportApplyPayload = {
  profile?: {
    targetRoles?: string[];
    deprioritizedRoles?: string[];
    prioritizedCategories?: string[];
    deprioritizedCategories?: string[];
    searchDuration?: string | null;
    avoidNotes?: string | null;
    proposed?: Partial<StrategyProfileFields>;
  };
  pipelineJobIds?: string[];
  companyIds?: string[];
  contactIds?: string[];
  applicationQaIds?: string[];
  applyResume?: boolean;
  preview: ClientImportPreview;
};

export type ImportListAudit = {
  added: string[];
  skipped: string[];
};

export type ImportJobAuditItem = {
  company: string;
  role: string;
  fields?: string[];
};

export type ClientImportApplyAudit = {
  targetRoles: ImportListAudit;
  deprioritizedRoles: ImportListAudit;
  prioritizedCategories: ImportListAudit;
  deprioritizedCategories: ImportListAudit;
  searchDuration: { set: boolean; value: string | null };
  avoidNotes: { appended: boolean; preview: string | null };
  applicationQa: {
    added: Array<{ question: string }>;
    skipped: Array<{ question: string; reason: string }>;
  };
  jobs: {
    added: ImportJobAuditItem[];
    updated: ImportJobAuditItem[];
    skipped: ImportJobAuditItem[];
  };
  resume: { applied: boolean; filename: string | null };
};

export type ClientImportApplyResult = {
  profileUpdated: boolean;
  jobs: { added: number; updated: number; skipped: number; descriptionsEnriched: number };
  companies: { added: number; updated: number; skipped: number };
  contacts: { added: number; updated: number; skipped: number };
  roles: { targetSelected: number; deprioritizedSelected: number };
  categories: { prioritizedSelected: number; deprioritizedSelected: number };
  applicationQa: { added: number; skipped: number };
  referenceDocumentsStored: number;
  audit: ClientImportApplyAudit;
  errors: string[];
};
