"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RT } from "@/lib/resume-tailor-tokens";

/** Letter-size page height at ~640px width (8.5:11 ratio). */
export const RESUME_PAGE_HEIGHT = 826;

export function TailoredResumePreviewFrame({
  children,
  fitToOnePage = false,
  onToggleFit,
  showFitButton = true,
}: {
  children: React.ReactNode;
  fitToOnePage?: boolean;
  onToggleFit?: () => void;
  showFitButton?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);

  const recalc = useCallback(() => {
    const paper = paperRef.current;
    if (!paper) return;
    const contentHeight = paper.offsetHeight;
    const pages = Math.max(1, Math.ceil(contentHeight / RESUME_PAGE_HEIGHT));
    setPageCount(pages);
    if (fitToOnePage && contentHeight > RESUME_PAGE_HEIGHT) {
      setScale(Math.max(0.55, RESUME_PAGE_HEIGHT / contentHeight));
    } else {
      setScale(1);
    }
  }, [fitToOnePage]);

  useEffect(() => {
    recalc();
    const paper = paperRef.current;
    if (!paper || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => recalc());
    ro.observe(paper);
    return () => ro.disconnect();
  }, [recalc, children]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || fitToOnePage) {
      setCurrentPage(1);
      return;
    }
    const onScroll = () => {
      const page = Math.min(pageCount, Math.floor(el.scrollTop / RESUME_PAGE_HEIGHT) + 1);
      setCurrentPage(page);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [pageCount, fitToOnePage]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        borderRadius: 8,
        background: RT.previewBg,
        padding: "16px 16px 44px",
        boxSizing: "border-box",
      }}
    >
      {showFitButton && onToggleFit && (
        <button
          type="button"
          onClick={onToggleFit}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 2,
            padding: "6px 14px",
            background: fitToOnePage ? RT.green : "#FFFFFF",
            color: fitToOnePage ? RT.text : RT.muted,
            border: fitToOnePage ? "none" : `1px solid ${RT.border}`,
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: fitToOnePage ? "0 2px 8px rgba(0,240,160,0.35)" : "0 1px 4px rgba(0,0,0,0.08)",
          }}
        >
          Fit to one page
        </button>
      )}

      <div
        ref={scrollRef}
        style={{
          maxHeight: fitToOnePage ? RESUME_PAGE_HEIGHT : RESUME_PAGE_HEIGHT * 1.15,
          overflowY: fitToOnePage ? "hidden" : "auto",
          overflowX: "hidden",
          borderRadius: 4,
          scrollbarWidth: "thin",
        }}
      >
        <div
          style={{
            transform: scale < 1 ? `scale(${scale})` : undefined,
            transformOrigin: "top center",
            width: scale < 1 ? `${100 / scale}%` : "100%",
            margin: scale < 1 ? "0 auto" : undefined,
          }}
        >
          <div ref={paperRef}>{children}</div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 10,
          left: "50%",
          transform: "translateX(-50%)",
          minWidth: 36,
          height: 28,
          padding: "0 10px",
          borderRadius: 999,
          background: RT.pageBadgeBg,
          color: "#FFFFFF",
          fontSize: 12,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          letterSpacing: 0.3,
        }}
      >
        {currentPage}/{pageCount}
      </div>
    </div>
  );
}
