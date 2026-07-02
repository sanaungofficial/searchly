"use client";

import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { color, fontSans } from "@/lib/typography";

type Props = {
  userId: string;
  startingUserId?: string | null;
  canReview?: boolean;
  canImpersonate?: boolean;
  onViewAsAdmin?: (userId: string) => void;
  onViewAsEmployee?: (userId: string) => void;
  compact?: boolean;
};

export function EmployeeViewAsActions({
  userId,
  startingUserId,
  canReview = false,
  canImpersonate = false,
  onViewAsAdmin,
  onViewAsEmployee,
  compact = false,
}: Props) {
  if (!canReview && !canImpersonate) return null;

  const busy = startingUserId === userId;

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        alignItems: compact ? "center" : "flex-start",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {canReview && onViewAsAdmin && (
        <div>
          <ScoutPrimaryBtn
            onClick={() => void onViewAsAdmin(userId)}
            disabled={busy}
            style={{ minHeight: compact ? 36 : 40, opacity: busy ? 0.7 : 1 }}
          >
            {busy && !canImpersonate ? "Opening…" : "View as admin"}
          </ScoutPrimaryBtn>
          {!compact && (
            <p style={{ fontSize: 11, color: color.muted, fontFamily: fontSans, margin: "4px 0 0", maxWidth: 200, lineHeight: 1.4 }}>
              Review their fit and profile — your admin portal stays available.
            </p>
          )}
        </div>
      )}
      {canImpersonate && onViewAsEmployee && (
        <div>
          <ScoutSecondaryBtn
            onClick={() => void onViewAsEmployee(userId)}
            disabled={busy}
            style={{ minHeight: compact ? 36 : 40, opacity: busy ? 0.7 : 1 }}
          >
            {busy ? "Opening…" : "View as employee"}
          </ScoutSecondaryBtn>
          {!compact && (
            <p style={{ fontSize: 11, color: color.muted, fontFamily: fontSans, margin: "4px 0 0", maxWidth: 200, lineHeight: 1.4 }}>
              Full impersonation — you become them in the app.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
