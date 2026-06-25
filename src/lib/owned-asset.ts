import type { User, UserAsset } from "@prisma/client";
import { getActingUser } from "@/lib/acting-user";
import { hydrateResumeAsset } from "@/lib/ensure-asset-resume";

export async function getOwnedAssetForActingUser(
  assetId: string,
  request?: Request,
): Promise<{ dbUser: User; asset: UserAsset } | null> {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return null;

  const hydrated = await hydrateResumeAsset(assetId, dbUser.id);
  if (!hydrated) return null;

  return { dbUser, asset: hydrated };
}
