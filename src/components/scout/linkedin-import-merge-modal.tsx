"use client";

import {
  defaultSelectedImportSections,
  type LinkedInImportMergeDiff,
  type LinkedInImportMergeSection,
} from "@/lib/linkedin-import-merge";
import { SelectiveMergeModal } from "@/components/scout/selective-merge-modal";

type Props = {
  open: boolean;
  loading: boolean;
  applying: boolean;
  error: string | null;
  diffs: LinkedInImportMergeDiff[];
  isFirstImport: boolean;
  onClose: () => void;
  onApply: (sections: LinkedInImportMergeSection[]) => void;
};

export function LinkedInImportMergeModal({
  open,
  loading,
  applying,
  error,
  diffs,
  isFirstImport,
  onClose,
  onApply,
}: Props) {
  const changeCount = diffs.filter((d) => d.hasChange).length;

  return (
    <SelectiveMergeModal
      open={open}
      loading={loading}
      applying={applying}
      error={error}
      title={isFirstImport ? "Import from LinkedIn" : "Review LinkedIn import"}
      description={
        isFirstImport
          ? "Choose which sections from LinkedIn to bring into your Kimchi preview. Nothing is saved until you confirm."
          : `LinkedIn has ${changeCount} section${changeCount === 1 ? "" : "s"} that differ from your current preview. Check what you want to bring over — unchecked sections stay as-is.`
      }
      emptyDescription="LinkedIn matches your current preview. You can still re-import any section if you want to refresh it."
      loadingLabel="Fetching your LinkedIn profile…"
      currentColumnTitle="Current preview"
      proposedColumnTitle="From LinkedIn"
      diffs={diffs}
      defaultSelected={(rows) => defaultSelectedImportSections(rows as LinkedInImportMergeDiff[])}
      onClose={onClose}
      onApply={(sections) => onApply(sections as LinkedInImportMergeSection[])}
    />
  );
}
