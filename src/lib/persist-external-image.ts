import { getSupabaseAdmin } from "@/lib/supabase-admin";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024;

export type PersistExternalImageResult = {
  url: string | null;
  error?: string;
};

function extFromContentType(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

function resolveImageContentType(sourceUrl: string, responseContentType: string | null): string {
  const fromResponse = responseContentType?.split(";")[0].trim();
  if (fromResponse && ALLOWED_TYPES.has(fromResponse)) return fromResponse;

  const lower = sourceUrl.toLowerCase();
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".gif")) return "image/gif";

  if (
    fromResponse === "application/octet-stream" ||
    fromResponse === "binary/octet-stream" ||
    !fromResponse
  ) {
    return "image/jpeg";
  }

  return fromResponse ?? "image/jpeg";
}

export function isKimchiHostedAvatarUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseHost && url.startsWith(supabaseHost)) return true;
  return url.includes("/storage/v1/object/public/avatars/");
}

export async function persistExternalImageToAvatarsBucket(input: {
  sourceUrl: string;
  storagePath: string;
  existingUrl?: string | null;
  forceRefresh?: boolean;
}): Promise<PersistExternalImageResult> {
  const sourceUrl = input.sourceUrl.trim();
  if (!sourceUrl) return { url: input.existingUrl ?? null };

  if (!input.forceRefresh && isKimchiHostedAvatarUrl(input.existingUrl)) {
    return { url: input.existingUrl ?? null };
  }

  try {
    const res = await fetch(sourceUrl, {
      headers: { Accept: "image/*" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      return {
        url: input.existingUrl ?? sourceUrl,
        error: `download failed (${res.status})`,
      };
    }

    const contentType = resolveImageContentType(sourceUrl, res.headers.get("content-type"));
    if (!ALLOWED_TYPES.has(contentType)) {
      return {
        url: input.existingUrl ?? sourceUrl,
        error: `unsupported type ${contentType}`,
      };
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) {
      return { url: input.existingUrl ?? sourceUrl, error: "empty image file" };
    }
    if (buffer.length > MAX_BYTES) {
      return { url: input.existingUrl ?? sourceUrl, error: "image too large (max 5 MB)" };
    }

    const ext = extFromContentType(contentType);
    const path = input.storagePath.replace(/\.[a-z0-9]+$/i, `.${ext}`);

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage.from("avatars").upload(path, buffer, {
      upsert: true,
      contentType,
    });

    if (error) {
      console.error("[persist-external-image] upload failed", error.message);
      return {
        url: input.existingUrl ?? sourceUrl,
        error: `storage upload failed: ${error.message}`,
      };
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    return { url: `${urlData.publicUrl}?t=${Date.now()}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "upload error";
    console.error("[persist-external-image]", err);
    return {
      url: input.existingUrl ?? sourceUrl,
      error: message,
    };
  }
}
