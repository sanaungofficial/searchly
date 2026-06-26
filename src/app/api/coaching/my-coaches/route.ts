import { NextResponse } from "next/server";
import { getClientCoachingUser } from "@/lib/coach-api";
import { dedupeCoachCommunications } from "@/lib/coach-activity";
import {
  coachAssignmentActivity,
  getClientCoachSummaries,
  getCoachHubBookings,
  getCoachHubCommunications,
} from "@/lib/coach-hub";

export async function GET() {
  const me = await getClientCoachingUser();
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
          view: "client",
        }),
      ]);

      let activity = [...communications];
      if (coach.isAssigned && coach.assignedAt) {
        activity.push(
          coachAssignmentActivity({
            coachProfileId: coach.coachProfileId,
            coachName: coach.displayName,
            assignedAt: coach.assignedAt,
          }),
        );
      }
      activity = dedupeCoachCommunications(activity)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 20);

      return {
        ...coach,
        upcomingBookings,
        pastBookings,
        communications: activity,
      };
    }),
  );

  return NextResponse.json({ coaches: coachDetails });
}
