import { getActingUser } from "@/lib/acting-user";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { expandHirebaseRelatedRoleTitles } from "@/lib/hirebase-role-discovery";
import { isHirebaseConfigured } from "@/lib/hirebase";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { title?: string; limit?: number } = {};
  try {
    body = (await request.json()) as { title?: string; limit?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const title = body.title?.trim() ?? "";
  if (title.length < 2) {
    return NextResponse.json({ error: "Enter a role title to expand." }, { status: 400 });
  }

  if (!isHirebaseConfigured()) {
    return NextResponse.json({ titles: [{ title, sampleCount: 0 }], hirebaseConfigured: false });
  }

  try {
    const titles = await expandHirebaseRelatedRoleTitles({
      seedTitle: title,
      limit: body.limit ?? 12,
      userId: dbUser.id,
    });
    return NextResponse.json({ titles, hirebaseConfigured: true });
  } catch (err) {
    console.error("[jobs/role-titles/expand POST]", err);
    return NextResponse.json(
      { error: formatApiErrorMessage(err, "Could not expand related titles.") },
      { status: 502 },
    );
  }
}
