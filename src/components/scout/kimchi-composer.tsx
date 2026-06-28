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

export function KimchiVoiceComposerFooter({ voice }: { voice: KimchiVoiceProps }) {
  if (voice.orbState !== "done" && !voice.error) return null;

  return (
    <>
      {voice.orbState === "done" && voice.onTalkAgain && (
        <button type="button" className="kimchi-voice-footer__again" onClick={voice.onTalkAgain}>
          Talk again
        </button>
      )}
      {voice.error && voice.orbState !== "done" && (
        <p className="kimchi-voice-footer__error">{voice.error}</p>
      )}
      <KimchiComposerStyles />
    </>
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
      .kimchi-voice-footer__again {
        display: block;
        width: 100%;
        margin: 0 0 8px;
        background: none;
        border: none;
        padding: 0;
        font-family: ${sans};
        font-size: 12px;
        color: rgba(26, 58, 47, 0.65);
        cursor: pointer;
        text-align: left;
        text-decoration: underline;
      }

      .kimchi-voice-footer__error {
        margin: 0 0 8px;
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
        background: var(--scout-cta);
        color: var(--scout-cta-foreground);
        font-size: 16px;
        cursor: pointer;
      }

      .kimchi-composer-row__send:disabled {
        background: var(--scout-cta-subtle);
        color: rgba(124, 58, 237, 0.35);
        cursor: default;
      }
    `}</style>
  );
}
