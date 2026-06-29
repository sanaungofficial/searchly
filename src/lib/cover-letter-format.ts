/** Parsed sections of a professional cover letter (plain text, blank-line separated). */

export type CoverLetterTone = "formal" | "conversational";

export type CoverLetterContext = {
  motivation: string;
  achievements: string;
  tone: CoverLetterTone;
  notes: string;
};

export type CoverLetterSections = {
  date?: string;
  recipientLines: string[];
  salutation?: string;
  bodyParagraphs: string[];
  closing?: string;
  signature?: string;
};

const MONTH_NAMES =
  "january|february|march|april|may|june|july|august|september|october|november|december";
const DATE_LINE = new RegExp(
  `^(?:${MONTH_NAMES})\\s+\\d{1,2},?\\s+\\d{4}$|^\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}$`,
  "i",
);
const SALUTATION_LINE = /^dear\s+.+,?\.?$/i;
const CLOSING_LINE =
  /^(sincerely|best regards|kind regards|warm regards|respectfully|thank you|regards),?\.?$/i;

function looksLikeDate(line: string): boolean {
  return DATE_LINE.test(line.trim());
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Heuristically split streamed/plain cover letter text into letter sections. */
export function parseCoverLetter(text: string): CoverLetterSections {
  const paragraphs = splitParagraphs(text);
  if (paragraphs.length === 0) {
    return { recipientLines: [], bodyParagraphs: [] };
  }

  let idx = 0;
  let date: string | undefined;
  const recipientLines: string[] = [];
  let salutation: string | undefined;
  const bodyParagraphs: string[] = [];
  let closing: string | undefined;
  let signature: string | undefined;

  if (looksLikeDate(paragraphs[0])) {
    date = paragraphs[0];
    idx = 1;
  }

  while (idx < paragraphs.length) {
    const block = paragraphs[idx];
    const firstLine = block.split("\n")[0]?.trim() ?? block;

    if (SALUTATION_LINE.test(firstLine)) {
      salutation = block;
      idx += 1;
      break;
    }
    if (CLOSING_LINE.test(firstLine)) break;

    recipientLines.push(...block.split("\n").map((l) => l.trim()).filter(Boolean));
    idx += 1;
  }

  while (idx < paragraphs.length) {
    const block = paragraphs[idx];
    const firstLine = block.split("\n")[0]?.trim() ?? block;

    if (CLOSING_LINE.test(firstLine)) {
      closing = block;
      idx += 1;
      if (idx < paragraphs.length) {
        signature = paragraphs[idx];
        idx += 1;
      }
      break;
    }

    bodyParagraphs.push(block);
    idx += 1;
  }

  if (!salutation && bodyParagraphs.length === 0 && recipientLines.length === 0) {
    return { date, recipientLines: [], bodyParagraphs: paragraphs };
  }

  return { date, recipientLines, salutation, bodyParagraphs, closing, signature };
}

export function coverLetterToPlainText(sections: CoverLetterSections): string {
  const parts: string[] = [];
  if (sections.date) parts.push(sections.date);
  if (sections.recipientLines.length) parts.push(sections.recipientLines.join("\n"));
  if (sections.salutation) parts.push(sections.salutation);
  parts.push(...sections.bodyParagraphs);
  if (sections.closing) parts.push(sections.closing);
  if (sections.signature) parts.push(sections.signature);
  return parts.join("\n\n");
}

/** HTML for print/PDF export — Georgia serif, business letter spacing. */
export function coverLetterToPrintHtml(
  sections: CoverLetterSections,
  opts?: { senderName?: string; senderEmail?: string },
): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");

  const senderBlock =
    opts?.senderName || opts?.senderEmail
      ? `<div class="sender">${esc(opts.senderName ?? "")}${
          opts.senderEmail ? `<br>${esc(opts.senderEmail)}` : ""
        }</div>`
      : "";

  const dateBlock = sections.date ? `<div class="date">${esc(sections.date)}</div>` : "";
  const recipientBlock =
    sections.recipientLines.length > 0
      ? `<div class="recipient">${esc(sections.recipientLines.join("\n"))}</div>`
      : "";
  const salutationBlock = sections.salutation
    ? `<p class="salutation">${esc(sections.salutation)}</p>`
    : "";
  const bodyBlocks = sections.bodyParagraphs
    .map((p) => `<p class="body">${esc(p)}</p>`)
    .join("");
  const closingBlock = sections.closing
    ? `<p class="closing">${esc(sections.closing)}</p>`
    : "";
  const signatureBlock = sections.signature
    ? `<p class="signature">${esc(sections.signature)}</p>`
    : "";

  return `<!DOCTYPE html><html><head><title>Cover Letter</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; max-width: 680px; margin: 60px auto;
    color: #1A1A1A; line-height: 1.75; font-size: 14px; }
  .sender { text-align: right; margin-bottom: 28px; font-family: -apple-system, sans-serif; font-size: 13px; }
  .date { margin-bottom: 24px; }
  .recipient { margin-bottom: 20px; }
  .salutation { margin: 0 0 16px; }
  .body { margin: 0 0 16px; }
  .closing { margin: 24px 0 8px; }
  .signature { margin: 0; }
  @media print { body { margin: 40px; } }
</style></head><body>
${senderBlock}${dateBlock}${recipientBlock}${salutationBlock}${bodyBlocks}${closingBlock}${signatureBlock}
<script>window.onload=function(){window.print()}<\/script>
</body></html>`;
}
