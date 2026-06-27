"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

type LocationSuggestion = {
  id: string;
  label: string;
  value: string;
  subtitle?: string;
};

type LocationAutocompleteInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  locationHint?: string | null;
  fieldBorder?: string;
  fieldBg?: string;
  textColor?: string;
  textSecondary?: string;
  labelColor?: string;
};

export function LocationAutocompleteInput({
  value,
  onChange,
  placeholder = "Start typing a city…",
  locationHint,
  fieldBorder = "1.5px solid rgba(26,58,47,0.2)",
  fieldBg = "#FFFFFF",
  textColor = "#1A3A2F",
  textSecondary = "rgba(26,58,47,0.55)",
  labelColor = "rgba(26,58,47,0.55)",
}: LocationAutocompleteInputProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const hintAppliedRef = useRef(false);

  useEffect(() => {
    if (hintAppliedRef.current || value.trim() || !locationHint?.trim()) return;
    hintAppliedRef.current = true;
    onChange(locationHint.trim());
  }, [locationHint, onChange, value]);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void fetch(`/api/location/suggest?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((data: { suggestions?: LocationSuggestion[] }) => {
          setSuggestions(data.suggestions ?? []);
          setHighlight(0);
        })
        .catch(() => {
          if (!controller.signal.aborted) setSuggestions([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const pickSuggestion = useCallback(
    (suggestion: LocationSuggestion) => {
      onChange(suggestion.value);
      setOpen(false);
      setSuggestions([]);
      inputRef.current?.blur();
    },
    [onChange],
  );

  const useCurrentLocation = useCallback(() => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("Location is not supported in this browser.");
      return;
    }

    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void fetch(
          `/api/location/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}`,
        )
          .then(async (res) => {
            if (!res.ok) throw new Error("reverse failed");
            const data = (await res.json()) as { suggestion?: LocationSuggestion };
            if (data.suggestion?.value) {
              onChange(data.suggestion.value);
              setOpen(false);
            } else {
              setGeoError("Could not resolve your city — try typing it instead.");
            }
          })
          .catch(() => {
            setGeoError("Could not detect location — try typing your city.");
          })
          .finally(() => setGeoLoading(false));
      },
      () => {
        setGeoLoading(false);
        setGeoError("Location permission denied — type your city instead.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, [onChange]);

  const showDropdown = open && suggestions.length > 0;

  return (
    <div ref={containerRef}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "stretch" }}>
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <input
            ref={inputRef}
            type="text"
            value={value}
            placeholder={placeholder}
            autoComplete="off"
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls={listboxId}
            aria-autocomplete="list"
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
              setGeoError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
                setHighlight((i) => Math.min(i + 1, Math.max(suggestions.length - 1, 0)));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && showDropdown && suggestions[highlight]) {
                e.preventDefault();
                pickSuggestion(suggestions[highlight]!);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            style={{
              width: "100%",
              minHeight: 48,
              padding: "11px 14px",
              border: fieldBorder,
              borderRadius: "var(--scout-radius)",
              background: fieldBg,
              fontFamily: "var(--font-ui)",
              fontSize: 16,
              fontWeight: 500,
              color: value ? textColor : textSecondary,
              outline: "none",
              boxSizing: "border-box",
            }}
          />

          {showDropdown && (
            <ul
              id={listboxId}
              role="listbox"
              style={{
                position: "absolute",
                zIndex: 100,
                top: "calc(100% + 6px)",
                left: 0,
                right: 0,
                margin: 0,
                padding: 6,
                listStyle: "none",
                background: "#FFFFFF",
                border: "1px solid rgba(26,58,47,0.16)",
                borderRadius: "var(--scout-radius)",
                boxShadow: "0 8px 24px rgba(26,58,47,0.12)",
                maxHeight: 240,
                overflowY: "auto",
              }}
            >
              {suggestions.map((item, index) => (
                <li key={item.id} role="option" aria-selected={index === highlight}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickSuggestion(item)}
                    onMouseEnter={() => setHighlight(index)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      border: "none",
                      borderRadius: 8,
                      background: index === highlight ? "rgba(26,58,47,0.06)" : "transparent",
                      cursor: "pointer",
                      fontFamily: "var(--font-ui)",
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 600, color: textColor }}>{item.label}</div>
                    {item.subtitle && (
                      <div style={{ fontSize: 12, color: textSecondary, marginTop: 2 }}>{item.subtitle}</div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={geoLoading}
          style={{
            minHeight: 48,
            padding: "0 14px",
            border: fieldBorder,
            borderRadius: "var(--scout-radius)",
            background: fieldBg,
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            fontWeight: 600,
            color: textColor,
            cursor: geoLoading ? "wait" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {geoLoading ? "Detecting…" : "Use my location"}
        </button>
      </div>

      {(loading || geoError || locationHint) && (
        <p
          style={{
            marginTop: 8,
            marginBottom: 0,
            fontFamily: "var(--font-ui)",
            fontSize: 12,
            color: geoError ? "#C4574A" : labelColor,
            lineHeight: 1.45,
          }}
        >
          {geoError ??
            (loading
              ? "Searching cities…"
              : locationHint && value === locationHint.trim()
                ? `Prefilled from your resume: ${locationHint}`
                : null)}
        </p>
      )}
    </div>
  );
}
