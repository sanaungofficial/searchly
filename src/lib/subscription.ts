import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isPro } from "@/lib/stripe";

export async function getSubscription() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, isPro: false, subscription: null };

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
    include: { subscription: true },
  });

  if (!dbUser) return { user: null, isPro: false, subscription: null };

  return {
    user: dbUser,
    isPro: isPro(dbUser.subscription),
    subscription: dbUser.subscription,
  };
}
