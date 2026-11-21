---
version: 1
slug: "src-app-app-page-tsx"
primary_target: "src/app/(app)/page.tsx"
related_targets: []
---

## Scope

Nueva venta (`/`): the door and bar sale screen with its payment panel. Mode: Operate. First surface of the Sello UV world; every other screen inherits from it.

## Audience, task, constraints

- Door staff selling entries (General, VIP, mesas, preventa) with buyer name + CI; bar staff selling drinks fast. Phones and shared tablets in dark, loud venues; owner on laptop.
- Task: pick items, take buyer data when entries are present, choose payment method, save. Seconds per sale, one hand.
- Keep every flow, feature and Spanish label as they are. Not playful, not dense.

## Direction contract

THESIS: Getting in is a stamp. The screen speaks the club door's ink system (wristband colours, the UV hand stamp) instead of the category's grey cards with one blue accent.

OWN-WORLD: Deep blacklight-violet ground, lifted violet surfaces, off-white ink. Flat fluorescent inks with fixed meanings: UV yellow = active/primary action, UV pink and cyan = plan wristband inks (entries vs tables), presale = violet-white. No glow, gradient or grain. Bold grotesk with optical size for UI, a mono for figures, times and codes.

STORY: Staff see which mode they are in, tap plans or products, watch the counted row light in its ink, confirm the total, charge; the saved sale lands a tilted PAGADO stamp with time and amount.

FIRST VIEWPORT: Phone: DEMO mark and time top; Puerta/Barra switch as two large segments; plan rows 76 px tall led by a wristband-ink band with +/− on the right; the live row floods in its ink while others dim; total at display size over a mono caption, Cobrar full width in UV yellow pinned at the bottom.

FORM: Sello UV, grounded candidate 3 of 7 on the re-rolled list; seed:fa6357d2cfa2b6ed. Signature move: the stamp on a saved sale, plus ink-flood selection.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Raises carried from declined challengers

- Flat ink only; fluorescence comes from colour, never light effects (guide map).
- Inks have fixed meanings; one reserved ink marks the active step (orienteering map).
- State changes snap in two quick steps, no floaty easing (acetate manual).
- The row being counted lifts and the rest dim (streaming wall).
- Totals at display scale over small labels (type specimen).

## Unresolved

- Final product name and logo (DEMO is a placeholder).
- Whether light surfaces are ever needed for owner screens in daylight.
