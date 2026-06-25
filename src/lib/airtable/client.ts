import {
  AIRTABLE_COACH_SYNC_FILTER_FORMULA,
  AIRTABLE_COACHES_VIEW_ID,
} from "@/lib/airtable/sync-config";
import type { AirtableListResponse, AirtableRecord } from "@/lib/airtable/types";

const AIRTABLE_API = "https://api.airtable.com/v0";

export function getAirtableCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY?.trim();
  const baseId = process.env.AIRTABLE_BASE_ID?.trim() || "apph4HTjhekSdaxv9";
  const tableId = process.env.AIRTABLE_COACHES_TABLE_ID?.trim() || "tblnl8cmFBBynOwg0";
  const viewId = process.env.AIRTABLE_COACHES_VIEW_ID?.trim() || AIRTABLE_COACHES_VIEW_ID;

  if (!apiKey) return null;

  return { apiKey, baseId, tableId, viewId };
}

export function isAirtablePushEnabled(): boolean {
  return process.env.AIRTABLE_SYNC_PUSH === "true" || process.env.AIRTABLE_SYNC_PUSH === "1";
}

async function airtableFetch(path: string, init?: RequestInit): Promise<Response> {
  const creds = getAirtableCredentials();
  if (!creds) throw new Error("Airtable is not configured");

  const url = path.startsWith("http") ? path : `${AIRTABLE_API}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${creds.apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export async function listAirtableCoachRecords(options?: { maxRecords?: number }): Promise<AirtableRecord[]> {
  const creds = getAirtableCredentials();
  if (!creds) throw new Error("Airtable is not configured");

  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    if (creds.viewId) params.set("view", creds.viewId);
    params.set("filterByFormula", AIRTABLE_COACH_SYNC_FILTER_FORMULA);
    if (offset) params.set("offset", offset);
    if (options?.maxRecords) {
      params.set("maxRecords", String(options.maxRecords));
    }

    const listPath = `/${creds.baseId}/${creds.tableId}?${params.toString()}`;
    const res = await airtableFetch(listPath);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Airtable list failed (${res.status}): ${text.slice(0, 400)}`);
    }

    const data = (await res.json()) as AirtableListResponse;
    records.push(...data.records);
    offset = data.offset;

    if (options?.maxRecords && records.length >= options.maxRecords) {
      return records.slice(0, options.maxRecords);
    }
  } while (offset);

  return records;
}

export async function updateAirtableCoachRecord(
  recordId: string,
  fields: Record<string, unknown>
): Promise<AirtableRecord> {
  const creds = getAirtableCredentials();
  if (!creds) throw new Error("Airtable is not configured");

  const res = await airtableFetch(`/${creds.baseId}/${creds.tableId}/${recordId}`, {
    method: "PATCH",
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable update failed (${res.status}): ${text.slice(0, 400)}`);
  }

  return (await res.json()) as AirtableRecord;
}

export type AirtableTableField = { id: string; name: string; type: string };

export async function getAirtableCoachesTableSchema(): Promise<{
  tableName: string;
  fields: AirtableTableField[];
} | null> {
  const creds = getAirtableCredentials();
  if (!creds) return null;

  const res = await airtableFetch(`/meta/bases/${creds.baseId}/tables`);
  if (!res.ok) return null;

  const data = (await res.json()) as {
    tables: Array<{ id: string; name: string; fields: AirtableTableField[] }>;
  };
  const table = data.tables.find((t) => t.id === creds.tableId);
  if (!table) return null;
  return { tableName: table.name, fields: table.fields };
}
