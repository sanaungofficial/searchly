import { OpportunitiesLayoutShell } from "./opportunities-layout-shell";

/** Keeps pipeline/network UI mounted across nested routes so job drawers do not remount on URL updates. */
export default function OpportunitiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OpportunitiesLayoutShell>{children}</OpportunitiesLayoutShell>;
}
