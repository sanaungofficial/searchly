"use client";

import { useEffect, useState } from "react";
import { CoachProfileView } from "@/components/scout/coach-profile-view";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspace } from "@/contexts/workspace-context";

export function CoachProfileClient({ slug }: { slug: string }) {
  const isMobile = useIsMobile();
  const [isPro, setIsPro] = useState(false);
  const { openPricing } = useWorkspace();

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((d) => { if (d.isPro) setIsPro(true); })
      .catch(() => {});
  }, []);

  return <CoachProfileView slug={slug} isMobile={isMobile} isPro={isPro} onSubscribe={openPricing} />;
}
