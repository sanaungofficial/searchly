import { NextResponse } from "next/server";

const EXTENSION_ORIGIN_PREFIX = "chrome-extension://";

export function isExtensionOrigin(origin: string | null): boolean {
  return !!origin?.startsWith(EXTENSION_ORIGIN_PREFIX);
}

/** CORS headers for chrome-extension:// origins calling Kimchi API routes. */
export function extensionCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("Origin");
  if (!isExtensionOrigin(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin!,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Cookie",
  };
}

export function extensionPreflightResponse(request: Request): NextResponse | null {
  if (request.method !== "OPTIONS") return null;
  const origin = request.headers.get("Origin");
  if (!isExtensionOrigin(origin)) return null;
  return new NextResponse(null, {
    status: 204,
    headers: extensionCorsHeaders(request),
  });
}

export function withExtensionCors<T>(request: Request, response: NextResponse<T>): NextResponse<T> {
  const headers = extensionCorsHeaders(request);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}
