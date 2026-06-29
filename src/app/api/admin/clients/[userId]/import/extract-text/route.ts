import { getActingUser, canAccessAdminClientTools } from "@/lib/acting-user";
import { resolveAdminClientSubject, readClientUserIdFromRequest } from "@/lib/admin-client-subject";
import { extractRawResumeText } from "@/lib/resume-extract";
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
  if (!resolved.subject || resolved.subject.id !== pathUserId) {
    return NextResponse.json({ error: "Client mismatch" }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a file" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!["txt", "pdf", "docx", "doc"].includes(ext)) {
    return NextResponse.json({ error: "Supported formats: .txt, .pdf, .docx" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractRawResumeText(buffer, ext);
    if (!text.trim()) {
      return NextResponse.json({ error: "Could not extract text from file" }, { status: 422 });
    }
    return NextResponse.json({ text, filename: file.name });
  } catch (err) {
    console.error("[import extract-text]", err);
    return NextResponse.json({ error: "Failed to extract text" }, { status: 500 });
  }
}
