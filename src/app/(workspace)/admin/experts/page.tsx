"use client";

import { Suspense } from "react";
import { AdminExpertsDirectory } from "@/components/admin/admin-experts-directory";
import { color, displayTitleStyle, fontSans } from "@/lib/typography";

export default function AdminExpertsPage() {
  return (
    <Suspense
      fallback={
        <div>
          <h1 style={{ ...displayTitleStyle(28), margin: "0 0 20px" }}>Expert directory</h1>
          <p style={{ fontFamily: fontSans, color: color.muted }}>Loading experts…</p>
        </div>
      }
    >
      <AdminExpertsDirectory />
    </Suspense>
  );
}
