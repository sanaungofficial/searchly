import { getAuthenticatedDbUser, listOrgsForUser } from "@/lib/org-auth";
import { NextResponse } from "next/server";

export async function GET() {
  const dbUser = await getAuthenticatedDbUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgs = await listOrgsForUser(dbUser.id);
  return NextResponse.json({ orgs });
}
