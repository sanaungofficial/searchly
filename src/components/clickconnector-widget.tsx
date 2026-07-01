"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";

const WIDGET_ID = "5efd60-6hvno";

function splitName(fullName: string | null | undefined): {
  firstName?: string;
  lastName?: string;
} {
  const trimmed = fullName?.trim();
  if (!trimmed) return {};
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function applyBottomLeftPosition() {
  const styleId = "kimchi-clickconnector-position";
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    .cc-widget-outer-container {
      right: auto !important;
      left: 16px !important;
    }
  `;
  document.head.appendChild(style);
}

async function resolveProfileName(): Promise<string | null> {
  try {
    const res = await fetch("/api/profile", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { name?: string | null };
    return data.name?.trim() || null;
  } catch {
    return null;
  }
}

export function ClickConnectorWidget() {
  const identifiedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;
    let unsubscribeAuth: (() => void) | undefined;

    async function identifyLoggedInUser(
      ChatWidget: typeof import("@clickconnector/widget-sdk").ChatWidget,
      userId: string,
      email: string | undefined,
      profileName: string | null,
    ) {
      if (identifiedUserIdRef.current === userId) return;

      const { firstName, lastName } = splitName(profileName);

      await ChatWidget.waitForWidgetReady().catch(() => undefined);
      if (cancelled) return;

      ChatWidget.identify({
        id: userId,
        firstName,
        lastName,
        primaryEmail: email,
      });
      identifiedUserIdRef.current = userId;
    }

    async function syncAuth(
      ChatWidget: typeof import("@clickconnector/widget-sdk").ChatWidget,
    ) {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;

      if (!user) {
        if (identifiedUserIdRef.current) {
          ChatWidget.resetSession();
          identifiedUserIdRef.current = null;
        }
        return;
      }

      const profileName = await resolveProfileName();
      if (cancelled) return;

      await identifyLoggedInUser(
        ChatWidget,
        user.id,
        user.email ?? undefined,
        profileName,
      );
    }

    void (async () => {
      const { ChatWidget } = await import("@clickconnector/widget-sdk");
      await ChatWidget.load(WIDGET_ID);
      if (cancelled) return;

      applyBottomLeftPosition();

      await syncAuth(ChatWidget);
      if (cancelled) return;

      const supabase = createClient();
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (cancelled) return;
        if (session?.user) {
          void (async () => {
            const profileName = await resolveProfileName();
            if (cancelled) return;
            await identifyLoggedInUser(
              ChatWidget,
              session.user.id,
              session.user.email ?? undefined,
              profileName,
            );
          })();
          return;
        }

        ChatWidget.resetSession();
        identifiedUserIdRef.current = null;
      });

      unsubscribeAuth = () => subscription.unsubscribe();
    })();

    return () => {
      cancelled = true;
      unsubscribeAuth?.();
    };
  }, []);

  return null;
}
