import { Suspense } from "react";
import PublicVouchPageInner from "./vouch-page-inner";

export default function PublicVouchPage() {
  return (
    <Suspense
      fallback={
        <div className="onboarding-loading bruddle">
          <div className="onboarding-loading__spinner" aria-hidden="true" />
          <span>Loading…</span>
        </div>
      }
    >
      <PublicVouchPageInner />
    </Suspense>
  );
}
