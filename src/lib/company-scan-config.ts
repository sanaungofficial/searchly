import { prisma } from "@/lib/prisma";
import { invalidatePromptCache } from "@/lib/prompts";

export type CompanyScanCronSummary = {
  scanned: number;
  skipped: number;
  failed: number;
  errors: string[];
};

export type CompanyScanSettings = {
  refreshIntervalDays: number;
  maxCompaniesPerCronRun: number;
  autoScanOnAdd: boolean;
  cronEnabled: boolean;
  lastCronRunAt: string | null;
  lastCronSummary: CompanyScanCronSummary | null;
};

export const COMPANY_SCAN_SETTINGS_KEY = "COMPANY_JOBS_SCAN_SETTINGS";

export const DEFAULT_COMPANY_SCAN_SETTINGS: CompanyScanSettings = {
  refreshIntervalDays: 7,
  maxCompaniesPerCronRun: 20,
  autoScanOnAdd: true,
  cronEnabled: true,
  lastCronRunAt: null,
  lastCronSummary: null,
};

const SETTINGS_META = {
  label: "Company jobs scan settings",
  description:
    "Shared careers-page scan cadence for CompanyIntel. Cron schedule is configured in vercel.json (weekly by default).",
  category: "Companies",
};

function parseSettings(content: string | undefined | null): CompanyScanSettings {
  if (!content) return { ...DEFAULT_COMPANY_SCAN_SETTINGS };
  try {
    const parsed = JSON.parse(content) as Partial<CompanyScanSettings>;
    return {
      refreshIntervalDays: Math.max(1, Number(parsed.refreshIntervalDays) || DEFAULT_COMPANY_SCAN_SETTINGS.refreshIntervalDays),
      maxCompaniesPerCronRun: Math.max(1, Math.min(100, Number(parsed.maxCompaniesPerCronRun) || DEFAULT_COMPANY_SCAN_SETTINGS.maxCompaniesPerCronRun)),
      autoScanOnAdd: parsed.autoScanOnAdd ?? DEFAULT_COMPANY_SCAN_SETTINGS.autoScanOnAdd,
      cronEnabled: parsed.cronEnabled ?? DEFAULT_COMPANY_SCAN_SETTINGS.cronEnabled,
      lastCronRunAt: parsed.lastCronRunAt ?? null,
      lastCronSummary: parsed.lastCronSummary ?? null,
    };
  } catch {
    return { ...DEFAULT_COMPANY_SCAN_SETTINGS };
  }
}

export async function getCompanyScanSettings(): Promise<CompanyScanSettings> {
  const row = await prisma.promptConfig.findUnique({ where: { key: COMPANY_SCAN_SETTINGS_KEY } });
  if (!row) {
    await saveCompanyScanSettings(DEFAULT_COMPANY_SCAN_SETTINGS);
    return { ...DEFAULT_COMPANY_SCAN_SETTINGS };
  }
  return parseSettings(row.content);
}

export async function saveCompanyScanSettings(
  settings: CompanyScanSettings,
  updatedBy?: string
): Promise<CompanyScanSettings> {
  const content = JSON.stringify(settings, null, 2);
  await prisma.promptConfig.upsert({
    where: { key: COMPANY_SCAN_SETTINGS_KEY },
    update: { content, updatedBy: updatedBy ?? undefined },
    create: {
      key: COMPANY_SCAN_SETTINGS_KEY,
      label: SETTINGS_META.label,
      description: SETTINGS_META.description,
      category: SETTINGS_META.category,
      content,
      defaultContent: JSON.stringify(DEFAULT_COMPANY_SCAN_SETTINGS, null, 2),
    },
  });
  invalidatePromptCache(COMPANY_SCAN_SETTINGS_KEY);
  return settings;
}

export async function patchCompanyScanSettings(
  patch: Partial<Omit<CompanyScanSettings, "lastCronRunAt" | "lastCronSummary">>,
  updatedBy?: string
): Promise<CompanyScanSettings> {
  const current = await getCompanyScanSettings();
  return saveCompanyScanSettings(
    {
      ...current,
      ...patch,
      lastCronRunAt: current.lastCronRunAt,
      lastCronSummary: current.lastCronSummary,
    },
    updatedBy
  );
}

export async function recordCompanyScanCronRun(summary: CompanyScanCronSummary): Promise<void> {
  const current = await getCompanyScanSettings();
  await saveCompanyScanSettings({
    ...current,
    lastCronRunAt: new Date().toISOString(),
    lastCronSummary: summary,
  });
}

export function isIntelScanStale(
  lastJobsFetchedAt: Date | null | undefined,
  refreshIntervalDays: number
): boolean {
  if (!lastJobsFetchedAt) return true;
  const ageMs = Date.now() - lastJobsFetchedAt.getTime();
  return ageMs > refreshIntervalDays * 24 * 60 * 60 * 1000;
}
