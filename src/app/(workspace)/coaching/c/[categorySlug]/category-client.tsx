"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { CoachingDirectory } from "@/components/scout/coaching-directory";
import { WorkspacePageShell } from "@/components/scout/workspace-page-shell";
import { WorkspaceSegmentTabs } from "@/components/scout/workspace-segment-tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspace } from "@/contexts/workspace-context";
import { slugToCategory } from "@/lib/coach-categories";
import { color, fontSans } from "@/lib/typography";

export function CoachingCategoryClient({
  category,
  categorySlug,
}: {
  category: string | null;
  categorySlug: string;
}) {
  const isMobile = useIsMobile();
  const [isPro, setIsPro] = useState(false);
  const { openPricing } = useWorkspace();

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((d) => { if (d.isPro) setIsPro(true); })
      .catch(() => {});
  }, []);

  if (!category) {
    return (
      <WorkspacePageShell isMobile={isMobile} label="Coaching" mobileBarTitle="Coaching" title="Category not found">
        <p style={{ fontFamily: fontSans, color: color.muted }}>
          We couldn&apos;t find that category. <Link href="/coaching" style={{ color: color.forest }}>Browse all coaches</Link>
        </p>
      </WorkspacePageShell>
    );
  }

  return (
    <WorkspacePageShell
      isMobile={isMobile}
      label="1:1 coaching"
      mobileBarTitle={category}
      title={category}
      subtitle={
        <Link href="/coaching" style={{ fontFamily: fontSans, fontSize: 14, color: color.forest, textDecoration: "none" }}>
          ← All coaches
        </Link>
      }
    >
      <Suspense fallback={<p style={{ color: color.muted, fontFamily: fontSans }}>Loading…</p>}>
        <CoachingDirectory category={category} isMobile={isMobile} isPro={isPro} onSubscribe={openPricing} />
      </Suspense>
    </WorkspacePageShell>
  );
}
