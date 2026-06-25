"use client";

import { useEffect, useRef, useState } from "react";
import { color, fontSans } from "@/lib/typography";

const SCRIPT_SRC =
  "https://cdn.jsdelivr.net/npm/@nylas/react@latest/dist/cdn/nylas-scheduling/nylas-scheduling.es.js";

type Props = {
  configurationId: string;
  minHeight?: number;
};

export function NylasSchedulerEmbed({ configurationId, minHeight = 520 }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    async function mount() {
      try {
        if (!hostRef.current) return;

        if (!customElements.get("nylas-scheduling")) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector(`script[data-nylas-scheduler="1"]`);
            if (existing) {
              existing.addEventListener("load", () => resolve(), { once: true });
              existing.addEventListener("error", () => reject(new Error("script error")), { once: true });
              return;
            }
            const script = document.createElement("script");
            script.type = "module";
            script.src = SCRIPT_SRC;
            script.dataset.nylasScheduler = "1";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load Nylas scheduler"));
            document.head.appendChild(script);
          });
          await customElements.whenDefined("nylas-scheduling");
        }

        if (cancelled || !hostRef.current) return;
        hostRef.current.innerHTML = "";

        const el = document.createElement("nylas-scheduling");
        el.setAttribute("configuration-id", configurationId);
        el.setAttribute("default-language", "en");
        el.setAttribute(
          "scheduler-api-url",
          process.env.NEXT_PUBLIC_NYLAS_API_URI ?? "https://api.us.nylas.com",
        );
        hostRef.current.appendChild(el);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    mount();
    return () => {
      cancelled = true;
    };
  }, [configurationId]);

  if (status === "error") {
    return (
      <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, padding: 16 }}>
        Could not load the booking calendar. Please try again or use the external booking link.
      </p>
    );
  }

  return (
    <div>
      {status === "loading" && (
        <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, padding: "8px 0 12px" }}>
          Loading availability…
        </p>
      )}
      <div ref={hostRef} style={{ minHeight, width: "100%" }} />
    </div>
  );
}
