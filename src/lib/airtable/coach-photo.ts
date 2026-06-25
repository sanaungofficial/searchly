import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { AirtableAttachment } from "@/lib/airtable/types";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

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

function isKimchiHostedPhoto(url: string | null | undefined): boolean {
  if (!url) return false;
  const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseHost && url.startsWith(supabaseHost)) return true;
  return url.includes("/storage/v1/object/public/avatars/");
}

export async function persistCoachPhotoFromAttachment(
  coachProfileId: string,
  attachment: AirtableAttachment,
  existingPhotoUrl?: string | null,
  options?: { forceRefresh?: boolean }
): Promise<string | null> {
  if (!options?.forceRefresh && isKimchiHostedPhoto(existingPhotoUrl)) {
    return existingPhotoUrl;
  }

  try {
    const res = await fetch(attachment.url);
    if (!res.ok) {
      console.error("[airtable photo] download failed", res.status, attachment.url);
      return existingPhotoUrl ?? null;
    }

    const contentType = (res.headers.get("content-type") ?? attachment.type ?? "image/jpeg").split(";")[0].trim();
    if (!ALLOWED_TYPES.has(contentType)) {
      console.error("[airtable photo] unsupported type", contentType);
      return existingPhotoUrl ?? null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = extFromFilename(attachment.filename) ?? extFromContentType(contentType);
    const path = `coaches/${coachProfileId}/photo.${ext}`;

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage.from("avatars").upload(path, buffer, {
      upsert: true,
      contentType,
    });

    if (error) {
      console.error("[airtable photo] upload failed", error.message);
      return existingPhotoUrl ?? null;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    return `${urlData.publicUrl}?t=${Date.now()}`;
  } catch (err) {
    console.error("[airtable photo]", err);
    return existingPhotoUrl ?? null;
  }
}
