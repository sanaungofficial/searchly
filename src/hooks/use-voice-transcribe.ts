"use client";

import { useCallback, useRef, useState } from "react";

type TranscribeState = "idle" | "recording" | "transcribing";

export function useVoiceTranscribe(onTranscript: (text: string) => void) {
  const [state, setState] = useState<TranscribeState>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
    streamRef.current = null;
  }, []);

  const toggle = useCallback(async () => {
    if (state === "transcribing") return;

    if (state === "recording") {
      stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        if (blob.size < 1000) {
          setState("idle");
          return;
        }

        setState("transcribing");
        try {
          const form = new FormData();
          form.append("audio", blob, "recording.webm");
          const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
          if (!res.ok) throw new Error("Transcription failed");
          const data = await res.json();
          if (data.transcript) onTranscript(data.transcript);
        } catch {
          // silently fail — user can retry
        } finally {
          setState("idle");
        }
      };

      recorder.start(250);
      setState("recording");
    } catch {
      setState("idle");
    }
  }, [state, stop, onTranscript]);

  return { state, toggle, stop } as const;
}
