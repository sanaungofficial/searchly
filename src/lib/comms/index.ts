export {
  canSendAutomatedSmsTo,
  isSmsLive,
  normalizeE164,
  smsAllowlist,
  SMS_FOOTER,
} from "@/lib/comms/sms-allowlist";
export { sendSms, smsConfigured, type SendSmsInput, type SendSmsResult, type SmsTemplate } from "@/lib/comms/send-sms";
export {
  coachShoutoutSms,
  liveNowSms,
  liveRegistrationSms,
  liveReminderSms,
} from "@/lib/comms/sms-templates";
export { sendSmsAdminTest, smsAdminStatus } from "@/lib/comms/sms-admin";
export {
  sendKimchiEmail,
  kimchiEmailConfigured,
  shouldSendAutomatedKimchiEmail,
  type KimchiEmailTemplate,
} from "@/lib/comms/send-email";
export {
  appBaseUrl,
  coachEmailShell,
  ctaButton,
  emailPreferencesUrl,
  emailShell,
  escapeHtml,
  KIMCHI_EMAIL_FROM,
} from "@/lib/comms/email-shell";
