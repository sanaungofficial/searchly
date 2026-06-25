import { DashboardCoachShell } from "@/components/scout/dashboard-coach-shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardCoachShell>{children}</DashboardCoachShell>;
}
