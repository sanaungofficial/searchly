import { getActingUser } from "@/lib/acting-user";
import { getOwnedAssetForActingUser } from "@/lib/owned-asset";
import { prisma } from "@/lib/prisma";
import { normalizeParsedResumeData, type ParsedResumeData } from "@/lib/resume-parse";
import { syncPrimaryResumeToProfile } from "@/lib/sync-primary-resume";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authUser } = await getActingUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const owned = await getOwnedAssetForActingUser(id, request);
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
    profileEmail: dbUser.email,
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authUser } = await getActingUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const owned = await getOwnedAssetForActingUser(id, request);
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
