import { getAirtableCredentials } from "@/lib/airtable/client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { AirtableAttachment } from "@/lib/airtable/types";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type CoachPhotoPersistResult = {
  url: string | null;
  error?: string;
};

function extFromContentType(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

function extFromFilename(filename?: string): string | null {
  if (!filename) return null;
  const match = filename.toLowerCase().match(/\.(jpe?g|png|webp|gif)$/);
  if (!match) return null;
  return match[1].replace("jpeg", "jpg");
}

function resolveImageContentType(
  attachment: AirtableAttachment,
  responseContentType: string | null
): string {
  const fromAttachment = attachment.type?.split(";")[0].trim();
  if (fromAttachment && ALLOWED_TYPES.has(fromAttachment)) return fromAttachment;

  const fromResponse = responseContentType?.split(";")[0].trim();
  if (fromResponse && ALLOWED_TYPES.has(fromResponse)) return fromResponse;

  const fromFilename = extFromFilename(attachment.filename);
  if (fromFilename === "png") return "image/png";
  if (fromFilename === "webp") return "image/webp";
  if (fromFilename === "gif") return "image/gif";

  // Airtable CDN often returns application/octet-stream for profile photos
  if (
    fromResponse === "application/octet-stream" ||
    fromResponse === "binary/octet-stream" ||
    !fromResponse
  ) {
    return "image/jpeg";
  }

  return fromResponse ?? "image/jpeg";
}

function isKimchiHostedCoachPhoto(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseHost && url.startsWith(supabaseHost)) return true;
  return url.includes("/storage/v1/object/public/avatars/");
}

export function shouldUploadCoachPhoto(
  photoUrl: string | null | undefined,
  options?: { forceRefresh?: boolean }
): boolean {
  if (options?.forceRefresh) return true;
  return !isKimchiHostedCoachPhoto(photoUrl);
}

async function downloadAirtableAttachment(attachment: AirtableAttachment): Promise<{
  buffer: Buffer;
  contentType: string;
} | { error: string }> {
  const creds = getAirtableCredentials();
  const headers: Record<string, string> = {};
  if (creds?.apiKey) {
    headers.Authorization = `Bearer ${creds.apiKey}`;
  }

  const res = await fetch(attachment.url, { headers });
  if (!res.ok) {
    return { error: `download failed (${res.status})` };
  }

  const contentType = resolveImageContentType(attachment, res.headers.get("content-type"));
  if (!ALLOWED_TYPES.has(contentType)) {
    return { error: `unsupported type ${contentType}` };
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) {
    return { error: "empty image file" };
  }

  return { buffer, contentType };
}

export async function persistCoachPhotoFromAttachment(
  coachProfileId: string,
  attachment: AirtableAttachment,
  existingPhotoUrl?: string | null,
  options?: { forceRefresh?: boolean }
): Promise<CoachPhotoPersistResult> {
  if (!options?.forceRefresh && isKimchiHostedCoachPhoto(existingPhotoUrl)) {
    return { url: existingPhotoUrl ?? null };
  }

  const downloaded = await downloadAirtableAttachment(attachment);
  if ("error" in downloaded) {
    console.error("[airtable photo]", downloaded.error, attachment.url);
    // Fallback: Airtable CDN URL works short-term if storage upload is unavailable
    if (attachment.url) {
      return { url: attachment.url, error: `${downloaded.error}; using Airtable URL fallback` };
    }
    return { url: existingPhotoUrl ?? null, error: downloaded.error };
  }

  const { buffer, contentType } = downloaded;
  const ext = extFromFilename(attachment.filename) ?? extFromContentType(contentType);
  const path = `coaches/${coachProfileId}/photo.${ext}`;

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage.from("avatars").upload(path, buffer, {
      upsert: true,
      contentType,
    });

    if (error) {
      console.error("[airtable photo] upload failed", error.message);
      if (attachment.url) {
        return {
          url: attachment.url,
          error: `storage upload failed: ${error.message}; using Airtable URL fallback`,
        };
      }
      return { url: existingPhotoUrl ?? null, error: `storage upload failed: ${error.message}` };
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    return { url: `${urlData.publicUrl}?t=${Date.now()}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "upload error";
    console.error("[airtable photo]", err);
    if (attachment.url) {
      return { url: attachment.url, error: `${message}; using Airtable URL fallback` };
    }
    return { url: existingPhotoUrl ?? null, error: message };
  }
}
