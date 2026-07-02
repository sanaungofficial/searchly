"use client";

import { useCallback, useState } from "react";
import {
  navigateToEmployeeProfileReview,
  startEmployeeImpersonation,
} from "@/lib/admin-client-navigation";

export function useEmployeeViewAs(options: {
  reviewReturnPath: string;
  reviewReturnLabel?: string;
  canImpersonate?: boolean;
  canReview?: boolean;
}) {
  const [startingUserId, setStartingUserId] = useState<string | null>(null);

  const viewAsAdmin = useCallback(
    async (userId: string) => {
      if (!options.canReview) return;
      setStartingUserId(userId);
      try {
        await navigateToEmployeeProfileReview(userId, {
          returnPath: options.reviewReturnPath,
          returnLabel: options.reviewReturnLabel,
        });
      } catch {
        setStartingUserId(null);
      }
    },
    [options.canReview, options.reviewReturnPath, options.reviewReturnLabel],
  );

  const viewAsEmployee = useCallback(
    async (userId: string) => {
      if (!options.canImpersonate) return;
      setStartingUserId(userId);
      try {
        await startEmployeeImpersonation(userId);
      } catch {
        setStartingUserId(null);
      }
    },
    [options.canImpersonate],
  );

  return { startingUserId, viewAsAdmin, viewAsEmployee };
}
