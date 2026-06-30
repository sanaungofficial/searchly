"use client";

import {
  DEFAULT_RESUME_STYLE,
  normalizeResumeStyle,
  type ResumeStyleSettings,
} from "@/lib/resume-style";
import { renderTextWithKeywords } from "@/lib/resume-highlight";
import { RT } from "@/lib/resume-tailor-tokens";
import {
  isSkillsEmphasisSection,
  parseSkillsSectionContent,
  type TailoredResumeSection,
} from "@/lib/tailored-resume-sections";

function sectionTitleStyle(style: ResumeStyleSettings, compact: boolean): React.CSSProperties {
  const accentOnHeadings = style.accentTarget === "headings" || style.accentTarget === "all";
  return {
    fontSize: style.fontSizeSection,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: accentOnHeadings ? style.accentColor : "#1A1A1A",
    margin: 0,
    marginBottom: compact ? 5 : 7,
    borderBottom: style.hideDivider ? "none" : "1px solid #1A1A1A",
    paddingBottom: style.hideDivider ? 0 : 4,
  };
}

function parseExperienceEntry(block: string): {
  title: string;
  company: string;
  dates: string;
  bullets: string[];
} {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { title: "", company: "", dates: "", bullets: [] };

  const first = lines[0];
  const pipeParts = first.split("|").map((p) => p.trim());
  if (pipeParts.length >= 2) {
    return {
      title: pipeParts[0] ?? "",
      company: pipeParts[1] ?? "",
      dates: pipeParts[2] ?? "",
      bullets: lines.slice(1).map((l) => l.replace(/^[-•*–]\s*/, "")),
    };
  }

  const dateMatch = first.match(/^(.+?)\s+(\d{4}\s*[–—-]\s*(?:Present|\d{4}))\s*$/);
  if (dateMatch) {
    return {
      title: dateMatch[1].trim(),
      company: lines[1]?.replace(/^[-•*–]\s*/, "") ?? "",
      dates: dateMatch[2],
      bullets: lines.slice(lines[1] ? 2 : 1).map((l) => l.replace(/^[-•*–]\s*/, "")),
    };
  }

  const hasCompanyLine = lines.length > 1 && !/^[-•*]/.test(lines[1]);
  return {
    title: first,
    company: hasCompanyLine ? lines[1] : "",
    dates: "",
    bullets: lines.slice(hasCompanyLine ? 2 : 1).map((l) => l.replace(/^[-•*–]\s*/, "")),
  };
}

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
  const isCompact = compact || style.fitToOnePage;
  const bulletPrefix = style.bulletStyle === "dash" ? "– " : "• ";
  const fontFamily = style.fontFamily.includes("Carlito") || style.fontFamily.includes("Calibri")
    ? RT.resumeSerif
    : style.fontFamily;
  const personalInfo = sections.find((s) => s.type === "header");
  const contentSections = sections.filter((s) => s.type !== "header" && s.type !== "meta");

  const inner = (
    <>
      {personalInfo ? (
        <div
          style={{
            textAlign: style.headerAlign === "left" ? "left" : "center",
            marginBottom: isCompact ? 14 : 20,
            paddingBottom: isCompact ? 12 : 16,
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
                    ? isCompact
                      ? style.fontSizeName - 3
                      : style.fontSizeName
                    : style.fontSizeBody,
                fontWeight: i === 0 ? 700 : 400,
                letterSpacing: i === 0 ? 1.8 : 0.2,
                color: "#1A1A1A",
                lineHeight: i === 0 ? 1.15 : 1.65,
              }}
            >
              {renderTextWithKeywords(line, highlightKeywords, `h${i}-`)}
            </p>
          ))}
        </div>
      ) : null}

      {contentSections.map((section) => (
        <div key={section.id} style={{ marginBottom: isCompact ? 12 : 16 }}>
          <p style={sectionTitleStyle(style, isCompact)}>{section.title.toUpperCase()}</p>

          {isSkillsEmphasisSection(section) ? (
            <div>
              {parseSkillsSectionContent(section.content).map((group) => (
                <div key={group.id} style={{ marginBottom: isCompact ? 8 : 10 }}>
                  {group.label && group.label !== "Skills" && (
                    <p
                      style={{
                        margin: "0 0 4px",
                        fontSize: style.fontSizeSub,
                        fontWeight: 600,
                        color: "#1A1A1A",
                      }}
                    >
                      {renderTextWithKeywords(group.label, highlightKeywords, `${group.id}lbl-`)}
                    </p>
                  )}
                  <p
                    style={{
                      margin: 0,
                      fontSize: style.fontSizeBody,
                      lineHeight: 1.55,
                    }}
                  >
                    {group.skills.map((skill, si) => (
                      <span key={si}>
                        {si > 0 && " · "}
                        {renderTextWithKeywords(skill, highlightKeywords, `${group.id}s${si}-`)}
                      </span>
                    ))}
                  </p>
                </div>
              ))}
            </div>
          ) : section.type === "bullets" ? (
            <div>
              {section.content
                .split(/\n(?=\S)/)
                .filter(Boolean)
                .map((block, bi) => {
                  const entry = parseExperienceEntry(block);
                  const hasStructure = entry.title && (entry.company || entry.bullets.length > 1);
                  if (hasStructure) {
                    return (
                      <div key={bi} style={{ marginBottom: isCompact ? 10 : 14 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "baseline",
                            gap: 8,
                            marginBottom: 2,
                          }}
                        >
                          <span
                            style={{
                              fontSize: style.fontSizeSub,
                              fontWeight: 700,
                              color: "#1A1A1A",
                            }}
                          >
                            {renderTextWithKeywords(entry.title, highlightKeywords, `${section.id}t${bi}-`)}
                          </span>
                          {entry.dates && (
                            <span
                              style={{
                                fontSize: style.fontSizeBody - 0.5,
                                color: "#444444",
                                flexShrink: 0,
                              }}
                            >
                              {entry.dates}
                            </span>
                          )}
                        </div>
                        {entry.company && (
                          <p
                            style={{
                              margin: "0 0 4px",
                              fontSize: style.fontSizeBody,
                              fontStyle: "italic",
                              color: "#333333",
                            }}
                          >
                            {renderTextWithKeywords(entry.company, highlightKeywords, `${section.id}c${bi}-`)}
                          </p>
                        )}
                        {entry.bullets.length > 0 && (
                          <ul style={{ margin: 0, paddingLeft: 16, listStyle: "none" }}>
                            {entry.bullets.map((b, i) => (
                              <li
                                key={i}
                                style={{
                                  marginBottom: 3,
                                  fontSize: style.fontSizeBody,
                                  lineHeight: 1.55,
                                }}
                              >
                                {bulletPrefix}
                                {renderTextWithKeywords(b, highlightKeywords, `${section.id}b${bi}${i}-`)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  }
                  return (
                    <ul key={bi} style={{ margin: "0 0 8px", paddingLeft: 16, listStyle: "none" }}>
                      {block
                        .split("\n")
                        .filter(Boolean)
                        .map((b, i) => (
                          <li
                            key={i}
                            style={{
                              marginBottom: 3,
                              fontSize: style.fontSizeBody,
                              lineHeight: 1.55,
                            }}
                          >
                            {bulletPrefix}
                            {renderTextWithKeywords(
                              b.replace(/^[-•*–]\s*/, ""),
                              highlightKeywords,
                              `${section.id}b${bi}${i}-`,
                            )}
                          </li>
                        ))}
                    </ul>
                  );
                })}
            </div>
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
          fontFamily,
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
        minHeight: 200,
        padding: isCompact ? "36px 44px" : "48px 52px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)",
        borderRadius: 2,
        fontFamily,
        fontSize: isCompact ? style.fontSizeBody - 0.5 : style.fontSizeBody,
        lineHeight: isCompact ? 1.42 : 1.52,
        color: "#1A1A1A",
      }}
    >
      {inner}
    </div>
  );
}
