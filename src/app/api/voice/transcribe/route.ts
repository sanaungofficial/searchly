import { getActingUser } from "@/lib/acting-user";
import { deepgramConfigured, transcribeAudio } from "@/lib/deepgram";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!deepgramConfigured()) {
    return NextResponse.json({ error: "Voice transcription not configured" }, { status: 503 });
  }

  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("audio");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "Audio file is empty" }, { status: 400 });
  }

  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "Audio file is too large (max 25MB)" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await transcribeAudio(buffer, file.type || "audio/webm");
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed";
    console.error("[voice/transcribe POST]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
