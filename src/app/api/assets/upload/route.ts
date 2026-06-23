import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const type = formData.get("type") as string | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!type || !["COVER_LETTER", "JOB_SEARCH_STRATEGY", "OTHER"].includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const ext = file.name.split(".").pop();
  const prefix = type.toLowerCase().replace(/_/g, "-");
  const path = `${user.id}/${prefix}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("resumes")
    .upload(path, file, { upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: signedData, error: signedError } = await supabase.storage
    .from("resumes")
    .createSignedUrl(path, 60 * 60 * 24 * 365);

  if (signedError || !signedData) {
    return NextResponse.json({ error: "Could not generate file URL" }, { status: 500 });
  }

  const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const asset = await prisma.userAsset.create({
    data: {
      userId: dbUser.id,
      type: type as "COVER_LETTER" | "JOB_SEARCH_STRATEGY" | "OTHER",
      name: file.name.replace(/\.[^/.]+$/, "") || type,
      url: signedData.signedUrl,
      isPrimary: false,
    },
  });

  return NextResponse.json({ asset });
}
