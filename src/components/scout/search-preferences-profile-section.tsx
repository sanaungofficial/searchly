"use client";

import { JOBRIGHT_EXPERIENCE_LEVELS } from "@/lib/search-preferences";
import { ChipToggle } from "./pipeline-filters-ui";
import { fontSans, color, type as T } from "@/lib/typography";

export function SearchPreferencesExperienceEditor({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (labels: string[]) => void;
}) {
  const toggle = (label: string) => {
    const lower = label.toLowerCase();
    if (selected.some((l) => l.toLowerCase() === lower)) {
      onChange(selected.filter((l) => l.toLowerCase() !== lower));
    } else {
      onChange([...selected, label]);
    }
  };

  return (
    <div>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 12px", lineHeight: 1.55 }}>
        Experience levels used to pre-fill Opportunities filters and rank your feed.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {JOBRIGHT_EXPERIENCE_LEVELS.map(({ label }) => (
          <ChipToggle
            key={label}
            label={label}
            active={selected.some((l) => l.toLowerCase() === label.toLowerCase())}
            onClick={() => toggle(label)}
          />
        ))}
      </div>
    </div>
  );
}
