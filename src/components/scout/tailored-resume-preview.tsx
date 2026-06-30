"use client";

import {
  DEFAULT_RESUME_STYLE,
  normalizeResumeStyle,
  type ResumeStyleSettings,
} from "@/lib/resume-style";
import { renderTextWithKeywords } from "@/lib/resume-highlight";
import type { TailoredResumeSection } from "@/lib/tailored-resume-sections";

export function TailoredResumePreview({
  sections,
  highlightKeywords = [],
  resumeStyle: styleProp,
  compact = false,
  paper = true,
}: {
  sections: TailoredResumeSection[];
  highlightKeywords?: string[];
  resumeStyle?: ResumeStyleSettings | null;
  compact?: boolean;
  paper?: boolean;
}) {
  const style = normalizeResumeStyle(styleProp ?? DEFAULT_RESUME_STYLE);
  const bulletPrefix = style.bulletStyle === "dash" ? "– " : "• ";
  const personalInfo = sections.find((s) => s.type === "header");
  const contentSections = sections.filter((s) => s.type !== "header" && s.type !== "meta");

  const inner = (
    <>
      {personalInfo ? (
        <div
          style={{
            textAlign: style.headerAlign === "left" ? "left" : "center",
            marginBottom: compact ? 16 : 22,
            paddingBottom: compact ? 14 : 18,
            borderBottom: style.hideDivider ? "none" : "1.5px solid #1A1A1A",
          }}
        >
          {personalInfo.content.split("\n").map((line, i) => (
            <p
              key={i}
              style={{
                margin: 0,
                fontSize:
                  i === 0
                    ? compact
                      ? style.fontSizeName - 4
                      : style.fontSizeName
                    : style.fontSizeBody - 0.5,
                fontWeight: i === 0 ? 700 : 400,
                letterSpacing: i === 0 ? 1.5 : 0,
                color: "#1A1A1A",
                lineHeight: i === 0 ? 1.2 : 1.75,
              }}
            >
              {renderTextWithKeywords(line, highlightKeywords, `h${i}-`)}
            </p>
          ))}
        </div>
      ) : null}

      {contentSections.map((section) => (
        <div key={section.id} style={{ marginBottom: compact ? 14 : 18 }}>
          <p
            style={{
              fontSize: style.fontSizeSection,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1,
              color:
                style.accentTarget === "headings" || style.accentTarget === "all"
                  ? style.accentColor
                  : "#1A1A1A",
              marginBottom: 6,
              borderBottom: style.hideDivider ? "none" : "1px solid #1A1A1A",
              paddingBottom: 3,
            }}
          >
            {section.title}
          </p>
          {section.type === "bullets" ? (
            <ul style={{ margin: 0, paddingLeft: 16, listStyle: "none" }}>
              {section.content
                .split("\n")
                .filter(Boolean)
                .map((b, i) => (
                  <li
                    key={i}
                    style={{
                      marginBottom: 4,
                      fontSize: style.fontSizeBody,
                      lineHeight: 1.55,
                    }}
                  >
                    {bulletPrefix}
                    {renderTextWithKeywords(
                      b.replace(/^[-•–]\s*/, ""),
                      highlightKeywords,
                      `${section.id}b${i}-`,
                    )}
                  </li>
                ))}
            </ul>
          ) : (
            <p
              style={{
                margin: 0,
                fontSize: style.fontSizeBody,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              {renderTextWithKeywords(section.content, highlightKeywords, `${section.id}t-`)}
            </p>
          )}
        </div>
      ))}
    </>
  );

  if (!paper) {
    return (
      <div
        style={{
          fontFamily: style.fontFamily,
          fontSize: style.fontSizeBody,
          color: "#1A1A1A",
        }}
      >
        {inner}
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#FFFFFF",
        width: "100%",
        padding: compact ? "32px 36px" : "44px 48px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.08)",
        borderRadius: "var(--scout-radius)",
        fontFamily: style.fontFamily,
        fontSize: compact ? style.fontSizeBody - 0.5 : style.fontSizeBody,
        lineHeight: compact ? 1.45 : 1.55,
        color: "#1A1A1A",
      }}
    >
      {inner}
    </div>
  );
}
