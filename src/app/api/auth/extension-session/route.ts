import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import {
  createSupabaseFromRequest,
  extensionPreflightResponse,
  withExtensionCors,
} from "@/lib/extension-api";

/**
 * GET /api/auth/extension-session
 * Validates Kimchi session cookies forwarded by the browser extension.
 */
export async function GET(request: Request) {
  const preflight = extensionPreflightResponse(request);
  if (preflight) return preflight;

  const supabase = createSupabaseFromRequest(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withExtensionCors(
      request,
      NextResponse.json({ authenticated: false }, { status: 401 })
    );
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
    select: { id: true, email: true, name: true },
  });

  return withExtensionCors(
    request,
    NextResponse.json({
      authenticated: true,
      email: dbUser?.email ?? user.email,
      userId: dbUser?.id ?? null,
      name: dbUser?.name ?? null,
    })
  );
}
