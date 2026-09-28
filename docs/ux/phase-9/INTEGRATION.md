# Phase 9 integration

## Read order

Read top-level `START_HERE_PHASE9_RETURN.md`, repository `RETURN_NOTES.md`, original Phase 9 `HANDOFF.md`, and Phase 8 `INTEGRATION_UPDATE.md`. Root `FILE_CHANGES.json` is the complete change manifest. Earlier phase return notes are historical, not the current instructions.

## Merge

1. Use `quotecore-plus-phase9-ux-handoff-2026-09-28.zip` as the common ancestor, not a previous agent-return ZIP.
2. Verify before hashes where your branch has no newer changes. Use a three-way review where it does. Preserve newer marketing and Smart Assistant work.
3. Review `SCOPE.csv`; every production path is classified. The two API routes, nine cache-only actions and `middleware.ts` must receive explicit integration review rather than being mistaken for a broad server refactor.
4. The new Inbox client expects `updatedIds`; deploy its API and client together. An older response fails safely as unconfirmed rather than treating requested count as success.
5. Keep the Next metadata route `app/manifest.ts`; do not add a second public manifest. Check anonymous and signed-in `/manifest.webmanifest` on the deployed canonical host.
6. Run repository TypeScript parity, changed-file lint and full Next build. Fix genuine integration/type issues without changing calculation, ownership or persistence contracts. Review source-only evidence before relying on it.
7. Run `RUNTIME_CHECKLIST.md` with approved fixture records, then deploy for owner desktop and real-phone review.

## Important implementation boundaries

- CSS scopes only adopted drawing/tutorial chrome. No global form reset, canvas transform or CSS scaling of Fabric.
- Drawing page keeps a single mounted canvas. Changing layout does not introduce a second mobile engine or guarantee all desktop gestures on a phone.
- Nested help uses existing C27 native dialogs. QcJourneyDialog retains explicit-close-only semantics where the former dialog had no Escape handler. Loading remains blocking while the existing load controller is active.
- Supplier refresh is a direct successful-action refresh only. It updates library/catalogue lists, not the profile-edit draft. No timers or polling introduced.
- Template actions preserve every mutation/payload/company filter. Dynamic route invalidation includes the `page` type. Existing legacy `/components` invalidation in unrelated statements is preserved and recorded, not silently swept away.
- Inbox `.select('id')` requires real RLS/read policies to return the affected IDs. Test mixed-company/nonexistent IDs and concurrent deletion. The client never infers success from `count`.
- The archive helper still clears source action-required state using its existing transitions. It remains best-effort; an alert success is not a guarantee every source badge updated.
- `/resources/new` still goes to Resources hub. Do not restore the agent's earlier Document Templates redirect.

## Reproduce isolated checks

See `validation/README.md`. Tests need ordinary local Node/TypeScript, Tailwind and Playwright/Chromium in a compatible development environment; they are not a replacement for application E2E or build. No secrets, tokens, test credentials or private records are provided.
