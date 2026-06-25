import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ParsedResumeData } from "@/lib/resume-parse";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const LINE_HEIGHT = 14;
const BODY_SIZE = 11;
const HEADING_SIZE = 13;
const NAME_SIZE = 16;

function wrapLines(text: string, maxWidth: number, font: Awaited<ReturnType<PDFDocument["embedFont"]>>, size: number): string[] {
  const words = text.replace(/\r/g, "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

async function createPdfWriter() {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const maxWidth = PAGE_WIDTH - MARGIN * 2;

  const ensureSpace = (needed: number) => {
    if (y - needed >= MARGIN) return;
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  };

  const writeLine = (text: string, opts?: { bold?: boolean; size?: number; gap?: number }) => {
    const size = opts?.size ?? BODY_SIZE;
    const gap = opts?.gap ?? LINE_HEIGHT;
    ensureSpace(gap);
    page.drawText(text, {
      x: MARGIN,
      y: y - size,
      size,
      font: opts?.bold ? fontBold : font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= gap;
  };

  const writeParagraph = (text: string, opts?: { bold?: boolean; size?: number }) => {
    const size = opts?.size ?? BODY_SIZE;
    const f = opts?.bold ? fontBold : font;
    for (const rawLine of text.split("\n")) {
      for (const line of wrapLines(rawLine.trim(), maxWidth, f, size)) {
        writeLine(line, { bold: opts?.bold, size });
      }
      y -= 4;
    }
  };

  const writeHeading = (text: string) => {
    y -= 8;
    writeLine(text.toUpperCase(), { bold: true, size: HEADING_SIZE, gap: HEADING_SIZE + 6 });
  };

  return {
    finish: async (filename: string) => {
      const bytes = await pdf.save();
      return { buffer: Buffer.from(bytes), filename };
    },
    writeLine,
    writeParagraph,
    writeHeading,
  };
}

export async function buildResumePdf(
  data: ParsedResumeData,
  filename = "resume.pdf",
): Promise<{ buffer: Buffer; filename: string }> {
  const w = await createPdfWriter();

  if (data.name) w.writeLine(data.name, { bold: true, size: NAME_SIZE, gap: NAME_SIZE + 4 });
  const contact = [data.email, data.phone, data.location, data.linkedinUrl, data.website].filter(Boolean).join(" · ");
  if (contact) w.writeParagraph(contact);

  if (data.summary) {
    w.writeHeading("Professional Summary");
    w.writeParagraph(data.summary);
  }

  if (data.skillGroups.length) {
    w.writeHeading("Areas of Emphasis");
    for (const group of data.skillGroups) {
      w.writeLine(group.label, { bold: true });
      w.writeParagraph(group.skills.join(" · "));
    }
  } else if (data.skills.length) {
    w.writeHeading("Skills");
    w.writeParagraph(data.skills.join(" · "));
  }

  if (data.workExperience.length) {
    w.writeHeading("Professional Experience");
    for (const job of data.workExperience) {
      const dates = [job.from, job.to].filter(Boolean).join(" – ");
      w.writeLine([job.title, dates].filter(Boolean).join("  "), { bold: true });
      w.writeLine(job.company, { bold: false });
      if (job.description) w.writeParagraph(job.description);
      for (const bullet of job.bullets) {
        w.writeParagraph(`• ${bullet}`);
      }
    }
  }

  if (data.education.length) {
    w.writeHeading("Education");
    for (const edu of data.education) {
      w.writeLine(edu.school, { bold: true });
      w.writeParagraph(
        [[edu.degree, edu.field].filter(Boolean).join(", "), [edu.from, edu.to].filter(Boolean).join(" – ")]
          .filter(Boolean)
          .join(" · "),
      );
    }
  }

  if (data.certifications.length) {
    w.writeHeading("Certifications");
    for (const cert of data.certifications) {
      w.writeParagraph([cert.name, cert.issuer, cert.date].filter(Boolean).join(" · "));
    }
  }

  return w.finish(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

export async function buildPlainTextResumePdf(
  text: string,
  filename = "resume.pdf",
): Promise<{ buffer: Buffer; filename: string }> {
  const w = await createPdfWriter();
  for (const line of text.split("\n")) {
    if (!line.trim()) {
      w.writeLine("");
      continue;
    }
    w.writeParagraph(line);
  }
  return w.finish(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
