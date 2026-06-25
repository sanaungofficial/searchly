import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { buildPlainTextResumePdf } from "@/lib/resume-pdf";
import { Document, Packer, Paragraph, TextRun } from "docx";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const format = body.format === "pdf" ? "pdf" : "docx";
  const baseName =
    typeof body.filename === "string" && body.filename.trim()
      ? body.filename.trim().replace(/[^a-z0-9-_]/gi, "-").slice(0, 80)
      : "tailored-resume";

  if (!text) return NextResponse.json({ error: "No resume text provided" }, { status: 400 });

  if (format === "pdf") {
    const { buffer, filename } = await buildPlainTextResumePdf(text, `${baseName}.pdf`);
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const paragraphs = text.split("\n").map(
    (line) =>
      new Paragraph({
        children: [new TextRun({ text: line || " ", size: 22 })],
        spacing: { after: line.trim() ? 80 : 40 },
      }),
  );
  const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
  const buffer = await Packer.toBuffer(doc);

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${baseName}.docx"`,
    },
  });
}
