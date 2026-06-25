"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CoachDrawer } from "@/components/scout/coach-drawer";
import { CoachingDirectory } from "@/components/scout/coaching-directory";
import { WorkspacePageShell } from "@/components/scout/workspace-page-shell";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspace } from "@/contexts/workspace-context";
import { categoryToSlug } from "@/lib/coach-categories";
import { color, fontSans } from "@/lib/typography";
import type { CoachListItem } from "@/lib/coach-types";

function CategoryInner({
  category,
}: {
  category: string;
}) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPro, setIsPro] = useState(false);
  const [drawerCoach, setDrawerCoach] = useState<CoachListItem | null>(null);
  const { openPricing } = useWorkspace();

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((d) => { if (d.isPro) setIsPro(true); })
      .catch(() => {});
  }, []);

  const openCoach = useCallback((coach: CoachListItem) => {
    setDrawerCoach(coach);
    const slug = coach.slug ?? coach.id;
    const params = new URLSearchParams(searchParams.toString());
    params.set("coach", slug);
    router.replace(`/coaching/c/${categoryToSlug(category)}?${params.toString()}`, { scroll: false });
  }, [category, router, searchParams]);

  const closeDrawer = useCallback(() => {
    setDrawerCoach(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("coach");
    const qs = params.toString();
    const catSlug = categoryToSlug(category);
    router.replace(qs ? `/coaching/c/${catSlug}?${qs}` : `/coaching/c/${catSlug}`, { scroll: false });
  }, [category, router, searchParams]);

  return (
    <>
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
        <CoachingDirectory category={category} isMobile={isMobile} isPro={isPro} onSubscribe={openPricing} onOpenCoach={openCoach} />
      </WorkspacePageShell>
      {drawerCoach && (
        <CoachDrawer slug={drawerCoach.slug ?? drawerCoach.id} preview={drawerCoach} onClose={closeDrawer} isPro={isPro} onSubscribe={openPricing} />
      )}
    </>
  );
}

export function CoachingCategoryClient({
  category,
  categorySlug,
}: {
  category: string | null;
  categorySlug: string;
}) {
  const isMobile = useIsMobile();

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
    <Suspense fallback={<p style={{ color: color.muted, fontFamily: fontSans }}>Loading…</p>}>
      <CategoryInner category={category} />
    </Suspense>
  );
}
