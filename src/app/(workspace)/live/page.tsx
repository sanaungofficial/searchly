import { WorkspaceLive } from "@/components/scout/workspace-live";

export default function LivePage() {
  const showBeta = process.env.NEXT_PUBLIC_SHOW_BETA === "true";
  if (!showBeta) return null;
  return <WorkspaceLive />;
}
