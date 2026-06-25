import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import type { ParsedResumeData } from "@/lib/resume-parse";

function contactLine(data: ParsedResumeData): string {
  return [
    data.email,
    data.phone,
    data.location,
    data.linkedinUrl,
    data.website,
  ].filter(Boolean).join(" · ");
}

export async function buildResumeDocx(data: ParsedResumeData, filename = "resume.docx"): Promise<{ buffer: Buffer; filename: string }> {
  const children: Paragraph[] = [];

  if (data.name) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: data.name, bold: true, size: 32 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
      }),
    );
  }

  const contact = contactLine(data);
  if (contact) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: contact, size: 20 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
      }),
    );
  }

  if (data.summary) {
    children.push(sectionHeading("Professional Summary"));
    children.push(bodyParagraph(data.summary));
  }

  if (data.skillGroups.length) {
    children.push(sectionHeading("Areas of Emphasis"));
    for (const group of data.skillGroups) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: group.label, bold: true, size: 22 })],
          spacing: { before: 120, after: 80 },
        }),
      );
      children.push(bodyParagraph(group.skills.join(" · ")));
    }
  } else if (data.skills.length) {
    children.push(sectionHeading("Skills"));
    children.push(bodyParagraph(data.skills.join(" · ")));
  }

  if (data.workExperience.length) {
    children.push(sectionHeading("Professional Experience"));
    for (const job of data.workExperience) {
      const dates = [job.from, job.to].filter(Boolean).join(" – ");
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: job.title, bold: true, size: 22 }),
            new TextRun({ text: dates ? `  ${dates}` : "", size: 20 }),
          ],
          spacing: { before: 160, after: 40 },
        }),
      );
      children.push(
        new Paragraph({
          children: [new TextRun({ text: job.company, italics: true, size: 20 })],
          spacing: { after: 80 },
        }),
      );
      if (job.description) children.push(bodyParagraph(job.description));
      for (const bullet of job.bullets) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: bullet, size: 20 })],
            bullet: { level: 0 },
            spacing: { after: 60 },
          }),
        );
      }
    }
  }

  if (data.education.length) {
    children.push(sectionHeading("Education"));
    for (const edu of data.education) {
      const line = [edu.degree, edu.field].filter(Boolean).join(", ");
      children.push(
        new Paragraph({
          children: [new TextRun({ text: edu.school, bold: true, size: 22 })],
          spacing: { before: 120, after: 40 },
        }),
      );
      children.push(bodyParagraph([line, [edu.from, edu.to].filter(Boolean).join(" – ")].filter(Boolean).join(" · ")));
    }
  }

  if (data.certifications.length) {
    children.push(sectionHeading("Certifications"));
    for (const cert of data.certifications) {
      children.push(bodyParagraph([cert.name, cert.issuer, cert.date].filter(Boolean).join(" · ")));
    }
  }

  const doc = new Document({ sections: [{ properties: {}, children }] });
  const buffer = await Packer.toBuffer(doc);
  return { buffer, filename };
}

function sectionHeading(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24 })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
  });
}

function bodyParagraph(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, size: 20 })],
    spacing: { after: 120 },
  });
}

export async function buildPlainTextDocx(
  text: string,
  filename = "resume.docx",
): Promise<{ buffer: Buffer; filename: string }> {
  const children = text.split(/\n/).map((line) => bodyParagraph(line || " "));
  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  return { buffer, filename };
}
