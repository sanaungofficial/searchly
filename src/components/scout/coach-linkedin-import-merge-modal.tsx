"use client";

import {
  defaultSelectedCoachImportSections,
  type CoachLinkedInImportMergeDiff,
  type CoachLinkedInImportSection,
} from "@/lib/coach-linkedin-import-merge";
import { SelectiveMergeModal } from "@/components/scout/selective-merge-modal";

type Props = {
  open: boolean;
  loading: boolean;
  applying: boolean;
  error: string | null;
  diffs: CoachLinkedInImportMergeDiff[];
  onClose: () => void;
  onApply: (sections: CoachLinkedInImportSection[]) => void;
};

export function CoachLinkedInImportMergeModal({
  open,
  loading,
  applying,
  error,
  diffs,
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
      title="Review LinkedIn import"
      description={`LinkedIn has ${changeCount} section${changeCount === 1 ? "" : "s"} that differ from this coach profile. Check what you want to apply — unchecked sections stay as-is.`}
      emptyDescription="LinkedIn matches the current coach profile. You can still re-import any section if you want to refresh it."
      loadingLabel="Fetching LinkedIn profile…"
      currentColumnTitle="Current profile"
      proposedColumnTitle="From LinkedIn"
      diffs={diffs}
      defaultSelected={defaultSelectedCoachImportSections}
      onClose={onClose}
      onApply={(sections) => onApply(sections as CoachLinkedInImportSection[])}
    />
  );
}
