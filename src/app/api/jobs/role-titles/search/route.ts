import { getActingUser } from "@/lib/acting-user";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { searchHirebaseRoleTitles } from "@/lib/hirebase-role-discovery";
import { isHirebaseConfigured } from "@/lib/hirebase";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ titles: [], hirebaseConfigured: isHirebaseConfigured() });
  }

  if (!isHirebaseConfigured()) {
    return NextResponse.json({
      titles: [{ title: query, sampleCount: 0 }],
      hirebaseConfigured: false,
    });
  }

  try {
    const titles = await searchHirebaseRoleTitles({ query, limit: 20, userId: dbUser.id });
    return NextResponse.json({ titles, hirebaseConfigured: true });
  } catch (err) {
    console.error("[jobs/role-titles/search GET]", err);
    return NextResponse.json(
      { error: formatApiErrorMessage(err, "Role title search failed.") },
      { status: 502 },
    );
  }
}
