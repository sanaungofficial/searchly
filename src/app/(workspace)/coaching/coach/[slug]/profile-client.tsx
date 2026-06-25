"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function CoachProfileClient({ slug }: { slug: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/coaching?coach=${encodeURIComponent(slug)}`);
  }, [router, slug]);

  return null;
}
