"use client";

import { Suspense } from "react";
import { CoachProfileTab } from "@/components/scout/coach-profile-tab";
import { color, displayTitleStyle, fontSans, type as T } from "@/lib/typography";

function AdminProfileContent() {
  return (
    <>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 24px", maxWidth: 640 }}>
        Your coach directory profile and calendar sync. Connect Google or Outlook here so seekers can book sessions
        with you inside Kimchi.
      </p>
      <CoachProfileTab setupOnMissing />
    </>
  );
}

export default function AdminProfilePage() {
  return (
    <div>
      <h1 style={{ ...displayTitleStyle(28), margin: "0 0 8px" }}>My Profile</h1>
      <Suspense fallback={<p style={{ color: "var(--scout-muted)", fontSize: 14, padding: "40px 0" }}>Loading…</p>}>
        <AdminProfileContent />
      </Suspense>
    </div>
  );
}
