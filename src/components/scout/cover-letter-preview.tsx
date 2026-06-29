"use client";

import { parseCoverLetter } from "@/lib/cover-letter-format";
import { fontSans } from "@/lib/typography";

type Props = {
  letter: string;
  senderName?: string;
  senderEmail?: string;
  streaming?: boolean;
};

export function CoverLetterPreview({ letter, senderName, senderEmail, streaming }: Props) {
  const sections = parseCoverLetter(letter);

  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: "var(--scout-radius)",
        boxShadow: "0 2px 16px rgba(0,0,0,0.08)",
        padding: "48px 52px",
        minHeight: "100%",
        fontFamily: "Georgia, 'Times New Roman', serif",
        color: "#1A1A1A",
      }}
    >
      {(senderName || senderEmail) && (
        <div style={{ marginBottom: 32, textAlign: "right" }}>
          {senderName && (
            <div
              style={{
                fontFamily: fontSans,
                fontSize: 15,
                fontWeight: 700,
                color: "#1A1A1A",
                letterSpacing: "-0.01em",
              }}
            >
              {senderName}
            </div>
          )}
          {senderEmail && (
            <div style={{ fontFamily: fontSans, fontSize: 14, color: "#6B7280", marginTop: 3 }}>
              {senderEmail}
            </div>
          )}
        </div>
      )}

      {sections.date && (
        <div style={{ fontSize: 13.5, lineHeight: 1.6, marginBottom: 28 }}>{sections.date}</div>
      )}

      {sections.recipientLines.length > 0 && (
        <div style={{ fontSize: 13.5, lineHeight: 1.6, marginBottom: 22 }}>
          {sections.recipientLines.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      {sections.salutation && (
        <p style={{ fontSize: 13.5, lineHeight: 1.75, margin: "0 0 18px" }}>{sections.salutation}</p>
      )}

      {sections.bodyParagraphs.map((para, i) => (
        <p
          key={i}
          style={{
            fontSize: 13.5,
            lineHeight: 1.75,
            margin: "0 0 18px",
          }}
        >
          {para}
          {streaming && i === sections.bodyParagraphs.length - 1 && (
            <span
              style={{
                display: "inline-block",
                width: 2,
                height: "1em",
                background: "#1C3A2F",
                marginLeft: 2,
                verticalAlign: "text-bottom",
                animation: "coverLetterBlink 1s step-end infinite",
              }}
            />
          )}
        </p>
      ))}

      {sections.closing && (
        <p style={{ fontSize: 13.5, lineHeight: 1.75, margin: "24px 0 8px" }}>{sections.closing}</p>
      )}

      {sections.signature && (
        <p style={{ fontSize: 13.5, lineHeight: 1.75, margin: 0 }}>{sections.signature}</p>
      )}

      {streaming &&
        sections.bodyParagraphs.length === 0 &&
        !sections.salutation &&
        letter.trim() && (
          <p style={{ fontSize: 13.5, lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" }}>
            {letter.trim()}
            <span
              style={{
                display: "inline-block",
                width: 2,
                height: "1em",
                background: "#1C3A2F",
                marginLeft: 2,
                verticalAlign: "text-bottom",
                animation: "coverLetterBlink 1s step-end infinite",
              }}
            />
          </p>
        )}

      <style>{`@keyframes coverLetterBlink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
    </div>
  );
}
