# RETURN NOTES — Smart Assistant Library + Draft Workflow (2026-09-30)

## Start here

This package is built from the user-supplied `quotecore-plus-SA-fix-handoff-2026-09-29.zip`.

The objective is deliberately narrow: make **new draft creation** behave like a task-completing controller rather than requiring the user/model to manually assemble low-level component IDs.

**NOT DEPLOYED. MIGRATION NOT APPLIED. Feature defaults OFF.**

## What changed

### 1. Assistant-specific component-library setup

A new additive migration adds:
- `assistant_v2_library_profiles`
- `assistant_v2_library_members`
- `assistant_v2_draft_briefs`

A workspace manager can enable a whole component library for Smart Assistant or make only selected components eligible. Eligible components can be assigned one of these structural roles:

`roof_area`, `ridge`, `hip`, `valley`, `barge`, `spouting`, `underlay`, `fixings`.

One explicit default may be configured per role/library. Existing `takeoff_slot` values are surfaced as setup suggestions, but are not silently treated as execution authority.

These settings control **new-work eligibility**. They do not hide components already placed on existing authorised quotes/drafts.

### 2. Measurement-first working draft

A new goal-level tool, `prepare_draft_from_brief`, accepts the user's job intent as:
- customer/job/address
- areas, including per-area pitch
- structural measurements grouped by role
- repeated individual measurements

It does **not** require the model/user to supply component-library UUIDs up front.

Server code then:
1. reads only assistant-enabled libraries/components;
2. applies an explicit configured role default when there is exactly one;
3. uses a sole compatible role candidate when there is only one;
4. groups unresolved choices into a single server-authored card;
5. preserves the job/measurements while the user answers choices;
6. produces the existing P4 reviewed `draft_create` proposal only when the brief is complete.

### 3. Grouped product choices

The new `draft_workflow` conversation card shows all current unresolved product choices at once. The user may select them in one interaction.

A text/voice answer can also continue the same working draft through `continue_draft_workflow`; current server-owned choice IDs are supplied to the model context so it does not have to rediscover the job.

Selecting components **never creates the draft**. The normal P4 proposal and Confirm button remain execution authority.

### 4. Draft capability gaps closed

The draft plan now supports:
- `site_address`
- per-area `pitch_degrees`
- multiple raw measurement entries for one component

Repeated measurements are intentionally preserved. Four 5m hips remain four entries because fixed-per-segment waste can produce a different result from one collapsed 20m entry.

`createQuoteWithDetails` now accepts an optional `siteAddress` while retaining all existing caller behaviour.

The additive migration overlays the existing trusted P4 checkpoint/finaliser so site address and repeated `quote_component_entries` are verified/inserted inside the existing confirmation path.

## Feature flag

Enable only after migration/security/live acceptance:

`SMART_ASSISTANT_LIBRARY_WORKFLOW_ENABLED=true`

With the flag OFF, the existing P4 `draft_creation_options` + `propose_draft_quote` path remains available.

## Locked boundaries preserved

- Existing admission/reservation/quota/replay/finish path unchanged.
- Existing P3/P4 Confirm-button authority unchanged.
- No arbitrary SQL/model-authored write path.
- Existing pricing/pitch/waste engines remain authoritative.
- Existing tenant and Smart Assistant permissions remain authoritative.
- No voice/TTS/visual UX redesign in this pass.
- No automatic quote send/finalisation.

## Validation completed here

- TypeScript/TSX syntax transpile check passed for 17 modified/new implementation files using the installed TypeScript compiler.
- Source comparison confirms only the documented workflow/settings/creation/UI files plus one additive migration changed relative to the supplied baseline.
- Final ZIP integrity and checksum are verified during packaging.

## Not verified here

No claim is made for:
- clean dependency install
- full project typecheck/lint/Next build
- live Supabase migration/RLS behavior
- live Luna planning quality
- browser/device acceptance
- actual quote creation against the testing database

Gavin must run those gates.

## Primary live acceptance

Configure one assistant-enabled roofing library with real role assignments/defaults, then in one conversation request a draft such as:

> Create a draft for James Smith at 123 Grand Lane. Main roof 100 m2 at 25 degrees, with four hips of 5 m each. Use my configured roofing library.

Expected:
1. The assistant does **not** ask for generic "component selections" or IDs.
2. It retains customer, address, roof area, pitch and all four hip measurements.
3. If products genuinely tie, one grouped card shows the real eligible choices.
4. After choices, one full proposal is rendered.
5. Only the existing Confirm button creates the draft.
6. Database verification shows exactly one draft, correct site address/area/pitch/components, and four separate hip measurement entries.

See `docs/sa-library-workflow-2026-09-30/AGENT_INTEGRATION_PROMPT.md` for the integration sequence.
