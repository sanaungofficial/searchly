import {
  attachNylasOAuthCookie,
  buildNylasAuthUrl,
  isNylasConfigured,
  resolveKimchiAppUrl,
  signNylasOAuthState,
} from "@/lib/nylas";
import type { NetworkPoolVisibility } from "@prisma/client";

export function buildOrgNetworkOAuthRedirect(params: {
  orgMemberId: string;
  userId: string;
  userEmail: string | null;
  visibility: NetworkPoolVisibility;
  returnPath: string;
  provider: "google" | "microsoft";
  appUrl: string;
}) {
  if (!isNylasConfigured()) {
    throw new Error("Nylas is not configured");
  }

  const oauthPayload = {
    kind: "orgNetwork" as const,
    orgMemberId: params.orgMemberId,
    userId: params.userId,
    visibility: params.visibility,
    ts: Date.now(),
    returnAppUrl: params.appUrl,
    returnPath: params.returnPath,
  };
  const state = signNylasOAuthState(oauthPayload);
  const url = buildNylasAuthUrl({
    provider: params.provider,
    state,
    loginHint: params.userEmail ?? undefined,
    inboxAccess: true,
  });

  return { url, oauthPayload };
}

export { attachNylasOAuthCookie };
