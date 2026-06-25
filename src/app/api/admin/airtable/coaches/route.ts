import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getAirtableCredentials,
  getAirtableCoachesTableSchema,
  isAirtablePushEnabled,
} from "@/lib/airtable/client";
import { getFieldAliasMap } from "@/lib/airtable/field-map";
import { getAirtableSyncStatus } from "@/lib/airtable/sync-state";
import {
  AIRTABLE_COACH_SYNC_STATUSES,
  AIRTABLE_COACHES_VIEW_ID,
} from "@/lib/airtable/sync-config";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const creds = getAirtableCredentials();
  const status = await getAirtableSyncStatus();
  const schema = creds ? await getAirtableCoachesTableSchema() : null;

  const missingEnv: string[] = [];
  if (!process.env.AIRTABLE_API_KEY?.trim()) missingEnv.push("AIRTABLE_API_KEY");

  return NextResponse.json({
    ...status,
    configured: !!creds,
    missingEnv,
    baseId: creds?.baseId ?? process.env.AIRTABLE_BASE_ID ?? "apph4HTjhekSdaxv9",
    tableId: creds?.tableId ?? process.env.AIRTABLE_COACHES_TABLE_ID ?? "tblnl8cmFBBynOwg0",
    viewId: creds?.viewId ?? process.env.AIRTABLE_COACHES_VIEW_ID ?? AIRTABLE_COACHES_VIEW_ID,
    pushEnabled: isAirtablePushEnabled(),
    tableName: schema?.tableName ?? null,
    syncStatuses: [...AIRTABLE_COACH_SYNC_STATUSES],
    expectedCoachCount: 20,
    airtableFields: schema?.fields?.map((f) => ({ name: f.name, type: f.type })) ?? null,
    fieldAliases: getFieldAliasMap(),
  });
}
