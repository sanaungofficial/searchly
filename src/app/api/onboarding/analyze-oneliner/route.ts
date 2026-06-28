import { NextRequest, NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { kimchiGenerateText } from "@/lib/llm";

const SYSTEM = `You are a career advisor. Given a one-sentence professional description, return a JSON object that identifies the person's background and recommends roles to target.

Return ONLY valid JSON in this exact shape:
{
  "picture": "A 1-2 sentence professional summary of this person.",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "targetRoles": [
    { "role": "Senior Product Manager", "match": "One sentence on why this fits." },
    { "role": "Director of Strategy", "match": "One sentence on why this fits." }
  ]
}

Rules:
- picture: 1-2 sentences, professional, specific to what they described.
- strengths: exactly 3 items, concrete skills or attributes implied by their description.
- targetRoles: 5-8 roles. Use specific, senior titles. Focus on Product, Strategy, Operations, Business Development, Finance, and adjacent functions in tech/corporate settings.
- No commentary outside the JSON.`;

export async function POST(req: NextRequest) {
  const { dbUser } = await getActingUser(req);
  if (!dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let oneliner: string;
  try {
    const body = await req.json();
    oneliner = typeof body.oneliner === "string" ? body.oneliner.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!oneliner) {
    return NextResponse.json({ error: "oneliner is required" }, { status: 400 });
  }

  try {
    const { text } = await kimchiGenerateText({
      tier: "fast",
      system: SYSTEM,
      prompt: `Professional description: "${oneliner}"`,
      userId: dbUser.id,
      tags: ["onboarding-oneliner"],
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(fallback(oneliner));
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (
      typeof parsed.picture !== "string" ||
      !Array.isArray(parsed.strengths) ||
      !Array.isArray(parsed.targetRoles)
    ) {
      return NextResponse.json(fallback(oneliner));
    }

    return NextResponse.json({
      picture: parsed.picture as string,
      strengths: (parsed.strengths as unknown[]).filter((s) => typeof s === "string") as string[],
      targetRoles: (parsed.targetRoles as unknown[]).filter(
        (r): r is { role: string; match: string } =>
          typeof (r as Record<string, unknown>).role === "string",
      ),
    });
  } catch {
    return NextResponse.json(fallback(oneliner));
  }
}

function fallback(oneliner: string) {
  return {
    picture: `Based on your description: ${oneliner}`,
    strengths: ["Cross-functional collaboration", "Strategic thinking", "Operational execution"],
    targetRoles: [
      { role: "Senior Product Manager", match: "Combines strategy and execution across teams." },
      { role: "Director of Strategy", match: "Applies analytical skills to business decisions." },
      { role: "Head of Operations", match: "Drives process and efficiency at scale." },
    ],
  };
}
