"use client";

import React, { useEffect, useState } from "react";

const STEPS = [
  "Reading your resume…",
  "Pulling out your experience…",
  "Drafting your headline…",
  "Writing your About section…",
  "Turning bullets into paragraphs…",
  "Ranking searchable skills…",
  "Finalizing the preview…",
];

export function LinkedInGenerateLoader({ active }: { active: boolean }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [visible, setVisible] = useState(active);

  useEffect(() => {
    if (active) {
      setVisible(true);
      setStepIndex(0);
    } else {
      const t = setTimeout(() => setVisible(false), 400);
      return () => clearTimeout(t);
    }
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setStepIndex((i) => (i + 1) % STEPS.length);
    }, 2800);
    return () => clearInterval(id);
  }, [active]);

  if (!visible) return null;

  return (
    <div
      className={`li-gen-overlay${active ? " li-gen-overlay--in" : " li-gen-overlay--out"}`}
      role="status"
      aria-live="polite"
      aria-label="Generating LinkedIn profile"
    >
      <div className="li-gen-card">
        <div className="li-gen-scene">
          <span className="li-gen-spark li-gen-spark--1" aria-hidden />
          <span className="li-gen-spark li-gen-spark--2" aria-hidden />
          <span className="li-gen-spark li-gen-spark--3" aria-hidden />

          <svg
            className="li-gen-mascot"
            viewBox="0 0 160 180"
            width={140}
            height={158}
            aria-hidden
          >
            {/* shadow */}
            <ellipse cx="80" cy="168" rx="36" ry="6" fill="rgba(0,0,0,0.08)" className="li-gen-shadow" />
            {/* body */}
            <rect x="52" y="98" width="56" height="58" rx="18" fill="#1A3A2F" />
            <rect x="58" y="108" width="44" height="36" rx="10" fill="#5fa67f" opacity="0.5" />
            {/* head */}
            <circle cx="80" cy="72" r="38" fill="#FFE8D6" />
            {/* hair - anime-ish swoop */}
            <path
              d="M44 68 C44 38, 68 22, 80 28 C92 22, 116 38, 116 68 C116 52, 100 42, 80 44 C60 42, 44 52, 44 68 Z"
              fill="#2C2419"
            />
            <path d="M116 62 C122 48, 118 36, 108 32" stroke="#2C2419" strokeWidth="8" strokeLinecap="round" fill="none" />
            {/* eyes */}
            <ellipse cx="66" cy="74" rx="7" ry="9" fill="#1A1A1A" className="li-gen-blink" />
            <ellipse cx="94" cy="74" rx="7" ry="9" fill="#1A1A1A" className="li-gen-blink" />
            <circle cx="68" cy="71" r="2.5" fill="#fff" />
            <circle cx="96" cy="71" r="2.5" fill="#fff" />
            {/* blush */}
            <ellipse cx="58" cy="82" rx="6" ry="3" fill="#FFB4A2" opacity="0.45" />
            <ellipse cx="102" cy="82" rx="6" ry="3" fill="#FFB4A2" opacity="0.45" />
            {/* smile */}
            <path d="M72 88 Q80 94 88 88" stroke="#C45C4a" strokeWidth="2" fill="none" strokeLinecap="round" />
            {/* kimchi badge */}
            <circle cx="118" cy="108" r="16" fill="#E85D4C" className="li-gen-kimchi" />
            <text x="118" y="113" textAnchor="middle" fontSize="14" fill="#fff" fontWeight="700">K</text>
            {/* floating doc */}
            <g className="li-gen-doc">
              <rect x="18" y="52" width="28" height="36" rx="4" fill="#fff" stroke="#0a66c2" strokeWidth="2" />
              <line x1="24" y1="62" x2="40" y2="62" stroke="#dce6f0" strokeWidth="2" />
              <line x1="24" y1="70" x2="38" y2="70" stroke="#dce6f0" strokeWidth="2" />
              <line x1="24" y1="78" x2="36" y2="78" stroke="#dce6f0" strokeWidth="2" />
            </g>
          </svg>
        </div>

        <p className="li-gen-title">Building your LinkedIn profile</p>
        <p className="li-gen-step" key={stepIndex}>
          {STEPS[stepIndex]}
        </p>
        <div className="li-gen-dots" aria-hidden>
          <span className="li-gen-dot" />
          <span className="li-gen-dot" />
          <span className="li-gen-dot" />
        </div>
      </div>

      <style jsx>{`
        .li-gen-overlay {
          position: fixed;
          inset: 0;
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(247, 245, 242, 0.72);
          backdrop-filter: blur(8px);
          transition: opacity 0.35s ease;
        }
        .li-gen-overlay--in {
          opacity: 1;
        }
        .li-gen-overlay--out {
          opacity: 0;
          pointer-events: none;
        }
        .li-gen-card {
          width: min(100%, 360px);
          background: #fff;
          border-radius: 20px;
          border: 1px solid rgba(0, 0, 0, 0.07);
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.12);
          padding: 32px 28px 28px;
          text-align: center;
        }
        .li-gen-scene {
          position: relative;
          height: 170px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
        }
        .li-gen-mascot {
          animation: liGenFloat 2.8s ease-in-out infinite;
        }
        .li-gen-shadow {
          animation: liGenShadow 2.8s ease-in-out infinite;
        }
        .li-gen-doc {
          animation: liGenDoc 2.4s ease-in-out infinite;
          transform-origin: 32px 70px;
        }
        .li-gen-kimchi {
          animation: liGenPulse 1.6s ease-in-out infinite;
        }
        .li-gen-blink {
          animation: liGenBlink 4s ease-in-out infinite;
        }
        .li-gen-spark {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #1A3A2F;
          opacity: 0.7;
        }
        .li-gen-spark--1 {
          top: 24px;
          left: calc(50% - 72px);
          animation: liGenSpark 2s ease-in-out infinite;
        }
        .li-gen-spark--2 {
          top: 40px;
          right: calc(50% - 80px);
          animation: liGenSpark 2s ease-in-out 0.6s infinite;
          background: #0a66c2;
        }
        .li-gen-spark--3 {
          bottom: 20px;
          left: calc(50% + 60px);
          animation: liGenSpark 2s ease-in-out 1.2s infinite;
          background: #E85D4C;
        }
        .li-gen-title {
          font-family: var(--font-display), Georgia, serif;
          font-size: 22px;
          font-weight: 500;
          font-style: italic;
          color: #1a1a1a;
          margin: 0 0 8px;
        }
        .li-gen-step {
          font-family: var(--font-ui), system-ui, sans-serif;
          font-size: 14px;
          color: rgba(0, 0, 0, 0.55);
          margin: 0 0 16px;
          min-height: 20px;
          animation: liGenStepIn 0.45s ease both;
        }
        .li-gen-dots {
          display: flex;
          gap: 6px;
          justify-content: center;
        }
        .li-gen-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #0a66c2;
          animation: liGenDot 1.2s ease-in-out infinite;
        }
        .li-gen-dot:nth-child(2) {
          animation-delay: 0.15s;
        }
        .li-gen-dot:nth-child(3) {
          animation-delay: 0.3s;
        }
        @keyframes liGenFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes liGenShadow {
          0%, 100% { transform: scaleX(1); opacity: 1; }
          50% { transform: scaleX(0.85); opacity: 0.7; }
        }
        @keyframes liGenDoc {
          0%, 100% { transform: translateY(0) rotate(-6deg); }
          50% { transform: translateY(-8px) rotate(4deg); }
        }
        @keyframes liGenPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes liGenBlink {
          0%, 92%, 100% { transform: scaleY(1); }
          96% { transform: scaleY(0.12); }
        }
        @keyframes liGenSpark {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.2; }
          50% { transform: translateY(-12px) scale(1.2); opacity: 0.9; }
        }
        @keyframes liGenStepIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes liGenDot {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
