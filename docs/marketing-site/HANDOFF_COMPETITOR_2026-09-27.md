# QuoteCore+ — Marketing V3: Competitor Pages Handoff (external agent)

**Baseline commit:** `a9c7bcf4` (branch `ux/phase-4`). This zip is that tree plus ONLY this handoff doc. All drift checks anchor here.
**Date:** 2026-09-27. **From:** Gavin (integration owner). **Owner:** Shaun.

## Read first (in order)

1. `docs/marketing-site/HANDOFF_2026-09-27.md` — the original marketing brief (architecture, writable surface, product truth). Still applies.
2. `docs/marketing-site/PHASE2_CORE_REPOSITIONING.md` — the V2 positioning model.
3. `docs/marketing-site/RETURN_NOTES_PHASE2.md` — what Phase 2 already changed (12 commercial pages; study the patterns: `ThreeWaysToWork` component usage, mobile-first copy, Assistant wording).

## Your mission

Bring the 7 competitor-alternative pages up to the V2 product positioning, keeping each page's search intent ("X alternative") intact:

- `app/(marketing)/roofr-alternative/page.tsx`
- `app/(marketing)/eagleview-alternative/page.tsx`
- `app/(marketing)/planswift-alternative/page.tsx`
- `app/(marketing)/hover-alternative/page.tsx`
- `app/(marketing)/roofsnap-alternative/page.tsx`
- `app/(marketing)/bluebeam-alternative-for-roofing/page.tsx`
- `app/(marketing)/stack-alternative-for-roofing/page.tsx`
- Plus the shared `components/competitor-pages/competitor-page.tsx` if shared improvements help all pages.

Positioning priorities per page (adapt to what honestly differentiates vs that competitor):

- **Mobile-first workflow** — full measure→quote on phone/tablet is a live differentiator vs desktop-locked tools.
- **Three ways to work** — measure in QuoteCore+ / enter existing measurements / ask Smart Assistant (`components/ThreeWaysToWork.tsx` is available and takes page-specific copy).
- **Measurement → pricing → quote connected** — no re-entry between tools.
- **Smart Assistant = interface, not the product** — retrieval + propose-then-confirm actions only. Never "AI does everything".
- **Paid-only honesty** — paid plans from $19/month, 30-day money-back guarantee, free tools separate. No free-trial claims.

## Honest comparison rules (critical)

1. Do NOT invent competitor facts, pricing or features. Keep existing comparison rows unless clearly false.
2. Preserve the existing `US$2,000/seat/yr` PlanSwift figure unless you can verify it is wrong (then flag in return notes).
3. If unsure about a competitor claim, keep it and flag it in the return notes as an owner decision. Never guess.
4. Keep "what QuoteCore+ does NOT do" honesty sections — they build trust and already exist in this site's voice.

## House style — em dashes are banned in visible copy

Replace any U+2014 (em dash) or U+2013 (en dash) with a spaced hyphen " - " (or restructure the sentence). This applies to ALL copy you write or touch. Owner directive 2026-09-27. The following files are already swept and clean: the 12 Phase 2 pages, `layout.tsx`, `pricing/page.tsx`, `competitor-page.tsx`.

## Hygiene task (do alongside the competitor work)

Sweep ALL other `app/(marketing)/**` pages and root marketing `components/**` for em/en dashes in VISIBLE copy (JSX text, strings rendered to users, metadata descriptions, schema/JSON-LD text). Replace per house style above. Code comments do not matter. Keep a per-file replacement count in the return notes. Do not make any other changes to those pages.

## Hard exclusions (unchanged)

- Root homepage (`app/page.tsx`) — frozen for a later release.
- Free tools (`app/(public)/**`) — any logic; copy only if an em dash appears in it.
- All product/app code, Smart Assistant implementation, billing, middleware, dependencies, routing.
- Pricing VALUES (ours) are owner-locked; presentation may improve.
- `/free-trial` route stays as-is (owner will repurpose it as the demo page in a future phase).
- No "App Demo" claims or links — it is not built.

## Verification loop (REV2 style — no build required from you)

1. Source-level self-check: your diff touches only allowed files; grep your diff for `—`, `–`, `free trial`, `no card required`, `App Demo` (must be zero hits in ADDED lines).
2. If node is available: `node scripts/seo-check.mjs` (no install needed) — report the before/after warning counts.
3. Gavin runs tsc/lint/build and the drift check at integration — your return is rejected if drift appears outside your declared manifest.

## Return format

- Full-source zip with `quotecore-plus/` wrapper.
- `START_HERE_RETURN.md` at zip ROOT.
- `docs/marketing-site/RETURN_NOTES_COMPETITOR.md` (what changed per page, competitor claims flagged, em-dash sweep counts).
- `docs/marketing-site/FILE_CHANGES_COMPETITOR.json` (complete added/modified list).
- Explicit owner decision points — never chosen silently.
