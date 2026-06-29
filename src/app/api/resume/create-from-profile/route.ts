import { getActingUser } from "@/lib/acting-user";
import { readClientUserIdFromRequest, resolveAdminClientSubject } from "@/lib/admin-client-subject";
import { createMasterResumeFromProfile } from "@/lib/master-resume";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const acting = await getActingUser(request);
  if (!acting.authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientUserId = readClientUserIdFromRequest(request);
  const resolved = await resolveAdminClientSubject(acting, clientUserId);
  if (resolved.error) return resolved.error;
  const dbUser = resolved.subject;
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  try {
    const asset = await createMasterResumeFromProfile(dbUser.id);
    return NextResponse.json({
      asset: {
        id: asset.id,
        name: asset.name,
        isPrimary: asset.isPrimary,
        parseStatus: asset.parseStatus,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create resume from profile";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
