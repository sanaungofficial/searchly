import { NextRequest, NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { searchHirebaseRoleTitles } from "@/lib/hirebase-role-discovery";

export async function GET(req: NextRequest) {
  const { dbUser } = await getActingUser(req);
  if (!dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ titles: [] });
  }

  const suggestions = await searchHirebaseRoleTitles({
    query: q,
    limit: 15,
    userId: dbUser.id,
  });

  const titles = suggestions.map((s) => s.title);
  return NextResponse.json({ titles });
}
