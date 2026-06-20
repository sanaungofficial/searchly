import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const ext = file.name.split(".").pop();
  const path = `${user.id}/resume-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("resumes")
    .upload(path, file, { upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from("resumes")
    .createSignedUrl(path, 60 * 60 * 24 * 365); // 1-year signed URL

  if (signedError || !signedData) {
    return NextResponse.json({ error: "Could not generate file URL" }, { status: 500 });
  }

  const publicUrl = signedData.signedUrl;

  // Look up DB user by email, then upsert profile
  const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
  if (dbUser) {
    await prisma.profile.upsert({
      where: { userId: dbUser.id },
      update: { resumeUrl: publicUrl },
      create: { userId: dbUser.id, resumeUrl: publicUrl },
    });
  }

  return NextResponse.json({ url: publicUrl });
}
