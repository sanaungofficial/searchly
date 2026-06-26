"use client";

import { VoiceOrb, type VoiceOrbState } from "@/components/voice/voice-orb";
import { fontSans } from "@/lib/typography";
import type { VoiceTranscriptLine } from "@/hooks/use-voice-agent-session";

const sans = fontSans;

export type KimchiVoiceProps = {
  orbState: VoiceOrbState;
  audioLevel: number;
  onOrbClick: () => void;
  disabled?: boolean;
  transcriptLines?: VoiceTranscriptLine[];
  error?: string | null;
  onTalkAgain?: () => void;
};

export function KimchiVoiceStrip({ voice }: { voice: KimchiVoiceProps }) {
  const lines = voice.transcriptLines ?? [];
  const active =
    voice.orbState === "live" ||
    voice.orbState === "listening" ||
    voice.orbState === "speaking" ||
    voice.orbState === "thinking" ||
    voice.orbState === "connecting";

  if (!active && lines.length === 0 && !voice.error && voice.orbState !== "done") {
    return null;
  }

  return (
    <div className="kimchi-voice-strip">
      {lines.slice(-6).map((line, index) => (
        <div
          key={`${line.role}-${index}-${line.content.slice(0, 16)}`}
          className={line.role === "Kimchi" ? "kimchi-voice-strip__line kimchi-voice-strip__line--agent" : "kimchi-voice-strip__line"}
        >
          <span className="kimchi-voice-strip__label">{line.role}</span>
          <p>{line.content}</p>
        </div>
      ))}
      {voice.orbState === "done" && voice.onTalkAgain && (
        <button type="button" className="kimchi-voice-strip__again" onClick={voice.onTalkAgain}>
          Talk again
        </button>
      )}
      {voice.error && voice.orbState !== "done" && (
        <p className="kimchi-voice-strip__error">{voice.error}</p>
      )}
      <KimchiComposerStyles />
    </div>
  );
}

export function KimchiComposerRow({
  voice,
  value,
  onChange,
  onSend,
  placeholder,
  disabled,
  inputRef,
  onKeyDown,
}: {
  voice?: KimchiVoiceProps;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder: string;
  disabled?: boolean;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
}) {
  const canSend = value.trim().length > 0 && !disabled;

  return (
    <>
      <div className="kimchi-composer-row">
        {voice && (
          <VoiceOrb
            variant="composer"
            state={voice.orbState}
            audioLevel={voice.audioLevel}
            onClick={voice.onOrbClick}
            disabled={voice.disabled}
            bounce={voice.orbState === "idle" || voice.orbState === "error"}
          />
        )}
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            onKeyDown?.(e);
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          className="kimchi-composer-row__input"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          className="kimchi-composer-row__send"
          aria-label="Send message"
        >
          ↑
        </button>
      </div>
      <KimchiComposerStyles />
    </>
  );
}

function KimchiComposerStyles() {
  return (
    <style>{`
      .kimchi-voice-strip {
        flex-shrink: 0;
        max-height: 140px;
        overflow-y: auto;
        padding: 10px 14px;
        background: rgba(238, 245, 242, 0.95);
        border-bottom: 1px solid rgba(26, 58, 47, 0.08);
      }

      .kimchi-voice-strip__line {
        margin-bottom: 8px;
      }

      .kimchi-voice-strip__line:last-child {
        margin-bottom: 0;
      }

      .kimchi-voice-strip__label {
        display: block;
        font-family: ${sans};
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(26, 58, 47, 0.5);
        margin-bottom: 2px;
      }

      .kimchi-voice-strip__line--agent .kimchi-voice-strip__label {
        color: rgba(61, 170, 156, 0.85);
      }

      .kimchi-voice-strip__line p {
        margin: 0;
        font-family: ${sans};
        font-size: 13px;
        line-height: 1.45;
        color: #1A3A2F;
      }

      .kimchi-voice-strip__again {
        margin-top: 8px;
        background: none;
        border: none;
        padding: 0;
        font-family: ${sans};
        font-size: 12px;
        color: rgba(26, 58, 47, 0.65);
        cursor: pointer;
        text-decoration: underline;
      }

      .kimchi-voice-strip__error {
        margin: 8px 0 0;
        font-family: ${sans};
        font-size: 12px;
        color: #9B3A2A;
      }

      .kimchi-composer-row {
        display: flex;
        align-items: flex-end;
        gap: 8px;
      }

      .kimchi-composer-row__input {
        flex: 1;
        min-height: 40px;
        max-height: 120px;
        resize: none;
        border: 1px solid rgba(26, 58, 47, 0.14);
        border-radius: var(--scout-radius);
        padding: 10px 12px;
        font-family: ${sans};
        font-size: 14px;
        line-height: 1.45;
        outline: none;
        background: #fff;
      }

      .kimchi-composer-row__input:focus {
        border-color: rgba(26, 58, 47, 0.28);
      }

      .kimchi-composer-row__send {
        width: 40px;
        height: 40px;
        flex-shrink: 0;
        border: none;
        border-radius: var(--scout-radius);
        background: #1A3A2F;
        color: #E8D5A3;
        font-size: 16px;
        cursor: pointer;
      }

      .kimchi-composer-row__send:disabled {
        background: rgba(26, 58, 47, 0.08);
        color: rgba(26, 58, 47, 0.35);
        cursor: default;
      }
    `}</style>
  );
}
