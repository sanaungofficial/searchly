import { NetworkingLayoutClient } from "./networking-layout-client";

export default function NetworkingLayout({ children }: { children: React.ReactNode }) {
  return <NetworkingLayoutClient>{children}</NetworkingLayoutClient>;
}
