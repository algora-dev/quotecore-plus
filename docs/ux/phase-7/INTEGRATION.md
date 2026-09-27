# Gavin — integrate Phase 7

## Start here

This is a full source return with **actual Phase 7 production changes**. Do not mistake the preserved incoming `HANDOFF.md`, old Phase 6 docs or historical Smart Assistant notes for the return's completion state.

Read `RETURN_NOTES.md`, `DECISIONS.md`, `FILE_CHANGES.json`, `CAPABILITY_PARITY.md`, then `RUNTIME_CHECKLIST.md` and `AGENT_TODOS.md`.

Baseline ZIP: `quotecore-plus-phase7-ux-handoff-2026-09-27.zip`. SHA-256: `055e7c83a36f2295e0bd78fa780a96019217ce405bfe2372bd60fe91b6e13d03`. Incoming baseline commit **01fc47e1**, branch `ux/phase-4`. Use that exact base for a three-way merge into your latest branch. The return has no `.git` history and is not a replacement for newer fixes.

## Merge order

1. Read manifest categories. Merge the C64 library scope and C65 mobile-return components, BackButton and the tiny shell insertion/CSS. Preserve all original shell mode/mark/tab/notification logic.
2. Merge Resources/new libraries plus legacy-list redirects and specialised template editors. Original template actions/schemas remain. Keep the two quote subtypes and complete invoice fields.
3. Merge Pricing Library, suppliers and Inbox presentation. Inspect controls and fields against capability ledger. No action-payload migration is required.
4. Merge the authorised carryover changes in Quotes/new-quote/create-invoice/catalogue/onboarding/signup/paywall; supplied price values govern display only.
5. Copy docs and integrate UX-standard v2.8. Do not deploy historical or static specimens as product routes.

## Protected / drift

The exact baseline-file inventory is bundled in `validation/baseline-sha256.json`. Source-invariant report covers 965 protected paths, including all app/lib/API/actions plus engine/renderers/config/dependencies. All originals are retained. `FILE_CHANGES.json` includes SHA-256 before/after values for every changed/added file except its own self-reference. Unlisted old paths should match the baseline; newer changes are yours to preserve.

Explicitly inspect `q-mark.png`, MainQCP, shell edge tab, notification polling, `catalog-list.tsx`'s 190px Actions column, removed Quotes Resource button, UTF-16 database.types, conversion constants and C59/C60 recipient renderers. These are not authorised to regress.

## Build / runtime

Per REV 2, this environment did not install dependencies or run `npx tsc`/Next build. Run your locked dependency-complete baseline and return checks, changed-file lint, real TypeScript and Next production build. Fix integration/type issues without silently widening functional scope.

Test all items in `RUNTIME_CHECKLIST.md` with approved fixtures. No live data writes should be inferred from our specimens. Use actual mobile devices and the real C27/C53 modal stack; browser-generated static layout screenshots are only layout references.

## Template caution

Earlier discussion inaccurately described message kinds as Quote/Invoice/Order/All and invoice templates as payment-only. Actual source is preserved: General (`custom`), quote/order/followup/decline kinds; all company templates available in all Send flows, one company default. Invoice already includes header/footer/payment/notes/terms. Do not 'correct' implementation back to a nonexistent enum or narrow invoice fields.

Success-only template refresh is intentional for new library freshness. It is not polling and must never be moved into shell notification effects.
