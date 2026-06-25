import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { getSumbleBriefAccess } from "@/lib/sumble-access";

export async function GET(request: Request) {
  const { dbUser, realDbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(getSumbleBriefAccess(dbUser, realDbUser));
}
