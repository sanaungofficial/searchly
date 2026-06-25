import Anthropic from "@anthropic-ai/sdk";
import { isHirebaseResumeConfigured, parseResumeWithHirebase } from "@/lib/hirebase-resume";
import {
  fallbackParseResumeFromText,
  isLikelyBrokenWorkExperience,
  normalizeParsedResumeData,
  parseJsonFromModel,
  type ParsedResumeData,
} from "@/lib/resume-parse";

export const PARSE_MODEL = "claude-haiku-4-5-20251001";

export type ResumeParseProvider = "hirebase" | "claude" | "heuristic";

export type ResumeFileParseResult = {
  text: string;
  parsed: ParsedResumeData | null;
  tokensIn: number;
  tokensOut: number;
  usedFallback: boolean;
  provider: ResumeParseProvider;
  hirebaseArtifactId?: string | null;
};

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
      max_tokens: 8192,
      messages: [{ role: "user", content: `${structuredPrompt}\n\nResume text:\n${rawText.slice(0, 24000)}` }],
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
        max_tokens: 8192,
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
        max_tokens: 8192,
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

async function parseFileWithClaude(
  anthropic: Anthropic,
  bytes: Buffer,
  ext: string,
  rawText: string,
  structuredPrompt: string,
): Promise<Omit<ResumeFileParseResult, "usedFallback" | "hirebaseArtifactId">> {
  if (ext === "pdf" || isPdfBuffer(bytes)) {
    const base64 = bytes.toString("base64");
    const result = await parseResumePdf(anthropic, base64, structuredPrompt);
    const text = result.text.trim() || rawText;
    const parsed = result.parsed || (text ? fallbackParseResumeFromText(text) : null);
    return {
      text,
      parsed,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      provider: result.parsed ? "claude" : "heuristic",
    };
  }

  const sourceText = rawText.trim();
  if (!sourceText) {
    return { text: "", parsed: null, tokensIn: 0, tokensOut: 0, provider: "heuristic" };
  }

  const { parsed, tokensIn, tokensOut } = await parseResumeText(anthropic, sourceText, structuredPrompt);
  return {
    text: sourceText,
    parsed: parsed || fallbackParseResumeFromText(sourceText),
    tokensIn,
    tokensOut,
    provider: parsed ? "claude" : "heuristic",
  };
}

function parseFileHeuristic(rawText: string): ResumeFileParseResult {
  const text = rawText.trim();
  return {
    text,
    parsed: text ? fallbackParseResumeFromText(text) : null,
    tokensIn: 0,
    tokensOut: 0,
    usedFallback: true,
    provider: "heuristic",
  };
}

export async function parseResumeFile(
  anthropic: Anthropic | null,
  bytes: Buffer,
  ext: string,
  structuredPrompt: string,
  filename?: string,
): Promise<ResumeFileParseResult> {
  const rawText = await extractRawResumeText(bytes, ext);
  const hirebaseEnabled = isHirebaseResumeConfigured();
  let hirebaseFailed = false;

  if (hirebaseEnabled) {
    try {
      const hirebase = await parseResumeWithHirebase({ bytes, ext, filename });
      if (hirebase?.parsed && !isLikelyBrokenWorkExperience(hirebase.parsed.workExperience)) {
        return {
          text: rawText || hirebase.resumeText,
          parsed: hirebase.parsed,
          tokensIn: 0,
          tokensOut: 0,
          usedFallback: false,
          provider: "hirebase",
          hirebaseArtifactId: hirebase.artifactId,
        };
      }
      if (hirebase?.parsed) {
        console.warn("[resume-parse] Hirebase structure looks broken, falling back to Claude/heuristic");
      }
      hirebaseFailed = true;
    } catch (err) {
      hirebaseFailed = true;
      console.error("[resume-parse] Hirebase embed failed, falling back to Claude:", err);
    }
  }

  if (anthropic) {
    const claude = await parseFileWithClaude(anthropic, bytes, ext, rawText, structuredPrompt);
    if (claude.parsed || claude.text) {
      return {
        ...claude,
        usedFallback: hirebaseFailed,
      };
    }
  }

  if (rawText.trim()) {
    return parseFileHeuristic(rawText);
  }

  return {
    text: "",
    parsed: null,
    tokensIn: 0,
    tokensOut: 0,
    usedFallback: hirebaseFailed,
    provider: "heuristic",
  };
}

export async function parseResumeFromText(
  anthropic: Anthropic | null,
  rawText: string,
  structuredPrompt: string,
): Promise<{ parsed: ParsedResumeData | null; tokensIn: number; tokensOut: number; usedFallback: boolean; provider: ResumeParseProvider }> {
  const text = rawText.trim();
  if (!text) return { parsed: null, tokensIn: 0, tokensOut: 0, usedFallback: false, provider: "heuristic" };

  if (!anthropic) {
    return {
      parsed: fallbackParseResumeFromText(text),
      tokensIn: 0,
      tokensOut: 0,
      usedFallback: true,
      provider: "heuristic",
    };
  }

  const { parsed, tokensIn, tokensOut } = await parseResumeText(anthropic, text, structuredPrompt);
  return {
    parsed: parsed || fallbackParseResumeFromText(text),
    tokensIn,
    tokensOut,
    usedFallback: !parsed,
    provider: parsed ? "claude" : "heuristic",
  };
}
