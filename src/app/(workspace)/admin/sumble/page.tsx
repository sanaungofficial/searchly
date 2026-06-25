import { SUMBLE_MCP_TOOLS } from "@/lib/sumble-mcp-catalog";
import { ScoutBox, ScoutDisplayTitle, ScoutLabel } from "@/components/scout/scout-box";
import { adminSectionLabel } from "../admin-styles";
import { color, fontMono, fontSans, type as T } from "@/lib/typography";

const STATUS_COLOR: Record<string, string> = {
  live: "#2A6A4A",
  partial: "#8A6A2A",
  planned: "#6A6A6A",
};

export default function AdminSumblePage() {
  return (
    <div>
      <ScoutDisplayTitle size={28} style={{ marginBottom: 8 }}>
        Sumble MCP tool catalog
      </ScoutDisplayTitle>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 24px", maxWidth: 640, lineHeight: 1.55 }}>
        Reference for agents and admins — maps Sumble v6 API endpoints to Kimchi integration status.
        Kimchi does not run a Sumble MCP server in-app; calls go through server routes with opt-in loading and credit guards.
      </p>

      <h2 className={adminSectionLabel}>Endpoints</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {SUMBLE_MCP_TOOLS.map((tool) => (
          <ScoutBox key={tool.name} padding="14px 16px">
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
              <code style={{ fontFamily: fontMono, fontSize: T.bodySm, color: color.forest, fontWeight: 600 }}>{tool.name}</code>
              <span
                style={{
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  fontWeight: 600,
                  color: STATUS_COLOR[tool.kimchiStatus] ?? color.muted,
                  textTransform: "uppercase",
                }}
              >
                {tool.kimchiStatus}
              </span>
            </div>
            <ScoutLabel>{tool.method} · {tool.endpoint}</ScoutLabel>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, margin: "8px 0 6px", lineHeight: 1.5 }}>
              {tool.description}
            </p>
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0 }}>
              Credits: {tool.creditNotes}
            </p>
          </ScoutBox>
        ))}
      </div>
    </div>
  );
}
