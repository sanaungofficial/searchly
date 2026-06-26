import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return document.cookie
            .split(";")
            .map((cookie) => {
              const trimmed = cookie.trim();
              if (!trimmed) return null;
              const eq = trimmed.indexOf("=");
              if (eq === -1) return { name: trimmed, value: "" };
              return {
                name: trimmed.slice(0, eq),
                value: trimmed.slice(eq + 1),
              };
            })
            .filter((c): c is { name: string; value: string } => c !== null);
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            let cookie = `${name}=${value}`;
            if (options?.path) cookie += `; path=${options.path}`;
            if (options?.maxAge) cookie += `; max-age=${options.maxAge}`;
            if (options?.domain) cookie += `; domain=${options.domain}`;
            if (options?.sameSite) cookie += `; samesite=${options.sameSite}`;
            if (options?.secure) cookie += "; secure";
            document.cookie = cookie;
          });
        },
      },
    }
  );
}
