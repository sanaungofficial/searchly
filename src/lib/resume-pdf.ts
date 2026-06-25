import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ParsedResumeData } from "@/lib/resume-parse";

const MARGIN = 50;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const LINE_HEIGHT = 14;
const MAX_WIDTH = PAGE_WIDTH - MARGIN * 2;

function wrapText(text: string, maxChars = 92): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n+/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

export async function buildResumePdf(
  data: ParsedResumeData,
  filename = "resume.pdf",
): Promise<{ buffer: Buffer; filename: string }> {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = PAGE_HEIGHT - MARGIN;

  function ensureSpace(lines = 1) {
    if (y - lines * LINE_HEIGHT < MARGIN) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  function drawLine(text: string, opts?: { bold?: boolean; size?: number; gap?: number }) {
    const size = opts?.size ?? 11;
    const gap = opts?.gap ?? LINE_HEIGHT;
    for (const line of wrapText(text)) {
      ensureSpace();
      page.drawText(line, {
        x: MARGIN,
        y,
        size,
        font: opts?.bold ? fontBold : font,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= gap;
    }
  }

  if (data.name) {
    drawLine(data.name, { bold: true, size: 16, gap: 18 });
  }

  const contact = [data.email, data.phone, data.location, data.linkedinUrl, data.website]
    .filter(Boolean)
    .join(" · ");
  if (contact) drawLine(contact, { size: 10, gap: 16 });

  if (data.summary) {
    drawLine("PROFESSIONAL SUMMARY", { bold: true, size: 12, gap: 16 });
    drawLine(data.summary);
    y -= 6;
  }

  if (data.skills.length) {
    drawLine("SKILLS", { bold: true, size: 12, gap: 16 });
    drawLine(data.skills.join(" · "));
    y -= 6;
  }

  if (data.workExperience.length) {
    drawLine("EXPERIENCE", { bold: true, size: 12, gap: 16 });
    for (const job of data.workExperience) {
      const dates = [job.from, job.to].filter(Boolean).join(" – ");
      drawLine(`${job.title}${dates ? ` · ${dates}` : ""}`, { bold: true, size: 11 });
      drawLine(`${job.company}${job.location ? ` · ${job.location}` : ""}`, { size: 10 });
      if (job.description) drawLine(job.description);
      for (const bullet of job.bullets ?? []) {
        drawLine(`• ${bullet.replace(/^[•\-\*–—]\s*/, "")}`);
      }
      y -= 4;
    }
  }

  if (data.education.length) {
    drawLine("EDUCATION", { bold: true, size: 12, gap: 16 });
    for (const edu of data.education) {
      drawLine(`${edu.degree}${edu.field ? `, ${edu.field}` : ""}`, { bold: true, size: 11 });
      drawLine(`${edu.school}${edu.from || edu.to ? ` · ${[edu.from, edu.to].filter(Boolean).join(" – ")}` : ""}`);
      y -= 4;
    }
  }

  const bytes = await pdf.save();
  return { buffer: Buffer.from(bytes), filename };
}

export async function buildPlainTextPdf(
  text: string,
  filename = "resume.pdf",
): Promise<{ buffer: Buffer; filename: string }> {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let y = PAGE_HEIGHT - MARGIN;

  for (const line of wrapText(text)) {
    if (y - LINE_HEIGHT < MARGIN) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
    page.drawText(line || " ", {
      x: MARGIN,
      y,
      size: 11,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= LINE_HEIGHT;
  }

  const bytes = await pdf.save();
  return { buffer: Buffer.from(bytes), filename };
}
