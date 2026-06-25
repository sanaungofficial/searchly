import { prisma } from "@/lib/prisma";
import { syncPrimaryResumeToProfile } from "@/lib/sync-primary-resume";
import { fetchResumeBytes, fileExtFromUrl } from "@/lib/resume-extract";
import { isHirebaseResumeConfigured, parseResumeWithHirebase } from "@/lib/hirebase-resume";
import {
  emptyParsedResumeData,
  normalizeParsedResumeData,
  parsedResumeToText,
  type ParsedResumeData,
} from "@/lib/resume-parse";
import { Prisma } from "@prisma/client";

function artifactFromParsed(parsed: ParsedResumeData | null): string | null {
  return parsed?.hirebaseArtifactId?.trim() || null;
}

/** Primary resume asset, or most recent upload if none marked primary. */
export async function findResumeAssetForUser(userId: string) {
  return (
    (await prisma.userAsset.findFirst({
      where: { userId, type: "RESUME", isPrimary: true },
      orderBy: { createdAt: "desc" },
    })) ??
    (await prisma.userAsset.findFirst({
      where: { userId, type: "RESUME" },
      orderBy: { createdAt: "desc" },
    }))
  );
}

async function persistParsedData(userId: string, assetId: string, parsed: ParsedResumeData, resumeText: string) {
  await prisma.userAsset.update({
    where: { id: assetId },
    data: {
      parsedData: parsed as unknown as Prisma.InputJsonValue,
      resumeText,
    },
  });
  await syncPrimaryResumeToProfile(userId);
}

/** Load or create a Hirebase resume artifact for vector job search. */
export async function ensureHirebaseArtifactForUser(userId: string): Promise<{
  artifactId: string | null;
  resumeText: string | null;
  parsed: ParsedResumeData | null;
  reEmbedded: boolean;
  error?: string;
  embedFailed?: boolean;
}> {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  const primaryAsset = await findResumeAssetForUser(userId);

  let parsed =
    normalizeParsedResumeData(primaryAsset?.parsedData) ??
    normalizeParsedResumeData(profile?.parsedData);
  let resumeText = primaryAsset?.resumeText?.trim() || profile?.resumeText?.trim() || "";
  let artifactId = artifactFromParsed(parsed);

  if (artifactId) {
    return { artifactId, resumeText: resumeText || null, parsed, reEmbedded: false };
  }

  if (!isHirebaseResumeConfigured()) {
    return {
      artifactId: null,
      resumeText: resumeText || null,
      parsed,
      reEmbedded: false,
      error: "Hirebase is not configured. Upload your resume again when Hirebase is available.",
    };
  }

  const assetUrl = primaryAsset?.url || profile?.resumeUrl;
  if (!assetUrl) {
    return {
      artifactId: null,
      resumeText: null,
      parsed,
      reEmbedded: false,
      error: "Upload a resume first — we need it to find matching jobs.",
    };
  }

  const bytes = await fetchResumeBytes(assetUrl);
  if (!bytes?.length) {
    return {
      artifactId: null,
      resumeText: resumeText || null,
      parsed,
      reEmbedded: false,
      error: "Could not read your resume file. Try re-uploading it from Profile.",
    };
  }

  const ext = fileExtFromUrl(assetUrl) || "pdf";
  try {
    const hirebase = await parseResumeWithHirebase({
      bytes,
      ext,
      filename: primaryAsset?.name || "resume.pdf",
    });
    if (!hirebase?.artifactId) {
      return {
        artifactId: null,
        resumeText: resumeText || hirebase?.resumeText || null,
        parsed: hirebase?.parsed ?? parsed,
        reEmbedded: false,
        error: "Hirebase could not embed this resume. Try a PDF or DOCX upload.",
      };
    }

    const mergedParsed = hirebase.parsed ?? parsed ?? emptyParsedResumeData();
    mergedParsed.hirebaseArtifactId = hirebase.artifactId;
    resumeText = hirebase.resumeText || resumeText || parsedResumeToText(mergedParsed);

    if (primaryAsset) {
      await persistParsedData(userId, primaryAsset.id, mergedParsed, resumeText);
    } else if (profile) {
      await prisma.profile.update({
        where: { userId },
        data: {
          parsedData: mergedParsed as unknown as Prisma.InputJsonValue,
          resumeText,
        },
      });
    }

    return {
      artifactId: hirebase.artifactId,
      resumeText,
      parsed: mergedParsed,
      reEmbedded: true,
    };
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    const isPermission =
      /403|forbidden|permission|not authorized|unauthorized/i.test(raw);
    const msg = isPermission
      ? "Resume matching is temporarily unavailable — showing roles from your tracked companies instead."
      : "Could not prepare your resume for matching. Try re-uploading a PDF or DOCX from Profile.";
    return {
      artifactId: null,
      resumeText: resumeText || null,
      parsed,
      reEmbedded: false,
      error: msg,
      embedFailed: true,
    };
  }
}
