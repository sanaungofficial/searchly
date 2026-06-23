import Anthropic from "@anthropic-ai/sdk";
import {
  normalizeParsedResumeData,
  parseJsonFromModel,
  type ParsedResumeData,
} from "@/lib/resume-parse";

export const PARSE_MODEL = "claude-haiku-4-5-20251001";

export async function parseResumeText(
  anthropic: Anthropic,
  rawText: string,
  structuredPrompt: string,
): Promise<{ parsed: ParsedResumeData | null; tokensIn: number; tokensOut: number }> {
  try {
    const msg = await anthropic.messages.create({
      model: PARSE_MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: `${structuredPrompt}\n\nResume text:\n${rawText.slice(0, 8000)}` }],
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
