import { useEffect, useState } from "react";

interface SubscriptionState {
  isPro: boolean;
  isAdmin: boolean;
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
    isAdmin: false,
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
          isAdmin: data.isAdmin ?? false,
          status: data.status ?? null,
          currentPeriodEnd: data.currentPeriodEnd ?? null,
          usage: data.usage ?? null,
          loading: false,
        });
      })
      .catch(() => setState((s) => ({ ...s, loading: false })));
  }, []);

  async function startCheckout() {
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? "Failed to start checkout. Please try again.");
      }
    } catch (e) {
      alert("Network error. Please try again.");
    }
  }

  async function openPortal() {
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? "Failed to open billing portal. Please try again.");
      }
    } catch (e) {
      alert("Network error. Please try again.");
    }
  }

  return { ...state, startCheckout, openPortal };
}
