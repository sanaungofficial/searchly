import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";
  const onAppHost = host.includes("app.kimchi.so");

  // Passcode gate — production only, login/signup pages (any host). Marketing / and app routes bypass.
  if (process.env.VERCEL_ENV === "production") {
    const gatePasscode =
      pathname.startsWith("/login") || pathname.startsWith("/signup");

    if (gatePasscode) {
      const passcodeValid = request.cookies.get("kimchi_access")?.value === "granted";
      if (!passcodeValid) {
        const url = request.nextUrl.clone();
        url.pathname = "/passcode";
        return NextResponse.redirect(url);
      }
    }
  }

  // Allow public routes through always
  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/r/") ||
    pathname.startsWith("/vouch/") ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/live") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/passcode") ||
    pathname.startsWith("/api/") // API routes handle their own auth and must return JSON, not HTML redirects
  ) {
    return supabaseResponse;
  }

  // Redirect unauthenticated users — marketing site to login; app host keeps landing redirect
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = onAppHost ? "/login" : "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
