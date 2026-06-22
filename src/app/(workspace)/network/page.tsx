import { WorkspaceNetwork } from "@/components/scout/workspace-network";

export default function NetworkPage() {
  const showBeta = process.env.NEXT_PUBLIC_SHOW_BETA === "true";
  if (!showBeta) return null;
  return <WorkspaceNetwork />;
}
