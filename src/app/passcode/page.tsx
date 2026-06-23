"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <div style={{
      minHeight: "100vh",
      background: "#F2EDE3",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
    }}>
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.15em", color: "#1A3A2F", marginBottom: 4 }}>
          KIMCHI
        </div>
        <div style={{ fontSize: 11, color: "#6B7280", letterSpacing: "0.08em" }}>BY SECOND LADDER</div>
      </div>

      <div style={{
        background: "#fff",
        borderRadius: 16,
        padding: "40px 48px",
        boxShadow: "0 2px 24px rgba(0,0,0,0.07)",
        textAlign: "center",
        width: 320,
        animation: shaking ? "shake 0.4s ease" : undefined,
      }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: "#1A3A2F", marginBottom: 8 }}>
          Enter passcode
        </div>
        <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 28 }}>
          This is an early preview. Enter your code to continue.
        </div>

        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={code}
          onChange={e => { setCode(e.target.value); setError(false); }}
          onKeyDown={onKey}
          autoFocus
          placeholder="••••"
          style={{
            width: "100%",
            textAlign: "center",
            fontSize: 28,
            letterSpacing: "0.3em",
            padding: "12px 16px",
            border: `2px solid ${error ? "#EF4444" : "#E5E7EB"}`,
            borderRadius: 10,
            outline: "none",
            color: "#1A3A2F",
            background: "#FAFAFA",
            boxSizing: "border-box",
            marginBottom: 8,
          }}
        />

        {error && (
          <div style={{ fontSize: 12, color: "#EF4444", marginBottom: 12 }}>
            Incorrect passcode. Try again.
          </div>
        )}

        <button
          onClick={submit}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "12px",
            background: "#1A3A2F",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Continue →
        </button>
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
