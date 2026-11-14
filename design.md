# Design guide: Octopus-style energy dashboard

This guide describes how to build the household energy dashboard so it *feels* like Octopus Energy's product: a deep indigo night-sky background, candy pink and electric violet accents, round friendly type and plain-English copy. Use it to copy the feel. Do not use it to copy the brand (see [Do not copy](#do-not-copy)).

Researched 13 November 2026. Most values were **measured** from Octopus's live production CSS and from pixel samples of official app screenshots. Values marked **est.** are my own estimates or recommendations.

---

## 1. What the style is, in one paragraph

Octopus's current web design system, and their app, are **dark by default**. The page is a deep indigo (`#180048`, or `#100030` on the marketing site). Content sits in slightly darker or slightly lighter purple panels. There are no heavy shadows: depth comes from stepping between three purples. Text is a very pale cyan-white (`azure`, `#f0ffff`) rather than pure white, and secondary text is a soft lavender grey. The main call to action is a hot pink (`#f050f8`) with dark text. Interactive "selected" states use electric violet (`#5840ff`). Usage charts use light pink bars on the darkest purple, with dashed lavender gridlines. Type is a rounded geometric sans: big, bold numbers and small uppercase labels.

---

## 2. Colour palette

### 2.1 Where the values come from

- **CSS**: these values come from the `:where(:root,:host)` block (the default dark theme) of the live stylesheet on `octopus.energy`. The variable names are obfuscated, so I worked out each value's role from how the site uses it (body background, button classes, card rules and so on). That stylesheet also contains a `.light` theme; its values are listed at the end of this section for reference.
- **Pixel**: these were sampled from official app screenshots on the Octopus blog (`track-my-energy-use`). Wherever both sources exist, the screenshot pixels match the CSS values exactly, which suggests the app and the website share one design system.
- **est.**: a recommendation or an anti-aliased approximation. It was not read directly from a source.

### 2.2 Core surfaces and text (dark theme)

| Token (this project) | Hex | Role | Source |
|---|---|---|---|
| `--background` | `#180048` | Page background in the app; "surface" token on the site | CSS + Pixel |
| `--card` | `#100030` | Chart cards and bottom nav in the app; page background on the marketing site | CSS + Pixel |
| `--muted` | `#2d1a83` | Raised panels (balance card, icon tiles), toggle track, subtle hover fill | CSS + Pixel |
| `--foreground` | `#f0ffff` (`azure`) | Primary text. Octopus uses `azure`, not pure white | CSS + Pixel |
| `--muted-foreground` | `#a49fc8` | Secondary text, axis labels, section headings, disabled text | CSS + Pixel |
| `--border` | `#a49fc8` at 20% (`#a49fc833`) | Hairline dividers and subtle borders | CSS |
| `--lavender` | `#d9ddff` | Pale lilac, used for light chips and highlights in both themes | CSS |

### 2.3 Brand accents

| Token | Hex | Role | Source |
|---|---|---|---|
| `--primary` | `#f050f8` | Main CTA background (with `#100030` text), active nav indicator, pink focus glow | CSS + Pixel |
| `--primary-hover` | `#fa98ff` | Hover and active state for pink buttons; also the electricity bar colour in the app | CSS + Pixel |
| `--secondary` | `#5840ff` | Secondary button background (with `azure` text), selected tab pill, selected segment of a toggle, card header strip, tooltip background | CSS + Pixel |
| `--secondary-hover` | `#6675f6` | Hover for violet buttons | CSS |
| `--primary-disabled` | `#600e6b` | Disabled pink button background (text becomes `#a49fc8`) | CSS |
| (unused here) | `#ff2ffb` | Brighter magenta, used sparingly on the site | CSS |

### 2.4 Status colours

Each status colour on the site has a solid value, a 10% tint (`1a` alpha) for backgrounds, and a 30% tint (`4d`) for borders.

| Token | Solid | Tint background | Role | Source |
|---|---|---|---|---|
| `--success` | `#10c395` | `#10c3951a` | Good news, savings, "you earned more" | CSS |
| `--success-strong` | `#a4ffe8` | | Success text on dark | CSS |
| `--warning` | `#ec8243` | `#ec82431a` | Warnings, peak-time highlights | CSS |
| `--destructive` | `#ff3e68` | `#ff3e681a` | Errors, "you'd have lost money" | CSS |
| `--destructive-soft` | `#ff809b` | | Softer error text on dark | CSS |
| `--info` | `#00c8f8` | `#00c8f81a` | Info notes, links on dark | CSS |
| (reference) | `#ffd862` | | Sunshine yellow, used for illustration and highlights | CSS |
| (reference) | `#ffa26b` | | Light orange | CSS |

### 2.5 Chart colours

| Token | Hex | Use in this dashboard | Source |
|---|---|---|---|
| `--chart-import` | `#f050f8` | Electricity imported from the grid. The app's bars use `#fa98ff`, but that fails the colour-blind separation check against the export cyan (deutan ΔE 7.3), so the dashboard uses the brand pink (ΔE 18.8) | CSS |
| `--chart-export` | `#60f0f8` | Electricity exported to the grid | CSS colour; role is est. |
| `--chart-solar` | `#ffd862` | Solar generation | CSS colour; role is est. |
| `--chart-battery` | `#6675f6` | Battery charge and discharge | CSS colour; role is est. |
| `--chart-flux` | `#f050f8` | Flux tariff series in comparisons | CSS colour; role is est. |
| `--chart-outgoing` | `#00c8f8` | Outgoing Octopus series in comparisons | CSS colour; role is est. |
| `--chart-peak` | `#ec8243` at 10% (`#ec82431a`) | Background band for the 4pm to 7pm peak window | CSS colour; role is est. |
| `--chart-grid` | `#5a537e` | Dashed horizontal gridlines | est. (the app's dashed lines anti-alias to about `#514673` to `#635a85`; `#5a537e` is the matching token from the site palette) |

For reference, the app's gas bars are `#bdf2ff` (Pixel). This dashboard doesn't need gas, so that colour is not a token.

### 2.6 Light theme (reference only, not tokenised)

The site ships a `.light` theme: background `#ffffff`, surface `#fcf8f2` (warm cream), text `#100030`, secondary text `#5a537e`, violet `#5200f7`, darker pink-purple `#9a30b2`, blue `#0050f8`, green `#088730`. The dashboard should be dark-only, like the app. Add a light mode later only if someone in the family asks for one.

---

## 3. Typography

### 3.1 Families

| Use | Octopus | Use in this project |
|---|---|---|
| Everything | **Chromatophore** (custom; served from Octopus's own CDN in weights 300, 400, 400 italic, 500, 800, 900). The stack is `Chromatophore, helvetica, arial, sans-serif` | **Figtree** (Google Fonts), weights 400, 500, 700, 800 |
| Code and IDs | System mono stack | Tailwind's default `font-mono` |

- Chromatophore appears to be proprietary. I found no public foundry listing for it, so **do not load Octopus's font files**.
- Why Figtree: Octopus's own published brand guide (the "Octopus Legacy" sub-brand on Brandpad) names Figtree as the Google Fonts substitute for its brand typeface. It also matches the rounded, geometric, friendly look of the app's type. Reasonable alternatives are Outfit or Plus Jakarta Sans.
- Use `font-variant-numeric: tabular-nums` (Tailwind `tabular-nums`) on every number in stat tiles, tables and axes.

### 3.2 Scale (measured)

The site sets `html { font-size: 62.5% }`, so `1.6rem` = 16px. Below, the sizes are converted to px. All sizes, line heights, weights and tracking are **CSS**. The role names are my mapping (est.).

| Role | Size / line height | Weight | Tracking | Tailwind equivalent |
|---|---|---|---|---|
| Hero number (stat tile, desktop) | 44 / 53 (56 / 67 on the site's largest heading) | 700 | -1% | `text-5xl font-bold tracking-heading` (size close enough) |
| Page title | 36 / 47 | 700 | -1% | `text-4xl font-bold tracking-heading` |
| Section heading | 28 / 37 or 32 / 42 | 500 | -1% | `text-3xl font-medium tracking-heading` |
| Card title | 24 / 32 or 20 / 30 | 500 | normal | `text-2xl` / `text-xl font-medium` |
| Large body / lead | 18 / 29 | 400 | normal | `text-lg leading-relaxed` |
| Body | 16 / 26 | 400 (the marketing site uses 300) | normal | `text-base leading-relaxed` |
| Small / table | 14 / 23 | 400 or 500 | +1% | `text-sm leading-relaxed tracking-label` |
| Caption / axis / label | 12 / 18 to 20 | 400 or 500 | +1% | `text-xs tracking-label` |
| Button | 16 (18 on large) | 500, line height 1.111 | normal | `text-base font-medium leading-none` |

Patterns seen in the app (Pixel):

- **Stat with unit:** a large bold number (`1.69`), a smaller medium unit beside it (`kWh`), and a tiny uppercase muted label underneath (`USED`).
- **Uppercase labels** for date navigation (`3 AUG 2026 - 9 AUG 2026`, `AUGUST 2026`) and stat captions. Use `uppercase text-xs font-medium tracking-label`.
- Sentence case everywhere else, including buttons and headings.

---

## 4. Spacing, layout, radius, borders, shadows, motion

### Spacing (CSS)
- The scale is built on 4px: 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 48, 64 px. This is exactly Tailwind's default spacing (`1` = 4px), so **no custom spacing tokens are needed**.
- Card padding: 16px (`p-4`) on mobile and 24px (`p-6`) on desktop. Gap between cards: 16 to 24px.
- Button padding: 12px by 16px (`py-3 px-4`), or 16px by 20px (`py-4 px-5`) for large buttons.

### Layout (CSS)
- Content max widths on the site: 560, 740, 1140, 1440 px. For the dashboard use `max-w-6xl` (1152px, the nearest Tailwind default to 1140) and centre it.
- Breakpoints on the site: 400, 640, 768, 1024, 1280 px. Tailwind's defaults (`sm` 640, `md` 768, `lg` 1024, `xl` 1280) match, so no custom breakpoints.

### Radius
| Element | Octopus | Tailwind | Source |
|---|---|---|---|
| Buttons, inputs, dropdowns, tooltips | 12px | `rounded-xl` | CSS |
| Cards, dialogs, dropdown panels | 16px | `rounded-2xl` | CSS |
| App chart cards | about 20 to 24px | `rounded-3xl` | est. from screenshots |
| Marketing feature cards | 60px (images inside: 30px) | not needed | CSS |
| Tabs (selected pill), toggles, icon buttons, avatars | fully round | `rounded-full` | CSS + Pixel |
| Chart bars | rounded top, fully rounded caps on thin bars | Recharts `radius={[4,4,0,0]}` or larger | Pixel |

Use `rounded-2xl` for standard cards and `rounded-3xl` for the big chart cards. Tailwind's defaults cover every radius here, so there are no radius tokens.

### Borders (CSS)
- Border width on buttons, inputs and outlined cards is **2px** (`border-2`), which is chunkier than most UIs.
- Outlined cards on the site use a 2px `#5840ff` border, often with a violet header strip.
- Hairline dividers use `--border` (`#a49fc833`), 1px.

### Shadows (CSS)
- On dark surfaces there are effectively **no shadows**. Show elevation by stepping colour: `#180048` page, then `#100030` card, with `#2d1a83` for raised or interactive panels.
- Floating layers (dropdowns, dialogs) use a very soft triple shadow: `0 1px 2px`, `0 4px 8px`, `0 8px 12px`, each at 5% of `#100030`. On dark it is nearly invisible, so Tailwind's `shadow-lg` is close enough. Don't add a shadow token.

### Focus and motion (CSS)
- Focus ring: a 2px outline at 2px offset, coloured `azure` on dark (`focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`).
- Transitions: 200ms with `cubic-bezier(.4, 0, .2, 1)` on colour, background, border and shadow. That is exactly Tailwind's `transition-colors duration-200 ease-in-out`.

---

## 5. Component patterns

### 5.1 Page shell
- `bg-background text-foreground font-sans antialiased`, with a minimum height of the screen.
- Header: the page title on the left, plus a small greeting in plain English ("Evening, here's how today went"). Keep it flat: no gradient, no shadow.
- A thin `border-b border-border` under the header is fine. The app uses colour change rather than lines.

### 5.2 Cards
- Standard card: `bg-card rounded-3xl p-4 md:p-6`.
- Inside a card, group list rows or secondary info in a `bg-background rounded-2xl` inset, as the app does with its tariff rows under charts. Rows are separated by a 1px divider in `muted`.
- Highlight card (for example, the "which tariff wins" verdict): `bg-muted rounded-2xl p-6 text-center`, as the app's balance card does.

### 5.3 Stat tiles
```
[icon in accent colour]  1.69 kWh      [kWh | £] toggle
                         USED
```
- Number: `text-4xl md:text-5xl font-bold tabular-nums tracking-heading`.
- Unit: `text-base font-medium` beside the number, baseline-aligned.
- Label: `text-xs uppercase font-medium tracking-label text-muted-foreground`.
- The small icon on the left takes the series colour (pink for import, cyan for export) so the tile also works as a legend.
- Show deltas as a small chip: `bg-success/10 text-success-strong` for good news and `bg-destructive/10 text-destructive-soft` for bad. Always pair the colour with a word ("12% more than last week") so colour is never the only signal.

### 5.4 Charts (Recharts or similar)
- The chart lives inside a `bg-card` card. The plot area has no background of its own.
- **Bars:** solid `--chart-import` and so on, no gradient, no outline, rounded tops. Bars are thin with generous gaps (about a 40 to 50% gap ratio on day views).
- **Gridlines:** horizontal only, dashed (`strokeDasharray="3 6"`), colour `--chart-grid`. No vertical gridlines.
- **Axes:** no axis lines and no tick marks. Labels are `text-xs` in `--muted-foreground`. The y-axis shows the unit (`kWh` or `£`) as the bottom tick label, as the app does, rather than as a rotated axis title.
- **Import vs export:** plot export as negative bars below the zero line, or as a side-by-side series. Keep import pink and export cyan everywhere: tiles, legends and tables.
- **Peak window (4pm to 7pm):** a `ReferenceArea` filled with `--chart-peak`, plus a small uppercase label "PEAK".
- **Tooltip:** `bg-secondary text-foreground rounded-xl px-3 py-2 text-xs` (the site's tooltips are violet `#5840ff` with 12px radius and 12px text). No border and no shadow. Use the time as the title and one line per series, each with a small colour dot.
- **Lines** (for example, cumulative earnings Flux vs Outgoing): 2 to 3px strokes, round caps, no dots except on hover. Flux is `--chart-flux` and Outgoing is `--chart-outgoing`.
- **Empty or partial data:** dim or omit the missing bars and add a friendly note under the chart ("Your meter hasn't sent today's readings yet. They usually arrive by tomorrow morning.").

### 5.5 Buttons
| Variant | Classes | Source |
|---|---|---|
| Primary | `bg-primary text-primary-foreground border-2 border-primary hover:bg-primary-hover hover:border-primary-hover rounded-xl px-4 py-3 font-medium` | CSS |
| Secondary | `bg-secondary text-foreground border-2 border-secondary hover:bg-secondary-hover hover:border-secondary-hover` (same shape) | CSS |
| Outline | `bg-transparent border-2 border-secondary text-foreground hover:bg-muted` | est. |
| Icon / round | `bg-foreground text-card rounded-full p-1` (the site's carousel arrows), or `hover:bg-muted rounded-full p-2` for quiet icons | CSS |
| Disabled (primary) | `bg-primary-disabled border-primary-disabled text-muted-foreground` | CSS |

- Use one primary pink button per view at most. In a read-only dashboard you may not need one at all.
- Build these with Base UI `Button` plus CVA variants, following the project's stack conventions.

### 5.6 Tabs and toggles (Pixel)
- **Period tabs (Day / Week / Month / Year):** plain text tabs (`text-foreground font-medium`) with no container. The selected tab becomes a large violet pill: `bg-secondary rounded-full px-8 py-2`.
- **Unit toggle (kWh / £):** a segmented pill. The track is `bg-muted rounded-full p-0.5`, and the selected segment is `bg-secondary rounded-full px-2 text-sm`.
- **Date stepper:** chevrons on both sides of an uppercase date label. A disabled chevron (future dates) drops to `text-muted-foreground`.
- **Bottom or side nav:** inactive items `text-muted-foreground`, active item `text-foreground` with a short pink bar (`bg-primary`, about 3px tall, `rounded-full`) above or beside it.

### 5.7 Tables (est.: Octopus has no public data-table pattern, so this extrapolates from their list rows)
- Put the table inside a `bg-card rounded-2xl` card with no outer border.
- Header row: `text-xs uppercase font-medium tracking-label text-muted-foreground`, no background.
- Rows: `py-3`, separated by `border-b border-border`. Hover: `bg-muted/50`.
- Right-align numbers with `tabular-nums`. Units go in the header (`Export (kWh)`), not in every cell.
- To mark the winning tariff in a comparison row, use a `bg-success/10 text-success-strong` chip that says "Better", not just a colour.

### 5.8 Alerts / callouts (CSS)
- Tinted background plus a solid icon: `bg-info/10` with `text-info`, and likewise for success, warning and destructive. `rounded-2xl p-4`. Body text stays `text-foreground`.

---

## 6. Tone of UI copy

Octopus doesn't publish a tone-of-voice guide. Their job ads and help pages, plus third-party analysis, describe the voice as **clear over flowery, warm, lightly playful, never jargon-heavy**. Examples from their help content: "Our energy usage graphs show your energy use in kWh and £." and "Gaps in your usage normally don't last long."

Rules for this dashboard:
- **Talk to the household:** "you" and "your", or "we" for the dashboard itself. "You exported 6.2 kWh today", not "Export volume: 6.2".
- **Plain English first, units second:** "You'd have earned £1.40 more on Flux this week" beats "Δ revenue (Flux - Outgoing): +£1.40".
- **Short sentences, sentence case**, contractions welcome ("you'd", "hasn't").
- **Say what it means.** After a number, add a one-line takeaway where it helps: "That's about a full battery's worth."
- **A light touch of personality, used sparingly:** one friendly greeting or empty-state line per screen at most. Never joke in error messages.
- **Be honest about data gaps.** "We're missing readings for 2pm to 4pm, so this total might be a bit low."
- Use British English and units: kWh, p/kWh, £, 24-hour or "4pm" style times. Write tariff names as the household knows them ("Flux", "Outgoing").

Example strings:
| Situation | Copy |
|---|---|
| Greeting | "Evening! Here's how the house did today." |
| Verdict card | "Flux is ahead this month by £8.20. Peak exports are doing the heavy lifting." |
| Empty state | "No readings yet for today. Your meter usually catches up overnight." |
| Error | "We couldn't reach the energy data just now. Try again in a minute." |
| Tooltip | "4:30pm · Exported 0.8 kWh · Earned 12.8p" |

---

## 7. Tailwind v4 tokens (ready to paste)

Paste this into the global CSS after the `@import` lines. It defines only the tokens this guide uses. Spacing, radius, breakpoints, easing and shadows all come from Tailwind's defaults (see section 4).

```css
@import url("https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;700;800&display=swap");

:root {
  /* Surfaces: elevation comes from stepping purples, not shadows */
  --background: #180048;
  --card: #100030;
  --muted: #2d1a83;

  /* Text: Octopus uses azure rather than pure white */
  --foreground: #f0ffff;
  --muted-foreground: #a49fc8;
  --border: #a49fc833;
  --ring: #f0ffff;

  /* Brand accents */
  --primary: #f050f8;
  --primary-hover: #fa98ff;
  --primary-disabled: #600e6b;
  --primary-foreground: #100030;
  --secondary: #5840ff;
  --secondary-hover: #6675f6;

  /* Status */
  --success: #10c395;
  --success-strong: #a4ffe8;
  --warning: #ec8243;
  --destructive: #ff3e68;
  --destructive-soft: #ff809b;
  --info: #00c8f8;

  /* Charts */
  --chart-import: #f050f8; /* #fa98ff (the app's bar colour) is too close to the export cyan for deutan vision */
  --chart-export: #60f0f8;
  --chart-solar: #ffd862;
  --chart-battery: #6675f6;
  --chart-flux: #f050f8;
  --chart-outgoing: #00c8f8;
  --chart-peak: #ec82431a;
  --chart-grid: #5a537e;
}

@theme inline {
  --font-sans: "Figtree", ui-sans-serif, system-ui, sans-serif;

  /* Octopus headings run at -1%, small labels at +1% */
  --tracking-heading: -0.01em;
  --tracking-label: 0.01em;

  --color-background: var(--background);
  --color-card: var(--card);
  --color-muted: var(--muted);
  --color-foreground: var(--foreground);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-ring: var(--ring);

  --color-primary: var(--primary);
  --color-primary-hover: var(--primary-hover);
  --color-primary-disabled: var(--primary-disabled);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-hover: var(--secondary-hover);

  --color-success: var(--success);
  --color-success-strong: var(--success-strong);
  --color-warning: var(--warning);
  --color-destructive: var(--destructive);
  --color-destructive-soft: var(--destructive-soft);
  --color-info: var(--info);

  --color-chart-import: var(--chart-import);
  --color-chart-export: var(--chart-export);
  --color-chart-solar: var(--chart-solar);
  --color-chart-battery: var(--chart-battery);
  --color-chart-flux: var(--chart-flux);
  --color-chart-outgoing: var(--chart-outgoing);
  --color-chart-peak: var(--chart-peak);
  --color-chart-grid: var(--chart-grid);
}

body {
  @apply bg-background text-foreground font-sans antialiased;
}
```

Notes:
- If shadcn's init generates its own `:root` block (`--card-foreground`, `--popover` and so on), merge these values into it rather than keeping two blocks. Map `--card-foreground` and `--popover-foreground` to `--foreground`, and `--popover` to `--card`.
- Chart libraries that take colour strings can read the tokens with `getComputedStyle(document.documentElement).getPropertyValue("--chart-import")`, or you can pass `var(--chart-import)` straight to SVG `fill` and `stroke`.

### Contrast checks (WCAG ratios, calculated)
- `#f0ffff` on `#100030`: 19.2:1. On `#180048`: 18.1:1.
- `#a49fc8` on `#100030`: 7.9:1. On `#180048`: 7.4:1. Both fine for small text.
- `#100030` on `#f050f8` (primary button): 6.8:1.
- `#f0ffff` on `#5840ff` (secondary button, tooltip): 5.7:1.
- `#5a537e` gridlines on `#100030`: 2.8:1. That is deliberately low contrast and fine for decoration, but never use this colour for text.

---

## 8. Do not copy

The aim is the *feel*: colours, type rhythm, spacing and tone. Nothing in the UI should suggest that this dashboard is an Octopus product.

- **No Octopus logo or wordmark**, and no favicon or app icon that resembles it.
- **No Constantine** (the pink octopus mascot), no tentacle motifs, and no other Octopus illustrations, icons or photography. Their CSS even has a "constantine-porthole" component; don't recreate it.
- **No Octopus brand names as UI chrome.** Don't call the app "Octopus Dashboard", don't use "Octoverse", "Octoplus" or "Kraken" in navigation, and avoid "octo" puns. Tariff names ("Flux", "Outgoing Octopus") may appear as plain data labels where they describe the household's real tariff, because that is factual.
- **Don't load Octopus's font files** (Chromatophore) or hotlink their CDN, stylesheets or images. Use Figtree.
- **Don't copy their marketing copy or taglines.** Write original copy in a similar voice.
- Give the dashboard its own name and a simple, neutral mark (for example, a lightning bolt or sun icon from a standard icon set).
- Use your own icon set (for example Lucide). Octopus's icons are custom.

---

## 9. Sources

Used directly:
- Octopus Energy homepage HTML: https://octopus.energy/ (fetched 13 Nov 2026; button markup and class combinations)
- Octopus production stylesheet: https://octopus.energy/_next/static/immutable/chunks/3s0j4n2bli0ay.css (dark `:root` theme, `.light` theme, type scale, spacing, radius, button and tooltip rules; the hashed filename will change on future deploys)
- Octopus font stylesheet: https://static.octopuscdn.com/fonts/Chromatophore/fonts.min.css (font family name and weights only)
- "Track my energy use" help post: https://octopus.energy/blog/track-my-energy-use/ (chart behaviour and copy)
- App screenshots from that post, pixel-sampled:
  - https://a.storyblok.com/f/275131/425x886/7355a7f3e4/homepage-view.png
  - https://a.storyblok.com/f/275131/425x886/77c26b6094/day-view.png
  - https://a.storyblok.com/f/275131/425x886/17c9df4582/week-view.png
  - https://a.storyblok.com/f/275131/425x886/e1f70ca392/month-view.png
  - https://a.storyblok.com/f/275131/425x886/02acf9ad92/live-view-4.png
- Octopus Legacy brand guidelines (sub-brand; source of the Figtree substitute and the group-level "Core Pink" `#FF71CF` / "Core Purple" `#261842`, which differ from the current web palette): https://brandpad.io/octopus-legacy
- GitHub org `octoenergy`, checked via the API: https://github.com/octoenergy (no public design system or UI token repo; `public-conventions` covers code conventions only)

Tone of voice (seen through search result summaries, not read in full):
- https://jobs.lever.co/octoenergy/94fd9c05-d6c2-4e3f-9b5d-b67992ff3d8b
- https://www.strattoncraig.com/insight/how-digital-copywriting-for-energy-companies-is-driving-change/
- https://octopus.energy/blog/arlo-ai-assistant/
- https://www.cxpartners.co.uk/our-thinking/how-octopus-energy-excel-in-customer-centricity
