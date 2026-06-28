import { redirectIfAuthenticated } from "@/lib/redirect-if-authenticated";
import { SignupPageClient } from "./signup-page-client";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  await redirectIfAuthenticated(params.next);
  return <SignupPageClient />;
}
