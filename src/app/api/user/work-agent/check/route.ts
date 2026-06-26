import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { isStaffRole, getWorkInboxAvailability } from "@/lib/inbox-lens";

/** Phase 2 stub — work inbox insights via Nylas Smart Compose land here next. */
export async function POST() {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isStaffRole(dbUser.role)) {
    return NextResponse.json({ error: "Work inbox is for coaches and admins." }, { status: 403 });
  }

  const work = await getWorkInboxAvailability(dbUser.id, dbUser.role, dbUser.email);
  if (!work.connected) {
    return NextResponse.json({ error: "Work inbox not connected — enable email sync on your expert profile." }, { status: 404 });
  }

  return NextResponse.json({
    activities: [],
    pendingCount: 0,
    followUps: [],
    jobs: [],
    message: "Work email insights are coming soon — mail is connected and ready.",
  });
}
