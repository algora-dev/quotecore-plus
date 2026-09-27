# Integration update — Phase 7 accepted, fresh baseline for the next phase

**Date:** 2026-09-27. **From:** Gavin (integration owner). **Owner verdict:** Phase 7 PASSED owner smoke test (desktop + real device, 15:46).

## New baseline

Commit `0f3758dd`, branch `ux/phase-4`. This tree = your Phase 7 return fully integrated + the additions below. All your drift checks for the next phase anchor to this commit.

## What changed since your Phase 7 baseline (`01fc47e1`)

1. **Your Phase 7 work integrated verbatim** (`c766dd95`) — 181 files, drift-verified against your manifest: zero changes outside it, 181/181 after-hashes matched. Protected spots re-verified post-apply: owner's removed Quotes Resource Library button, catalog-list 190px Actions column, UTF-16 database.types, conversions constants, C59/C60 renderers — all intact.
2. **P7-TEMPLATE-01 implemented by Gavin** (`0f3758dd`): copy-existing quote header is now LIVE. Creator's copy option enables when a source template is selected; build page loads the source via a `copy` query param + existing `loadCustomerQuoteTemplates`; `TemplateBuilder` prefills company name/address/phone/email, footer text and logo URL from the source row; save is unchanged (creates a NEW template). No schema/action changes. Do NOT re-introduce the "unavailable" notice or rework this flow without owner approval.
3. **Marketing lane landed in the same tree** (commits `2e9bf3df`, `b42e7797`, `a9c7bcf4`, `1b90d9d6`): marketing-only scope — public marketing pages (`app/(marketing)/**`, root marketing components incl. new `ThreeWaysToWork.tsx`), factual cleanup + commercial repositioning + an em-dash sweep. **This surface is OUT OF SCOPE for the UX loop** — a separate agent lane owns it. Expect marketing files in the tree; leave them alone.
4. **Integration notes on your return:** before-hash convention reconciled (your raw-byte CRLF hashes vs canonical compare — full-tree walk was the authoritative check, all clean). 5 react-hooks rule findings in your modified files were accepted as intentional patterns (P7-D05 pathname reset, loading-flag-before-fetch) and documented — do not "fix" them by restructuring working behaviour.

## Standing invariants (owner-locked, not authorised to regress)

- `catalog-list.tsx` 190px dedicated Actions column and the removed Quotes-list Resource Library button.
- `app/lib/supabase/database.types.ts` is UTF-16 LE — edit tools corrupt it. Do not touch.
- `app/lib/conversions.ts` constants are truncated by design. Never "fix".
- C59/C60 recipient renderers, q-mark.png, MainQCP, shell edge tab + notification polling logic.
- Message template kinds/defaults and invoice template fields are protected contracts (P7-D03/D04) — source truth, not the earlier approximate audit.
- Orders menu keeps its 6 legacy states. Do not trim to the 2-enum.
- Visible marketing copy: NO em dashes (owner directive, house style).

## Loop protocol (unchanged, REV 2)

You source-check and self-verify; Gavin runs tsc/lint/build + drift gates at integration. Return = full zip, `quotecore-plus/` wrapper, `START_HERE_RETURN.md` at root, `FILE_CHANGES.json` with before/after hashes (raw or canonical — declare which), decisions + runtime checklist in `docs/ux/phase-<n>/`.
