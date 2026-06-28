import { headers } from "next/headers";
import { LandingPage } from "@/components/landing/landing-page";
import { HomeRedirect } from "@/components/landing/home-redirect";
import { isAppHost } from "@/lib/site-host";

export default async function Home() {
  const host = (await headers()).get("host") ?? "";
  if (isAppHost(host)) {
    return <HomeRedirect />;
  }
  return <LandingPage />;
}
