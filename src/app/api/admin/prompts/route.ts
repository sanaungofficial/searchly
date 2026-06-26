import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PROMPT_META, PROMPT_DEFAULTS, getPrompt } from "@/lib/prompts";
import { COMPANY_SCAN_SETTINGS_KEY } from "@/lib/company-scan-config";
import { KIMCHI_AI_SETTINGS_KEY } from "@/lib/kimchi-ai-settings";
import { NextResponse } from "next/server";

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ensure all prompts are seeded — getPrompt auto-creates if missing
  await Promise.all(Object.keys(PROMPT_META).map((key) => getPrompt(key)));

  const rows = await prisma.promptConfig.findMany({
    where: { key: { notIn: [COMPANY_SCAN_SETTINGS_KEY, KIMCHI_AI_SETTINGS_KEY] } },
    orderBy: { category: "asc" },
  });

  const result = rows.map((row) => ({
    key: row.key,
    label: row.label,
    description: row.description,
    category: row.category,
    content: row.content,
    defaultContent: row.defaultContent,
    updatedAt: row.updatedAt.toISOString(),
    variables: PROMPT_META[row.key]?.variables ?? [],
  }));

  // Include any prompts that might not be in the DB yet
  const dbKeys = new Set(rows.map((r) => r.key));
  for (const key of Object.keys(PROMPT_META)) {
    if (!dbKeys.has(key)) {
      const meta = PROMPT_META[key];
      const def = PROMPT_DEFAULTS[key] ?? "";
      result.push({
        key,
        label: meta.label,
        description: meta.description,
        category: meta.category,
        content: def,
        defaultContent: def,
        updatedAt: new Date().toISOString(),
        variables: meta.variables,
      });
    }
  }

  return NextResponse.json(result);
}
