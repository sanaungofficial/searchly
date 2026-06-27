import { CoachProfilePageClient } from "@/components/scout/coach-profile-page-client";
import { BetaFeaturePage } from "@/lib/beta-feature-page";

type Props = { params: Promise<{ slug: string }> };

export default async function CoachPublicProfilePage({ params }: Props) {
  const { slug } = await params;
  return (
    <BetaFeaturePage feature="coaching">
      <CoachProfilePageClient slug={slug} />
    </BetaFeaturePage>
  );
}
