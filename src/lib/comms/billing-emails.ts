import { ctaButton, emailShell, escapeHtml, appBaseUrl } from "@/lib/comms/email-shell";
import { sendKimchiEmail } from "@/lib/comms/send-email";

export async function sendProWelcomeEmail(input: {
  email: string;
  name: string | null;
}) {
  const firstName = input.name?.split(" ")[0] ?? "there";
  const html = emailShell({
    subtitle: "Kimchi Pro",
    title: `Welcome to Pro, ${firstName}.`,
    bodyHtml: `<p style="margin:0 0 16px;font-size:15px;color:#52493F;line-height:1.7;">
        Your Kimchi Pro subscription is active. You now have expanded AI credits, deeper job matching, and priority tooling for your search.
      </p>
      <p style="margin:0 0 24px;font-size:15px;color:#52493F;line-height:1.7;">
        Receipts and billing details are always available in your Stripe customer portal — we've branded the experience, but Stripe handles payment security.
      </p>
      ${ctaButton(`${appBaseUrl()}/dashboard`, "Go to Kimchi →")}
      ${ctaButton(`${appBaseUrl()}/dashboard?settings=billing`, "Manage billing →")}`,
  });

  await sendKimchiEmail({
    to: input.email,
    subject: "Welcome to Kimchi Pro",
    html,
    template: "billing_pro_welcome",
    bypassAutomatedGate: true,
  });
}

export async function sendPaymentFailedEmail(input: {
  email: string;
  name: string | null;
}) {
  const firstName = input.name?.split(" ")[0] ?? "there";
  const html = emailShell({
    subtitle: "Billing",
    title: `Action needed, ${firstName}.`,
    bodyHtml: `<p style="margin:0 0 16px;font-size:15px;color:#52493F;line-height:1.7;">
        We couldn't process your latest Kimchi Pro payment. Update your card to keep uninterrupted access.
      </p>
      ${ctaButton(`${appBaseUrl()}/dashboard?settings=billing`, "Update payment method →")}`,
  });

  await sendKimchiEmail({
    to: input.email,
    subject: "Kimchi Pro — payment failed",
    html,
    template: "billing_payment_failed",
    bypassAutomatedGate: true,
  });
}

export async function sendCoachPurchaseConfirmationEmail(input: {
  email: string;
  name: string | null;
  coachName: string;
  packageLabel: string;
}) {
  const firstName = input.name?.split(" ")[0] ?? "there";
  const html = emailShell({
    subtitle: "Coaching purchase",
    title: `You're all set, ${firstName}.`,
    bodyHtml: `<p style="margin:0 0 12px;font-size:15px;color:#52493F;line-height:1.7;">
        Your purchase of <strong>${escapeHtml(input.packageLabel)}</strong> with ${escapeHtml(input.coachName)} is confirmed.
      </p>
      <p style="margin:0;font-size:14px;color:#6B6258;">Book your first session anytime from the coach's profile.</p>
      ${ctaButton(`${appBaseUrl()}/coaching`, "Book a session →")}`,
  });

  await sendKimchiEmail({
    to: input.email,
    subject: `Confirmed — ${input.packageLabel} with ${input.coachName}`,
    html,
    template: "coach_purchase_confirm",
    bypassAutomatedGate: true,
  });
}
