import { resend } from "@/lib/email";
import { canSendDigestEmailTo } from "@/lib/digest-email-live";
import { KIMCHI_EMAIL_FROM } from "@/lib/comms/email-shell";

export type KimchiEmailTemplate =
  | "welcome"
  | "job_digest"
  | "watchlist_alert"
  | "pipeline_followup"
  | "live_register"
  | "live_reminder"
  | "live_cancel"
  | "live_follower_live"
  | "live_follower_post"
  | "booking_confirm"
  | "booking_cancel"
  | "booking_reschedule"
  | "booking_reminder"
  | "billing_pro_welcome"
  | "billing_payment_failed"
  | "coach_purchase_confirm"
  | "admin_test";

export type SendKimchiEmailInput = {
  to: string;
  subject: string;
  html: string;
  template: KimchiEmailTemplate;
  /** When false, skips DIGEST_EMAIL_LIVE / allowlist gate (admin tests, transactional confirm). */
  bypassAutomatedGate?: boolean;
  replyTo?: string;
};

export type SendKimchiEmailResult = {
  sent: boolean;
  skipped?: "not_configured" | "gate";
};

export function kimchiEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** Automated job-search + marketing-adjacent sends respect digest live gate. */
export function shouldSendAutomatedKimchiEmail(email: string): boolean {
  return canSendDigestEmailTo(email);
}

export async function sendKimchiEmail(input: SendKimchiEmailInput): Promise<SendKimchiEmailResult> {
  if (!process.env.RESEND_API_KEY) {
    return { sent: false, skipped: "not_configured" };
  }

  const to = input.to.trim().toLowerCase();
  if (!to) return { sent: false, skipped: "gate" };

  if (!input.bypassAutomatedGate && !shouldSendAutomatedKimchiEmail(to)) {
    return { sent: false, skipped: "gate" };
  }

  try {
    await resend.emails.send({
      from: KIMCHI_EMAIL_FROM,
      to,
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo,
    });
    console.info("[comms/email]", { template: input.template, to });
    return { sent: true };
  } catch (err) {
    console.error("[comms/email] send failed", { template: input.template, to, err });
    return { sent: false };
  }
}
