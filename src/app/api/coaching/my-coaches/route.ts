import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  getClientCoachSummaries,
  getCoachHubBookings,
  getCoachHubCommunications,
} from "@/lib/coach-hub";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { email: user.email }, select: { id: true } });
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const coaches = await getClientCoachSummaries(dbUser.id, user.email);

  const coachDetails = await Promise.all(
    coaches.map(async (coach) => {
      const [upcomingBookings, pastBookings, communications] = await Promise.all([
        getCoachHubBookings({
          coachProfileId: coach.coachProfileId,
          clientUserId: dbUser.id,
          upcoming: true,
          limit: 10,
        }),
        getCoachHubBookings({
          coachProfileId: coach.coachProfileId,
          clientUserId: dbUser.id,
          upcoming: false,
          limit: 10,
        }),
        getCoachHubCommunications({
          coachProfileId: coach.coachProfileId,
          clientUserId: dbUser.id,
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
