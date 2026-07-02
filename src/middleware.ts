import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPublicCoachingPath, requiresAuthCoachingPath, sanitizeReturnPath } from "@/lib/auth-return-url";
import { APP_HOME_PATH, isAppHost } from "@/lib/site-host";

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
  const onAppHost = isAppHost(host);

  // Passcode gate — production only, login page (any host). Marketing / and app routes bypass.
  if (process.env.VERCEL_ENV === "production") {
    const gatePasscode =
      pathname.startsWith("/login");

    if (gatePasscode) {
      const passcodeValid = request.cookies.get("kimchi_access")?.value === "granted";
      if (!passcodeValid) {
        const url = request.nextUrl.clone();
        url.pathname = "/passcode";
        return NextResponse.redirect(url);
      }
    }
  }

  // Root `/` — marketing landing for guests; signed-in app-host users → dashboard.
  if (pathname === "/") {
    if (user && onAppHost) {
      const url = request.nextUrl.clone();
      url.pathname = APP_HOME_PATH;
      url.search = "";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Allow public routes through always
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/r/") ||
    pathname.startsWith("/vouch/") ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/live") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/passcode") ||
    isPublicCoachingPath(pathname) ||
    pathname.startsWith("/api/") // API routes handle their own auth and must return JSON, not HTML redirects
  ) {
    return supabaseResponse;
  }

  // Redirect unauthenticated users to the marketing homepage `/` rather than `/login`.
  // This prevents auto-completed browser requests from displaying the passcode page immediately,
  // ensuring guests only see the passcode gate when they explicitly click "Log In".
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
