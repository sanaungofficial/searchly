import { MarketInsightsProvider } from "@/contexts/market-insights-context";

export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return <MarketInsightsProvider>{children}</MarketInsightsProvider>;
}
