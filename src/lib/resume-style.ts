export type ResumeTemplate = "standard" | "compact" | "centered";
export type ResumeBulletStyle = "dot" | "dash";
export type ResumeHeaderAlign = "left" | "center";
export type ResumeDateFormat = "short" | "long";

export interface ResumeStyleSettings {
  template: ResumeTemplate;
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
}

export const DEFAULT_RESUME_STYLE: ResumeStyleSettings = {
  template: "standard",
  accentColor: "#000000",
  accentTarget: "headings",
  fontFamily: "Carlito, Calibri, sans-serif",
  fontSizeName: 22,
  fontSizeSection: 10,
  fontSizeSub: 10.5,
  fontSizeBody: 10,
  dateFormat: "short",
  bulletStyle: "dot",
  hideDivider: false,
  headerAlign: "center",
  fitToOnePage: false,
};

export function normalizeResumeStyle(raw: unknown): ResumeStyleSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_RESUME_STYLE };
  const o = raw as Partial<ResumeStyleSettings>;
  return {
    template: o.template === "compact" || o.template === "centered" ? o.template : "standard",
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
    headerAlign: o.headerAlign === "left" ? "left" : "center",
    fitToOnePage: !!o.fitToOnePage,
  };
}

export function resumeStyleToCss(style: ResumeStyleSettings): Record<string, string | number> {
  return {
    fontFamily: style.fontFamily,
    fontSize: style.fontSizeBody,
    ["--resume-accent" as string]: style.accentColor,
    ["--resume-name-size" as string]: `${style.fontSizeName}px`,
    ["--resume-section-size" as string]: `${style.fontSizeSection}px`,
    ["--resume-sub-size" as string]: `${style.fontSizeSub}px`,
    ["--resume-body-size" as string]: `${style.fontSizeBody}px`,
  };
}
