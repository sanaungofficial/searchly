import { getActingUser, canAccessAdminClientTools } from "@/lib/acting-user";
import { resolveAdminClientSubject, readClientUserIdFromRequest } from "@/lib/admin-client-subject";
import {
  emptyImportPreview,
  mergeImportPreviews,
  parseClientImportWorkbook,
} from "@/lib/client-import/xlsx-parser";
import { classifyImportFilename, storeImportAsset } from "@/lib/client-import/store-asset";
import { extractRawResumeText, parseResumeText } from "@/lib/resume-extract";
import { ensureProfileRow } from "@/lib/profile-write";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteParams = { params: Promise<{ userId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const acting = await getActingUser(request);
  if (!acting.authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessAdminClientTools(acting)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId: pathUserId } = await params;
  const clientUserId = readClientUserIdFromRequest(request) ?? pathUserId;
  const resolved = await resolveAdminClientSubject(acting, clientUserId);
  if (resolved.error) return resolved.error;
  const dbUser = resolved.subject;
  if (!dbUser || dbUser.id !== pathUserId) {
    return NextResponse.json({ error: "Client mismatch" }, { status: 400 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) {
    return NextResponse.json({ error: "Upload at least one file" }, { status: 400 });
  }

  await ensureProfileRow(dbUser.id);

  let preview = emptyImportPreview();
  const warnings: string[] = [];

  try {
    for (const file of files) {
      const classification = classifyImportFilename(file.name);
      const buffer = Buffer.from(await file.arrayBuffer());

      if (classification.kind === "xlsx") {
        const parsed = parseClientImportWorkbook(buffer, file.name);
        preview = mergeImportPreviews(preview, parsed);
        continue;
      }

      if (classification.kind === "resume") {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
        const text = await extractRawResumeText(buffer, ext);
        let summary: string | null = null;
        let parsedOk = false;
        if (text) {
          const parsed = await parseResumeText(text);
          parsedOk = !!parsed.parsed;
          const latest = parsed.parsed?.workExperience?.[0];
          summary = latest ? `${latest.title} at ${latest.company}` : `${text.slice(0, 120)}…`;
        }
        const stored = await storeImportAsset(dbUser, file, "RESUME");
        preview.resume = {
          filename: file.name,
          assetId: stored.id,
          parsed: parsedOk,
          summary,
        };
        preview.sourceFiles.push({ filename: file.name, kind: "resume" });
        if (!parsedOk) preview.warnings.push(`Could not fully parse ${file.name} — file stored for manual review.`);
        continue;
      }

      const stored = await storeImportAsset(dbUser, file, classification.assetType);
      preview.referenceDocuments.push({
        id: stored.id,
        filename: file.name,
        assetType: stored.assetType,
        reason: classification.reason,
      });
      preview.sourceFiles.push({ filename: file.name, kind: classification.kind });

      if (classification.kind === "reference") {
        preview.warnings.push(`${file.name}: stored as reference only (not applied to profile).`);
      }
    }

    preview.warnings.push(...warnings);

    return NextResponse.json({ preview });
  } catch (err) {
    console.error("[admin import parse]", err);
    return NextResponse.json({ error: "Failed to parse import files" }, { status: 500 });
  }
}
