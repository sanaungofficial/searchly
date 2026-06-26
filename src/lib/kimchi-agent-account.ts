import { prisma } from "@/lib/prisma";
import { getNylasConfig, nylasFetch } from "@/lib/nylas";

const DEFAULT_PURPOSE = "pipeline_assistant";

type AgentAccountResponse = {
  data?: { id?: string; grant_id?: string; email?: string };
  grant_id?: string;
  id?: string;
  email?: string;
};

/** Provision or load the Kimchi Nylas Agent Account (system mailbox). */
export async function ensureKimchiAgentAccount(): Promise<{
  purpose: string;
  email: string;
  grantId: string;
} | null> {
  const email = process.env.KIMCHI_AGENT_EMAIL?.trim();
  if (!email) return null;

  const existing = await prisma.kimchiAgentAccount.findUnique({
    where: { purpose: DEFAULT_PURPOSE },
  });
  if (existing) {
    return { purpose: existing.purpose, email: existing.email, grantId: existing.nylasGrantId };
  }

  const cfg = getNylasConfig();
  if (!cfg) return null;

  const displayName = process.env.KIMCHI_AGENT_DISPLAY_NAME?.trim() || "Kimchi";

  try {
    const res = await nylasFetch<AgentAccountResponse>("/v3/connect/custom", {
      method: "POST",
      body: {
        provider: "nylas",
        settings: {
          email,
          name: displayName,
        },
      },
    });

    const data = res.data ?? res;
    const grantId = data.grant_id ?? data.id;
    if (!grantId) throw new Error("Nylas Agent Account did not return grant_id");

    const row = await prisma.kimchiAgentAccount.create({
      data: {
        purpose: DEFAULT_PURPOSE,
        email,
        nylasGrantId: grantId,
        displayName,
      },
    });

    return { purpose: row.purpose, email: row.email, grantId: row.nylasGrantId };
  } catch (err) {
    console.error("[kimchi-agent-account] provision failed", err);
    return null;
  }
}
