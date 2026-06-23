import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { INITIAL_SIGNALS } from "@/components/scout/workspace-data";

export async function GET() {
  try {
    const latest = await prisma.marketSignals.findFirst({
      orderBy: { generatedAt: "desc" },
    });

    if (latest) {
      return NextResponse.json({
        data: latest.data,
        generatedAt: latest.generatedAt,
      });
    }
  } catch {
    // DB not yet migrated in dev — fall through to static
  }

  return NextResponse.json({
    data: INITIAL_SIGNALS,
    generatedAt: null,
  });
}
