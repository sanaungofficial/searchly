import { getActingUser } from "@/lib/acting-user";
import {
  applyIntakeTrackedCompanies,
  normalizeSuggestedTrackedCompanies,
  type SuggestedTrackedCompany,
} from "@/lib/intake-tracked-companies";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const acting = await getActingUser(request);
  const { dbUser } = acting;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const raw = body.companies ?? body.suggestedTrackedCompanies ?? body.suggestedDreamCompanies;

  let companies: SuggestedTrackedCompany[];
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "object") {
    companies = normalizeSuggestedTrackedCompanies({ suggestedTrackedCompanies: raw });
  } else {
    companies = normalizeSuggestedTrackedCompanies({
      suggestedDreamCompanies: body.suggestedDreamCompanies ?? raw,
      suggestedTrackedCompanies: body.suggestedTrackedCompanies,
    });
  }

  if (!companies.length) {
    return NextResponse.json({ error: "No companies to apply" }, { status: 400 });
  }

  const result = await applyIntakeTrackedCompanies(dbUser.id, companies, { max: 100 });
  return NextResponse.json(result);
}
