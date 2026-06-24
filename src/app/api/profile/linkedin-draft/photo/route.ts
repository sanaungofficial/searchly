import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { normalizeLinkedInDraft } from "@/lib/linkedin-profile";
import { NextResponse } from "next/server";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string | null;

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (type !== "profile" && type !== "cover") {
      return NextResponse.json({ error: "type must be profile or cover" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Use JPG, PNG, WebP, or GIF" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });
    }

    const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
    const filename = type === "profile" ? `linkedin-profile.${ext}` : `linkedin-cover.${ext}`;
    const path = `${user.id}/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    // Optionally sync profile photo to user avatar for app-wide consistency
    if (type === "profile") {
      const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
      if (dbUser) {
        await prisma.user.update({
          where: { id: dbUser.id },
          data: { avatarUrl: publicUrl },
        });
      }
    }

    return NextResponse.json({ url: publicUrl, type });
  } catch (err) {
    console.error("[linkedin-draft/photo]", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
