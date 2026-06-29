import type { ClientImportApplyResult } from "@/lib/client-import/types";

export type ImportVerifyLink = {
  label: string;
  href: string;
  hint: string;
};

export function buildImportVerifyLinks(clientUserId?: string | null): ImportVerifyLink[] {
  const withClient = (path: string) => {
    if (!clientUserId) return path;
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}clientUserId=${encodeURIComponent(clientUserId)}`;
  };

  return [
    {
      label: "Preferences → Import",
      href: withClient("/profile/preferences/import"),
      hint: "Re-open import hub to add more data.",
    },
    {
      label: "Preferences (roles & keywords)",
      href: withClient("/profile/preferences"),
      hint: "Target roles, keywords to use/avoid, deprioritized titles.",
    },
    {
      label: "Profile → About",
      href: withClient("/profile"),
      hint: "Career motivation and strategy notes from import.",
    },
    {
      label: "Application Q&A bank",
      href: withClient("/profile/preferences"),
      hint: "Saved passwords and application answers — filter by “passwords” tag.",
    },
    {
      label: "Target companies",
      href: withClient("/profile/target-companies"),
      hint: "Watchlist companies from import.",
    },
    {
      label: "Dashboard / pipeline",
      href: withClient("/dashboard"),
      hint: "Imported jobs and application stages.",
    },
  ];
}

export function summarizeImportResult(result: ClientImportApplyResult): string[] {
  const lines: string[] = [];

  if (result.audit?.targetRoles.added.length) {
    lines.push(`${result.audit.targetRoles.added.length} target role(s) added`);
  }
  if (result.audit?.targetRoles.skipped.length) {
    lines.push(`${result.audit.targetRoles.skipped.length} target role(s) skipped — already on profile`);
  }
  if (result.audit?.deprioritizedRoles.added.length) {
    lines.push(`${result.audit.deprioritizedRoles.added.length} deprioritized role(s) added`);
  }
  if (result.audit?.prioritizedCategories.added.length) {
    lines.push(`${result.audit.prioritizedCategories.added.length} keyword(s) to use added`);
  }
  if (result.audit?.deprioritizedCategories.added.length) {
    lines.push(`${result.audit.deprioritizedCategories.added.length} keyword(s) to avoid added`);
  }
  if (result.audit?.applicationQa.added.length) {
    lines.push(`${result.audit.applicationQa.added.length} login credential(s) saved`);
  }
  if (result.audit?.applicationQa.skipped.length) {
    lines.push(`${result.audit.applicationQa.skipped.length} credential(s) skipped — duplicate question`);
  }
  if (result.jobs.added) lines.push(`${result.jobs.added} job(s) added`);
  if (result.jobs.updated) lines.push(`${result.jobs.updated} job(s) updated`);
  if (result.jobs.skipped) lines.push(`${result.jobs.skipped} job(s) unchanged`);
  if (result.companies.added) lines.push(`${result.companies.added} company(ies) added`);
  if (result.contacts.added || result.contacts.updated) {
    lines.push(`${result.contacts.added} contact(s) added, ${result.contacts.updated} updated`);
  }
  if (result.audit?.resume.applied) lines.push("Resume applied to profile");

  return lines;
}
