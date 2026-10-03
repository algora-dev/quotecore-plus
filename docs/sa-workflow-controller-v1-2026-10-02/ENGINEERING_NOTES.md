# Engineering notes / code map

## Workflow

`app/lib/smart-assistant/workflow-controller/` contains pure vocabulary/brief/delta validation, product decisions, structural differences, state contracts, tool schemas and task hints, plus scoped configuration/settings readers. `library-workflow/service.server.ts` orchestrates authoritative reads, revision-checked persistence, product questions and proposal attachment. It does not create quote parents or calculate prices itself.

Initial briefs allocate UUIDs server-side. Corrections refer to stable area/group/entry IDs. Adding another measurement appends a distinct entry; `add_component` deliberately creates a separate group, while `append_measurements` targets an exact group. Covering/underlay explicitly linked to an area follows area changes. The server never collapses repeated entries, silently supplies missing pitch, or invents custom calculation rules.

Selection provenance distinguishes explicit choices from configured defaults and sole matches. A configuration epoch change refreshes automatic choices on an **uncreated** brief; on a bound draft, an existing eligible product remains selected so a changed default does not silently switch its product. Eligibility and exact product/context snapshots are revalidated for each proposal/confirmation.

`v2/draft-plan.ts` still invokes `pricing/engine.ts` and `pricing/calcTracer.ts`. Same-product revisions retain saved rates, waste/pack settings and pricing strategy. Reassigning a product uses its current valid defaults. Stable IDs enter the existing plan rather than being regenerated. `structural-diff.ts` preserves unchanged audit rows and provides bounded full review, including all individual raw measurements in chunked rows. Quote margin/tax totals remain the existing builder's responsibility; reviewed engine component costs are labelled accordingly.

## Mutation path

`v2/creation.server.ts` retains the original create → checkpoint → finish recovery discipline and existing `createQuoteWithDetails` domain action. In-flight/uncertain parent creation is never retried by creating a new parent. The SQL finalizer wrapper stores the produced quote ID, committed canonical plan and full quote snapshot together.

Same-draft edits claim the original proof under the existing actor/permission/run protections, lock the parent/descendants, compare the full baseline, apply only added/changed/removed stable child IDs, update bounded root details, commit audit evidence and rebind the snapshot in one RPC transaction. It does not call `sa_v2_draft_edit_clear`. Existing library/context exact-snapshot policy remains in place. These atomic/locking properties are source intent pending PostgreSQL tests, not proven by the mocked tests.

The full conflict snapshot is private service state, never model context or a card. If a manual builder edit, sharing, acceptance or deletion invalidates it, the controller refuses to overwrite/recreate. It does not auto-rebase. Old pre-controller briefs are not reconstructed into safe baselines.

## Task and UI

The existing task classifier remains authoritative. The new hint only recognizes narrow correction/choice continuations for a live matching workflow. Self-contained new tasks close the old preparation and do not carry its produced quote. The new-job tool refuses full regeneration of an active brief. Legacy low-level proposals are blocked for a continuing workflow task; reads/resolver implementations themselves are not rewritten.

Model context includes a bounded working brief and real question options. `read_working_measurements` exposes paginated entry IDs when needed. `DraftWorkflowCard` derives actions from explicit server state and does not authorize creation. The old prose/punctuation Proceed heuristic is no longer used in chat. Existing proof-bearing Confirm and task Done/Move on remain distinct. Task-close/cancel wrappers expire preparation without mutating the quote.

## PWA/auth

`supabase/cookie-batch.ts`, middleware and server cookie adapters use the pinned SSR 0.9.0 `getAll`/`setAll` contract. The accumulator preserves every chunk/removal on replacement and redirect responses, including the separate demo namespace. A verified-user requirement remains; transient verification failure is unavailable, not authenticated. Cookie lifetimes, pricing/billing and auth policy were not relaxed.

The pre-existing assistant manifest still has a stable `/assistant` start URL; the new server launch route resolves authenticated company context to its slug. Push taps use `/pwa/open?delivery=<opaque UUID>`, fresh authentication/MFA and owner/tenant-scoped alert/entity reads. Login retains that query so the correct internal destination can be resolved after authentication.

## Push

`app/lib/pwa/` holds strict subscription contracts, server auth/config, native protocol transport, local additive DB typing and bounded request-scoped dispatch. `/api/pwa/push` manages a single browser device; `/api/cron/dispatch-push` is secret-gated. The existing alert taxonomy and company event preferences are reused; no new AI event or message authoring path exists.

`PushSettings` requests permission only on explicit interaction. `PushSessionBridge` only heartbeats an existing subscription and never asks permission or reenables consent. Logout attempts to disable the current server subscription before signing out; authentication logout is not blocked by an unavailable push database. `qcp-push-sw.js` handles push/click only, with fixed generic copy and a stable notification tag. It opens a new notification destination rather than redirecting an unsaved builder.

See `PUSH_PROTOCOL.md` for protocol scope, fixed provider allowlist, retry semantics, key handling and provider-interoperability limits.
