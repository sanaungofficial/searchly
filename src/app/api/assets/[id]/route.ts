import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { normalizeParsedResumeData, type ParsedResumeData } from "@/lib/resume-parse";
import { hydrateResumeAsset } from "@/lib/ensure-asset-resume";
import { syncPrimaryResumeToProfile } from "@/lib/sync-primary-resume";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

async function getOwnedAsset(id: string, email: string) {
  const dbUser = await prisma.user.findUnique({ where: { email } });
  if (!dbUser) return null;
  const hydrated = await hydrateResumeAsset(id, dbUser.id);
  if (!hydrated) return null;
  return { dbUser, asset: hydrated };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const owned = await getOwnedAsset(id, user.email!);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { dbUser, asset } = owned;
  const parsedData = normalizeParsedResumeData(asset.parsedData);

  return NextResponse.json({
    id: asset.id,
    type: asset.type,
    name: asset.name,
    url: asset.url,
    isPrimary: asset.isPrimary,
    resumeText: asset.resumeText,
    parsedData,
    analysisData: asset.analysisData,
    analysisUpdatedAt: asset.analysisUpdatedAt,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    profileName: dbUser.name,
    profileEmail: user.email,
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const owned = await getOwnedAsset(id, user.email!);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { name, parsedData, isPrimary } = body as {
    name?: string;
    parsedData?: ParsedResumeData;
    isPrimary?: boolean;
  };

  const update: Prisma.UserAssetUpdateInput = {};
  if (name !== undefined) update.name = name;
  if (parsedData !== undefined) update.parsedData = parsedData as unknown as Prisma.InputJsonValue;

  if (isPrimary === true) {
    await prisma.userAsset.updateMany({
      where: { userId: owned.dbUser.id, type: "RESUME", isPrimary: true },
      data: { isPrimary: false },
    });
    update.isPrimary = true;
  } else if (isPrimary === false) {
    update.isPrimary = false;
  }

  const asset = await prisma.userAsset.update({ where: { id }, data: update });

  if (asset.isPrimary) {
    await syncPrimaryResumeToProfile(owned.dbUser.id);
  }

  return NextResponse.json({
    asset: {
      ...asset,
      parsedData: normalizeParsedResumeData(asset.parsedData),
    },
  });
}
