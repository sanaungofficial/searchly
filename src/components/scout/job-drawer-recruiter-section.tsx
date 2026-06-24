import { fontSans, border as B, surface, color, displayTitleStyle } from "@/lib/typography";
import { ScoutBox } from "./scout-box";
import type { JobMeta } from "@/lib/job-meta";

const sans = fontSans;
const line = B.line;

function RecruiterMetaChip({ label }: { label: string }) {
  return (
    <span
      style={{
        padding: "5px 10px",
        background: surface.inset,
        border: line,
        borderRadius: 0,
        fontFamily: sans,
        fontSize: 12,
        fontWeight: 500,
        color: "#5C534A",
      }}
    >
      {label}
    </span>
  );
}

function MetaLine({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: color.muted, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </p>
      {href ? (
        <a href={href} style={{ fontFamily: sans, fontSize: 14, color: color.forest, fontWeight: 600, textDecoration: "none" }}>
          {value} ↗
        </a>
      ) : (
        <p style={{ fontFamily: sans, fontSize: 14, color: "#2A2218", margin: 0, lineHeight: 1.55 }}>{value}</p>
      )}
    </div>
  );
}

export function JobDrawerRecruiterSection({
  networkJob,
}: {
  networkJob: NonNullable<JobMeta["networkJob"]>;
}) {
  const recruiter = networkJob.recruiter;
  if (!recruiter) {
    return (
      <ScoutBox padding={20}>
        <p style={{ fontFamily: sans, fontSize: 14, color: color.muted, margin: 0 }}>
          No recruiter profile linked to this network posting yet.
        </p>
      </ScoutBox>
    );
  }

  const chips = [recruiter.agencyName, networkJob.networkId ? `Network ${networkJob.networkId}` : null].filter(
    Boolean
  ) as string[];

  return (
    <ScoutBox padding={20}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: color.forest,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ fontFamily: sans, fontSize: 16, fontWeight: 700, color: color.gold }}>
            {(recruiter.name || "?").slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div>
          <h4 style={displayTitleStyle(20, { margin: "0 0 4px" })}>{recruiter.name}</h4>
          {recruiter.agencyName && (
            <p style={{ fontFamily: sans, fontSize: 14, color: color.muted, margin: 0 }}>{recruiter.agencyName}</p>
          )}
        </div>
      </div>

      {chips.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {chips.map((c) => (
            <RecruiterMetaChip key={c} label={c} />
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "4px 20px" }}>
        <MetaLine label="TE recruiter ID" value={recruiter.externalId} />
        {recruiter.email && <MetaLine label="Email" value={recruiter.email} href={`mailto:${recruiter.email}`} />}
        {recruiter.phone && <MetaLine label="Phone" value={recruiter.phone} href={`tel:${recruiter.phone}`} />}
        {recruiter.firstName && <MetaLine label="First name" value={recruiter.firstName} />}
        {recruiter.lastName && <MetaLine label="Last name" value={recruiter.lastName} />}
      </div>

      {networkJob.fee && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: line }}>
          <MetaLine label="Placement fee" value={networkJob.fee} />
        </div>
      )}
    </ScoutBox>
  );
}

export function JobDrawerNetworkAdminSection({
  networkJob,
}: {
  networkJob: NonNullable<JobMeta["networkJob"]>;
}) {
  if (!networkJob.adminDetails.length) return null;

  return (
    <ScoutBox padding={20} style={{ marginBottom: 22, background: "rgba(196,168,106,0.06)", borderTop: `3px solid rgba(196,168,106,0.5)` }}>
      <p style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: color.muted, margin: "0 0 14px" }}>
        Internal · network posting details
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px 24px" }}>
        {networkJob.adminDetails.map(({ label, value }) => (
          <div key={label}>
            <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: color.muted, margin: "0 0 4px" }}>{label}</p>
            <p style={{ fontFamily: sans, fontSize: 14, color: "#2A2218", margin: 0, lineHeight: 1.5 }}>{value}</p>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <a
          href={networkJob.topEchelonUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: color.forest, textDecoration: "none" }}
        >
          Open in Top Echelon Big Biller ↗
        </a>
      </div>
    </ScoutBox>
  );
}
