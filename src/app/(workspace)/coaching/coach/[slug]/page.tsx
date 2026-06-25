import { CoachProfileClient } from "./profile-client";
import { BetaFeaturePage } from "@/lib/beta-feature-page";

type Props = { params: Promise<{ slug: string }> };

export default async function CoachProfilePage({ params }: Props) {
  const { slug } = await params;
  return (
    <BetaFeaturePage feature="coaching">
      <CoachProfileClient slug={slug} />
    </BetaFeaturePage>
  );
}
