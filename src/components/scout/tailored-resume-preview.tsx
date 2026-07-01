"use client";

import {
  DEFAULT_RESUME_STYLE,
  normalizeResumeStyle,
  resumeStyleToCss,
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
  company: string;
  title: string;
  dates: string;
  location: string;
  bullets: string[];
  intro: string;
} {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) {
    return { company: "", title: "", dates: "", location: "", bullets: [], intro: "" };
  }

  let company = "";
  let title = "";
  let dates = "";
  let location = "";
  const bullets: string[] = [];
  const introParts: string[] = [];
  let phase: "header" | "body" = "header";

  for (const line of lines) {
    if (/^[-•*–]\s/.test(line)) {
      phase = "body";
      bullets.push(line.replace(/^[-•*–]\s+/, ""));
      continue;
    }

    if (phase === "body") {
      if (bullets.length) bullets.push(line);
      else introParts.push(line);
      continue;
    }

    const pipeParts = line.split("|").map((p) => p.trim());
    if (pipeParts.length >= 2 && /\d{4}/.test(line)) {
      company = pipeParts[0] ?? "";
      dates = pipeParts.slice(1).join(" | ");
      continue;
    }

    const dateMatch = line.match(/^(.+?)\s+(\d{4}\s*[–—-]\s*(?:Present|\d{4}))\s*$/i);
    if (dateMatch) {
      if (!company) company = dateMatch[1]!.trim();
      else title = dateMatch[1]!.trim();
      dates = dateMatch[2]!;
      continue;
    }

    const locDateMatch = line.match(/^(.+?)\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\s*[–—-]\s*(?:Present|\d{4}))\s*$/i);
    if (locDateMatch) {
      company = locDateMatch[1]!.trim();
      dates = locDateMatch[2]!;
      continue;
    }

    if (!company && line.length < 60) {
      company = line;
      continue;
    }

    if (!title && company) {
      title = line;
      continue;
    }

    if (/^[A-Za-z\s,]+$/.test(line) && line.length < 40 && !location && !/\d/.test(line)) {
      location = line;
      continue;
    }

    phase = "body";
    introParts.push(line);
  }

  return { company, title, dates, location, bullets, intro: introParts.join(" ") };
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
  const isCompact = compact || style.fitToOnePage || style.template === "compact";
  const css = resumeStyleToCss(style);
  const bulletPrefix = style.bulletStyle === "dash" ? "– " : "• ";
  const fontFamily =
    style.template === "standard" && style.fontFamily.includes("Carlito")
      ? RT.resumeSerif
      : style.fontFamily;
  const personalInfo = sections.find((s) => s.type === "header");
  const contentSections = sections.filter((s) => s.type !== "header" && s.type !== "meta");
  const headerAlign = style.template === "centered" ? "center" : style.headerAlign;
  const sectionGap = css["--resume-section-gap"] as string;
  const entryGap = css["--resume-entry-gap"] as string;
  const padH = css["--resume-pad-h"] as string;
  const padV = css["--resume-pad-v"] as string;

  const inner = (
    <>
      {personalInfo ? (
        <div
          style={{
            textAlign: headerAlign,
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
                fontSize: i === 0 ? (isCompact ? style.fontSizeName - 3 : style.fontSizeName) : style.fontSizeBody,
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
        <div key={section.id} style={{ marginBottom: sectionGap }}>
          <p style={sectionTitleStyle(style, isCompact)}>{section.title.toUpperCase()}</p>

          {isSkillsEmphasisSection(section) ? (
            <div>
              {parseSkillsSectionContent(section.content).map((group) => (
                <div key={group.id} style={{ marginBottom: entryGap }}>
                  {style.skillsLayout === "bullets" ? (
                    <ul style={{ margin: 0, paddingLeft: 16, listStyle: "none" }}>
                      <li style={{ fontSize: style.fontSizeBody, lineHeight: css.lineHeight as number }}>
                        {group.label && group.label !== "Skills" && (
                          <strong>{renderTextWithKeywords(group.label, highlightKeywords, `${group.id}lbl-`)}: </strong>
                        )}
                        {group.skills.map((skill, si) => (
                          <span key={si}>
                            {si > 0 && ", "}
                            {renderTextWithKeywords(skill, highlightKeywords, `${group.id}s${si}-`)}
                          </span>
                        ))}
                      </li>
                    </ul>
                  ) : (
                    <>
                      {group.label && group.label !== "Skills" && (
                        <p style={{ margin: "0 0 4px", fontSize: style.fontSizeSub, fontWeight: 700, color: "#1A1A1A" }}>
                          {renderTextWithKeywords(group.label, highlightKeywords, `${group.id}lbl-`)}:
                        </p>
                      )}
                      <p style={{ margin: 0, fontSize: style.fontSizeBody, lineHeight: css.lineHeight as number, textAlign: style.alignText ? "justify" : "left" }}>
                        {group.skills.map((skill, si) => (
                          <span key={si}>
                            {si > 0 && (style.skillsLayout === "columns" ? " · " : ", ")}
                            {renderTextWithKeywords(skill, highlightKeywords, `${group.id}s${si}-`)}
                          </span>
                        ))}
                      </p>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : section.type === "bullets" ? (
            <div>
              {section.content
                .split(/\n(?=[A-Z])/)
                .filter(Boolean)
                .map((block, bi) => {
                  const entry = parseExperienceEntry(block);
                  const hasStructure = entry.company || entry.title || entry.bullets.length > 0;

                  if (hasStructure && (entry.company || entry.title)) {
                    return (
                      <div key={bi} style={{ marginBottom: entryGap }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                          <span style={{ fontSize: style.fontSizeSub, fontWeight: 700, fontStyle: "italic", color: "#1A1A1A" }}>
                            {renderTextWithKeywords(entry.company || entry.title, highlightKeywords, `${section.id}c${bi}-`)}
                          </span>
                          {entry.dates && (
                            <span style={{ fontSize: style.fontSizeBody - 0.5, color: "#444444", flexShrink: 0, textAlign: "right" }}>
                              {entry.dates}
                            </span>
                          )}
                        </div>
                        {entry.location && (
                          <p style={{ margin: "0 0 2px", fontSize: style.fontSizeBody - 0.5, color: "#444444", textAlign: "right" }}>
                            {entry.location}
                          </p>
                        )}
                        {entry.title && entry.company && (
                          <p style={{ margin: "2px 0 4px", fontSize: style.fontSizeBody, fontStyle: "italic", color: "#333333" }}>
                            {renderTextWithKeywords(entry.title, highlightKeywords, `${section.id}t${bi}-`)}
                          </p>
                        )}
                        {entry.intro && (
                          <p style={{ margin: "0 0 4px", fontSize: style.fontSizeBody, lineHeight: css.lineHeight as number, textAlign: style.alignText ? "justify" : "left" }}>
                            {renderTextWithKeywords(entry.intro, highlightKeywords, `${section.id}i${bi}-`)}
                          </p>
                        )}
                        {entry.bullets.length > 0 && (
                          <ul style={{ margin: 0, paddingLeft: 16, listStyle: "none" }}>
                            {entry.bullets.map((b, i) => (
                              <li key={i} style={{ marginBottom: 3, fontSize: style.fontSizeBody, lineHeight: css.lineHeight as number, textAlign: style.alignText ? "justify" : "left" }}>
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
                      {block.split("\n").filter(Boolean).map((b, i) => (
                        <li key={i} style={{ marginBottom: 3, fontSize: style.fontSizeBody, lineHeight: css.lineHeight as number }}>
                          {/^[-•*–]/.test(b) ? bulletPrefix : ""}
                          {renderTextWithKeywords(b.replace(/^[-•*–]\s*/, ""), highlightKeywords, `${section.id}b${bi}${i}-`)}
                        </li>
                      ))}
                    </ul>
                  );
                })}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: style.fontSizeBody, lineHeight: css.lineHeight as number, whiteSpace: "pre-wrap", textAlign: style.alignText ? "justify" : "left" }}>
              {renderTextWithKeywords(section.content, highlightKeywords, `${section.id}t-`)}
            </p>
          )}
        </div>
      ))}
    </>
  );

  if (!paper) {
    return (
      <div style={{ fontFamily, fontSize: style.fontSizeBody, color: "#1A1A1A", ...css }}>
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
        padding: isCompact ? `calc(${padV} * 0.75) calc(${padH} * 0.85)` : `${padV} ${padH}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)",
        borderRadius: 2,
        fontFamily,
        fontSize: isCompact ? style.fontSizeBody - 0.5 : style.fontSizeBody,
        lineHeight: css.lineHeight as number,
        color: "#1A1A1A",
      }}
    >
      {inner}
    </div>
  );
}
