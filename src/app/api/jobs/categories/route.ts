import { getActingUser } from "@/lib/acting-user";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { fetchHirebaseJobCategories } from "@/lib/hirebase-role-discovery";
import { isHirebaseConfigured } from "@/lib/hirebase";
import { NextResponse } from "next/server";

export async function GET() {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isHirebaseConfigured()) {
    return NextResponse.json({ categories: [], hirebaseConfigured: false });
  }

  try {
    const categories = await fetchHirebaseJobCategories(dbUser.id);
    return NextResponse.json({ categories, hirebaseConfigured: true });
  } catch (err) {
    console.error("[jobs/categories GET]", err);
    return NextResponse.json(
      { error: formatApiErrorMessage(err, "Could not load job categories.") },
      { status: 502 },
    );
  }
}
