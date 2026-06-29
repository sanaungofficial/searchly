import { getActingUser, canAccessAdminClientTools } from "@/lib/acting-user";
import { resolveAdminClientSubject, readClientUserIdFromRequest } from "@/lib/admin-client-subject";
import {
  parseCompaniesSheetFromText,
  parseCompaniesSheetFromWorkbook,
  type CompaniesSheetPreview,
} from "@/lib/client-import/company-field-mapping";
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
  const pasteText = formData.get("pasteText")?.toString()?.trim() ?? "";
  const file = formData.get("file");
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  const upload = file instanceof File ? file : files[0];

  if (!upload && !pasteText) {
    return NextResponse.json({ error: "Upload a file or paste rows to preview." }, { status: 400 });
  }

  try {
    let preview: CompaniesSheetPreview;
    if (upload) {
      const buffer = Buffer.from(await upload.arrayBuffer());
      preview = parseCompaniesSheetFromWorkbook(buffer, upload.name);
    } else {
      preview = parseCompaniesSheetFromText(pasteText, "pasted-rows.txt");
    }

    return NextResponse.json({ preview });
  } catch (err) {
    console.error("[companies import preview]", err);
    const message = err instanceof Error ? err.message : "Failed to parse file";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
