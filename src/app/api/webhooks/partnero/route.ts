import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { grantFeatureBonus } from "@/lib/feature-credits";
import { REFERRAL_BONUS_PER_FEATURE } from "@/lib/plan-config";
import type { PlanCreditFeature } from "@prisma/client";

const BONUS_FEATURES: PlanCreditFeature[] = ["MATCH", "TAILOR", "INSIDER"];

async function grantReferralBonuses(userId: string, amount: number) {
  for (const feature of BONUS_FEATURES) {
    await grantFeatureBonus(userId, feature, amount);
  }
}

/**
 * Partnero outgoing webhooks — grant Kimchi AI credits when referrals convert.
 * Configure in Partnero: Integration → Webhooks → customer.created (and/or reward.created)
 */
export async function POST(req: Request) {
  let body: { event?: string; data?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = body.event;
  const data = body.data ?? {};

  // Respond fast — Partnero expects 200
  if (event === "customer.created") {
    const referring = data.referring_customer as { key?: string } | undefined;
    const refereeKey = (data.key ?? data.id) as string | undefined;
    const referrerKey = referring?.key;

    if (referrerKey && refereeKey && referrerKey !== refereeKey) {
      try {
        const [referrer, referee] = await Promise.all([
          prisma.user.findFirst({
            where: { OR: [{ id: referrerKey }, { referralCode: referrerKey }] },
          }),
          prisma.user.findFirst({
            where: { OR: [{ id: refereeKey }, { email: (data.email as string) ?? "" }] },
          }),
        ]);

        if (referrer && referee) {
          await prisma.user.update({
            where: { id: referee.id },
            data: { referredByUserId: referrer.id },
          });
        }
      } catch (e) {
        console.error("[partnero webhook] customer.created attribution", e);
      }
    }
  }

  if (event === "reward.created" || event === "reward.approved") {
    const partnerKey = (data.partner as { key?: string })?.key
      ?? (data.customer as { key?: string })?.key
      ?? (data.key as string | undefined);

    if (partnerKey) {
      try {
        const user = await prisma.user.findFirst({
          where: { OR: [{ id: partnerKey }, { referralCode: partnerKey }] },
        });
        if (user) {
          // Skip if Kimchi already granted credits via completeReferral.
          const asReferee = await prisma.referralEvent.findUnique({ where: { refereeId: user.id } });
          const asReferrer = await prisma.referralEvent.count({ where: { referrerId: user.id } });
          if (!asReferee && asReferrer === 0) {
            await grantReferralBonuses(user.id, REFERRAL_BONUS_PER_FEATURE);
          }
        }
      } catch (e) {
        console.error("[partnero webhook] reward grant", e);
      }
    }
  }

  return NextResponse.json({ received: true });
}
