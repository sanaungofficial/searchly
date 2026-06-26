"use client";

import { useState } from "react";
import { AdminClientProfileBanner } from "@/components/admin/admin-client-profile-banner";
import { exitAdminClientReview } from "@/lib/admin-client-navigation";

type Props = {
  clientId: string;
  name?: string | null;
  email?: string | null;
};

export function AdminClientReviewBanner({ clientId, name, email }: Props) {
  const [exiting, setExiting] = useState(false);

  if (!clientId) return null;

  return (
    <AdminClientProfileBanner
      name={name}
      email={email}
      onBack={() => {
        setExiting(true);
        void exitAdminClientReview().finally(() => setExiting(false));
      }}
    />
  );
}
