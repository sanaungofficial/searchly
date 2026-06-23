import { useCallback, useEffect, useState } from "react";
import type { CreditBalance } from "@/lib/credits";
import { CREDITS_CHANGED_EVENT } from "@/lib/credits";

interface SubscriptionState {
  isPro: boolean;
  isAdmin: boolean;
  status: string | null;
  currentPeriodEnd: string | null;
  credits: CreditBalance | null;
  /** @deprecated use credits */
  usage: { used: number; limit: number | null } | null;
  loading: boolean;
}

export function useSubscription(): SubscriptionState & {
  startCheckout: () => Promise<void>;
  openPortal: () => Promise<void>;
  refresh: () => Promise<void>;
} {
  const [state, setState] = useState<SubscriptionState>({
    isPro: false,
    isAdmin: false,
    status: null,
    currentPeriodEnd: null,
    credits: null,
    usage: null,
    loading: true,
  });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/subscription");
      const data = await res.json();
      if (!res.ok) return;
      setState({
        isPro: data.isPro ?? false,
        isAdmin: data.isAdmin ?? false,
        status: data.status ?? null,
        currentPeriodEnd: data.currentPeriodEnd ?? null,
        credits: data.credits ?? null,
        usage: data.usage ?? null,
        loading: false,
      });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onCreditsChanged = () => {
      refresh();
    };
    window.addEventListener(CREDITS_CHANGED_EVENT, onCreditsChanged);
    return () => window.removeEventListener(CREDITS_CHANGED_EVENT, onCreditsChanged);
  }, [refresh]);

  async function startCheckout() {
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? "Failed to start checkout. Please try again.");
      }
    } catch {
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
    } catch {
      alert("Network error. Please try again.");
    }
  }

  return { ...state, startCheckout, openPortal, refresh };
}
