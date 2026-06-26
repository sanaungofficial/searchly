import { fontSans, border as B, surface, color, displayTitleStyle } from "@/lib/typography";
import { ScoutBox } from "./scout-box";
import type { JobMeta } from "@/lib/job-meta";
import {
  networkSourceAdminName,
  networkSourceChannelCode,
  networkSourceListingLinkLabel,
} from "@/lib/network-source-labels";

const sans = fontSans;
const line = B.line;

type NetworkRecruiter = NonNullable<JobMeta["networkJob"]>["recruiter"];

function RecruiterMetaChip({ label }: { label: string }) {
  return (
    <span
      style={{
        padding: "5px 10px",
        background: surface.inset,
        border: line,
        borderRadius: "var(--scout-radius)",
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
        <a href={href} target="_blank" rel="noopener noreferrer" style={{ fontFamily: sans, fontSize: 14, color: color.forest, fontWeight: 600, textDecoration: "none" }}>
          {value} ↗
        </a>
      ) : (
        <p style={{ fontFamily: sans, fontSize: 14, color: "#2A2218", margin: 0, lineHeight: 1.55 }}>{value}</p>
      )}
    </div>
  );
}

function RecruiterCard({
  recruiter,
  networkJob,
  showDivider = false,
}: {
  recruiter: NonNullable<NetworkRecruiter>;
  networkJob: NonNullable<JobMeta["networkJob"]>;
  showDivider?: boolean;
}) {
  const chips = [
    recruiter.title,
    recruiter.agencyName,
    networkJob.internalView && networkJob.networkId ? `Network ${networkJob.networkId}` : null,
  ].filter(Boolean) as string[];

  return (
    <div style={showDivider ? { paddingTop: 16, marginTop: 16, borderTop: line } : undefined}>
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
          {recruiter.title && (
            <p style={{ fontFamily: sans, fontSize: 14, color: color.muted, margin: "0 0 2px" }}>{recruiter.title}</p>
          )}
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
        {networkJob.internalView && <MetaLine label="Recruiter ID" value={recruiter.externalId} />}
        {recruiter.email && <MetaLine label="Email" value={recruiter.email} href={`mailto:${recruiter.email}`} />}
        {recruiter.phone && <MetaLine label="Phone" value={recruiter.phone} href={`tel:${recruiter.phone}`} />}
        {recruiter.linkedInUrl && (
          <MetaLine label="LinkedIn" value="View profile" href={recruiter.linkedInUrl} />
        )}
      </div>
    </div>
  );
}

export function JobDrawerRecruiterSection({
  networkJob,
}: {
  networkJob: NonNullable<JobMeta["networkJob"]>;
}) {
  const recruiters =
    networkJob.recruiters?.length
      ? networkJob.recruiters
      : networkJob.recruiter
        ? [networkJob.recruiter]
        : [];

  if (!recruiters.length) {
    return (
      <ScoutBox padding={20}>
        <p style={{ fontFamily: sans, fontSize: 14, color: color.muted, margin: 0 }}>
          No recruiter profile linked to this network posting yet.
        </p>
      </ScoutBox>
    );
  }

  return (
    <ScoutBox padding={20}>
      <p style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: color.muted, margin: "0 0 8px" }}>
        Recruiters{recruiters.length > 1 ? ` (${recruiters.length})` : ""}
      </p>
      {recruiters.length > 1 && (
        <p style={{ fontFamily: sans, fontSize: 13, color: color.mutedLight, margin: "0 0 8px", lineHeight: 1.5 }}>
          Tip: If you do not personally know the contacts below, look for a shared connection on LinkedIn for a warm introduction.
        </p>
      )}

      {recruiters.map((recruiter, index) => (
        <RecruiterCard
          key={recruiter.externalId}
          recruiter={recruiter}
          networkJob={networkJob}
          showDivider={index > 0}
        />
      ))}

      {networkJob.internalView && networkJob.fee && (
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
  if (!networkJob.internalView || !networkJob.adminDetails.length) return null;

  return (
    <ScoutBox padding={20} flat style={{ marginBottom: 22, background: "rgba(196,168,106,0.06)" }}>
      <p style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: color.muted, margin: "0 0 14px" }}>
        Internal · {networkJob.source ? `${networkSourceChannelCode(networkJob.source)} (${networkSourceAdminName(networkJob.source)})` : "network posting"} details
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px 24px" }}>
        {networkJob.adminDetails.map(({ label, value }) => (
          <div key={label}>
            <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: color.muted, margin: "0 0 4px" }}>{label}</p>
            <p style={{ fontFamily: sans, fontSize: 14, color: "#2A2218", margin: 0, lineHeight: 1.5, wordBreak: "break-word" }}>{value}</p>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 16 }}>
        {networkJob.applyUrl && (
          <a
            href={networkJob.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: color.forest, textDecoration: "none" }}
          >
            Apply now ↗
          </a>
        )}
        {(networkJob.listingUrl || networkJob.topEchelonUrl || networkJob.sourceUrl) && (
          <a
            href={networkJob.listingUrl ?? networkJob.topEchelonUrl ?? networkJob.sourceUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: color.forest, textDecoration: "none" }}
          >
            {networkJob.source
              ? networkSourceListingLinkLabel(networkJob.source)
              : "Partner listing ↗"}
          </a>
        )}
      </div>
    </ScoutBox>
  );
}
