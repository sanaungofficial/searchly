import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  const format = req.nextUrl.searchParams.get("format") || "docx";

  const resume = await prisma.tailoredResume.findUnique({ where: { jobId } });
  if (!resume) return NextResponse.json({ error: "No resume found" }, { status: 404 });

  const sections = resume.sections as Array<{
    id: string;
    title: string;
    type: "text" | "bullets" | "header";
    content: string;
  }>;

  if (format === "docx") {
    const docParagraphs: Paragraph[] = [];

    for (const section of sections) {
      if (section.type === "header") {
        docParagraphs.push(
          new Paragraph({
            children: [new TextRun({ text: section.content, bold: true, size: 28 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          })
        );
      } else {
        docParagraphs.push(
          new Paragraph({
            children: [new TextRun({ text: section.title, bold: true, size: 24 })],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
          })
        );

        if (section.type === "bullets") {
          const bullets = section.content.split("\n").filter(Boolean);
          for (const bullet of bullets) {
            docParagraphs.push(
              new Paragraph({
                children: [new TextRun({ text: bullet, size: 20 })],
                bullet: { level: 0 },
                spacing: { after: 80 },
              })
            );
          }
        } else {
          docParagraphs.push(
            new Paragraph({
              children: [new TextRun({ text: section.content, size: 20 })],
              spacing: { after: 200 },
            })
          );
        }
      }
    }

    const doc = new Document({
      sections: [{ properties: {}, children: docParagraphs }],
    });

    const buffer = await Packer.toBuffer(doc);

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="tailored-resume.docx"`,
      },
    });
  }

  return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
}
