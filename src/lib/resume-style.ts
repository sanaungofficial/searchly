export type ResumeTemplate = "standard" | "compact" | "centered";
export type ResumeBulletStyle = "dot" | "dash";
export type ResumeHeaderAlign = "left" | "center" | "right";
export type ResumeDateFormat = "short" | "long";
export type ResumePageSize = "letter" | "a4";
export type ResumeSkillsLayout = "inline" | "columns" | "bullets";
export type ResumeEducationBy = "school" | "degree";

export interface ResumeStyleSettings {
  template: ResumeTemplate;
  pageSize: ResumePageSize;
  accentColor: string;
  accentTarget: "headings" | "all";
  fontFamily: string;
  fontSizeName: number;
  fontSizeSection: number;
  fontSizeSub: number;
  fontSizeBody: number;
  dateFormat: ResumeDateFormat;
  bulletStyle: ResumeBulletStyle;
  hideDivider: boolean;
  headerAlign: ResumeHeaderAlign;
  fitToOnePage: boolean;
  autoFitAfterCustom: boolean;
  sectionSpacing: number;
  entrySpacing: number;
  lineSpacing: number;
  marginH: number;
  marginV: number;
  alignText: boolean;
  skillsLayout: ResumeSkillsLayout;
  showEducationBy: ResumeEducationBy;
}

export const DEFAULT_RESUME_STYLE: ResumeStyleSettings = {
  template: "standard",
  pageSize: "letter",
  accentColor: "#000000",
  accentTarget: "headings",
  fontFamily: "Georgia, 'Times New Roman', Times, serif",
  fontSizeName: 22,
  fontSizeSection: 10,
  fontSizeSub: 10.5,
  fontSizeBody: 10,
  dateFormat: "short",
  bulletStyle: "dot",
  hideDivider: false,
  headerAlign: "center",
  fitToOnePage: false,
  autoFitAfterCustom: true,
  sectionSpacing: 50,
  entrySpacing: 50,
  lineSpacing: 50,
  marginH: 50,
  marginV: 50,
  alignText: false,
  skillsLayout: "inline",
  showEducationBy: "school",
};

export function normalizeResumeStyle(raw: unknown): ResumeStyleSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_RESUME_STYLE };
  const o = raw as Partial<ResumeStyleSettings>;
  const clamp = (n: unknown, fallback: number) =>
    typeof n === "number" && Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : fallback;
  return {
    template: o.template === "compact" || o.template === "centered" ? o.template : "standard",
    pageSize: o.pageSize === "a4" ? "a4" : "letter",
    accentColor: typeof o.accentColor === "string" && o.accentColor.trim() ? o.accentColor : DEFAULT_RESUME_STYLE.accentColor,
    accentTarget: o.accentTarget === "all" ? "all" : "headings",
    fontFamily: typeof o.fontFamily === "string" && o.fontFamily.trim() ? o.fontFamily : DEFAULT_RESUME_STYLE.fontFamily,
    fontSizeName: typeof o.fontSizeName === "number" ? o.fontSizeName : DEFAULT_RESUME_STYLE.fontSizeName,
    fontSizeSection: typeof o.fontSizeSection === "number" ? o.fontSizeSection : DEFAULT_RESUME_STYLE.fontSizeSection,
    fontSizeSub: typeof o.fontSizeSub === "number" ? o.fontSizeSub : DEFAULT_RESUME_STYLE.fontSizeSub,
    fontSizeBody: typeof o.fontSizeBody === "number" ? o.fontSizeBody : DEFAULT_RESUME_STYLE.fontSizeBody,
    dateFormat: o.dateFormat === "long" ? "long" : "short",
    bulletStyle: o.bulletStyle === "dash" ? "dash" : "dot",
    hideDivider: !!o.hideDivider,
    headerAlign: o.headerAlign === "left" || o.headerAlign === "right" ? o.headerAlign : "center",
    fitToOnePage: !!o.fitToOnePage,
    autoFitAfterCustom: o.autoFitAfterCustom !== false,
    sectionSpacing: clamp(o.sectionSpacing, DEFAULT_RESUME_STYLE.sectionSpacing),
    entrySpacing: clamp(o.entrySpacing, DEFAULT_RESUME_STYLE.entrySpacing),
    lineSpacing: clamp(o.lineSpacing, DEFAULT_RESUME_STYLE.lineSpacing),
    marginH: clamp(o.marginH, DEFAULT_RESUME_STYLE.marginH),
    marginV: clamp(o.marginV, DEFAULT_RESUME_STYLE.marginV),
    alignText: !!o.alignText,
    skillsLayout: o.skillsLayout === "columns" || o.skillsLayout === "bullets" ? o.skillsLayout : "inline",
    showEducationBy: o.showEducationBy === "degree" ? "degree" : "school",
  };
}

export function resumeStyleToCss(style: ResumeStyleSettings): Record<string, string | number> {
  const sectionGap = 8 + (style.sectionSpacing / 100) * 16;
  const entryGap = 4 + (style.entrySpacing / 100) * 12;
  const lineHeight = 1.35 + (style.lineSpacing / 100) * 0.35;
  const padH = 36 + (style.marginH / 100) * 24;
  const padV = 36 + (style.marginV / 100) * 24;
  return {
    fontFamily: style.fontFamily,
    fontSize: style.fontSizeBody,
    lineHeight,
    ["--resume-accent" as string]: style.accentColor,
    ["--resume-name-size" as string]: `${style.fontSizeName}px`,
    ["--resume-section-size" as string]: `${style.fontSizeSection}px`,
    ["--resume-sub-size" as string]: `${style.fontSizeSub}px`,
    ["--resume-body-size" as string]: `${style.fontSizeBody}px`,
    ["--resume-section-gap" as string]: `${sectionGap}px`,
    ["--resume-entry-gap" as string]: `${entryGap}px`,
    ["--resume-pad-h" as string]: `${padH}px`,
    ["--resume-pad-v" as string]: `${padV}px`,
  };
}
