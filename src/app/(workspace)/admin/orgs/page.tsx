import { AdminOrgsPageHeader, AdminOrgsPanel } from "@/components/admin/admin-orgs-panel";
import { adminSectionLabel } from "../admin-styles";

export default function AdminOrgsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <AdminOrgsPageHeader />
      <section>
        <h2 className={adminSectionLabel}>Directory</h2>
        <AdminOrgsPanel />
      </section>
    </div>
  );
}
