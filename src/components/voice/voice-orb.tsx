"use client";

import { useEffect, useRef, useState } from "react";

export type VoiceOrbState =
  | "idle"
  | "connecting"
  | "live"
  | "listening"
  | "speaking"
  | "thinking"
  | "done"
  | "error";

interface VoiceOrbProps {
  state: VoiceOrbState;
  audioLevel?: number;
  onClick?: () => void;
  disabled?: boolean;
  label?: string;
  sublabel?: string;
  /** hero = onboarding panel; float = bottom-right launcher; composer = inline mic button */
  variant?: "hero" | "float" | "composer";
  /** Continuous bounce when idle (default true for float) */
  bounce?: boolean;
}

function KimchiStar({ size = 28 }: { size?: number }) {
  return (
    <span
      className="voice-orb-star"
      aria-hidden="true"
      style={{ fontSize: size, lineHeight: 1, color: "currentColor" }}
    >
      ✦
    </span>
  );
}

export function VoiceOrb({
  state,
  audioLevel = 0,
  onClick,
  disabled,
  label,
  sublabel,
  variant = "hero",
  bounce,
}: VoiceOrbProps) {
  const isFloat = variant === "float";
  const isComposer = variant === "composer";
  const shouldBounce = bounce ?? (isFloat && (state === "idle" || state === "error" || state === "done"));
  const isListening = state === "listening" || state === "live";
  const isSpeaking = state === "speaking";
  const isThinking = state === "thinking" || state === "connecting";
  const isDone = state === "done";
  const pulse = 1 + Math.min(audioLevel, 1) * 0.22;
  const glow = 0.35 + Math.min(audioLevel, 1) * 0.45;

  const defaultLabel =
    state === "listening"
      ? "Listening…"
      : state === "live"
        ? "Your turn"
      : state === "speaking"
        ? "Kimchi"
      : state === "thinking" || state === "connecting"
        ? "One sec…"
        : state === "done"
          ? "All set"
          : "Tap to talk";

  return (
    <>
      <VoiceOrbStyles />
      <div className={["voice-orb-wrap", isFloat ? "voice-orb-wrap--float" : "", isComposer ? "voice-orb-wrap--composer" : ""].filter(Boolean).join(" ")}>
        <div
          className={[
            "voice-orb-rings",
            shouldBounce ? "voice-orb-rings--bounce" : "",
            isFloat ? "voice-orb-rings--compact" : "",
            isComposer ? "voice-orb-rings--composer" : "",
            isListening ? "voice-orb-rings--active" : "",
            isSpeaking ? "voice-orb-rings--speaking" : "",
            isThinking ? "voice-orb-rings--processing" : "",
            isDone ? "voice-orb-rings--done" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={
            isListening || isSpeaking
              ? ({
                  ["--orb-pulse" as string]: String(pulse),
                  ["--orb-glow" as string]: String(glow),
                } as React.CSSProperties)
              : undefined
          }
        >
          <span className="voice-orb-ring voice-orb-ring--1" aria-hidden="true" />
          {!isComposer && (
            <>
              <span className="voice-orb-ring voice-orb-ring--2" aria-hidden="true" />
              <span className="voice-orb-ring voice-orb-ring--3" aria-hidden="true" />
            </>
          )}

          <button
            type="button"
            className={[
              "voice-orb-core",
              isListening ? "voice-orb-core--active" : "",
              isSpeaking ? "voice-orb-core--speaking" : "",
              isThinking ? "voice-orb-core--processing" : "",
              isDone ? "voice-orb-core--done" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={onClick}
            disabled={disabled || isThinking}
            aria-label={
              state === "live" || state === "listening" || state === "speaking"
                ? "End voice conversation"
                : state === "connecting" || state === "thinking"
                  ? "Connecting voice agent"
                  : "Start voice conversation"
            }
          >
            <span className="voice-orb-core__inner">
              {isThinking ? (
                <span className="voice-orb-spinner" aria-hidden="true" />
              ) : isDone ? (
                <span className="voice-orb-check" aria-hidden="true">
                  ✓
                </span>
              ) : state === "idle" ? (
                <span className="voice-orb-star-wrap" aria-hidden="true">
                  <KimchiStar size={isComposer ? 18 : isFloat ? 26 : 32} />
                </span>
              ) : (
                <span className="voice-orb-wave" aria-hidden="true">
                  <span /><span /><span />
                </span>
              )}
            </span>
            {!isFloat && !isComposer && (
              <span className="voice-orb-core__label">{label ?? defaultLabel}</span>
            )}
          </button>
        </div>

        {sublabel && <p className="voice-orb-sublabel">{sublabel}</p>}
      </div>
    </>
  );
}

/** Hook: live audio level 0–1 from mic stream */
export function useAudioLevel(active: boolean, stream: MediaStream | null): number {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || !stream) {
      setLevel(0);
      return;
    }

    let cancelled = false;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (cancelled) return;
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) sum += data[i] ?? 0;
      const avg = sum / data.length / 255;
      setLevel(avg);
      rafRef.current = requestAnimationFrame(tick);
    };

    void ctx.resume().then(() => {
      if (!cancelled) rafRef.current = requestAnimationFrame(tick);
    });

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      source.disconnect();
      void ctx.close();
      setLevel(0);
    };
  }, [active, stream]);

  return level;
}

function VoiceOrbStyles() {
  return (
    <style>{`
      @keyframes voice-orb-float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-8px); }
      }
      @keyframes voice-orb-bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-14px); }
      }
      @keyframes voice-orb-spin {
        to { transform: rotate(360deg); }
      }
      @keyframes voice-orb-ring-pulse {
        0%, 100% { opacity: 0.45; transform: scale(1); }
        50% { opacity: 0.9; transform: scale(1.04); }
      }
      @keyframes voice-orb-ring-expand {
        0% { transform: scale(1); opacity: 0.55; }
        100% { transform: scale(1.35); opacity: 0; }
      }
      @keyframes voice-orb-gradient {
        0% { filter: hue-rotate(0deg); }
        100% { filter: hue-rotate(360deg); }
      }

      .voice-orb-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        width: 100%;
      }

      .voice-orb-rings {
        position: relative;
        width: min(220px, 58vw);
        height: min(220px, 58vw);
        animation: voice-orb-float 4.5s ease-in-out infinite;
      }

      .voice-orb-rings--bounce {
        animation: voice-orb-bounce 2.4s ease-in-out infinite;
      }

      .voice-orb-rings--compact {
        width: 100px;
        height: 100px;
        animation: none;
      }

      .voice-orb-rings--compact.voice-orb-rings--bounce {
        animation: voice-orb-bounce 2.4s ease-in-out infinite;
      }

      .voice-orb-wrap--composer {
        flex-shrink: 0;
      }

      .voice-orb-rings--composer {
        width: 44px;
        height: 44px;
        animation: none;
      }

      .voice-orb-wrap--composer .voice-orb-core {
        inset: 2px;
      }

      .voice-orb-wrap--composer .voice-orb-core__inner {
        margin-bottom: 0;
      }

      .voice-orb-wrap--composer .voice-orb-spinner {
        width: 18px;
        height: 18px;
      }

      .voice-orb-wrap--composer .voice-orb-check {
        font-size: 16px;
      }

      .voice-orb-wrap--composer .voice-orb-ring--1 {
        inset: -2px;
      }

      .voice-orb-wrap--float .voice-orb-core {
        inset: 6px;
      }

      .voice-orb-wrap--float .voice-orb-core__inner {
        margin-bottom: 0;
      }

      .voice-orb-wrap--float .voice-orb-spinner {
        width: 24px;
        height: 24px;
      }

      .voice-orb-wrap--float .voice-orb-check {
        font-size: 22px;
      }

      .voice-orb-ring {
        position: absolute;
        inset: 0;
        border-radius: 999px;
        pointer-events: none;
      }

      .voice-orb-ring--1 {
        inset: -6px;
        background: conic-gradient(
          from 180deg,
          #3DAA9C,
          #C4A86A,
          #1A3A2F,
          #5BC4B8,
          #E8D5A3,
          #3DAA9C
        );
        opacity: 0.55;
        animation: voice-orb-gradient 8s linear infinite;
        mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px));
        -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px));
      }

      .voice-orb-ring--2 {
        inset: -18px;
        border: 1px solid rgba(61, 170, 156, 0.25);
        animation: voice-orb-ring-pulse 3s ease-in-out infinite;
      }

      .voice-orb-ring--3 {
        inset: -32px;
        border: 1px solid rgba(196, 168, 106, 0.18);
        animation: voice-orb-ring-pulse 3s ease-in-out infinite 0.6s;
      }

      .voice-orb-rings--active .voice-orb-ring--1 {
        opacity: calc(0.5 + var(--orb-glow, 0.35));
        transform: scale(var(--orb-pulse, 1));
        transition: transform 0.08s ease-out, opacity 0.08s ease-out;
      }

      .voice-orb-rings--speaking .voice-orb-ring--1 {
        background: conic-gradient(from 180deg, #5BC4B8, #E8D5A3, #3DAA9C, #C4A86A, #5BC4B8);
        opacity: calc(0.55 + var(--orb-glow, 0.35));
        transform: scale(var(--orb-pulse, 1));
        animation: voice-orb-gradient 4s linear infinite;
      }

      .voice-orb-rings--speaking .voice-orb-ring--2,
      .voice-orb-rings--speaking .voice-orb-ring--3 {
        animation: voice-orb-ring-pulse 1.2s ease-in-out infinite;
      }

      .voice-orb-rings--active .voice-orb-ring--2,
      .voice-orb-rings--active .voice-orb-ring--3 {
        animation: voice-orb-ring-expand 1.8s ease-out infinite;
      }

      .voice-orb-rings--processing .voice-orb-ring--1 {
        animation: voice-orb-gradient 2s linear infinite;
        opacity: 0.75;
      }

      .voice-orb-rings--done .voice-orb-ring--1 {
        background: conic-gradient(from 180deg, #1A3A2F, #3DAA9C, #1A3A2F);
        opacity: 0.8;
      }

      .voice-orb-core {
        position: absolute;
        inset: 10px;
        border: none;
        border-radius: 999px;
        cursor: pointer;
        padding: 0;
        background:
          radial-gradient(circle at 35% 28%, rgba(93, 196, 184, 0.22), transparent 45%),
          radial-gradient(circle at 70% 75%, rgba(196, 168, 106, 0.12), transparent 40%),
          linear-gradient(160deg, #0f241c 0%, #1A3A2F 55%, #0a1812 100%);
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.08),
          0 12px 40px rgba(26, 58, 47, 0.35),
          0 0 0 1px rgba(255,255,255,0.06);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }

      .voice-orb-core:hover:not(:disabled) {
        transform: scale(1.02);
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.1),
          0 16px 48px rgba(26, 58, 47, 0.42),
          0 0 32px rgba(61, 170, 156, 0.25);
      }

      .voice-orb-core:disabled {
        cursor: default;
      }

      .voice-orb-core--active {
        box-shadow:
          inset 0 0 24px rgba(61, 170, 156, 0.12),
          0 0 0 2px rgba(61, 170, 156, 0.35),
          0 16px 48px rgba(26, 58, 47, 0.4),
          0 0 40px rgba(61, 170, 156, calc(var(--orb-glow, 0.35)));
      }

      .voice-orb-core--speaking {
        box-shadow:
          inset 0 0 28px rgba(232, 213, 163, 0.12),
          0 0 0 2px rgba(196, 168, 106, 0.4),
          0 16px 48px rgba(26, 58, 47, 0.4),
          0 0 48px rgba(91, 196, 184, calc(var(--orb-glow, 0.35)));
      }

      .voice-orb-core__inner {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 28px;
        color: #E8D5A3;
      }

      .voice-orb-core__label {
        position: absolute;
        bottom: 22%;
        left: 50%;
        transform: translateX(-50%);
        width: 78%;
        text-align: center;
        font-family: var(--font-ui);
        font-size: clamp(13px, 2.8vw, 15px);
        font-weight: 600;
        color: rgba(232, 213, 163, 0.92);
        line-height: 1.3;
        pointer-events: none;
      }

      .voice-orb-mic { display: flex; opacity: 0.95; }

      .voice-orb-star-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        color: #E8D5A3;
      }

      .voice-orb-wrap--float .voice-orb-star-wrap {
        color: #E8D5A3;
      }

      .voice-orb-wave {
        display: flex;
        align-items: flex-end;
        gap: 4px;
        height: 24px;
      }

      .voice-orb-wave span {
        display: block;
        width: 4px;
        height: 8px;
        background: #E8D5A3;
        border-radius: 2px;
        animation: voice-orb-wave 0.9s ease-in-out infinite;
      }

      .voice-orb-wave span:nth-child(2) { animation-delay: 0.15s; }
      .voice-orb-wave span:nth-child(3) { animation-delay: 0.3s; }

      @keyframes voice-orb-wave {
        0%, 100% { height: 8px; opacity: 0.5; }
        50% { height: 22px; opacity: 1; }
      }

      .voice-orb-check {
        font-size: 28px;
        color: #5BC4B8;
        font-weight: 700;
      }

      .voice-orb-spinner {
        width: 32px;
        height: 32px;
        border-radius: 999px;
        border: 2px solid rgba(232, 213, 163, 0.2);
        border-top-color: #5BC4B8;
        animation: voice-orb-spin 0.9s linear infinite;
      }

      .voice-orb-sublabel {
        margin: 0;
        max-width: 360px;
        text-align: center;
        font-family: var(--font-ui);
        font-size: 15px;
        line-height: 1.55;
        color: rgba(26, 58, 47, 0.72);
      }

      /* Float launcher — Bruddle purple accent (hero/composer keep forest/teal brand orb) */
      .voice-orb-wrap--float .voice-orb-ring--1 {
        background: conic-gradient(
          from 180deg,
          #AE7AFF,
          #C9A8FF,
          #8B5CF6,
          #D4BBFF,
          #9966F0,
          #AE7AFF
        );
        opacity: 0.6;
      }
      .voice-orb-wrap--float .voice-orb-ring--2 {
        border-color: rgba(174, 122, 255, 0.28);
      }
      .voice-orb-wrap--float .voice-orb-ring--3 {
        border-color: rgba(201, 168, 255, 0.22);
      }
      .voice-orb-wrap--float .voice-orb-core {
        background:
          radial-gradient(circle at 35% 28%, rgba(201, 168, 255, 0.35), transparent 45%),
          radial-gradient(circle at 70% 75%, rgba(212, 187, 255, 0.15), transparent 40%),
          linear-gradient(160deg, #5B21A8 0%, #AE7AFF 55%, #7C3AED 100%);
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.1),
          0 12px 40px rgba(174, 122, 255, 0.4),
          0 0 0 1px rgba(255,255,255,0.06);
      }
      .voice-orb-wrap--float .voice-orb-core:hover:not(:disabled) {
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.12),
          0 16px 48px rgba(174, 122, 255, 0.48),
          0 0 32px rgba(174, 122, 255, 0.35);
      }
      .voice-orb-wrap--float .voice-orb-core--active {
        box-shadow:
          inset 0 0 24px rgba(201, 168, 255, 0.2),
          0 0 0 2px rgba(174, 122, 255, 0.45),
          0 16px 48px rgba(174, 122, 255, 0.45),
          0 0 40px rgba(174, 122, 255, calc(var(--orb-glow, 0.35)));
      }
      .voice-orb-wrap--float .voice-orb-core--speaking {
        box-shadow:
          inset 0 0 28px rgba(212, 187, 255, 0.18),
          0 0 0 2px rgba(201, 168, 255, 0.5),
          0 16px 48px rgba(174, 122, 255, 0.45),
          0 0 48px rgba(174, 122, 255, calc(var(--orb-glow, 0.35)));
      }
      .voice-orb-wrap--float .voice-orb-rings--speaking .voice-orb-ring--1 {
        background: conic-gradient(from 180deg, #C9A8FF, #D4BBFF, #AE7AFF, #EDE9FE, #C9A8FF);
      }
      .voice-orb-wrap--float .voice-orb-rings--done .voice-orb-ring--1 {
        background: conic-gradient(from 180deg, #9966F0, #AE7AFF, #9966F0);
      }
      .voice-orb-wrap--float .voice-orb-star-wrap {
        color: #161616;
      }
      .voice-orb-wrap--float .voice-orb-check {
        color: #9966F0;
      }
      .voice-orb-wrap--float .voice-orb-spinner {
        border-top-color: #AE7AFF;
      }
    `}</style>
  );
}
