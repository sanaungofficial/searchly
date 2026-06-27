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

export type ClientImportPreview = {
  sourceFiles: Array<{ filename: string; kind: string }>;
  profile: {
    targetRoles: ImportRow<string>[];
    deprioritizedRoles: ImportRow<string>[];
    searchDuration: string | null;
    avoidNotes: string | null;
    proposed: Partial<StrategyProfileFields>;
  };
  pipelineJobs: ImportRow<ImportPipelineJob>[];
  companies: ImportRow<SuggestedTrackedCompany>[];
  contacts: ImportRow<ImportContact>[];
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
    searchDuration?: string | null;
    avoidNotes?: string | null;
    proposed?: Partial<StrategyProfileFields>;
  };
  pipelineJobIds?: string[];
  companyIds?: string[];
  contactIds?: string[];
  applyResume?: boolean;
  preview: ClientImportPreview;
};

export type ClientImportApplyResult = {
  profileUpdated: boolean;
  jobs: { added: number; updated: number; skipped: number };
  companies: { added: number; updated: number; skipped: number };
  contacts: { added: number; updated: number; skipped: number };
  referenceDocumentsStored: number;
  errors: string[];
};
