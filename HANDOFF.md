# QuoteCore+ — External Handoff: Smart Component Creation Flow

**Date:** 2026-11-14
**Base:** commit `15f458c9`, branch `development` (tip of our internal pipeline — all work lands here first)
**Contents:** Full source of the QuoteCore+ app + marketing website (single Next.js repo), lean export.

## What this is

QuoteCore+ is a construction/roofing quoting SaaS: measure roofs, build components, create quotes, send them, track jobs. One Next.js app serves both the product (`app/(auth)/...`) and the marketing site (`app/(marketing)/...`, domain-aware homepage).

**Stack:** Next.js 16 (App Router, server actions) · React 18 · TypeScript (strict) · Tailwind CSS 4 · Supabase (Postgres, auth, RLS) · Fabric.js (takeoff canvas) · jsPDF + html2canvas (PDFs) · Stripe · Vercel.

## Project map (essentials)

```
app/
  (auth)/[workspaceSlug]/   the product app (dashboard, quotes, components, jobs…)
  (marketing)/              marketing site (homepage, blog, pricing, free tools)
  api/                      route handlers
  components/               SHARED components (incl. ui/v2 design primitives)
  lib/                      shared logic (smart-assistant, onboarding, …)
supabase/                   migrations + seeds (DB schema reference)
docs/                       DESIGN_SYSTEM.md is the design authority
```

## Your target: the Smart Component creation flow

Users create reusable "Smart Components" (materials + labour + pricing rules) in their library and add them to quotes. Key files:

| File | Role |
|---|---|
| `app/(auth)/[workspaceSlug]/components/actions.ts` | Server actions: create/update component, quota caps ("N smart components in total"), Smart Assistant call-name validation |
| `app/(auth)/[workspaceSlug]/components/page.tsx` | Components page (server) |
| `app/(auth)/[workspaceSlug]/components/component-list.tsx` | Client list; mounts the editor |
| `app/(auth)/[workspaceSlug]/components/parts/` | Type-specific fields + helpers |
| `app/(auth)/[workspaceSlug]/components/components/` | AddFromCatalogModal, PublishLibraryModal, etc. |
| `app/components/CreateSmartComponentModal.tsx` | Create modal (used from quote builder) |
| `app/components/pricing/SmartComponentEditor.tsx` | The editor UI |
| `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/AddFromLibrary.tsx` | "Add Smart Component" in the quote builder |
| `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/ExpandableComponent.tsx` | Component rows in quote builder |
| `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/GuidedQuoteSetup.tsx` | Guided flow (choose saved component → enter measurement) |
| `app/lib/smart-assistant/access.server.ts` | Feature gating for Smart Assistant call names |

`component_libraries` / supplier published libraries interact with this flow (`catalog-actions.ts`, `AddFromCatalogModal.tsx`); the "Default component library" is pre-select only, NON-restrictive.

## Design standard — MANDATORY

**Read `docs/DESIGN_SYSTEM.md` first (the Phase 6/7 "v2" section is current).** Build on the v2 primitives in `app/components/ui/v2/` (`QcButton`, `QcLinkButton`, `QcDialog`, …, marked `data-qc-ui="v2"`) and CSS vars from `app/components/ui/v2/qc-tokens.css`.

Hard rules:
- Controls are **rounded-corner SQUARES, never full-round pills**. Radius tokens: control 12px (`--qc-radius-control`), small 8px, card 16px, dialog 20px.
- Primary button: orange gradient `linear-gradient(135deg,#FF641F 0%,#FF8A3D 55%,#FFB36B 100%)` with `#191B20` text. Secondary: near-black `#191F27`, light text. Ghost: transparent, orange hover.
- Icons: Heroicons outline, 24x24, `fill="none" stroke="currentColor" strokeWidth={2}`. Never 20px solid-fill icons.
- When unsure, copy patterns from existing v2 surfaces (e.g. `DemoShellToggle.tsx`) — do not guess, and never reintroduce `rounded-full` controls.

## Setup & validation

- Node 20+ (we build on 24), then `npm install`.
- **No secrets are included — by design.** Do NOT attempt to connect to live Supabase/Stripe; use dummy env values if a local build needs names present (grep `process.env` for the var names). No live database access is expected or wanted for this work.
- Validate your work with `npx tsc --noEmit` and ESLint scoped to the files you change. `npm run build` may need dummy env vars to pass — that's fine.
- Server actions return `{ ok, code, message }` — keep that contract.

## Constraints

1. Scope your changes to the Smart Component creation flow (files above + anything they directly require).
2. Do NOT touch auth, billing/Stripe logic, or DB schema (`supabase/migrations`).
3. No new npm dependencies unless justified in CHANGES.md.
4. No drive-by refactors/reformats of unrelated files, no renames.

## How to hand the work back

Return a zip with the **same folder structure containing ONLY the files you changed or added**, plus a `CHANGES.md` at the root listing every file and a one-line what/why for each. A unified diff against this base is also acceptable. We will review, integrate onto the current tip, build, and deploy through our pipeline.

## Exclusions from this export (not needed for this work)

`public/Main clip for site.mp4`, `docs/visual-acceptance/`, `docs/sa-visual-2026-09-29/`, `docs/visual-references/` were removed to keep the zip lean. If your change somehow depends on one of them, flag it in CHANGES.md.
