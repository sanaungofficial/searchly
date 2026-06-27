import { NextRequest, NextResponse } from "next/server";
import { getClientCoachingUser } from "@/lib/coach-api";
import {
  getClientCoachSummaries,
  getCoachHubBookings,
  getCoachHubCommunications,
} from "@/lib/coach-hub";

export async function GET(request: NextRequest) {
  const me = await getClientCoachingUser(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const coaches = await getClientCoachSummaries(me.id, me.email);

  const coachDetails = await Promise.all(
    coaches.map(async (coach) => {
      const [upcomingBookings, pastBookings, communications] = await Promise.all([
        getCoachHubBookings({
          coachProfileId: coach.coachProfileId,
          clientUserId: me.id,
          upcoming: true,
          limit: 10,
        }),
        getCoachHubBookings({
          coachProfileId: coach.coachProfileId,
          clientUserId: me.id,
          upcoming: false,
          limit: 10,
        }),
        getCoachHubCommunications({
          coachProfileId: coach.coachProfileId,
          clientUserId: me.id,
          limit: 20,
        }),
      ]);

      return {
        ...coach,
        upcomingBookings,
        pastBookings,
        communications,
      };
    }),
  );

  return NextResponse.json({ coaches: coachDetails });
}
