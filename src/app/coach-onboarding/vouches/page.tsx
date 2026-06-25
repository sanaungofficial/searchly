import { Suspense } from "react";
import CoachVouchesPageInner from "./vouches-page-inner";

export default function CoachVouchesPage() {
  return (
    <Suspense
      fallback={
        <div className="onboarding-loading" role="status">
          <div className="onboarding-loading__spinner" aria-hidden="true" />
          <span>Loading…</span>
        </div>
      }
    >
      <CoachVouchesPageInner />
    </Suspense>
  );
}
