import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { kimchiGenerateText } from "@/lib/llm";
import {
  buildDiscoveryPrompt,
  DISCOVERY_SCORE_SYSTEM,
  parseDiscoveryResponse,
  tierFromScore,
  type DiscoveryScoreInput,
} from "@/lib/discovery-score";

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let input: DiscoveryScoreInput;
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const prompt = buildDiscoveryPrompt(input);
    const { text } = await kimchiGenerateText({
      tier: "analyze",
      system: DISCOVERY_SCORE_SYSTEM,
      prompt,
      userId: session.user.id,
      tags: ["discovery-score"],
    });

    const result = parseDiscoveryResponse(text);
    if (!result) {
      return NextResponse.json(
        { score: 20, tier: tierFromScore(20), summary: "Unable to score at this time.", topImprovement: "Complete your profile to get a full score." },
        { status: 200 },
      );
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Scoring failed" }, { status: 500 });
  }
}
