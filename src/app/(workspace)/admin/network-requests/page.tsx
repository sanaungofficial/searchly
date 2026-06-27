import { AdminNetworkRequestsPanel } from "@/components/admin/admin-network-requests-panel";
import { ScoutDisplayTitle, ScoutLabel } from "@/components/scout/scout-box";
import { color, type as T } from "@/lib/typography";
import { adminSectionLabel } from "../admin-styles";

export default function AdminNetworkRequestsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ width: 8, height: 8, background: color.forest, display: "inline-block" }} />
          <ScoutLabel>Operations</ScoutLabel>
        </div>
        <ScoutDisplayTitle size={32} style={{ marginBottom: 8 }}>
          In-network request queue
        </ScoutDisplayTitle>
        <p style={{ fontSize: T.bodySm, color: color.muted, margin: 0 }}>Introduction and send-profile requests from clients.</p>
      </div>
      <section>
        <h2 className={adminSectionLabel}>Queue</h2>
        <AdminNetworkRequestsPanel />
      </section>
    </div>
  );
}
