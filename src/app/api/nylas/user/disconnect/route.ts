import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { prisma } from "@/lib/prisma";
import { revokeGrant } from "@/lib/nylas-inbox";

export async function POST() {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const grant = await prisma.userEmailGrant.findUnique({ where: { userId: dbUser.id } });
  if (!grant) return NextResponse.json({ ok: true });

  try {
    await revokeGrant(grant.nylasGrantId);
  } catch (err) {
    console.error("[nylas/user/disconnect] revoke", err);
  }

  await prisma.userEmailGrant.delete({ where: { id: grant.id } });
  return NextResponse.json({ ok: true });
}
