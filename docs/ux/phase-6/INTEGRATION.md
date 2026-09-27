# Phase 6 — Integration instructions

## Read order and provenance

Read root `RETURN_NOTES.md`, this file, `DESIGN_CHANGES.md`, `AGENT_TODOS.md`, then `FILE_CHANGES.json`, `VALIDATION.md` and `RUNTIME_CHECKLIST.md`. The original `HANDOFF.md` is unchanged as provenance. Its legacy styling requirement is superseded only by the owner's P6-D01 approval. Its green build requirement is still a **release gate**, not a result claimed here; the owner approved proceeding with source work when installation was unavailable.

Baseline archive: `quotecore-plus-phase6-ux-handoff-2026-09-27.zip`. Hash: `3dd0d92e8b0e2010e90b527c82fee5983c9c56e65d088e788b190e4dcc5eeb75`. Supplied provenance: `4106026a`, `ux/phase-4`. Source export contains no `.git` history. All 2,797 original paths are retained. Only the enumerated application and documentation files differ; see manifest and integrity report for exact hashes.

## Merge, do not overwrite

1. Preserve a clean copy of the original handoff ZIP as the merge ancestor. `baseline/source/` also contains LF-normalized original source for the 58 modified application files for review, not import into production.
2. Merge the 60 application changes (58 modified, two new) against the current integrated branch. Respect Gavin's subsequent edits. Import the new `QcJourney.tsx` and `qc-journeys.css` together; do not replace existing v2 primitives with older UX ZIP snapshots.
3. `PasswordField` and `TaxEditor` receive optional `appearance="v2"`. Default legacy behavior is retained. Only reviewed Phase 6 call sites opt in. Audit any newer call sites during merge.
4. `BillingPanel` adds only `context?: 'account' | 'activation'`; paywall supplies activation. It changes labels, not entitlement/plan/checkout behavior. Keep every existing active-subscription/portal/dunning/plan-change guard.
5. The shared send trigger/modal and attachment picker are presentation updates for their existing per-entity configuration. Do not homogenize modes, token strategy or attachment sources.
6. Keep existing QcDialog/C27 and QcHostedDialog/C53 source from the integrated baseline. C63 composes them, not a replacement overlay manager. The new journey scope is local, never wrap the global shell or touch workspace in it.
7. Update Phase 6 docs and the standard together. Historical Phase 5/Smart Assistant notes remain evidence, not the current change manifest.

## C63 dialog integration points

`QcJourneyDialog` is mounted only where the legacy owner already renders its overlay. Feature state/callbacks remain in that owner. It uses native modal focus containment and body scroll locking from C27. No backdrop dismissal is added. Default Escape dismissal is disabled; only flows with an existing close policy pass `onRequestClose`. Retained existing window/key handlers still need real keyboard testing.

C53 scope is enabled **inside** C63 so nested storage/upgrade helpers using C53 join the native top layer. It does not opt the page or another workspace into hosted-dialog behavior. Check nested helpers, body lock release, trigger focus restoration, explicit cancel and pending close rules on desktop and phone.

Two legacy overlays with meaningful backdrop callbacks—catalogue replacement and signup guarantee information—retain those callbacks and overlay ownership, receiving styling only. Browser `alert`/`confirm` calls embedded in existing action handlers also remain; silently rewriting those into asynchronous custom dialogs would change control flow. These are deliberate preservation exceptions, not a claim that every dialog in the application has been rewritten.

## Keep protected areas intact

No changes to `app/lib/**`, API routes, server actions, backend/migrations, configuration/dependencies, cookie/session settings, application gates, pricing/calculation engines, database types, Takeoff/mobile, Assistant, shell navigation, document renderer files or notification refresh logic. No schema/env/flag/workflow change is required.

`QuoteIndexPage.tsx` changes the Quotes branch, not Job Spaces' data contract or workflow. `AccountTabs.tsx` scopes the settings navigation; the QAssistant branch and its preferences are not redesigned. Native business form submissions, validation, handlers and visibility guards remain authoritative.

## Required execution gate in your environment

Install from the unchanged lockfile, then run `npx tsc --noEmit --incremental false`, `npm run build`, relevant existing tests and the manual checklist. Compare against the original baseline in the same environment. Do not count this package's static evaluator as a React/runtime test.

Exercise only approved test records and recipients. Do not send emails, change subscription state, replace catalogues or modify real settings on production data merely to validate presentation. Preview may share production data; use isolated test arrangements for mutations and Stripe.

Report the actual build/typecheck results, tested routes/states, remaining issues and preview URL to Shaun. Do not ship solely because archive/source checks are green.

## Non-compiling evidence files

Baseline inspection copies deliberately end in `.source.txt`; the unchanged tsconfig includes all `.ts` / `.tsx` files recursively. This prevents archived originals from becoming duplicate compilation inputs. The source-check tool reads those text copies explicitly, and the ZIP retains exact original bytes. No tsconfig exclusion or dependency change was needed.
