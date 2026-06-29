/** Types exposed in the client import UI — only these three. */
export type VisibleImportType = "job_tracker" | "target_companies" | "application_info";

/** All import types supported by the parse API (legacy / admin). */
export type ImportType =
  | VisibleImportType
  | "client_packet"
  | "contacts"
  | "interview_tracker"
  | "job_titles"
  | "keywords"
  | "passwords";

export type ImportTypeConfig = {
  id: ImportType;
  label: string;
  description: string;
  accept: string;
  pastePlaceholder: string;
  supportsFile: boolean;
  supportsPaste: boolean;
  usesAi: boolean;
};

/** Three-option picker shown in UnifiedImportModal step 0. */
export const VISIBLE_IMPORT_TYPE_CONFIGS: ImportTypeConfig[] = [
  {
    id: "job_tracker",
    label: "Jobs list",
    description: "Pipeline jobs from a spreadsheet export — map columns and status values before import.",
    accept: ".xlsx,.xls,.csv,.txt",
    pastePlaceholder: "Paste rows copied from Excel — include a header row with Company and Job Title columns.",
    supportsFile: true,
    supportsPaste: true,
    usesAi: false,
  },
  {
    id: "target_companies",
    label: "Companies list",
    description: "Target companies to watch or prioritize — map columns and fold descriptive fields into notes.",
    accept: ".xlsx,.xls,.csv,.txt",
    pastePlaceholder: "One company per line, or paste from Target Companies tab.",
    supportsFile: true,
    supportsPaste: true,
    usesAi: false,
  },
  {
    id: "application_info",
    label: "Onboarding questionnaire",
    description: "Parse questionnaire responses into profile fields and preferences.",
    accept: ".pdf,.doc,.docx,.txt",
    pastePlaceholder: "Paste questionnaire responses or intake notes…",
    supportsFile: true,
    supportsPaste: true,
    usesAi: true,
  },
];

export const IMPORT_TYPE_CONFIGS: ImportTypeConfig[] = [
  ...VISIBLE_IMPORT_TYPE_CONFIGS,
  {
    id: "client_packet",
    label: "Full client packet (.xlsx)",
    description:
      "Complete Google Sheet export — jobs, contacts, target companies, roles, keywords, and login credentials (if present). Review all tabs before apply.",
    accept: ".xlsx,.xls,.csv,.docx,.doc,.pdf,.txt",
    pastePlaceholder: "For full packet import, upload the .xlsx export. Paste is for single-type imports below.",
    supportsFile: true,
    supportsPaste: false,
    usesAi: false,
  },
  {
    id: "contacts",
    label: "Contacts",
    description: "Contact list with email addresses.",
    accept: ".xlsx,.xls,.csv,.txt",
    pastePlaceholder: "Paste contact rows — include Email column (Name, Company optional).",
    supportsFile: true,
    supportsPaste: true,
    usesAi: false,
  },
  {
    id: "interview_tracker",
    label: "Interview tracker",
    description: "Interview-stage jobs from tracker sheet or pasted rows.",
    accept: ".xlsx,.xls,.csv,.txt",
    pastePlaceholder: "Paste interview tracker rows — Company, Job Title, and round columns.",
    supportsFile: true,
    supportsPaste: true,
    usesAi: false,
  },
  {
    id: "job_titles",
    label: "Job titles",
    description: "Target roles and deprioritized titles.",
    accept: ".xlsx,.xls,.csv,.txt",
    pastePlaceholder: "One role per line, or paste from Target Job Titles tab.",
    supportsFile: true,
    supportsPaste: true,
    usesAi: false,
  },
  {
    id: "keywords",
    label: "Keywords to use or avoid",
    description: "Search keyword categories — prioritized (use) and deprioritized (avoid).",
    accept: ".xlsx,.xls,.csv,.txt",
    pastePlaceholder: 'Paste keywords — one per line, or "use:" / "avoid:" sections.',
    supportsFile: true,
    supportsPaste: true,
    usesAi: false,
  },
  {
    id: "passwords",
    label: "Login credentials",
    description:
      "Portal logins and passwords — stored in Application Q&A (plain text, not encrypted). Only import if the client accepts that.",
    accept: ".txt,.csv,.xlsx,.xls",
    pastePlaceholder:
      "Site, login, and password — one per line: Site\\tLogin\\tPassword, Site: login / password, or Site\\tPassword",
    supportsFile: true,
    supportsPaste: true,
    usesAi: false,
  },
];

export function getImportTypeConfig(type: ImportType): ImportTypeConfig {
  const config = IMPORT_TYPE_CONFIGS.find((c) => c.id === type);
  if (!config) throw new Error(`Unknown import type: ${type}`);
  return config;
}

export function parseImportType(raw: string | null | undefined): ImportType | null {
  if (!raw) return null;
  return IMPORT_TYPE_CONFIGS.some((c) => c.id === raw) ? (raw as ImportType) : null;
}
