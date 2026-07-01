# Bruddle design system

Bruddle is Kimchi’s neo-brutalist UI layer: sharp corners, ink borders, hard offset shadows, and a purple-forward accent palette. Apply it by wrapping a subtree in `className="bruddle"`. Tokens live in `src/app/globals.css`; components in `src/components/scout/scout-box.tsx` and `src/components/scout/pipeline-tag.tsx`.

---

## Core principles

| Rule | Value | CSS / class |
|------|-------|-------------|
| Corner radius | **0** (sharp) | `.bruddle { --scout-radius: 0px }` |
| Border | **1.5px solid ink** | `var(--scout-border)` → `1.5px solid var(--bruddle-ink)` |
| Default shadow | **3px 3px 0 black** | `var(--scout-shadow-bruddle)` |
| Hover shadow | **5px 5px 0 ink** | `var(--scout-shadow-bruddle-hover)` |
| Button hover lift | **translate(-2px, -2px)** | `.bruddle-btn-hover:hover` |
| Card/chip hover lift | **translate(-1px, -1px)** | `.bruddle-hover-lift`, `.bruddle-card-hover` |
| Page background | Cream surface | `var(--bruddle-surface)` → `#FAF4F0` |
| Card background | White | `var(--scout-surface)` → `#FFFFFF` |
| Text on fills | Ink | `var(--bruddle-ink)` → `#161616` |

Shadow colors: **black** `#000000` for default offset shadow; **white** `#FFFFFF` only when stacking on dark fills (e.g. removable tag X outline on black).

Reduced motion: all Bruddle hover transforms are disabled under `prefers-reduced-motion: reduce`.

---

## Color tokens

### Primary

| Name | Hex | RGB | CSS variable |
|------|-----|-----|--------------|
| Purple (base) | `#AE7AFF` | 174, 122, 255 | `--bruddle-purple` |
| Purple hover / medium | `#9966F0` | 153, 102, 240 | `--scout-cta-hover` |
| Purple muted / dark tint | `rgba(174,122,255,0.35)` | — | `--scout-cta-muted` |
| Purple subtle / light tint | `rgba(174,122,255,0.08)` | — | `--scout-cta-subtle` |

Primary CTA fill aliases: `--scout-cta` → `--bruddle-purple`; CTA text: `--scout-cta-foreground` → `--bruddle-ink`.

### Secondary fills

| Name | Hex | RGB | CSS variable |
|------|-----|-----|--------------|
| Yellow | `#FAE8A4` | 250, 232, 164 | `--bruddle-cream` |
| Green | `#98E9AB` | 152, 233, 171 | `--bruddle-green` |
| Red | `#E99898` | 233, 152, 152 | `--bruddle-red` |
| Gray | `#5F646D` | 95, 100, 109 | `--bruddle-gray` |

### Surface fills

| Name | Hex | RGB | CSS variable |
|------|-----|-----|--------------|
| White | `#FFFFFF` | 255, 255, 255 | `--scout-surface` (inside `.bruddle`) |
| Cream | `#FAF4F0` | 250, 244, 240 | `--bruddle-surface` |
| Black / ink | `#161616` | 22, 22, 22 | `--bruddle-ink` |

### Shadows

| Token | Value |
|-------|-------|
| `--scout-shadow-bruddle` | `3px 3px 0 #000000` |
| `--scout-shadow-bruddle-hover` | `5px 5px 0 var(--bruddle-ink)` |

---

## Typography

Inside `.bruddle`:

| Role | Size | Variable / token |
|------|------|------------------|
| Body (primary) | **16px** | `--type-body`, `type.body` |
| Secondary / caption | **14px** | `--type-body-sm`, `type.bodySm` |
| Labels | **12px** | `--type-label`, `type.label` |
| UI font | Roboto Flex | `--font-ui` |
| Display / headings | Newsreader | `--font-display`, `bruddleHeadingStyle()` |

Heading scale (Newsreader, weight 400): h1 48 → h6 18. See `src/lib/typography.ts`.

Outside `.bruddle`, Kimchi uses the warm parchment palette (10px radius, soft shadows) — forest/gold sidebar brand colors remain separate from Bruddle CTAs.

---

## Tag palette

Pipeline tags (`PipelineTag`, `pipelineTagStyles`) support six colors × two variants. All tags use **1.5px ink border**, **4px radius** (slightly rounded chips — exception to zero-radius cards), ink text unless noted.

| Color key | Solid bg | Light bg | Notes |
|-----------|----------|----------|-------|
| `purple` | `--bruddle-purple` | `rgba(174,122,255,0.14)` | Default accent |
| `green` | `--bruddle-green` | `rgba(152,233,171,0.28)` | |
| `gray` | `#F0ECE6` | `rgba(95,100,109,0.08)` | Light variant uses gray text `#5F646D` |
| `salmon` (red) | `--bruddle-red` | `rgba(233,152,152,0.22)` | |
| `yellow` | `--bruddle-cream` | `rgba(250,232,164,0.55)` | |
| `black` | `#161616` | `rgba(22,22,22,0.06)` | Solid: cream text `#FAF4F0` |

### Tag modifiers

| Prop | Behavior |
|------|----------|
| `variant="light"` / `"solid"` | Tint vs full fill (see table) |
| `removable` + `onRemove` | **×** button on the left; `removeVariant="fill"` (ink bg) or `"outline"` (cream border) |
| `dot` | 6px purple circle before label (`--bruddle-purple`) |
| `count` | Purple square badge with cream text |

Compact mode: 11px type, tighter padding — for dense pipeline rows.

---

## Component patterns

### ScoutBox

Bordered surface on cream page. Uses `var(--scout-border)`, `radius.box` (0 inside Bruddle). Shadow off when `flat`; stronger when `stack`. Clickable boxes get `bruddle-card-hover`.

```tsx
<div className="bruddle">
  <ScoutBox padding={20}>…</ScoutBox>
</div>
```

Helpers: `ScoutInsetBox`, `scoutFieldStyle`, `scoutInsetChipStyle`, `ScoutLabel`.

### Buttons

| Component | Fill | Hover class |
|-----------|------|-------------|
| `ScoutPrimaryBtn` | Purple + ink text + offset shadow | `bruddle-btn-hover` |
| `ScoutSecondaryBtn` | White (active: ink + white text) | `bruddle-btn-hover` when inactive |
| `ScoutGoldBtn` | Gold (legacy Kimchi accent) | `bruddle-btn-hover` |

Shared CTA style (`scoutPrimaryCtaStyle`):

```
background: var(--scout-cta)
color: var(--scout-cta-foreground)
border: var(--scout-border)
box-shadow: var(--scout-shadow-bruddle)
```

### Tags

```tsx
<PipelineTag label="Referral" color="green" variant="light" dot />
<PipelineTag label="Urgent" color="salmon" variant="solid" removable onRemove={…} />
```

Color picker swatches: `PipelineTagColorSwatch` — selected state adds `2px 2px 0 #161616` shadow.

---

## Scoping checklist

1. Wrap root in `className="bruddle"` (e.g. opportunities pipeline, job drawer).
2. Use CSS vars (`--bruddle-*`, `--scout-*`) — not hard-coded hex — for fills that should track theme.
3. Add `bruddle-btn-hover` to interactive buttons; `bruddle-card-hover` to clickable cards.
4. Forest (`#1A3A2F`) / gold (`#E8D5A3`) are **sidebar / legacy Kimchi brand** — not Bruddle primary fills.

---

## Related files

| File | Purpose |
|------|---------|
| `src/app/globals.css` | `.bruddle` scope + token definitions |
| `src/lib/typography.ts` | Type scale, colors, `bruddleHeadingStyle` |
| `src/components/scout/scout-box.tsx` | ScoutBox, button primitives |
| `src/components/scout/pipeline-tag.tsx` | Tag palette + `PipelineTag` |
| `src/lib/opportunities-jobright-tokens.ts` | Jobright list skin (separate from Bruddle) |
