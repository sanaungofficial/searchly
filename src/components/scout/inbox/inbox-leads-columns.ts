export type LeadColumnId =
  | "name"
  | "email"
  | "company"
  | "title"
  | "status"
  | "linkedJobs"
  | "lastActivity"
  | "source"
  | "contacted"
  | "linkedinUrl"
  | "notes"
  | "createdAt"
  | "updatedAt";

export type LeadColumnDef = {
  id: LeadColumnId;
  label: string;
  group: "Contacts";
  defaultVisible: boolean;
  minWidth?: number;
};

export const LEAD_COLUMNS: LeadColumnDef[] = [
  { id: "name", label: "Name", group: "Contacts", defaultVisible: true, minWidth: 200 },
  { id: "email", label: "Email", group: "Contacts", defaultVisible: true, minWidth: 180 },
  { id: "company", label: "Company", group: "Contacts", defaultVisible: true, minWidth: 140 },
  { id: "title", label: "Title", group: "Contacts", defaultVisible: false, minWidth: 140 },
  { id: "status", label: "Status", group: "Contacts", defaultVisible: true, minWidth: 160 },
  { id: "linkedJobs", label: "Opportunities", group: "Contacts", defaultVisible: true, minWidth: 180 },
  { id: "lastActivity", label: "Latest communication", group: "Contacts", defaultVisible: true, minWidth: 160 },
  { id: "source", label: "Source", group: "Contacts", defaultVisible: false, minWidth: 100 },
  { id: "contacted", label: "Contacted", group: "Contacts", defaultVisible: false, minWidth: 90 },
  { id: "linkedinUrl", label: "LinkedIn", group: "Contacts", defaultVisible: false, minWidth: 120 },
  { id: "notes", label: "Notes", group: "Contacts", defaultVisible: false, minWidth: 160 },
  { id: "createdAt", label: "Created", group: "Contacts", defaultVisible: false, minWidth: 110 },
  { id: "updatedAt", label: "Updated", group: "Contacts", defaultVisible: false, minWidth: 110 },
];

export const LEAD_COLUMNS_STORAGE_KEY = "kimchi_leads_columns_v1";

export const DEFAULT_VISIBLE_COLUMNS: LeadColumnId[] = LEAD_COLUMNS.filter((c) => c.defaultVisible).map(
  (c) => c.id,
);

export type LeadSortField =
  | "name"
  | "email"
  | "company"
  | "status"
  | "updatedAt"
  | "createdAt"
  | "lastActivityAt";

export const LEAD_SORT_OPTIONS: { id: LeadSortField; label: string }[] = [
  { id: "updatedAt", label: "Last updated" },
  { id: "lastActivityAt", label: "Latest communication" },
  { id: "name", label: "Name" },
  { id: "company", label: "Company" },
  { id: "status", label: "Status" },
  { id: "createdAt", label: "Date created" },
  { id: "email", label: "Email" },
];

export function readStoredLeadColumns(): LeadColumnId[] {
  if (typeof window === "undefined") return DEFAULT_VISIBLE_COLUMNS;
  try {
    const raw = localStorage.getItem(LEAD_COLUMNS_STORAGE_KEY);
    if (!raw) return DEFAULT_VISIBLE_COLUMNS;
    const parsed = JSON.parse(raw) as LeadColumnId[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_VISIBLE_COLUMNS;
    return parsed.filter((id) => LEAD_COLUMNS.some((c) => c.id === id));
  } catch {
    return DEFAULT_VISIBLE_COLUMNS;
  }
}

export function storeLeadColumns(columns: LeadColumnId[]) {
  try {
    localStorage.setItem(LEAD_COLUMNS_STORAGE_KEY, JSON.stringify(columns));
  } catch {
    /* ignore */
  }
}

export function sourceLabel(source: string): string {
  if (source === "MANUAL") return "Import";
  if (source === "NYLAS") return "Address book";
  return "Email";
}

export function formatLeadDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "2-digit", day: "2-digit", year: "numeric" });
}
