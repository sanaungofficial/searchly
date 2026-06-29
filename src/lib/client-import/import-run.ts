import type { ImportRun, ImportRunStatus, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getImportTypeConfig, parseImportType } from "@/lib/client-import/import-types";
import type { ClientImportApplyResult, ClientImportPreview } from "@/lib/client-import/types";

export type ImportRunMeta = {
  importType: string;
  fileName?: string | null;
  sourceKind: "file" | "paste";
};

export type ImportRunListItem = {
  id: string;
  createdAt: string;
  status: ImportRunStatus;
  importedByName: string | null;
  fileName: string | null;
  sourceKind: string;
  importType: string;
  importTypeLabel: string;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
};

export type ImportRunDetail = ImportRunListItem & {
  result: ClientImportApplyResult;
  errors: string[];
};

export function deriveImportRunStatus(result: ClientImportApplyResult): ImportRunStatus {
  const errorCount = result.errors?.length ?? 0;
  const created =
    result.jobs.added +
    result.companies.added +
    result.contacts.added +
    result.applicationQa.added +
    (result.audit?.targetRoles.added.length ?? 0) +
    (result.audit?.deprioritizedRoles.added.length ?? 0) +
    (result.audit?.prioritizedCategories.added.length ?? 0) +
    (result.audit?.deprioritizedCategories.added.length ?? 0);
  const updated =
    result.jobs.updated +
    result.companies.updated +
    result.contacts.updated +
    (result.profileUpdated ? 1 : 0);

  if (errorCount === 0) return "SUCCESS";
  if (created + updated === 0) return "FAILED";
  return "SOME_FAILURES";
}

export function computeImportCounts(result: ClientImportApplyResult) {
  const createdCount =
    result.jobs.added +
    result.companies.added +
    result.contacts.added +
    result.applicationQa.added +
    (result.audit?.targetRoles.added.length ?? 0) +
    (result.audit?.deprioritizedRoles.added.length ?? 0) +
    (result.audit?.prioritizedCategories.added.length ?? 0) +
    (result.audit?.deprioritizedCategories.added.length ?? 0);
  const updatedCount =
    result.jobs.updated + result.companies.updated + result.contacts.updated + (result.profileUpdated ? 1 : 0);
  const skippedCount =
    result.jobs.skipped +
    result.companies.skipped +
    result.contacts.skipped +
    result.applicationQa.skipped +
    (result.audit?.targetRoles.skipped.length ?? 0) +
    (result.audit?.deprioritizedRoles.skipped.length ?? 0) +
    (result.audit?.prioritizedCategories.skipped.length ?? 0) +
    (result.audit?.deprioritizedCategories.skipped.length ?? 0) +
    (result.audit?.jobs.skipped.length ?? 0);
  const failedCount = result.errors?.length ?? 0;

  return { createdCount, updatedCount, skippedCount, failedCount };
}

export function resolveImportMeta(
  meta: Partial<ImportRunMeta> | undefined,
  preview?: ClientImportPreview | null,
): ImportRunMeta {
  const sourceFiles = preview?.sourceFiles ?? [];
  const fileName =
    meta?.fileName !== undefined
      ? meta.fileName
      : sourceFiles.length === 1
        ? sourceFiles[0]?.filename ?? null
        : sourceFiles.length > 1
          ? `${sourceFiles[0]?.filename ?? "file"} +${sourceFiles.length - 1}`
          : null;

  const sourceKind =
    meta?.sourceKind ?? (fileName ? "file" : preview?.sourceFiles?.length ? "file" : "paste");

  let importType = meta?.importType ?? inferImportTypeFromPreview(preview);
  if (!parseImportType(importType)) importType = "client_packet";

  return { importType, fileName, sourceKind };
}

function inferImportTypeFromPreview(preview?: ClientImportPreview | null): string {
  if (!preview) return "client_packet";
  const hasJobs = preview.pipelineJobs.length > 0;
  const hasCompanies = preview.companies.length > 0;
  const hasProfile =
    preview.profile.targetRoles.length > 0 ||
    preview.profile.deprioritizedRoles.length > 0 ||
    (preview.profile.prioritizedCategories?.length ?? 0) > 0 ||
    (preview.profile.deprioritizedCategories?.length ?? 0) > 0 ||
    !!preview.profile.searchDuration ||
    !!preview.profile.avoidNotes;
  const hasQa = (preview.applicationQa?.length ?? 0) > 0;

  if (hasJobs && !hasCompanies && !hasProfile) return "job_tracker";
  if (hasCompanies && !hasJobs && !hasProfile) return "target_companies";
  if (hasProfile && !hasJobs && !hasCompanies) return "application_info";
  if (hasQa && !hasJobs && !hasCompanies) return "passwords";
  return "client_packet";
}

export function importTypeLabel(importType: string): string {
  const parsed = parseImportType(importType);
  if (parsed) return getImportTypeConfig(parsed).label;
  return importType.replace(/_/g, " ");
}

export function importRunFileLabel(fileName: string | null, sourceKind: string): string {
  if (fileName) return fileName;
  return sourceKind === "paste" ? "Pasted" : "—";
}

export async function recordImportRun(input: {
  clientUserId: string;
  importedById: string;
  meta: Partial<ImportRunMeta>;
  preview?: ClientImportPreview | null;
  result: ClientImportApplyResult;
}): Promise<ImportRun> {
  const meta = resolveImportMeta(input.meta, input.preview);
  const counts = computeImportCounts(input.result);
  const status = deriveImportRunStatus(input.result);
  const errors = input.result.errors ?? [];

  return prisma.importRun.create({
    data: {
      clientUserId: input.clientUserId,
      importedById: input.importedById,
      importType: meta.importType,
      fileName: meta.fileName,
      sourceKind: meta.sourceKind,
      status,
      ...counts,
      resultSnapshot: input.result as object,
      errorDetails: errors.length ? errors : undefined,
    },
  });
}

export function serializeImportRunListItem(
  run: ImportRun & { importedBy?: Pick<User, "name" | "email"> | null },
): ImportRunListItem {
  return {
    id: run.id,
    createdAt: run.createdAt.toISOString(),
    status: run.status,
    importedByName: run.importedBy?.name ?? run.importedBy?.email ?? null,
    fileName: run.fileName,
    sourceKind: run.sourceKind,
    importType: run.importType,
    importTypeLabel: importTypeLabel(run.importType),
    createdCount: run.createdCount,
    updatedCount: run.updatedCount,
    skippedCount: run.skippedCount,
    failedCount: run.failedCount,
  };
}

export function serializeImportRunDetail(
  run: ImportRun & { importedBy?: Pick<User, "name" | "email"> | null },
): ImportRunDetail {
  const result = run.resultSnapshot as ClientImportApplyResult;
  const errors = Array.isArray(run.errorDetails)
    ? (run.errorDetails as string[])
    : (result.errors ?? []);

  return {
    ...serializeImportRunListItem(run),
    result: { ...result, errors },
    errors,
  };
}

export function buildIntakeApplyResult(input: {
  profileUpdated: boolean;
  companiesAdded: number;
  companiesUpdated: number;
  qaAdded: number;
  qaSkipped: number;
  errors?: string[];
}): ClientImportApplyResult {
  return {
    profileUpdated: input.profileUpdated,
    jobs: { added: 0, updated: 0, skipped: 0, descriptionsEnriched: 0 },
    companies: { added: input.companiesAdded, updated: input.companiesUpdated, skipped: 0 },
    contacts: { added: 0, updated: 0, skipped: 0 },
    roles: { targetSelected: 0, deprioritizedSelected: 0 },
    categories: { prioritizedSelected: 0, deprioritizedSelected: 0 },
    applicationQa: { added: input.qaAdded, skipped: input.qaSkipped },
    referenceDocumentsStored: 0,
    audit: {
      targetRoles: { added: [], skipped: [] },
      deprioritizedRoles: { added: [], skipped: [] },
      prioritizedCategories: { added: [], skipped: [] },
      deprioritizedCategories: { added: [], skipped: [] },
      searchDuration: { set: false, value: null },
      avoidNotes: { appended: false, preview: null },
      applicationQa: { added: [], skipped: [] },
      jobs: { added: [], updated: [], skipped: [] },
      resume: { applied: false, filename: null },
    },
    errors: input.errors ?? [],
  };
}

export function downloadImportErrorsCsv(errors: string[], fileName = "import-errors.csv") {
  const header = "error\n";
  const body = errors.map((e) => `"${e.replace(/"/g, '""')}"`).join("\n");
  const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function importStatusLabel(status: ImportRunStatus): string {
  switch (status) {
    case "SUCCESS":
      return "Success";
    case "SOME_FAILURES":
      return "Some failures";
    case "FAILED":
      return "Failed";
    default:
      return status;
  }
}

export function importStatusColor(status: ImportRunStatus): string {
  switch (status) {
    case "SUCCESS":
      return colorFor("success");
    case "SOME_FAILURES":
      return colorFor("warn");
    case "FAILED":
      return colorFor("error");
    default:
      return colorFor("muted");
  }
}

function colorFor(kind: "success" | "warn" | "error" | "muted"): string {
  switch (kind) {
    case "success":
      return "#2d6a4f";
    case "warn":
      return "#b8860b";
    case "error":
      return "#b04040";
    default:
      return "#6b7280";
  }
}

export function primaryVerifyLinkForImportType(
  importType: string,
  clientUserId?: string,
): { label: string; href: string } | null {
  const withClient = (path: string) => {
    if (!clientUserId) return path;
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}clientUserId=${encodeURIComponent(clientUserId)}`;
  };

  const parsed = parseImportType(importType);
  if (parsed === "job_tracker" || parsed === "interview_tracker") {
    return { label: "View pipeline", href: withClient("/dashboard") };
  }
  if (parsed === "target_companies") {
    return { label: "View target companies", href: withClient("/profile/target-companies") };
  }
  if (parsed === "application_info" || parsed === "job_titles" || parsed === "keywords") {
    return { label: "View profile preferences", href: withClient("/profile/preferences") };
  }
  return { label: "View profile", href: withClient("/profile") };
}
