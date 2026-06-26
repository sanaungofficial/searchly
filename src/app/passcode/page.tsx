"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KimchiBySecondLadder, ScoutPrimaryBtn } from "@/components/scout/scout-box";
import { border, color, fontSans, surface, displayTitleStyle } from "@/lib/typography";

export default function PasscodePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);

  const submit = async () => {
    if (code === "3992") {
      await fetch("/api/passcode", { method: "POST" });
      router.push("/");
      router.refresh();
    } else {
      setError(true);
      setShaking(true);
      setCode("");
      setTimeout(() => setShaking(false), 500);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") submit();
  };

  return (
    <div
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
          border: border.lineStrong,
          padding: "40px 32px",
          textAlign: "center",
          width: "100%",
          maxWidth: 320,
          animation: shaking ? "shake 0.4s ease" : undefined,
          boxSizing: "border-box",
        }}
      >
        <h1 style={{ ...displayTitleStyle(20), marginBottom: 8 }}>Almost there.</h1>
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
          style={{
            width: "100%",
            textAlign: "center",
            fontSize: 28,
            letterSpacing: "0.3em",
            padding: "12px 16px",
            border: error ? "1px solid #C4574A" : border.lineStrong,
            borderRadius: 0,
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

        <ScoutPrimaryBtn onClick={submit} style={{ marginTop: 12, width: "100%", minHeight: 44 }}>
          Continue →
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
