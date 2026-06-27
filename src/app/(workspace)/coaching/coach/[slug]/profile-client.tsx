"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy URL — redirect to /coach/{slug} */
export function CoachProfileClient({ slug }: { slug: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/coach/${encodeURIComponent(slug)}`);
  }, [router, slug]);

  return null;
}
