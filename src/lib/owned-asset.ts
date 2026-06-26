import type { User, UserAsset } from "@prisma/client";
import { getActingUser } from "@/lib/acting-user";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { hydrateResumeAsset } from "@/lib/ensure-asset-resume";

export async function getOwnedAssetForActingUser(
  assetId: string,
  request?: Request,
): Promise<{ dbUser: User; asset: UserAsset } | null> {
  let dbUser: User | null = null;
  if (request) {
    const scoped = await resolveScopedDbUser(request);
    dbUser = scoped.dbUser;
  } else {
    const acting = await getActingUser();
    dbUser = acting.dbUser;
  }
  if (!dbUser) return null;

  const hydrated = await hydrateResumeAsset(assetId, dbUser.id);
  if (!hydrated) return null;

  return { dbUser, asset: hydrated };
}
