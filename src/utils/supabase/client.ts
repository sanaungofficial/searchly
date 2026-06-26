import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Callback/confirm routes handle auth codes server-side or explicitly.
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    }
  );
}
