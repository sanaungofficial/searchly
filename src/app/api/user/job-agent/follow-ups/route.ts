import { NextRequest, NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { getFollowUpSuggestions } from "@/lib/job-follow-up-suggestions";

export async function GET(request: NextRequest) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const suggestions = await getFollowUpSuggestions(dbUser.id);
  return NextResponse.json({ suggestions });
}
