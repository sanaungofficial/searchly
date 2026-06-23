import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
  if (!dbUser) return NextResponse.json([], { status: 200 });

  const assets = await prisma.userAsset.findMany({
    where: { userId: dbUser.id },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
  });

  // Backward compat: if no RESUME asset but profile has resumeUrl, create a row
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
        },
      });
      return NextResponse.json([created, ...assets]);
    }
  }

  return NextResponse.json(assets);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const asset = await prisma.userAsset.findFirst({ where: { id, userId: dbUser.id } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Best-effort remove from storage
  try {
    const url = new URL(asset.url);
    const storagePath = url.pathname.split("/object/sign/resumes/")[1]?.split("?")[0];
    if (storagePath) {
      await supabase.storage.from("resumes").remove([decodeURIComponent(storagePath)]);
    }
  } catch { /* ignore */ }

  await prisma.userAsset.delete({ where: { id } });

  // Clear profile.resumeUrl if this was the primary resume
  if (asset.type === "RESUME" && asset.isPrimary) {
    await prisma.profile.updateMany({
      where: { userId: dbUser.id },
      data: { resumeUrl: null },
    });
  }

  return NextResponse.json({ ok: true });
}
