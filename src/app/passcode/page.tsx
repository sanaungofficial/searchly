"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { KimchiBySecondLadder, ScoutPrimaryBtn } from "@/components/scout/scout-box";
import { bruddleHeadingStyle, color, fontSans, surface, displayTitleStyle } from "@/lib/typography";
import { sanitizeReturnPath } from "@/lib/auth-return-url";

function PasscodeForm() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(false);

    try {
      const res = await fetch("/api/passcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
        credentials: "same-origin",
      });

      if (!res.ok) {
        setError(true);
        setShaking(true);
        setCode("");
        setTimeout(() => setShaking(false), 500);
        return;
      }

      const next = sanitizeReturnPath(searchParams.get("next"));
      const destination = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
      window.location.assign(destination);
    } catch {
      setError(true);
      setShaking(true);
      setCode("");
      setTimeout(() => setShaking(false), 500);
    } finally {
      setSubmitting(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") submit();
  };

  return (
    <div
      className="bruddle"
      style={{
        minHeight: "100vh",
        background: surface.page,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: fontSans,
        padding: "32px 16px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div style={{ ...displayTitleStyle(22), color: color.forest, marginBottom: 4 }}>Kimchi</div>
        <KimchiBySecondLadder fontSize={12} color={color.muted} />
      </div>

      <div
        style={{
          background: surface.card,
          border: "var(--scout-border)",
          padding: "40px 32px",
          textAlign: "center",
          width: "100%",
          maxWidth: 320,
          animation: shaking ? "shake 0.4s ease" : undefined,
          boxSizing: "border-box",
        }}
      >
        <h1 style={{ ...bruddleHeadingStyle("h4"), marginBottom: 8 }}>Almost there.</h1>
        <p style={{ fontSize: 13, color: color.muted, marginBottom: 28, lineHeight: 1.5 }}>
          Kimchi is in early access. Enter your code to get in.
        </p>

        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(false);
          }}
          onKeyDown={onKey}
          autoFocus
          placeholder="••••"
          disabled={submitting}
          style={{
            width: "100%",
            textAlign: "center",
            fontSize: 28,
            letterSpacing: "0.3em",
            padding: "12px 16px",
            border: error ? "1px solid #C4574A" : "var(--scout-border)",
            borderRadius: "var(--scout-radius)",
            outline: "none",
            color: color.ink,
            background: surface.inset,
            boxSizing: "border-box",
            marginBottom: 8,
            fontFamily: fontSans,
          }}
        />

        {error && (
          <div style={{ fontSize: 12, color: "#C4574A", marginBottom: 12 }}>
            That&apos;s not it. Try again.
          </div>
        )}

        <ScoutPrimaryBtn
          onClick={submit}
          disabled={submitting}
          style={{ marginTop: 12, width: "100%", minHeight: 44 }}
        >
          {submitting ? "Checking…" : "Continue →"}
        </ScoutPrimaryBtn>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}

export default function PasscodePage() {
  return (
    <Suspense>
      <PasscodeForm />
    </Suspense>
  );
}
