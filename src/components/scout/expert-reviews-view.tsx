"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CoachStarRating } from "@/components/scout/coach-avatar";
import { ScoutBox, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { useIsMobile } from "@/hooks/use-mobile";
import type { CoachReviewItem } from "@/lib/coach-types";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

type ReviewsPayload = {
  reviews: CoachReviewItem[];
  aggregates: {
    knowledge: number;
    value: number;
    responsiveness: number;
    supportiveness: number;
  } | null;
  avgRating: number | null;
  reviewCount: number;
  slug: string | null;
  displayName: string | null;
  vouchCount: number;
  vouchUrl: string | null;
};

function DimensionBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: fontSans, fontSize: 12, color: color.muted }}>{label}</span>
        <span style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600 }}>{value.toFixed(1)}</span>
      </div>
      <div style={{ height: 6, background: surface.inset, borderRadius: 3 }}>
        <div style={{ height: "100%", width: `${(value / 5) * 100}%`, background: color.forest, borderRadius: 3 }} />
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: CoachReviewItem }) {
  return (
    <ScoutBox padding={18} style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <p style={{ margin: 0, fontFamily: fontSans, fontSize: 15, fontWeight: 600 }}>{review.authorName}</p>
        <CoachStarRating rating={review.rating} />
      </div>
      {review.coachedFor && (
        <p style={{ margin: "0 0 8px", fontFamily: fontSans, fontSize: 12, color: color.muted }}>Coached for: {review.coachedFor}</p>
      )}
      <p style={{ margin: 0, fontFamily: fontSans, fontSize: 14, color: color.stone, lineHeight: 1.55 }}>{review.message}</p>
      <p style={{ margin: "10px 0 0", fontFamily: fontSans, fontSize: 11, color: color.muted }}>
        {new Date(review.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
      </p>
    </ScoutBox>
  );
}

export function ExpertReviewsView() {
  const isMobile = useIsMobile();
  const [data, setData] = useState<ReviewsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/coach/reviews").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/coach/vouches").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([reviews, vouches]) => {
        if (!reviews) return;
        setData({
          ...reviews,
          vouchCount: vouches?.count ?? 0,
          vouchUrl: vouches?.vouchUrl ?? null,
        });
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ height: "100%", minHeight: 0, overflowY: "auto" }}>
      <div style={{ padding: isMobile ? "16px 16px 32px" : "24px 28px 40px", maxWidth: 720 }}>
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ margin: "0 0 8px", fontFamily: fontSans, fontSize: isMobile ? 22 : 26, fontWeight: 600, color: color.forest }}>Reviews</h1>
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55 }}>
            Client feedback on your coaching. Share your vouch link to collect testimonials before reviews come in.
          </p>
        </header>

        {loading && <p style={{ fontFamily: fontSans, color: color.muted }}>Loading reviews…</p>}

        {!loading && data && (
          <>
            <ScoutBox padding={20} style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, marginBottom: data.aggregates ? 16 : 0 }}>
                <CoachStarRating rating={data.avgRating} count={data.reviewCount} />
                {data.slug && (
                  <Link href={`/coaching/coach/${data.slug}`} style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: color.forest }}>
                    View public profile →
                  </Link>
                )}
              </div>
              {data.aggregates && (
                <div style={{ maxWidth: 360 }}>
                  <DimensionBar label="Knowledge" value={data.aggregates.knowledge} />
                  <DimensionBar label="Value" value={data.aggregates.value} />
                  <DimensionBar label="Responsiveness" value={data.aggregates.responsiveness} />
                  <DimensionBar label="Supportiveness" value={data.aggregates.supportiveness} />
                </div>
              )}
            </ScoutBox>

            {data.vouchUrl && (
              <ScoutBox padding={18} style={{ marginBottom: 24, background: "rgba(42,107,74,0.04)", border: border.line }}>
                <p style={{ margin: "0 0 6px", fontFamily: fontSans, fontSize: 14, fontWeight: 600 }}>Request a review</p>
                <p style={{ margin: "0 0 12px", fontFamily: fontSans, fontSize: 13, color: color.muted, lineHeight: 1.5 }}>
                  {data.vouchCount} vouch{data.vouchCount === 1 ? "" : "es"} collected — send your link after a great session.
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href="/coach-onboarding/vouches" style={{ textDecoration: "none" }}>
                    <ScoutSecondaryBtn type="button">Manage vouches</ScoutSecondaryBtn>
                  </Link>
                </div>
              </ScoutBox>
            )}

            {data.reviews.length === 0 ? (
              <ScoutBox padding={24}>
                <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55 }}>
                  No reviews yet. After clients complete sessions, they can leave feedback on your public profile.
                </p>
              </ScoutBox>
            ) : (
              data.reviews.map((r) => <ReviewCard key={r.id} review={r} />)
            )}
          </>
        )}
      </div>
    </div>
  );
}
