import { VOICE_AGENT_OUTPUT_SAMPLE_RATE } from "@/lib/voice-agent-audio";

/**
 * Browser playback for Deepgram agent PCM (linear16).
 * Unlike AgentPlayer from @deepgram/agents, interrupt() stops scheduled buffers
 * without closing AudioContext — avoids static/garbled TTS after barge-in.
 */
export class VoiceAgentPlayer {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private nextStartTime = 0;
  private readonly sampleRate: number;
  private sources = new Set<AudioBufferSourceNode>();
  private volume = 1;

  constructor(sampleRate = VOICE_AGENT_OUTPUT_SAMPLE_RATE) {
    this.sampleRate = sampleRate;
  }

  /** Call on user gesture before connect so TTS can play reliably. */
  async prepare(): Promise<void> {
    const ctx = await this.ensureContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
  }

  private async ensureContext(): Promise<AudioContext> {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext({ sampleRate: this.sampleRate });
      this.nextStartTime = 0;
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = this.volume;
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  queue(data: ArrayBuffer): void {
    void this.play(data);
  }

  private async play(data: ArrayBuffer): Promise<void> {
    if (!data.byteLength) return;
    const ctx = await this.ensureContext();
    const int16 = new Int16Array(data);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / (int16[i] < 0 ? 32768 : 32767);
    }

    const buffer = ctx.createBuffer(1, float32.length, this.sampleRate);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode!);

    const startAt = Math.max(ctx.currentTime, this.nextStartTime);
    source.start(startAt);
    this.nextStartTime = startAt + buffer.duration;

    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
    };
  }

  interrupt(): void {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear();
    if (this.ctx) {
      this.nextStartTime = this.ctx.currentTime;
    }
  }

  getOutputVolume(): number {
    if (!this.analyser) return 0;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const sample = (data[i] - 128) / 128;
      sum += sample * sample;
    }
    return Math.min(1, 4 * Math.sqrt(sum / data.length));
  }

  dispose(): void {
    this.interrupt();
    void this.ctx?.close();
    this.ctx = null;
    this.gainNode = null;
    this.analyser = null;
  }
}
