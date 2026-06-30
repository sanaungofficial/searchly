import { getActingUser } from "@/lib/acting-user";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { groupHirebaseJobCategories } from "@/lib/job-function-groups";
import { fetchHirebaseJobCategories } from "@/lib/hirebase-role-discovery";
import { isHirebaseConfigured } from "@/lib/hirebase";
import { NextRequest, NextResponse } from "next/server";

/** Hirebase job categories grouped for JobRight-style function picker. */
export async function GET(request: NextRequest) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isHirebaseConfigured()) {
    return NextResponse.json({ groups: [], categories: [], hirebaseConfigured: false });
  }

  try {
    const categories = await fetchHirebaseJobCategories(dbUser.id);
    const groups = groupHirebaseJobCategories(categories);
    return NextResponse.json({ groups, categories, hirebaseConfigured: true });
  } catch (err) {
    console.error("[jobs/job-functions GET]", err);
    return NextResponse.json(
      { error: formatApiErrorMessage(err, "Could not load job functions.") },
      { status: 502 },
    );
  }
}
