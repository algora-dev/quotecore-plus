# Phase 6 return — Everyday journeys

**Implemented source candidate; ready for Gavin's merge and testing, not deployed or runtime-approved.**

This package contains Phase 6 production changes, not merely the handoff baseline. Start with `docs/ux/phase-6/INTEGRATION.md` and `FILE_CHANGES.json` in that folder. Examples: `app/components/ui/v2/QcJourney.tsx`, `qc-journeys.css`, QuotesList, InvoiceList, OrderList, SendDocumentModal, catalogue upload/conversion, account settings and auth/billing presentation.

**Baseline:** `quotecore-plus-phase6-ux-handoff-2026-09-27.zip`, SHA-256 `3dd0d92e8b0e2010e90b527c82fee5983c9c56e65d088e788b190e4dcc5eeb75`. The handoff reports commit `4106026a`, branch `ux/phase-4`; the ZIP has no Git history. This return preserves the latest integrated Phases 1–5 and Smart Assistant/Takeoff work in that exact baseline.

## Owner-approved decisions

- P6-D01: use the existing v2 orange-gradient primary, near-black secondary, rounded rectangular controls and visible keyboard focus. Do not bring the old black pill-button rules back into migrated surfaces.
- P6-D02: proceed with source implementation and available checks despite the unavailable locked dependency install. Full application build/typecheck/runtime remain Gavin's release gate. No Linux dependency bundle is requested.
- Keep real order menu/action states: ready, ordered, delivered, paid, pickup and waiting. The handoff's two-value description does not justify deleting four existing choices.

## Implemented

1. Quotes/Drafts, recent Orders and Invoices: consistent hierarchy, labelled small-screen rows, keyboard links, original filters/selection/status/actions and bulk rules.
2. Connecting creation, selection, send/share/follow-up, attachment and confirmation surfaces: common controls, readable choices and scoped native-dialog presentation using existing C27.
3. Catalogue import/conversion: named stages, clearer mapping, selection count including off-filter rows, visible destination and truthful next actions; upload remains distinct from component creation.
4. Existing attachment/logo/drawing-library upload entry points: consistent requirements, controls and real progress/error/storage states; no shared replacement upload engine.
5. Company/account/security/integrations/support/billing: clearer sections and current control standard; subscriptions and settings still use their existing handlers.
6. Login/signup/recovery/onboarding/paywall: calm shared presentation and explicit paid activation journey; no access, authentication, cookie, redirect or Stripe changes.

## Verified and not verified

Syntax/transpilation passed for all 59 changed/new TS/TSX files. Source comparison retains all 463 original event bindings, disabled expressions, audited form/data bindings, uppercase constants and non-JSX function declarations. These are source invariants, not behavioral execution.

16 isolated source-derived fixture states were inspected at 1440, 1024, 390 and 320px (64 layouts): no page-wide overflow, missing accessible names in the rendered controls, background focus escape from native fixture dialogs, unreachable final dialog action, or fixture script errors. These use a custom static JSX evaluator and deterministic hook stubs, NOT React/Next application rendering. Real effects, sends, saves, payments, route transitions and production data were not exercised.

Both before/after `npx --no-install tsc --noEmit --incremental false` and `npm run build` were attempted. Typechecking is blocked by absent dependency types; Next is not installed. Installation failed because the registry was unreachable. No green full build or full typecheck is claimed. See `VALIDATION.md` and actual logs.

## Merge and release

Three-way merge the manifest against the original ZIP and Gavin's current branch. Do not replace newer unrelated fixes. Run dependency-complete typecheck/build and the runtime checklist using approved fixtures, recipients and isolated billing tests. The previous Smart Assistant root return notes are preserved with LF-normalized line endings at `docs/ux/phase-6/baseline/RETURN_NOTES-SMART-ASSISTANT-P17.md`; do not mistake that historical lane for this return.

Takeoff, mobile, Smart Assistant, notifications/navigation, C59/C60 recipient renderers, APIs/actions, pricing, permissions, persistence, auth/Stripe logic, schemas and dependency/configuration files are unchanged. The generated UTF-16 database types and real `/q-mark.png` remain byte-identical. No package installs, build output or credentials were added to this source return.
