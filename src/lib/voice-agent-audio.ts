/** Deepgram Voice Agent PCM settings — keep session + player in sync. */
export const VOICE_AGENT_AUDIO = {
  input: { encoding: "linear16" as const, sampleRate: 16_000 },
  output: { encoding: "linear16" as const, sampleRate: 24_000 },
};

export const VOICE_AGENT_OUTPUT_SAMPLE_RATE = VOICE_AGENT_AUDIO.output.sampleRate;
