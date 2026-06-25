import { NextResponse } from "next/server";
import { buildPlainTextDocx } from "@/lib/resume-docx";
import { buildPlainTextPdf } from "@/lib/resume-pdf";
import { getAuthedUserForAi } from "@/lib/ai-guard";

export async function POST(req: Request) {
  const auth = await getAuthedUserForAi();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const format = body.format === "pdf" ? "pdf" : "docx";
  const filename = typeof body.filename === "string" && body.filename.trim() ? body.filename.trim() : "tailored-resume";

  if (!text) {
    return NextResponse.json({ error: "No resume text provided" }, { status: 400 });
  }

  if (format === "pdf") {
    const { buffer, filename: outName } = await buildPlainTextPdf(text, `${filename}.pdf`);
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${outName}"`,
      },
    });
  }

  const { buffer, filename: outName } = await buildPlainTextDocx(text, `${filename}.docx`);
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${outName}"`,
    },
  });
}
