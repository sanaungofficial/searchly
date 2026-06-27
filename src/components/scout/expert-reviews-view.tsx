"use client";

import { ScoutBox } from "@/components/scout/scout-box";
import { useIsMobile } from "@/hooks/use-mobile";
import { color, fontSans, type as T } from "@/lib/typography";

export function ExpertReviewsView() {
  const isMobile = useIsMobile();

  return (
    <div style={{ height: "100%", minHeight: 0, overflowY: "auto" }}>
      <div style={{ padding: isMobile ? "16px 16px 32px" : "24px 24px 40px" }}>
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ margin: "0 0 8px", fontFamily: fontSans, fontSize: isMobile ? 22 : 26, fontWeight: 600, color: color.forest }}>
            Reviews
          </h1>
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55 }}>
            Client feedback and testimonials for your expert profile.
          </p>
        </header>

        <ScoutBox padding={24}>
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55 }}>
            Coming soon — you&apos;ll be able to see session reviews and manage vouches here. For now, clients can leave feedback on your public coaching profile.
          </p>
        </ScoutBox>
      </div>
    </div>
  );
}
