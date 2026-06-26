import type { LinkedInChecklistItem } from "@/lib/linkedin-profile";
import { linkedInChecklist, type LinkedInProfileDraft } from "@/lib/linkedin-profile";
import type { LinkedInSectionId } from "@/lib/linkedin-analysis";

export type ChecklistProgressItem = LinkedInChecklistItem & {
  optimized: boolean;
  jumpSection?: LinkedInSectionId | "featured";
  jumpEntryId?: string;
};

function isChecklistItemOptimized(item: LinkedInChecklistItem): boolean {
  if (item.imageUrl) return Boolean(item.imageUrl.trim());
  const text = item.copyText?.trim() ?? "";
  if (!text) return false;
  if (item.id === "headline") return text.length >= 40;
  if (item.id === "about") return text.length >= 200;
  if (item.id.startsWith("exp_")) return text.length >= 80 || /\d|%|\$/.test(text);
  if (item.id === "skills") return text.split(",").filter(Boolean).length >= 5;
  return text.length >= 8;
}

function jumpTargetForItem(item: LinkedInChecklistItem): {
  jumpSection?: LinkedInSectionId | "featured";
  jumpEntryId?: string;
} {
  if (item.id === "headline") return { jumpSection: "headline" };
  if (item.id === "about") return { jumpSection: "about" };
  if (item.id === "skills") return { jumpSection: "skills" };
  if (item.id.startsWith("exp_")) {
    return { jumpSection: "experience", jumpEntryId: item.id.replace(/^exp_/, "") };
  }
  if (item.id.startsWith("feat_")) return { jumpSection: "featured" };
  return {};
}

export function linkedInChecklistProgress(draft: LinkedInProfileDraft): {
  items: ChecklistProgressItem[];
  optimizedCount: number;
  totalCount: number;
  nextWeak?: ChecklistProgressItem;
} {
  const items = linkedInChecklist(draft).map((item) => {
    const optimized = isChecklistItemOptimized(item);
    return { ...item, optimized, ...jumpTargetForItem(item) };
  });
  const optimizedCount = items.filter((i) => i.optimized).length;
  const nextWeak = items.find((i) => !i.optimized);
  return {
    items,
    optimizedCount,
    totalCount: items.length,
    nextWeak,
  };
}
