import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { hydrateResumeAsset } from "@/lib/ensure-asset-resume";
import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { readClientUserIdFromRequest, resolveAdminClientSubject } from "@/lib/admin-client-subject";

export async function GET(request: Request) {
  const acting = await getActingUser(request);
  const clientUserId = readClientUserIdFromRequest(request);
  const resolved = await resolveAdminClientSubject(acting, clientUserId);
  if (resolved.error) return resolved.error;
  const dbUser = resolved.subject;
  if (!dbUser) return NextResponse.json([], { status: 200 });

  let assets = await prisma.userAsset.findMany({
    where: { userId: dbUser.id },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
  });

  const hasResume = assets.some((a) => a.type === "RESUME");
  if (!hasResume) {
    const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
    if (profile?.resumeUrl) {
      const created = await prisma.userAsset.create({
        data: {
          userId: dbUser.id,
          type: "RESUME",
          name: "Resume",
          url: profile.resumeUrl,
          isPrimary: true,
          resumeText: profile.resumeText,
          parsedData: profile.parsedData ?? undefined,
        },
      });
      return NextResponse.json([created, ...assets]);
    }
  }

  await Promise.all(
    assets
      .filter((a) => a.type === "RESUME" && a.isPrimary)
      .map((a) => hydrateResumeAsset(a.id, dbUser.id)),
  );

  assets = await prisma.userAsset.findMany({
    where: { userId: dbUser.id },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(assets);
}

export async function DELETE(request: Request) {
  const acting = await getActingUser(request);
  const { authUser } = acting;
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientUserId = readClientUserIdFromRequest(request);
  const resolved = await resolveAdminClientSubject(acting, clientUserId);
  if (resolved.error) return resolved.error;
  const dbUser = resolved.subject;
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const asset = await prisma.userAsset.findFirst({ where: { id, userId: dbUser.id } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const url = new URL(asset.url);
    const storagePath = url.pathname.split("/object/sign/resumes/")[1]?.split("?")[0];
    if (storagePath) {
      await supabase.storage.from("resumes").remove([decodeURIComponent(storagePath)]);
    }
  } catch { /* ignore */ }

  await prisma.userAsset.delete({ where: { id } });

  if (asset.type === "RESUME" && asset.isPrimary) {
    await prisma.profile.updateMany({
      where: { userId: dbUser.id },
      data: { resumeUrl: null, resumeText: null, parsedData: Prisma.DbNull },
    });
  }

  return NextResponse.json({ ok: true });
}
