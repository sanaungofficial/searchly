import { WorkspaceCoaching } from "@/components/scout/workspace-coaching";

export default function CoachingPage() {
  const showBeta = process.env.NEXT_PUBLIC_SHOW_BETA === "true";
  if (!showBeta) return null;
  return <WorkspaceCoaching />;
}
