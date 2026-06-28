import { redirectIfAuthenticated } from "@/lib/redirect-if-authenticated";
import { LoginPageClient } from "./login-page-client";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  await redirectIfAuthenticated(params.next);
  return <LoginPageClient />;
}
