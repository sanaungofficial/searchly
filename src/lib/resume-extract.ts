import Anthropic from "@anthropic-ai/sdk";
import {
  fallbackParseResumeFromText,
  normalizeParsedResumeData,
  parseJsonFromModel,
  type ParsedResumeData,
} from "@/lib/resume-parse";

export const PARSE_MODEL = "claude-haiku-4-5-20251001";

export async function fetchResumeBytes(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export function isPdfBuffer(bytes: Buffer): boolean {
  return bytes.length >= 4 && bytes.subarray(0, 4).toString() === "%PDF";
}

function isDocxBuffer(bytes: Buffer): boolean {
  return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export function fileExtFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const base = pathname.split("/").pop() || "";
    const ext = base.split(".").pop()?.toLowerCase();
    return ext && ext.length <= 5 ? ext : "";
  } catch {
    return "";
  }
}

export async function extractRawResumeText(bytes: Buffer, extHint?: string): Promise<string> {
  const ext = extHint?.toLowerCase().replace(/^\./, "") || "";

  if (ext === "docx" || isDocxBuffer(bytes)) {
    try {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ buffer: bytes });
      return value.trim();
    } catch {
      return "";
    }
  }

  if (ext === "txt") {
    return bytes.toString("utf-8").trim();
  }

  if (ext === "pdf" || isPdfBuffer(bytes)) {
    try {
      const pdfParse = (await import("pdf-parse")).default as (data: Buffer) => Promise<{ text: string }>;
      const result = await pdfParse(bytes);
      return result.text?.trim() || "";
    } catch {
      return "";
    }
  }

  return "";
}

export async function parseResumeText(
  anthropic: Anthropic,
  rawText: string,
  structuredPrompt: string,
): Promise<{ parsed: ParsedResumeData | null; tokensIn: number; tokensOut: number }> {
  try {
    const msg = await anthropic.messages.create({
      model: PARSE_MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: `${structuredPrompt}\n\nResume text:\n${rawText.slice(0, 12000)}` }],
    });
    let parsed: ParsedResumeData | null = null;
    if (msg.content[0]?.type === "text") {
      parsed = normalizeParsedResumeData(parseJsonFromModel(msg.content[0].text));
    }
    return {
      parsed,
      tokensIn: msg.usage.input_tokens,
      tokensOut: msg.usage.output_tokens,
    };
  } catch {
    return { parsed: null, tokensIn: 0, tokensOut: 0 };
  }
}

export async function parseResumePdf(
  anthropic: Anthropic,
  base64: string,
  structuredPrompt: string,
): Promise<{ text: string; parsed: ParsedResumeData | null; tokensIn: number; tokensOut: number }> {
  try {
    const [textMsg, structuredMsg] = await Promise.all([
      anthropic.messages.create({
        model: PARSE_MODEL,
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
            { type: "text", text: "Extract all text from this resume exactly as written. Output only the extracted text, nothing else." },
          ],
        }],
      }),
      anthropic.messages.create({
        model: PARSE_MODEL,
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
            { type: "text", text: structuredPrompt },
          ],
        }],
      }),
    ]);

    const text = textMsg.content[0]?.type === "text" ? textMsg.content[0].text : "";
    let parsed: ParsedResumeData | null = null;
    if (structuredMsg.content[0]?.type === "text") {
      parsed = normalizeParsedResumeData(parseJsonFromModel(structuredMsg.content[0].text));
    }
    return {
      text,
      parsed,
      tokensIn: textMsg.usage.input_tokens + structuredMsg.usage.input_tokens,
      tokensOut: textMsg.usage.output_tokens + structuredMsg.usage.output_tokens,
    };
  } catch {
    return { text: "", parsed: null, tokensIn: 0, tokensOut: 0 };
  }
}

export async function parseResumeFile(
  anthropic: Anthropic | null,
  bytes: Buffer,
  ext: string,
  structuredPrompt: string,
): Promise<{ text: string; parsed: ParsedResumeData | null; tokensIn: number; tokensOut: number; usedFallback: boolean }> {
  const rawText = await extractRawResumeText(bytes, ext);
  if (!rawText) {
    return { text: "", parsed: null, tokensIn: 0, tokensOut: 0, usedFallback: false };
  }

  if (!anthropic) {
    return {
      text: rawText,
      parsed: fallbackParseResumeFromText(rawText),
      tokensIn: 0,
      tokensOut: 0,
      usedFallback: true,
    };
  }

  if (ext === "pdf" || isPdfBuffer(bytes)) {
    const base64 = bytes.toString("base64");
    const result = await parseResumePdf(anthropic, base64, structuredPrompt);
    const text = result.text.trim() || rawText;
    const parsed = result.parsed || fallbackParseResumeFromText(text);
    return {
      text,
      parsed,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      usedFallback: !result.parsed,
    };
  }

  const { parsed, tokensIn, tokensOut } = await parseResumeText(anthropic, rawText, structuredPrompt);
  return {
    text: rawText,
    parsed: parsed || fallbackParseResumeFromText(rawText),
    tokensIn,
    tokensOut,
    usedFallback: !parsed,
  };
}

export async function parseResumeFromText(
  anthropic: Anthropic | null,
  rawText: string,
  structuredPrompt: string,
): Promise<{ parsed: ParsedResumeData | null; tokensIn: number; tokensOut: number; usedFallback: boolean }> {
  const text = rawText.trim();
  if (!text) return { parsed: null, tokensIn: 0, tokensOut: 0, usedFallback: false };

  if (!anthropic) {
    return { parsed: fallbackParseResumeFromText(text), tokensIn: 0, tokensOut: 0, usedFallback: true };
  }

  const { parsed, tokensIn, tokensOut } = await parseResumeText(anthropic, text, structuredPrompt);
  return {
    parsed: parsed || fallbackParseResumeFromText(text),
    tokensIn,
    tokensOut,
    usedFallback: !parsed,
  };
}
