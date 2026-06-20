import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { Document, Packer, Paragraph, TextRun } from "docx";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text, company } = await req.json() as { text: string; company?: string };
  if (!text) return NextResponse.json({ error: "Missing text" }, { status: 400 });

  const paragraphs = text.split("\n").filter(Boolean).map(
    (line) => new Paragraph({ children: [new TextRun({ text: line, size: 22 })], spacing: { after: 200 } })
  );

  const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
  const buffer = await Packer.toBuffer(doc);

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="cover-letter-${company || "application"}.docx"`,
    },
  });
}
