import { anthropicFailureMessage } from "@/lib/api-error-message";
import { NextResponse } from "next/server";

export function anthropicErrorResponse(err: unknown, status = 503): NextResponse {
  return NextResponse.json({ error: anthropicFailureMessage(err) }, { status });
}
