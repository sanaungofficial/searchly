import { useEffect, useState } from "react";

interface SubscriptionState {
  isPro: boolean;
  status: string | null;
  currentPeriodEnd: string | null;
  usage: { used: number; limit: number | null } | null;
  loading: boolean;
}

export function useSubscription(): SubscriptionState & {
  startCheckout: () => Promise<void>;
  openPortal: () => Promise<void>;
} {
  const [state, setState] = useState<SubscriptionState>({
    isPro: false,
    status: null,
    currentPeriodEnd: null,
    usage: null,
    loading: true,
  });

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((data) => {
        setState({
          isPro: data.isPro ?? false,
          status: data.status ?? null,
          currentPeriodEnd: data.currentPeriodEnd ?? null,
          usage: data.usage ?? null,
          loading: false,
        });
      })
      .catch(() => setState((s) => ({ ...s, loading: false })));
  }, []);

  async function startCheckout() {
    const res = await fetch("/api/stripe/checkout", { method: "POST" });
    const { url } = await res.json();
    if (url) window.location.href = url;
  }

  async function openPortal() {
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const { url } = await res.json();
    if (url) window.location.href = url;
  }

  return { ...state, startCheckout, openPortal };
}
