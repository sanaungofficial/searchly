import type { SendSmsInput } from "@/lib/comms/send-sms";

import { resolveAppUrl } from "@/lib/site-host";

const APP_URL = resolveAppUrl();

export function liveRegistrationSms(input: {
  to: string;
  coachName: string;
  sessionTitle: string;
  sessionRouteId: string;
  whenLabel: string;
}): SendSmsInput {
  return {
    to: input.to,
    template: "live_register",
    coachName: input.coachName,
    body: `You're registered for "${input.sessionTitle}" ${input.whenLabel}. Join: ${APP_URL}/live/${input.sessionRouteId}`,
  };
}

export function liveReminderSms(input: {
  to: string;
  coachName: string;
  sessionTitle: string;
  sessionRouteId: string;
}): SendSmsInput {
  return {
    to: input.to,
    template: "live_reminder",
    coachName: input.coachName,
    body: `"${input.sessionTitle}" starts in ~1 hour. Join: ${APP_URL}/live/${input.sessionRouteId}`,
  };
}

export function liveNowSms(input: {
  to: string;
  coachName: string;
  sessionTitle: string;
  sessionRouteId: string;
}): SendSmsInput {
  return {
    to: input.to,
    template: "live_now",
    coachName: input.coachName,
    body: `Live now — "${input.sessionTitle}". Join: ${APP_URL}/live/${input.sessionRouteId}`,
  };
}

export function coachShoutoutSms(input: {
  to: string;
  coachName: string;
  message: string;
  sessionRouteId?: string;
}): SendSmsInput {
  const link = input.sessionRouteId ? ` ${APP_URL}/live/${input.sessionRouteId}` : "";
  return {
    to: input.to,
    template: "coach_shoutout",
    coachName: input.coachName,
    body: `${input.message.trim()}${link}`,
  };
}
