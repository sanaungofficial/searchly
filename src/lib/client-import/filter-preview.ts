import type { ClientImportPreview } from "@/lib/client-import/types";
import type { ImportType } from "@/lib/client-import/import-types";
import { emptyImportPreview } from "@/lib/client-import/xlsx-parser";

function isInterviewSource(source: string): boolean {
  return /interview tracker/i.test(source);
}

/** Narrow a full workbook parse to the selected import type. */
export function filterImportPreviewByType(
  preview: ClientImportPreview,
  importType: ImportType,
): ClientImportPreview {
  const base = emptyImportPreview();
  base.sourceFiles = preview.sourceFiles;
  base.warnings = [...preview.warnings];

  switch (importType) {
    case "client_packet":
      return preview;

    case "job_tracker":
      return {
        ...base,
        pipelineJobs: preview.pipelineJobs.filter((row) => !isInterviewSource(row.source)),
        warnings: preview.pipelineJobs.filter((row) => !isInterviewSource(row.source)).length
          ? [`${preview.pipelineJobs.filter((row) => !isInterviewSource(row.source)).length} pipeline jobs.`]
          : ["No job tracker rows found."],
      };

    case "interview_tracker":
      return {
        ...base,
        pipelineJobs: preview.pipelineJobs.filter((row) => isInterviewSource(row.source)),
        warnings: preview.pipelineJobs.filter((row) => isInterviewSource(row.source)).length
          ? [`${preview.pipelineJobs.filter((row) => isInterviewSource(row.source)).length} interview tracker jobs.`]
          : ["No interview tracker tab found — try Job tracker type or paste rows."],
      };

    case "contacts":
      return {
        ...base,
        contacts: preview.contacts,
        warnings: preview.contacts.length ? [`${preview.contacts.length} contacts.`] : ["No contacts found."],
      };

    case "target_companies":
      return {
        ...base,
        companies: preview.companies.filter((row) => !/job tracker/i.test(row.source)),
        warnings: preview.companies.filter((row) => !/job tracker/i.test(row.source)).length
          ? [`${preview.companies.filter((row) => !/job tracker/i.test(row.source)).length} target companies.`]
          : ["No target companies tab found."],
      };

    case "job_titles":
      return {
        ...base,
        profile: {
          ...base.profile,
          targetRoles: preview.profile.targetRoles,
          deprioritizedRoles: preview.profile.deprioritizedRoles,
          avoidNotes: preview.profile.avoidNotes,
        },
        warnings:
          preview.profile.targetRoles.length || preview.profile.deprioritizedRoles.length
            ? [
                `${preview.profile.targetRoles.length} target roles, ${preview.profile.deprioritizedRoles.length} deprioritized.`,
              ]
            : ["No job titles found."],
      };

    case "keywords":
      return {
        ...base,
        profile: {
          ...base.profile,
          prioritizedCategories: preview.profile.prioritizedCategories ?? [],
          deprioritizedCategories: preview.profile.deprioritizedCategories ?? [],
        },
        warnings:
          (preview.profile.prioritizedCategories?.length ?? 0) +
            (preview.profile.deprioritizedCategories?.length ?? 0) >
          0
            ? [
                `${preview.profile.prioritizedCategories?.length ?? 0} to use, ${preview.profile.deprioritizedCategories?.length ?? 0} to avoid.`,
              ]
            : ["No keywords found."],
      };

    case "passwords":
      return {
        ...base,
        applicationQa: preview.applicationQa ?? [],
        warnings: preview.applicationQa?.length
          ? [`${preview.applicationQa.length} login credential entries.`]
          : ["No login credentials found."],
      };

    default:
      return preview;
  }
}
