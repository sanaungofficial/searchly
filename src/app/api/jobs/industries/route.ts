import { formatApiErrorMessage } from "@/lib/api-error-message";
import { fetchHirebaseFlatIndustryOptions, isHirebaseConfigured } from "@/lib/hirebase";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { NextResponse } from "next/server";

/** Flat searchable industry + subindustry options for onboarding and All Filters. */
export async function GET(request: Request) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isHirebaseConfigured()) {
    return NextResponse.json({ options: [], hirebaseConfigured: false });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";

  try {
    const all = await fetchHirebaseFlatIndustryOptions();
    const options = q
      ? all.filter(
          (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
        ).slice(0, 24)
      : all.slice(0, 200);
    return NextResponse.json({ options, hirebaseConfigured: true });
  } catch (err) {
    return NextResponse.json(
      { error: formatApiErrorMessage(err, "Could not load industries.") },
      { status: 502 },
    );
  }
}
