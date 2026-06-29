import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { parseCoverLetter } from "@/lib/cover-letter-format";

function paragraph(text: string, spacingAfter = 200): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 22 })],
    spacing: { after: spacingAfter },
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text, company } = await req.json() as { text: string; company?: string };
  if (!text) return NextResponse.json({ error: "Missing text" }, { status: 400 });

  const sections = parseCoverLetter(text);
  const blocks: Paragraph[] = [];

  if (sections.date) blocks.push(paragraph(sections.date, 280));
  sections.recipientLines.forEach((line, i) => {
    blocks.push(paragraph(line, i === sections.recipientLines.length - 1 ? 240 : 120));
  });
  if (sections.salutation) blocks.push(paragraph(sections.salutation, 240));
  for (const body of sections.bodyParagraphs) blocks.push(paragraph(body, 240));
  if (sections.closing) blocks.push(paragraph(sections.closing, 120));
  if (sections.signature) blocks.push(paragraph(sections.signature, 0));

  if (blocks.length === 0) {
    for (const line of text.split("\n").filter(Boolean)) {
      blocks.push(paragraph(line));
    }
  }

  const doc = new Document({ sections: [{ properties: {}, children: blocks }] });
  const buffer = await Packer.toBuffer(doc);

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="cover-letter-${company || "application"}.docx"`,
    },
  });
}
