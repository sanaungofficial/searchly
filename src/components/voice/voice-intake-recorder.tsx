"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { IntakeParseResult } from "@/lib/career-strategy";
import { KimchiProcessLoader } from "@/components/scout/kimchi-process-loader";

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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

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
        setSummary(result.summary || "Got it — we pulled a few things from your story.");
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

  if (available === false) return null;

  const cardStyle: React.CSSProperties = {
    border: "1.5px solid rgba(26,58,47,0.14)",
    background: "#fff",
    padding: "clamp(18px, 4vw, 28px)",
  };

  if (phase === "processing") {
    return (
      <div style={cardStyle}>
        <KimchiProcessLoader
          preset="onboardingReadback"
          title="Listening back and pulling out the good stuff…"
          hint="Usually about 10–20 seconds."
        />
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div style={cardStyle}>
        <p style={{ margin: 0, fontFamily: "var(--font-ui)", fontSize: 15, color: "#1A3A2F", lineHeight: 1.5 }}>
          ✨ {summary}
        </p>
        <button
          type="button"
          onClick={() => {
            setPhase("idle");
            setSummary(null);
          }}
          style={{
            marginTop: 14,
            background: "transparent",
            border: "none",
            padding: 0,
            color: "rgba(26,58,47,0.65)",
            fontFamily: "var(--font-ui)",
            fontSize: 14,
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Record again
        </button>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <button
          type="button"
          aria-label={phase === "recording" ? "Stop recording" : "Start voice recording"}
          disabled={disabled || available !== true}
          onClick={() => {
            if (phase === "recording") stopRecording();
            else void startRecording();
          }}
          style={{
            width: 56,
            height: 56,
            borderRadius: "999px",
            border: "none",
            flexShrink: 0,
            cursor: disabled ? "not-allowed" : "pointer",
            background: phase === "recording" ? "#C4574A" : "#1A3A2F",
            color: "#F7F5F2",
            fontSize: 22,
            lineHeight: 1,
            boxShadow: phase === "recording" ? "0 0 0 6px rgba(196,87,74,0.18)" : "none",
          }}
        >
          {phase === "recording" ? "■" : "🎙"}
        </button>

        <div style={{ flex: 1 }}>
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontSize: "clamp(18px, 2.4vw, 22px)",
              color: "#1A3A2F",
              lineHeight: 1.25,
            }}
          >
            {phase === "recording" ? "We're listening…" : "Prefer talking to tapping?"}
          </p>
          <p
            style={{
              margin: "8px 0 0",
              fontFamily: "var(--font-ui)",
              fontSize: 15,
              color: "rgba(26,58,47,0.72)",
              lineHeight: 1.5,
            }}
          >
            {phase === "recording"
              ? `Hit stop when you're done.${elapsed > 0 ? ` (${formatDuration(elapsed)})` : ""}`
              : "Hit the mic and tell us what you're looking for — a couple minutes is perfect."}
          </p>
          {error && (
            <p style={{ margin: "10px 0 0", color: "#9B3A2A", fontFamily: "var(--font-ui)", fontSize: 14 }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
