---
name: Nox
description: Sales and payment register for a night venue, in the Sello UV world.
colors:
  background: "#17122b"
  card: "#211a3b"
  popover: "#262044"
  secondary: "#2c2550"
  border: "#382f62"
  scrim: "#0b0817"
  foreground: "#efeaff"
  foreground-2: "#bdb5dc"
  muted-foreground: "#958db5"
  primary: "#e8ff3a"
  primary-foreground: "#17122b"
  ink-pink: "#ff4fb8"
  ink-cyan: "#38e8ff"
  ink-violet: "#c9b8ff"
  success: "#5cf2a4"
  warning: "#ffb547"
  destructive: "#ff5c7a"
  glow-pink: "#ff2fa8"
  glow-violet: "#a24bff"
  glow-indigo: "#6a4dff"
  glow-cyan: "#22d8ff"
  glow-orchid: "#ff5cd0"
typography:
  display:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    letterSpacing: "0.025em"
  mono-caption:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    letterSpacing: "0.1em"
  mono-figure:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    fontFeature: "tnum"
  mono-count:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "22px"
    fontWeight: 700
    fontFeature: "tnum"
rounded:
  sm: "10px"
  md: "12px"
  lg: "14px"
  xl: "18px"
  2xl: "16px"
  full: "9999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  8: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    height: "40px"
    padding: "0 16px"
  button-cta:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.2xl}"
    height: "56px"
    width: "100%"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: "40px"
    padding: "0 16px"
  button-ghost:
    textColor: "{colors.foreground-2}"
    rounded: "{rounded.lg}"
    height: "40px"
    padding: "0 16px"
  input:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: "40px"
    padding: "0 12px"
  segment:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground-2}"
    rounded: "{rounded.2xl}"
    height: "56px"
  segment-on:
    backgroundColor: "{colors.foreground}"
    textColor: "{colors.background}"
  chip:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground-2}"
    rounded: "{rounded.full}"
    height: "36px"
    padding: "0 16px"
  chip-on:
    backgroundColor: "{colors.foreground}"
    textColor: "{colors.background}"
  method-option:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground-2}"
    rounded: "{rounded.md}"
    height: "64px"
  method-option-on:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
  plan-row:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.2xl}"
    padding: "10px 12px 10px 16px"
    height: "76px"
  plan-row-live-pink:
    backgroundColor: "{colors.ink-pink}"
    textColor: "{colors.background}"
  plan-row-live-cyan:
    backgroundColor: "{colors.ink-cyan}"
    textColor: "{colors.background}"
  plan-row-live-violet:
    backgroundColor: "{colors.ink-violet}"
    textColor: "{colors.background}"
  stepper:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    size: "48px"
  stepper-add:
    backgroundColor: "{colors.foreground}"
    textColor: "{colors.background}"
    rounded: "{rounded.md}"
    size: "48px"
  product-tile:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.2xl}"
    padding: "16px"
  product-tile-on:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
  panel:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.2xl}"
---

# Design System: Nox

## Overview

**Creative North Star: "Sello UV"** (getting in is a stamp)

The interface speaks the club door's ink system instead of the category's grey cards with one blue accent: a deep blacklight-violet ground, lifted violet surfaces, off-white text, and a handful of flat fluorescent inks whose meanings never change. Wristband colours mark plans; the UV hand stamp marks a saved sale. Fluorescence comes from colour alone.

It is built for a phone held in one hand in a dark, loud room. Targets are large, the money is always the biggest thing on screen, the main action is pinned under the thumb, and state changes snap in about a tenth of a second. Not playful, not dense. The owner's laptop gets the same world with a sidebar and a side checkout panel.

The app is dark-only (`color-scheme: dark`). Whether daylight owner screens ever need light surfaces is unresolved; do not invent a light theme.

**Key Characteristics:**
- Blacklight-violet ground, tonal violet surfaces, no shadows (one exception: the stamp).
- Five inks with fixed meanings; UV yellow is reserved for the active item and the main action.
- Flat ink only inside the app: no glow, gradients, blur or grain. The one exception is the Door Glow on the sign-in screen.
- Bold optical-size grotesk for the interface, mono for figures, times and codes.
- One-hand, mobile-native operation: pinned primary action, 48px+ targets, safe areas respected.

## Colors

A violet-black ground with flat fluorescent inks, each owning one meaning.

### Primary
- **UV Yellow** (primary): the active item and the main action, nothing else. Cobrar and Guardar, the chosen payment method, a selected bar product, cart counts on the Puerta/Barra switch, the active nav icon and bottom-nav tab, the focus ring, the text caret, the Wordmark's full stop. Text on it is always `primary-foreground` (the ground colour).

### Secondary (wristband inks)
- **Wristband Pink** (ink-pink): single entries (a plan for one person). Also the PAGADO stamp and the Titular icon.
- **Table Cyan** (ink-cyan): tables and multi-person plans (`people_per_unit > 1`).
- **Presale Violet** (ink-violet): presale. The active Preventa toggle, plan rows while selling presale, the presale notice, the PREVENTA stamp.

### Tertiary (status)
- **Paid Green** (success): paid / verified, "Gratis" prices, success toasts.
- **Attention Amber** (warning): needs a look. Pending status, low stock ("quedan" ≤ 10), amount mismatch and duplicate-proof alerts.
- **Void Red** (destructive): voided, errors, sold out, invalid fields, "Vaciar" hover. Kept for errors; do not use it as a plan ink, and do not use ink-pink for errors.

Status fills are tints, not floods: 15% fill + 30% border of the status colour with the status colour as text (badges, danger/ok buttons), 12% fill for alert blocks.

### Neutral
- **Blacklight Ground** (background): page, header, bottom nav, charge bar; also the text colour on any ink flood.
- **Lifted Violet** (card): plan rows, product tiles, segments, the checkout panel, modals.
- **Raised Violet** (secondary): inputs, steppers, secondary buttons, unselected method options, active nav row.
- **Popover Violet** (popover): toasts.
- **Violet Rule** (border): every hairline and section rule.
- **Off-white Ink** (foreground): primary text, and the inverted fill for selected modes and filters.
- **Soft Ink** (foreground-2): secondary text, unselected controls, dimmed names.
- **Muted Ink** (muted-foreground): captions, placeholders, field labels, inactive nav.
- **Scrim** (scrim, at 80%): behind modals.

### Named Rules
**The Fixed Ink Rule.** Each ink means one thing on every screen: yellow = active item / main action, pink = single entry, cyan = table / multi-person, violet = presale, green / amber / red = paid / attention / void-error. Never use an ink decoratively or for a second meaning.

**The One Yellow Rule.** UV yellow marks the single most important action or the item currently in play. Selected modes and filters (Puerta/Barra, category chips) invert to off-white, not yellow; presale selection is violet.

**The Flat Ink Rule.** Colour is applied as solid fills and 1px rules. No glow, no gradients, no blur or backdrop-filter, no grain or texture, no neon text-shadow.

**The Door Glow.** The sign-in screen is the venue door and the one place Nox glows. The light travels rather than sitting still (`.edge-glow` in globals.css): two comets, hot pink and cyan, each with a white-hot head and a fading tail, run clockwise around the screen edges once every 8s, while a violet streak runs the other way every 13s and fades in and out. Between passes the edges go dark, and the intensity wavers slightly, like a light rig being played. Everything fades in over 1.2s, the falloff stays narrow (40-104px) so the light never touches the form, and the motion uses transform and opacity only. Under reduced motion the comets stop and a soft, still frame in the same inks remains. The form, wordmark and button on that screen stay flat. Never bring the glow into working screens, where prices and buttons must stay sharp in a dark venue.

## Typography

**Interface Font:** Bricolage Grotesque, loaded with its `opsz` axis (with ui-sans-serif, system-ui)
**Mono Font:** JetBrains Mono (with ui-monospace)

**Character:** A bold, slightly quirky grotesk that tightens itself at display sizes through optical sizing, paired with a plain mono that makes every number read like a printed ticket.

### Hierarchy
- **Display** (800, 2.25rem, line-height 1, -0.03em, tabular figures): the sale total in the charge bar and the checkout panel. One per view. It is set in the grotesk, not the mono, and always sits on a mono caption.
- **Headline** (700, 1.125rem): modal and sheet titles. Page titles on admin screens use `PageHeader` (600, 1.25rem, tight tracking).
- **Title** (700, 17px, line-height 1.25): plan-row names; 600 at 15px for product tiles and checkout lines; 700 at 16px for the Puerta/Barra segment labels and section heads ("Detalle", "Titular").
- **Body** (400, 0.875rem): supporting text, prices with conditions, hints.
- **Label** (500, 0.75rem, uppercase, 0.025em): form field labels only.
- **Mono caption** (400, 0.75rem, uppercase, 0.1em): live status readouts that carry data ("PUERTA · 4 DENTRO", "1 ÍTEM · 1 PERSONA", "TOTAL"), the header clock.
- **Mono figure** (400, 0.875rem, tabular): prices, line totals, CI, references, promoter codes, dates, amount inputs, "×6" multipliers.
- **Mono count** (700, 22px, tabular): stepper quantities; 700 at 14px inside count pills.

### Named Rules
**The Ticket Figures Rule.** Every money amount, time, quantity, ID number, reference and code is set in mono with tabular figures. The display total is the one figure set in the grotesk (800, tabular).

**The Data-Only Caption Rule.** Mono uppercase captions carry live data or label a figure. They are not decorative eyebrows above headings.

## Layout

- **Phone (default):** single column, 16px side gutter, 20px top padding. Sticky 56px header (Wordmark, clock, admin icons, logout) and a fixed 64px bottom nav, both padded by `env(safe-area-inset-*)`. Main content reserves `6rem + safe-area-bottom` so nothing hides under the nav.
- **md (≥768px):** a 240px sticky sidebar replaces header and bottom nav; gutter becomes 32px.
- **xl (≥1280px):** Nueva venta splits into content plus a 400px sticky checkout panel (`grid-cols-[1fr_400px]`, 32px gap). Below xl the checkout opens as a full-screen sheet from the charge bar.
- **Rhythm:** 8px between sibling rows and tiles, 12-16px between control groups, 20px section padding inside panels. Plan rows are capped at `max-w-2xl` and go two-up only at 2xl; product tiles run 2 / 3 / 4 columns (base / sm / xl).
- Horizontal chip rails scroll edge to edge (`-mx-4 px-4`) with the scrollbar hidden.

### Named Rules
**The Pinned Action Rule.** On phones and tablets the screen's primary action is pinned at the bottom, full width, above the bottom nav and safe area. Inside sheets and panels the save button lives in a sticky footer, so one thumb reaches it on every sale.

## Elevation & Depth

Flat. Depth is tonal: ground (`background`) < lifted (`card`) < raised (`secondary`). Separation comes from tone and 1px `border` rules, never from shadow. The live plan row lifts 2px (`translateY(-2px)`) without a shadow. The modal scrim is a flat 80% `scrim`.

### Shadow Vocabulary
- **Stamp lift** (`box-shadow: 0 12px 40px rgb(11 8 23 / 0.55)`): only under the PAGADO stamp, so it reads as pressed on top of the screen. A dark lift, not a glow. Nowhere else.

### Named Rules
**The No-Nest Rule.** One container level per area. Inside a panel or sheet, sections are split by a top rule (`border-top: 1px border`, 16px above, 20px between sections), never by cards inside cards.

## Shapes

Soft rounded rectangles on one scale (`--radius` 14px): 10 / 12 / 14 / 18px, plus 16px for the large touch surfaces.
- **16px:** plan rows, product tiles, Puerta/Barra segments, the checkout panel, modals on desktop, the bottom sheet's top corners, the 56px CTA.
- **14px:** buttons and inputs (40px tall).
- **12px:** steppers, payment-method options, inner toggle pills, alert and notice blocks.
- **Full:** category chips, count pills, the wristband, the stamp, icon-only close buttons.
- Full-screen sheets on phones have square corners.

## Components

### Buttons
Firm and quick; they press in, never float.
- **Primary:** UV yellow fill, ground-colour text, 14px radius, 40px (sm 32px, lg 48px). Hover `brightness(1.1)`.
- **CTA (Cobrar, Guardar · Bs X):** primary at 56px, full width, 16px radius, 1.125rem bold. Exactly one per view.
- **Secondary:** raised violet with a 1px rule; hover lifts the rule to muted ink. **Ghost:** soft-ink text, hover fills raised violet.
- **Danger / Ok:** status tints (15% fill, 30% border, status-colour text).
- **Press:** `scale(0.97)` with a 100ms ease-out transition of background, colour, border and transform. Disabled is 40% opacity.
- **Focus:** 2px UV yellow outline, 2px offset, on every control.

### Inputs / Fields
- **Style:** raised violet fill, 1px violet rule, 14px radius, 40px tall, muted placeholder. Codes, CI, references, dates and amounts use mono.
- **Focus:** the rule turns UV yellow; no ring glow.
- **Error:** `aria-invalid` keeps the rule red, focused or not. On a failed save the first invalid field scrolls to centre and takes focus; the toast is secondary.
- Labels sit above in the Label role; optional fields say "(opcional)".

### Segments, Chips and Choices
- **Mode switch (Puerta / Barra):** two 56px segments, 16px radius. Selected inverts to off-white fill with ground text; unselected is lifted violet. A yellow mono count pill shows items in the cart for that mode.
- **Toggle pair (En puerta / Preventa):** 36px pills inside a lifted track; "En puerta" selects to raised violet, "Preventa" selects to violet ink.
- **Category chips:** 36px full-round, off-white when selected.
- **Payment method (Cómo pagó):** three 64px options, icon over label, a `radiogroup`; the chosen one floods UV yellow. Press `scale(0.96)`.

### Wristband and Plan Rows (signature)
- **Wristband:** a 16 × 48px full-round band in the plan's ink with a 6px snap dot near the top in the ground colour. It leads every plan row. On a live row it inverts: ground-colour band with an ink snap.
- **Plan row:** 76px minimum, 16px radius, lifted violet. Wristband, then name (Title) with a mono "×N" for multi-person plans, then price and conditions (mono price, "Gratis" in green, "quedan N" amber at ≤10, "agotado" red), then −, mono count, + steppers (48px, 12px radius; + is off-white, − is raised violet and disabled at zero).
- **Live flood:** a row with quantity > 0 floods in its ink (pink / cyan / violet), text turns ground colour, it lifts 2px, and its steppers invert to ground-colour fills.
- **Sold out:** the whole row drops to 40% opacity.

**The Step-Back Rule.** While any row is live, the other rows step back through band and name only: the wristband drops to 35% opacity and the name to soft ink. Their price and stepper controls stay full strength, so the next tap is never harder to see.

### Product Tiles (Barra)
At least 96px tall, 16px radius, 16px padding, lifted violet; name (600, 15px, two lines) over a mono price. A tile with quantity > 0 floods UV yellow (the active item) with a mono count pill top-right in inverted colours. The whole tile is the add target; press `scale(0.97)`.

### Charge Bar
Fixed to the bottom on phones and tablets once the cart has items: ground fill, top rule, sitting above the bottom nav (on md, at the screen bottom beside the sidebar, padded by the safe area). A mono caption summary ("2 ÍTEMS · 3 PERSONAS") left, the Display total right, the Cobrar CTA below. Content reserves 144px of space under it.

### Checkout Panel / Sheet
On xl a sticky 16px-radius panel; below xl a modal with `fullOnMobile` that owns the whole screen on phones. Sections in order (Detalle, Total, presale notice, Titular, Cómo pagó, comprobante and reference, Monto recibido, Más datos, alerts) are split by top rules. The lines list caps at 32vh and scrolls. Optional fields hide behind "Más datos" (chevron rotates 150ms, content fades in 150ms). The Guardar CTA sits in a sticky footer padded by the safe area and repeats the amount.

### PAGADO Stamp (signature moment)
On save the cart clears, the sheet closes, and a 192px round stamp presses onto the centre of the screen: ground fill, 6px ink ring, an inner 2px ring, "PAGADO" (800, 32px) over the time and amount in bold 13px mono on two lines, and "NOX" in 11px mono tracked 0.2em. Pink for a sale, violet with "PREVENTA" for a presale. Tilted -14°, it lands in 420ms `cubic-bezier(0.2, 0, 0, 1)` in two steps (from 1.35 down to 0.96 by 55%, settle to 1), holds, and is gone after 1.8s. It ignores pointer events and is mirrored by a polite live region ("Venta de Bs X guardada"). Reserve the stamp for a completed payment.

### Modals and Sheets
Bottom sheet on phones (top corners 16px, max 92vh), centred dialog on sm+ (16px radius, max-w-md, or 3xl when wide). A sticky 56px title bar with a top-right 40px round close button; content padded 20px. Entrance 200ms ease-out: slide up 2rem and fade on phones, fade with a 0.98 zoom on desktop. Escape and scrim tap close it; the content scrolls with `overscroll-behavior: contain`.

### Navigation
- **Desktop sidebar:** 240px, translucent lifted violet, Wordmark at 24px. Rows 40px, 14px radius; active is raised violet with a medium label and a UV yellow icon. Admin items sit under an "Administración" group label.
- **Phone header:** 56px plus the top safe area, Wordmark at 20px beside the mono clock (24h, La Paz); Productos and Equipo as icon links; logout.
- **Bottom nav:** five 64px tabs (icon 20px over an 11px label), active in UV yellow, padded by the bottom safe area.
- **Wordmark:** the name in 800 grotesk, -0.03em, with a UV yellow full stop.

### Toasts
Sonner, bottom-centre, popover violet with a 1px rule and 14px radius; status-coloured icons (green / yellow info / amber / red). On phones they float 88px plus the safe area above the bottom, clear of the nav and charge bar.

## Do's and Don'ts

### Do:
- **Do** keep every ink to its one meaning (The Fixed Ink Rule); colour new plan types pink if single-person, cyan if multi-person, violet when presale.
- **Do** spend UV yellow only on the main action and the item in play; select modes and filters with the off-white inversion.
- **Do** set money, times, counts, CI, references and codes in JetBrains Mono with tabular figures; set the one display total at 800 grotesk over a mono caption.
- **Do** split sections inside a panel with a 1px top rule and keep one container level.
- **Do** pin the primary action full width at the bottom on phones (56px, 16px radius) and keep sheet save buttons in a sticky footer.
- **Do** use 100ms ease-out for state changes and press feedback (`scale` 0.97 buttons and tiles, 0.98 segments, 0.96 method options, 0.92 steppers); 150ms for disclosures, 200ms for sheet entrances.
- **Do** make touch targets at least 48px for repeated actions (steppers, segments, CTAs, bottom tabs) and never under 40px.
- **Do** keep the mobile-native base: `viewport-fit=cover` with safe-area padding on header, bottom nav, charge bar and sheet footers; `interactive-widget=resizes-content`; `dvh` heights; inputs at 16px minimum; `touch-action: manipulation`; no long-press selection on controls; no tap highlight; `overscroll-behavior: none` on the page and `contain` in scroll areas; theme colour `#17122b`.
- **Do** honour `prefers-reduced-motion` (animations and transitions clamp to 1ms).
- **Do** point at the field to fix on validation errors (red rule, scroll, focus), not only a toast.

### Don't:
- **Don't** add glow, neon text-shadow, gradients, blur, backdrop-filter, grain or textures to working screens. Fluorescence is colour only; the Door Glow on sign-in is the single exception.
- **Don't** add shadows to cards, rows, panels or buttons; the stamp lift is the only shadow.
- **Don't** use UV yellow for decoration, headings, links, selected filters or a second CTA on the same view.
- **Don't** nest cards inside cards or panels.
- **Don't** set figures in the proportional face, or set interface text in the mono.
- **Don't** dim a step-back row's price or steppers; only band and name step back.
- **Don't** use floaty easing, bounces or slow fades; state changes snap.
- **Don't** put mono uppercase eyebrows or kickers above headings; captions carry data.
- **Don't** use the PAGADO stamp for anything but a saved payment.
- **Don't** introduce a light theme or new inks without a decision.
