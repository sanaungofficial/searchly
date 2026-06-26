"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { IntakeParseResult } from "@/lib/career-strategy";
import { VoiceOrb, useAudioLevel, type VoiceOrbState } from "@/components/voice/voice-orb";

export type VoiceIntakeResult = IntakeParseResult & {
  transcript: string;
  durationSeconds?: number | null;
  parseSkipped?: boolean;
};

type RecorderPhase = "idle" | "recording" | "processing" | "done" | "error";

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "audio/webm";
}

function phaseToOrbState(phase: RecorderPhase): VoiceOrbState {
  if (phase === "error") return "idle";
  return phase;
}

interface VoiceIntakeRecorderProps {
  onComplete: (result: VoiceIntakeResult) => void;
  disabled?: boolean;
}

export function VoiceIntakeRecorder({ onComplete, disabled }: VoiceIntakeRecorderProps) {
  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const audioLevel = useAudioLevel(phase === "recording", liveStream);

  useEffect(() => {
    void fetch("/api/voice/intake")
      .then((res) => res.json())
      .then((data) => setAvailable(!!data?.transcriptionAvailable))
      .catch(() => setAvailable(false));
  }, []);

  const cleanupStream = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLiveStream(null);
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => cleanupStream, [cleanupStream]);

  const uploadRecording = useCallback(
    async (blob: Blob) => {
      setPhase("processing");
      setError(null);

      const formData = new FormData();
      formData.append("audio", blob, "voice-intake.webm");

      try {
        const res = await fetch("/api/voice/intake", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(typeof data?.error === "string" ? data.error : "Voice intake failed");
        }

        const result = data as VoiceIntakeResult;
        setSummary(result.summary || "Pulled a few things from your story — check the picks below.");
        setPhase("done");
        onComplete(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Voice intake failed");
        setPhase("error");
      }
    },
    [onComplete],
  );

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  }, []);

  const startRecording = useCallback(async () => {
    if (disabled || phase === "recording" || phase === "processing") return;

    setError(null);
    setSummary(null);
    setElapsed(0);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setLiveStream(stream);

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        cleanupStream();
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        if (blob.size === 0) {
          setError("We didn't catch any audio — try again and speak for a few seconds.");
          setPhase("error");
          return;
        }
        void uploadRecording(blob);
      };

      recorder.start(250);
      setPhase("recording");
      timerRef.current = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    } catch (err) {
      cleanupStream();
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access is blocked — check your browser permissions."
          : "Could not start recording.";
      setError(message);
      setPhase("error");
    }
  }, [cleanupStream, disabled, phase, uploadRecording]);

  const handleOrbClick = useCallback(() => {
    if (phase === "recording") stopRecording();
    else if (phase === "idle" || phase === "error" || phase === "done") void startRecording();
  }, [phase, startRecording, stopRecording]);

  if (available === false) return null;

  const orbLabel =
    phase === "recording"
      ? elapsed > 0
        ? `Listening · ${formatDuration(elapsed)}`
        : "Listening…"
      : phase === "processing"
        ? "One sec…"
        : phase === "done"
          ? "Got it"
          : "Tap to talk";

  const orbSublabel =
    phase === "idle" || phase === "error"
      ? "Tell us what you're looking for — target role, timeline, what matters. A minute is plenty."
      : phase === "recording"
        ? "Tap the orb again when you're done."
        : phase === "processing"
          ? "Transcribing and pulling out the useful bits."
          : summary ?? undefined;

  return (
    <div className="voice-intake-hero anim-fade-up">
      <VoiceIntakeHeroStyles />
      <div className="voice-intake-hero__panel">
        <p className="voice-intake-hero__eyebrow">Or just talk</p>
        <h3 className="voice-intake-hero__title">Skip the forms — tell Kimchi your story.</h3>

        <VoiceOrb
          state={phaseToOrbState(phase)}
          audioLevel={audioLevel}
          onClick={handleOrbClick}
          disabled={disabled || available !== true}
          label={orbLabel}
        />

        {orbSublabel && phase !== "done" && (
          <p className="voice-intake-hero__hint">{orbSublabel}</p>
        )}

        {phase === "done" && summary && (
          <div className="voice-intake-hero__success">
            <p>{summary}</p>
            <button type="button" className="voice-intake-hero__again" onClick={() => {
              setPhase("idle");
              setSummary(null);
            }}>
              Record again
            </button>
          </div>
        )}

        {error && <p className="voice-intake-hero__error">{error}</p>}
      </div>
    </div>
  );
}

function VoiceIntakeHeroStyles() {
  return (
    <style>{`
      .voice-intake-hero {
        width: 100%;
      }

      .voice-intake-hero__panel {
        position: relative;
        overflow: hidden;
        padding: clamp(28px, 6vw, 44px) clamp(20px, 5vw, 36px);
        background:
          radial-gradient(circle at 20% 0%, rgba(61, 170, 156, 0.12), transparent 42%),
          radial-gradient(circle at 80% 100%, rgba(196, 168, 106, 0.1), transparent 38%),
          linear-gradient(180deg, #eef5f2 0%, #f7f5f2 100%);
        border: 1.5px solid rgba(26, 58, 47, 0.12);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        text-align: center;
      }

      .voice-intake-hero__panel::before {
        content: "";
        position: absolute;
        inset: 0;
        background-image:
          radial-gradient(rgba(26, 58, 47, 0.04) 1px, transparent 1px);
        background-size: 18px 18px;
        pointer-events: none;
        opacity: 0.5;
      }

      .voice-intake-hero__eyebrow {
        position: relative;
        margin: 0;
        font-family: var(--font-ui);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(26, 58, 47, 0.55);
      }

      .voice-intake-hero__title {
        position: relative;
        margin: 0 0 12px;
        max-width: 420px;
        font-family: var(--font-display);
        font-size: clamp(20px, 3.2vw, 26px);
        line-height: 1.25;
        color: #1A3A2F;
        font-weight: 600;
      }

      .voice-intake-hero__hint {
        position: relative;
        margin: 4px 0 0;
        max-width: 380px;
        font-family: var(--font-ui);
        font-size: 15px;
        line-height: 1.55;
        color: rgba(26, 58, 47, 0.72);
      }

      .voice-intake-hero__success {
        position: relative;
        margin-top: 8px;
        max-width: 420px;
        padding: 14px 18px;
        background: rgba(255, 255, 255, 0.72);
        border: 1px solid rgba(26, 58, 47, 0.12);
      }

      .voice-intake-hero__success p {
        margin: 0;
        font-family: var(--font-ui);
        font-size: 15px;
        line-height: 1.5;
        color: #1A3A2F;
      }

      .voice-intake-hero__again {
        margin-top: 12px;
        background: transparent;
        border: none;
        padding: 0;
        font-family: var(--font-ui);
        font-size: 14px;
        color: rgba(26, 58, 47, 0.65);
        cursor: pointer;
        text-decoration: underline;
      }

      .voice-intake-hero__error {
        position: relative;
        margin: 8px 0 0;
        max-width: 380px;
        font-family: var(--font-ui);
        font-size: 14px;
        line-height: 1.5;
        color: #9B3A2A;
      }
    `}</style>
  );
}
