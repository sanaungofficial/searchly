import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import type { LibraryDocumentType } from "@/lib/asset-types";
import type { User } from "@prisma/client";

export function classifyImportFilename(filename: string): {
  kind: "xlsx" | "resume" | "reference" | "strategy_doc";
  assetType: LibraryDocumentType;
  reason: string;
} {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) {
    return { kind: "xlsx", assetType: "OTHER", reason: "Workbook import" };
  }
  if (lower.includes("linkedin") && (lower.includes("strategy") || lower.includes("linkedin"))) {
    return { kind: "reference", assetType: "OTHER", reason: "LinkedIn strategy — stored as reference only" };
  }
  if (/resume|cv\b/.test(lower) && /\.(pdf|docx|doc|txt)$/i.test(lower)) {
    return { kind: "resume", assetType: "RESUME", reason: "Resume" };
  }
  if (lower.includes("strategy") || lower.includes("target company")) {
    return { kind: "strategy_doc", assetType: "JOB_SEARCH_STRATEGY", reason: "Strategy document — stored; parse from workbook tabs when available" };
  }
  return { kind: "reference", assetType: "OTHER", reason: "Reference document" };
}

export async function storeImportAsset(
  dbUser: User,
  file: File,
  type: LibraryDocumentType | "RESUME",
): Promise<{ id: string; filename: string; assetType: string }> {
  const supabase = await createClient();
  const ext = file.name.split(".").pop() || "bin";
  const prefix = type.toLowerCase().replace(/_/g, "-");
  const path = `${dbUser.id}/import-${prefix}-${Date.now()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from("resumes").upload(path, buffer, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data: signedData, error: signedError } = await supabase.storage
    .from("resumes")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signedError || !signedData) throw new Error("Could not generate file URL");

  const asset = await prisma.userAsset.create({
    data: {
      userId: dbUser.id,
      type: type as "RESUME" | LibraryDocumentType,
      name: file.name.replace(/\.[^/.]+$/, "") || file.name,
      url: signedData.signedUrl,
      isPrimary: false,
    },
  });

  return { id: asset.id, filename: file.name, assetType: type };
}
