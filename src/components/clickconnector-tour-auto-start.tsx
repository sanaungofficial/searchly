"use client";

import { useEffect, useRef } from "react";
import { startProductTour } from "@/lib/clickconnector-tour";

const AUTO_START_DELAY_MS = 2000;

/** Starts the product tour once for first-time workspace visitors on Opportunities. */
export function ClickConnectorTourAutoStart() {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const timer = window.setTimeout(() => {
      void startProductTour({ auto: true });
    }, AUTO_START_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
