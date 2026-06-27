import { Suspense } from "react";
import { AdminNetworkJobsCatalog } from "@/components/admin/admin-network-jobs-catalog";

export default function AdminNetworkJobsPage() {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Loading catalog…</p>}>
      <AdminNetworkJobsCatalog />
    </Suspense>
  );
}
