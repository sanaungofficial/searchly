import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

/** Direct Anthropic SDK client — required for PDF document parsing (gateway does not support PDF uploads). */
export function getLegacyAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY required for legacy Anthropic client");
  }
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export function hasLegacyAnthropicClient(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
