# Marketing Phase A — header + reusable CTA primitives

## Intent

Refresh the existing calm marketing header without changing its information architecture into another busy landing-page nav.

Approved desktop hierarchy:

`QuoteCore+` → whitespace → `Sign in` → **`+ Try the demo`** → menu.

Approved mobile hierarchy:

`QuoteCore+` → **`+ Demo` / `+ Try the demo`** → menu. Sign in moves into the menu.

## Implemented

- Removed the visible `Free Tools`, `App`, and `Get started` button trio from the header. Free Tools stays in the existing menu and the app link is now labelled `Sign in`.
- `Try the demo` links to the existing `/takeoff-demo` route and uses the same orange gradient, dark text, 12px control radius, highlight, hover glow and pressed treatment as the authenticated v2 primary action language.
- Added a reusable marketing button primitive with `primary`, `glass`, and `ghost` variants. This is intended for the future homepage content pass; only the header consumes it in this return.
- Header is almost-solid white at page top. After 18px scroll it transitions to controlled translucent white glass with 18px blur/saturation, a quiet divider and raised shadow.
- Logo hover is deliberately restrained: ~1.8% scale and a small warm drop shadow. Reduced-motion users get no transition.
- Hamburger is a compact square control, not a pill/circle. Menu is a frosted dropdown using the existing marketing destinations.
- Mobile keeps the conversion CTA visible and moves Sign in into the open menu.
- Removed the old AnimatedHero/HeroVideo CSS overrides that forced header transparency independently of the shared header, so BlogHeader owns top-vs-scrolled behavior consistently.

## Explicitly not changed

- Homepage hero copy, current animated text, demo cards, lower homepage sections, Done For You content, pricing/SEO content.
- App/authenticated shell or its button component.
- Demo behavior itself; `/takeoff-demo` retains its existing desktop/mobile behavior.
- Analytics infrastructure. Header demo clicks use the existing generic event emitter only.

## Runtime checks for Gavin

1. Homepage at top: solid/near-solid white header, correct logo, Sign in, + Try the demo, square menu.
2. Scroll 20px+: header becomes translucent/frosted and returns to solid when scrolled back to top.
3. Animated intro: no second transparency rule overrides the shared header.
4. Other marketing pages using `BlogHeader`: header remains sticky and no content is hidden underneath unexpectedly.
5. `Try the demo` opens `/takeoff-demo`; Sign in resolves the existing regional/app URL.
6. Desktop menu opens/closes; Escape closes it; all existing nav destinations remain.
7. Mobile (390px and 320px): logo + demo + menu fit one row; Sign in exists in the open menu; no horizontal overflow.
8. Keyboard focus is visible on logo, Sign in, demo and menu.
9. Reduced motion/transparency and forced-colors fallbacks remain usable.

## Future homepage phase

The next marketing content pass can reuse the new `MarketingButton` glass treatment for secondary actions and the primary variant for Demo/Done For You CTAs. This return deliberately does not restyle the current homepage body because its content/funnel is scheduled for redesign around the new 45-second video, interactive demo and Done For You offer.

## Local verification performed

- Source contract checks passed for CTA destination, scroll threshold, mobile CTA presence, unique menu IDs, v2 gradient/radius values, frosted glass values, restrained logo hover and removal of hero-local transparency overrides.
- Original archive parity check: all 3,503 original paths retained; only `BlogHeader.tsx`, `HeroVideo.tsx`, and `hero/AnimatedHero.tsx` differ from the supplied baseline, plus the new marketing header/button/docs files listed in `CHANGED_FILES.json`.
- A standalone TypeScript syntax attempt reached only missing dependency/type errors (`react`, aliases and CSS-module declarations) because the supplied archive has no `node_modules`; no successful full Next/typecheck/build is claimed here.
- `preview.html` is a static design-state reference only. The running marketing site remains the authoritative visual/runtime gate.
