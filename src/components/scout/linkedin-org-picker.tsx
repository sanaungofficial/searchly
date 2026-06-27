"use client";

import React, { useEffect, useRef, useState } from "react";
import { CompanyLogo } from "./company-logo";
import type { LinkedInOrgRef } from "@/lib/linkedin-profile";

export type OrgSuggestItem = {
  id: string | null;
  catalogSlug: string;
  name: string;
  website: string | null;
  careersUrl: string | null;
  logoUrl: string | null;
  type: string | null;
  source: "catalog" | "intel" | "hirebase";
};

function suggestToOrgRef(item: OrgSuggestItem): LinkedInOrgRef {
  return {
    name: item.name,
    slug: item.catalogSlug,
    logoUrl: item.logoUrl,
    website: item.website,
    source: item.source,
  };
}

function formatMeta(item: OrgSuggestItem): string {
  if (item.type) return item.type;
  if (item.source === "hirebase") return "Job index";
  if (item.website) {
    try {
      return new URL(item.website.startsWith("http") ? item.website : `https://${item.website}`).hostname.replace(/^www\./, "");
    } catch {
      return item.website;
    }
  }
  return "";
}

type Props = {
  value: string;
  orgRef?: LinkedInOrgRef | null;
  placeholder: string;
  onChange: (name: string, ref: LinkedInOrgRef | null) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  inputStyle?: React.CSSProperties;
  logoSize?: number;
  showLogo?: boolean;
  hintLabel?: string;
};

export function LinkedInOrgPicker({
  value,
  orgRef,
  placeholder,
  onChange,
  onFocus,
  onBlur,
  inputStyle,
  logoSize = 48,
  showLogo = true,
  hintLabel = "company",
}: Props) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<OrgSuggestItem[]>([]);
  const [picked, setPicked] = useState<OrgSuggestItem | null>(null);
  const [searching, setSearching] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const needsMatch = Boolean(value.trim()) && !orgRef?.logoUrl && !picked?.logoUrl;

  useEffect(() => {
    if (!open) return;
    if (!value.trim()) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/companies/suggest?q=${encodeURIComponent(value.trim())}`);
        if (res.ok) {
          const data: OrgSuggestItem[] = await res.json();
          setSuggestions(data);
        } else {
          setSuggestions([]);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [value, open]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const displayLogoUrl = orgRef?.logoUrl ?? picked?.logoUrl ?? null;
  const displayWebsite = orgRef?.website ?? picked?.website ?? null;
  const displayName = value.trim() || orgRef?.name || picked?.name || "";

  function choose(item: OrgSuggestItem) {
    setPicked(item);
    onChange(item.name, suggestToOrgRef(item));
    setOpen(false);
  }

  function openSearch() {
    setOpen(true);
  }

  return (
    <div ref={wrapRef} style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: 0, flex: 1 }}>
      {showLogo && (
        <CompanyLogo
          name={displayName || placeholder}
          website={displayWebsite}
          logoUrl={displayLogoUrl}
          size={logoSize}
          borderRadius={0}
        />
      )}
      <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value, null);
            setPicked(null);
          }}
          onFocus={() => onFocus?.()}
          onBlur={() => onBlur?.()}
          style={inputStyle}
        />
        {needsMatch && !open && (
          <p style={{ margin: "6px 0 0", fontFamily: "system-ui, sans-serif", fontSize: 12, color: "rgba(0,0,0,0.55)", lineHeight: 1.4 }}>
            No logo yet —{" "}
            <button
              type="button"
              onClick={openSearch}
              style={{
                padding: 0,
                border: "none",
                background: "none",
                color: "#0a66c2",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "inherit",
              }}
            >
              search for this {hintLabel}
            </button>
          </p>
        )}
        {open && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              background: "#fff",
              border: "1px solid rgba(0,0,0,0.12)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
              zIndex: 50,
              maxHeight: 280,
              overflowY: "auto",
            }}
          >
            <div style={{ padding: "8px 12px", borderBottom: "1px solid #f3f2ef", fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
              {searching ? "Searching…" : suggestions.length ? "Pick a match to add the logo" : "No matches — keep typing or use the name as entered"}
            </div>
            {suggestions.map((item) => (
              <button
                key={`${item.catalogSlug}-${item.id ?? item.source}`}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(item);
                }}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  gap: 10,
                  textAlign: "left",
                  padding: "10px 12px",
                  border: "none",
                  borderBottom: "1px solid #f3f2ef",
                  background: picked?.catalogSlug === item.catalogSlug ? "#eef3f8" : "#fff",
                  cursor: "pointer",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                <CompanyLogo
                  name={item.name}
                  website={item.website}
                  logoUrl={item.logoUrl}
                  size={32}
                  borderRadius={0}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(0,0,0,0.9)" }}>{item.name}</div>
                  {formatMeta(item) && (
                    <div style={{ fontSize: 12, color: "rgba(0,0,0,0.6)", marginTop: 2 }}>{formatMeta(item)}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
