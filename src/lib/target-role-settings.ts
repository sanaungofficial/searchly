export type TargetRoleSetting = {
  resumeAssetId: string | null;
};

export type TargetRoleSettingsMap = Record<string, TargetRoleSetting>;

export function normalizeTargetRoleSettings(raw: unknown): TargetRoleSettingsMap {
  if (!raw || typeof raw !== "object") return {};
  const out: TargetRoleSettingsMap = {};
  for (const [role, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!role.trim()) continue;
    if (!value || typeof value !== "object") {
      out[role] = { resumeAssetId: null };
      continue;
    }
    const row = value as Record<string, unknown>;
    out[role] = {
      resumeAssetId: typeof row.resumeAssetId === "string" ? row.resumeAssetId : null,
    };
  }
  return out;
}

export function defaultResumeAssetId(
  resumes: { id: string; isPrimary?: boolean }[],
): string | null {
  if (!resumes.length) return null;
  return resumes.find((r) => r.isPrimary)?.id ?? resumes[0]?.id ?? null;
}

export function getRoleResumeAssetId(
  role: string,
  settings: TargetRoleSettingsMap,
  resumes: { id: string; isPrimary?: boolean }[],
): string | null {
  const configured = settings[role]?.resumeAssetId;
  if (configured && resumes.some((r) => r.id === configured)) return configured;
  return defaultResumeAssetId(resumes);
}
