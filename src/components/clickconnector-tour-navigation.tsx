"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { registerTourStepNavigation } from "@/lib/clickconnector-tour";

/** Wires ClickConnector tour steps to Next.js App Router navigation. */
export function ClickConnectorTourNavigation() {
  const router = useRouter();

  useEffect(() => {
    registerTourStepNavigation(router);
  }, [router]);

  return null;
}
