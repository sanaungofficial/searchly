export type ReadbackPayload = {
  picture: string;
  strengths: string[];
  targetRoles: { role: string; fit: string }[];
  honestNote: string;
};

export function readbackFirstName(fullName: string | null | undefined): string {
  const trimmed = fullName?.trim();
  if (!trimmed) return "This candidate";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function possessiveName(name: string): string {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

/** Convert legacy second-person readback copy to third person for display. */
export function readbackTextToThirdPerson(text: string, fullName: string | null | undefined): string {
  const name = readbackFirstName(fullName);
  const possessive = possessiveName(name);

  return text
    .replace(/\bYou're\b/g, `${name} is`)
    .replace(/\bYou are\b/g, `${name} is`)
    .replace(/\bYour\b/g, possessive)
    .replace(/\byou're\b/g, `${name} is`)
    .replace(/\byou are\b/g, `${name} is`)
    .replace(/\byour\b/g, possessive);
}

function needsThirdPersonConversion(text: string): boolean {
  return /\b(You're|You are|Your|you're|you are|your)\b/.test(text);
}

export function formatReadbackForDisplay(
  data: ReadbackPayload,
  fullName: string | null | undefined,
): ReadbackPayload {
  if (!needsThirdPersonConversion(`${data.picture} ${data.honestNote}`)) {
    return data;
  }
  return {
    ...data,
    picture: readbackTextToThirdPerson(data.picture, fullName),
    honestNote: readbackTextToThirdPerson(data.honestNote, fullName),
  };
}
