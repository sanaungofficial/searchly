import { findActiveCoachBookingForEmail } from "@/lib/coach-user-booking";
import { getActingUser } from "@/lib/acting-user";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { authUser, dbUser } = await getActingUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbUser?.email) return NextResponse.json({ booking: null });

  const email = dbUser.email;
  const booking = await findActiveCoachBookingForEmail(email);

  return NextResponse.json({ booking });
}
