"use client";

import { Suspense } from "react";
import { ExpertOfferingsView } from "@/components/scout/expert-offerings-view";
import { color, fontSans } from "@/lib/typography";

export default function ExpertOfferingsPage() {
  return (
    <Suspense fallback={<p style={{ padding: 24, fontFamily: fontSans, color: color.muted }}>Loading…</p>}>
      <ExpertOfferingsView />
    </Suspense>
  );
}
