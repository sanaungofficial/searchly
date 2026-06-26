"use client";

import { useState } from "react";
import {
  DEFAULT_OPEN_DAYS,
  DEFAULT_OPEN_HOUR_END,
  DEFAULT_OPEN_HOUR_START,
  DEFAULT_SCHEDULER_TIMEZONE,
  SCHEDULER_TIMEZONE_OPTIONS,
} from "@/lib/coach-scheduler-settings";
import { border, color, fontMono, fontSans } from "@/lib/typography";

export type CoachSchedulerSettingsValues = {
  schedulerTimezone: string;
  schedulerOpenHourStart: string;
  schedulerOpenHourEnd: string;
  schedulerOpenDays: number[];
  schedulerDurationMinutes: number;
};

type Props = {
  values: CoachSchedulerSettingsValues;
  onSave: (values: CoachSchedulerSettingsValues) => Promise<void>;
  disabled?: boolean;
  compact?: boolean;
};

const DAY_LABELS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 14,
  background: "#fff",
  border: border.line,
  borderRadius: "var(--scout-radius)",
  padding: "8px 10px",
  outline: "none",
  fontFamily: fontSans,
  boxSizing: "border-box",
  color: color.stone,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: color.muted,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontFamily: fontMono,
  marginBottom: 6,
};

export function defaultCoachSchedulerSettings(
  partial?: Partial<{
    schedulerTimezone: string | null;
    schedulerOpenHourStart: string | null;
    schedulerOpenHourEnd: string | null;
    schedulerOpenDays: number[] | null;
    schedulerDurationMinutes: number | null;
  }>,
): CoachSchedulerSettingsValues {
  return {
    schedulerTimezone: partial?.schedulerTimezone?.trim() || DEFAULT_SCHEDULER_TIMEZONE,
    schedulerOpenHourStart: partial?.schedulerOpenHourStart?.trim() || DEFAULT_OPEN_HOUR_START,
    schedulerOpenHourEnd: partial?.schedulerOpenHourEnd?.trim() || DEFAULT_OPEN_HOUR_END,
    schedulerOpenDays: partial?.schedulerOpenDays?.length
      ? [...partial.schedulerOpenDays]
      : [...DEFAULT_OPEN_DAYS],
    schedulerDurationMinutes: partial?.schedulerDurationMinutes ?? 30,
  };
}

export function CoachSchedulerSettingsForm({ values, onSave, disabled = false, compact = false }: Props) {
  const [form, setForm] = useState(values);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggleDay(day: number) {
    setForm((f) => {
      const days = f.schedulerOpenDays.includes(day)
        ? f.schedulerOpenDays.filter((d) => d !== day)
        : [...f.schedulerOpenDays, day].sort((a, b) => a - b);
      return { ...f, schedulerOpenDays: days.length ? days : [day] };
    });
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await onSave(form);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save availability");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 10 : 14 }}>
      <p style={{ margin: 0, fontFamily: fontSans, fontSize: 12, color: color.muted, lineHeight: 1.45 }}>
        Working hours for in-app booking. Nylas also checks the connected calendar for conflicts.
      </p>

      <div>
        <label style={labelStyle}>Timezone</label>
        <select
          value={form.schedulerTimezone}
          disabled={disabled || saving}
          onChange={(e) => {
            setForm((f) => ({ ...f, schedulerTimezone: e.target.value }));
            setSaved(false);
          }}
          style={inputStyle}
        >
          {SCHEDULER_TIMEZONE_OPTIONS.map((tz) => (
            <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
          ))}
          {!SCHEDULER_TIMEZONE_OPTIONS.includes(form.schedulerTimezone as typeof SCHEDULER_TIMEZONE_OPTIONS[number]) && (
            <option value={form.schedulerTimezone}>{form.schedulerTimezone}</option>
          )}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={labelStyle}>Start</label>
          <input
            type="time"
            value={form.schedulerOpenHourStart}
            disabled={disabled || saving}
            onChange={(e) => {
              setForm((f) => ({ ...f, schedulerOpenHourStart: e.target.value }));
              setSaved(false);
            }}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>End</label>
          <input
            type="time"
            value={form.schedulerOpenHourEnd}
            disabled={disabled || saving}
            onChange={(e) => {
              setForm((f) => ({ ...f, schedulerOpenHourEnd: e.target.value }));
              setSaved(false);
            }}
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Available days</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {DAY_LABELS.map((day) => {
            const active = form.schedulerOpenDays.includes(day.value);
            return (
              <button
                key={day.value}
                type="button"
                disabled={disabled || saving}
                onClick={() => toggleDay(day.value)}
                style={{
                  padding: "6px 10px",
                  fontFamily: fontSans,
                  fontSize: 12,
                  fontWeight: 600,
                  border: active ? `1px solid ${color.forest}` : border.line,
                  background: active ? "rgba(45,122,80,0.08)" : "#fff",
                  color: active ? color.forest : color.stone,
                  cursor: disabled || saving ? "default" : "pointer",
                }}
              >
                {day.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Session duration (minutes)</label>
        <input
          type="number"
          min={15}
          max={120}
          step={15}
          value={form.schedulerDurationMinutes}
          disabled={disabled || saving}
          onChange={(e) => {
            setForm((f) => ({
              ...f,
              schedulerDurationMinutes: Math.min(120, Math.max(15, Number(e.target.value) || 30)),
            }));
            setSaved(false);
          }}
          style={{ ...inputStyle, maxWidth: 120 }}
        />
      </div>

      {error && (
        <p style={{ margin: 0, fontFamily: fontSans, fontSize: 12, color: "#b45309" }}>{error}</p>
      )}
      {saved && !error && (
        <p style={{ margin: 0, fontFamily: fontSans, fontSize: 12, color: color.forest }}>
          Availability updated — seekers will see new slots.
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={disabled || saving}
        style={{
          padding: "10px 14px",
          background: color.forest,
          color: color.gold,
          border: border.lineStrong,
          fontFamily: fontSans,
          fontSize: 13,
          fontWeight: 600,
          cursor: disabled || saving ? "wait" : "pointer",
          alignSelf: "flex-start",
        }}
      >
        {saving ? "Saving…" : "Save availability"}
      </button>
    </div>
  );
}
