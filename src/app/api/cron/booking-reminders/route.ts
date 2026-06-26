import { NextResponse } from "next/server";
import { runBookingReminderCron } from "@/lib/comms/booking-reminder-cron";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runBookingReminderCron();
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.error("[cron booking-reminders]", err);
    return NextResponse.json({ error: "Cron run failed" }, { status: 500 });
  }
}
