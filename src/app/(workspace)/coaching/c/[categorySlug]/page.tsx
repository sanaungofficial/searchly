import { BetaFeaturePage } from "@/lib/beta-feature-page";
import { slugToCategory } from "@/lib/coach-categories";
import { CoachingCategoryClient } from "./category-client";

type Props = { params: Promise<{ categorySlug: string }> };

export default async function CoachingCategoryPage({ params }: Props) {
  const { categorySlug } = await params;
  const category = slugToCategory(categorySlug);

  if (!category) {
    return (
      <BetaFeaturePage feature="coaching">
        <CoachingCategoryClient category={null} categorySlug={categorySlug} />
      </BetaFeaturePage>
    );
  }

  return (
    <BetaFeaturePage feature="coaching">
      <CoachingCategoryClient category={category} categorySlug={categorySlug} />
    </BetaFeaturePage>
  );
}
