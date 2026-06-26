import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { getFollowUpSuggestions } from "@/lib/job-follow-up-suggestions";

export async function GET() {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const suggestions = await getFollowUpSuggestions(dbUser.id);
  return NextResponse.json({ suggestions });
}
