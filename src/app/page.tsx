import { redirectIfAuthenticated } from "@/lib/redirect-if-authenticated";
import { LandingPage } from "@/components/landing/landing-page";

export default async function Home() {
  await redirectIfAuthenticated();
  return <LandingPage />;
}
