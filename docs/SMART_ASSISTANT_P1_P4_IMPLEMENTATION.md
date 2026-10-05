# Smart Assistant V2: P1-P4 implementation and phased integration contract

Date: 2026-09-24. Baseline: the owner's `quotecore-plus-smart-assistant-P0-integrated-2026-09-24.zip`, repository commit `40d5607d`. This delivery is a statically reviewed implementation candidate, not a deployed or runtime-verified release.

## 1. Delivery decision

Ship one full source tree; integrate and enable P1, P2, P3 and P4 separately. All four phases' code can be deployed together. The new database phase gates and server environment switch keep later capabilities unavailable until their migrations, approvals and acceptance gates are complete. Do not cherry-pick only a UI file while omitting its contracts or server modules.

The original V2 plan remains the broader roadmap. This document defines the implementation in this batch, including source-verified limits and a proposed change to the write policy. It does not claim to implement P5 voice tiers, P6 streaming/admin usage, P7 notifications, or every operation in QuoteCore+.

### Important outstanding owner policy gates

The P0 integrator explicitly left policy decisions open. The code implements the following conservative option but keeps writes disabled until Gavin records approval:

| Decision | Implemented option requiring approval | Service-only rollout value |
|---|---|---|
| When business data changes | Propose first; apply only the exact reviewed patch after a button confirmation. No automatic mutate-and-revert. | `write_policy = 'propose_then_confirm'` |
| Who/how confirms | The authenticated requester, using the actual confirmation button. Neither another member nor model-interpreted text/voice assent can execute. | `confirmation_policy = 'requester_button'` |
| Retention | Retain action identity, changes and necessary operational snapshot after chat deletion. No client deletion or new account-deletion cascade is introduced. | `ledger_policy = 'retain_action_fields'` |

These values are prerequisites, not automatically populated defaults. P3/P4 cannot turn on without all three. Retention still needs review against the company's account-deletion/redaction process; this batch does not change that locked process. A different policy needs a deliberate design amendment, not simply a misleading value in the rollout table.

## 2. Source facts that shape the implementation

| Verified source fact | Implementation consequence |
|---|---|
| Drafts are `quotes` rows with `status = 'draft'`. | Every search, read, navigation and edit resolves the actual status and enforces `draft_quotes` separately from `quotes`. |
| There is no standalone customer directory/profile in this source. | Customer results are quote-derived contact snapshots. Both Customers and the source quote/draft must be readable. Opening a contact opens its source quote. |
| The library table is `component_library`. | No invented `roof_components` table or customer API is introduced. |
| Quote entry modes have different real routes. | Navigation resolves manual draft, digital draft, blank draft and non-draft destinations in a strict allowlist. |
| `createQuoteWithDetails` owns parent creation, subscription/quota enforcement and tax seeding. | P4 invokes that existing action unchanged. No second quote-creation or quota implementation. |
| The existing creation wrapper can default currency. | After the parent identity is checkpointed, the unchanged `updateQuoteCurrency` action applies the explicitly reviewed workspace currency. No foreign-exchange conversion. |
| The builder uses the existing pricing engine and calculation tracer. | Proposals call those modules; no LLM arithmetic or alternate price formula. |
| Canonical source quantities are metric and key stored numbers use `numeric(*,4)`. | Explicit unit adapters convert inputs; decimal storage rounding happens before calculations that depend on stored inputs. P3 asserts the live precision before any enabling. |
| Some mutation flows cross more than one database call. | Atomic component updates use a narrow new transaction. Parent creation uses claim/checkpoint/finalise and an explicit uncertain state, not a false exactly-once guarantee. |
| Preview and main share the production database, per `INTEGRATION_UPDATE.md`. | A testing deployment is not an isolated write sandbox. Use explicit company allowlisting and labelled fixtures. Never run write harnesses casually. |

Source reference map: `quotes/new/actions.ts`, `quotes/actions.ts`, `app/lib/pricing/{engine,calcTracer}.ts`, `app/lib/trades/assertCompatible.ts`, `backend/supabase/quotecore_v2_schema.sql`, additive patches/migrations, and the supplied generated database types. These existing business modules are unchanged.

## 3. Supported product surface

### P1: find, inspect and navigate

- Search Quotes, Draft quotes, Orders, Invoices, Components and quote-derived Customers with permission-scoped fuzzy names and record numbers. Return at most ten options; ambiguity is a question, not permission to choose the first fuzzy match.
- Read the selected record. Quote detail includes at most 40 components and 20 roof areas with an explicit completeness warning. Stored component costs are not represented as the entire customer-facing quote total.
- Resolve “this quote” from the underlying route, then re-authorise it. Page context is an identifier hint, never trusted instructions or a database access grant.
- Show actual record buttons. One tap obtains a freshly verified destination, navigates, and hides the assistant once the destination arrives. Failed navigation keeps the conversation visible with an error.
- Explicit unambiguous “open/show” requests can prepare automatic navigation. Historical cards do not re-trigger navigation when the assistant reopens.
- Offer two to four contextual reply buttons. They submit ordinary replies through the existing charged turn flow, not privileged mutations.

Actual destinations:

| Entity | Destination |
|---|---|
| Non-draft quote | `/{workspace}/quotes/{id}/summary` |
| Manual draft | `/{workspace}/quotes/{id}` |
| Digital draft | `/{workspace}/quotes/{id}/build?step=roof-areas` |
| Blank draft | `/{workspace}/quotes/{id}/blank-build` |
| Material order | `/{workspace}/material-orders/{id}/preview` |
| Invoice | `/{workspace}/invoices/{id}` |
| Library component | `/{workspace}/components?created={id}` using the existing highlight affordance |
| Customer contact | The authorised source quote/draft route |

### P2: what needs attention

Read-only groups: viewed but unaccepted shared quotes; sent orders without a supplier response; overdue unpaid invoices; due scheduled follow-ups. Results distinguish `available`, `hidden` and `unavailable`. An inaccessible source never becomes a reassuring zero.

Counts are a current database snapshot with an `asOf` timestamp; up to ten record links per group. Invoice due dates are compared with the UTC date explicitly. Follow-ups require Emails read access and the relevant quote/draft access. This phase sends no messages, changes no statuses, schedules nothing and introduces no cron job. The acceptance guide defines reconciliation against real source rows.

### P3: controlled changes

Supported after both phase approval and Edit permission:

- Customer/job name changes on an editable unsent quote/draft. Changing a customer name additionally requires Customers Edit. It changes that quote's snapshot, not a nonexistent global CRM record.
- Material/labour unit rates on one quote component, with explicit rate units and quote currency.
- Waste percentage, component pitch and single raw manual-entry quantity for supported simple manual/calculated components.
- Exact before/after cards, Confirm and Cancel buttons, current-record navigation, terminal status and a stored human proof.

Safety limits: no accepted, shared, withdrawn or blank-quote mutation; no status changes; no library-rate mutation; no external send/delete/finalise; no geometry replacement for digital takeoff, combined entries or specialised dimensional forms. Pack-priced material components must use the existing pack-price editor rather than an ignored unit-rate edit. Rate-only changes preserve measured quantities and source provenance.

View-only users can inspect permitted proposals but cannot approve edits. The UI disables confirmation when the current permission/phase does not allow it; the server and SQL independently enforce the same restriction.

### P4: new manual drafts and iteration

Collect customer, job, unit system, pitch, trade, an owned compatible component collection, explicit areas and selected library components. Use constrained reply buttons where helpful, but do not infer lengths, roof geometry, quantities, pack sizes or currency conversions.

- Header-only drafts are valid. Up to 12 explicit areas and 24 components per proposal.
- Area quantity must specify plan versus already-pitched surface area.
- Component quantity must specify plan versus actual basis and a supported unit. Quantity is before waste. Optional area references must name an area in this proposal.
- Components must exist, be active, belong to the selected collection and pass the real trade-compatibility helper.
- Simple scalar area, lineal, count/fixed and supported volume components are implemented; specialised dimension/segment/time workflows remain in the real builder.
- The measurement system is explicitly reviewed because it is locked at creation by the source application.
- Generic Trades follows the existing `GENERIC_TRADES_V1_ENABLED` setting. No new entitlement policy is introduced.
- Show collection, trade, currency, pitch, supplied quantities and engine costs before margins/taxes. The full customer price remains the builder's responsibility.
- On confirmed successful creation, open the actual new manual draft and hide the assistant. Reopen to request a supported P3 edit.

Not implemented: cloning a digital takeoff/plan, inferred component schedules, template expansion, adding/deleting/restructuring arbitrary existing quote components, whole-roof geometry or quote-global-pitch propagation, invoice/order creation or edits, sending, settings or billing tools. Unsupported requests should lead to the real editor, not simulated success.

## 4. Mobile shell and conversation contract

The header contains only Menu and Hide. Normal mobile use is a full-screen assistant, with the current application still mounted underneath. Desktop keeps a compact modal widget. The native dialog does not close on a backdrop click.

User preference is device-local and scoped by user and company. Text mode shows the composer. Voice-note mode removes the persistent textarea: microphone, clear listening/stopped/transcribing states, transcript review, then Send. This reuses the existing transcription endpoint, limits and quota infrastructure. It is not sequential spoken replies or Realtime voice. Hiding cancels the microphone/late recording callbacks but does not abandon pending actions or cancel an already admitted turn.

The selected conversation ID survives hide/reopen and route changes in session storage. Text drafts survive hide/reopen while the launcher remains mounted. Conversation content and transcripts are not written to local storage. Preference persistence across devices and full unsent-text recovery after a hard reload are not claimed.

Record/choice/confirmation buttons use the actual shared `QcButton`. Assistant-owned CSS supplies the minimal shell, existing design tokens, safe-area spacing and 44/48px interaction sizes. The accepted P0 button adapter now forwards to that real shared primitive. Shared UI files, global styling and the parallel UX team's components are untouched.

A route request is not proof of approval. A reply button is not approval. The UI must never turn text such as “yes” into a confirmation API call. This batch deliberately uses the real Confirm button as the human boundary.

## 5. Execution architecture

```text
User text / existing voice-note transcript / reply button
  -> existing /api/smart-assistant/turn
  -> unchanged reservation, replay, quota and active-run mechanisms
  -> orchestrator selects V1 registry OR gated V2 registry
  -> V2 scope marker + permission-scoped history / current-page hint
  -> authorised read / navigation card / proposed action
  -> unchanged run completion and usage accounting
  -> stored cards become visible after completed run

Record button -> /v2/navigation -> owned card + fresh entity read
  -> allowlisted destination -> router -> hide on arrival

Confirm button -> /v2/actions -> requester + digest + version + fresh access
  -> P3 atomic mutation+proof OR P4 claim/existing creation/checkpoint/finalise
  -> committed / conflict / needs_review / failed
```

### New route surface

| Route | Input | Behaviour |
|---|---|---|
| `GET /api/smart-assistant/v2/session` | Optional conversation ID | Capability or own scoped conversation/messages/cards/actions/recent run outcomes. |
| `POST /api/smart-assistant/v2/session` | Conversation, company, current pathname | Store an owned page hint, not instructions or an arbitrary redirect. |
| `POST /api/smart-assistant/v2/navigation` | Conversation, company, card ID, exact typed record target | Re-read owned card, match its target, re-authorise live record, return a strict destination. |
| `POST /api/smart-assistant/v2/actions` | Action ID, company, confirm/cancel, digest, version | Execute only a stored approved proposal through its narrow adapter; never accepts a client patch. |

Each new route has coverage in `scripts/test-smart-assistant-v2.mjs`. All new POSTs require same-origin requests, exact top-level shapes and an actual bounded body. Responses are no-store. Auth is obtained through the existing authenticated server client; caller company IDs are comparison guards, not sources of authority. There is no new auth/session/cookie system.

### Read/permission/history design

The rollout switch does not grant read rights. Tools are registered for readable sections and every handler/RPC rechecks current user, company and permission revision. Customers intersect source permissions; quote identity may still include customer name while Customers Hidden withholds customer contact details.

Unscoped V1 knowledge search is NOT registered in V2 because current knowledge chunks lack a section-permission taxonomy. V1 remains unchanged when V2 is disabled. Re-enabling unrestricted knowledge search would be a permission leak, not a harmless UX improvement; classify knowledge first or explicitly approve a separate knowledge permission in a future contract.

V2 history uses trusted `assistant_v2_run_scopes`, plus permission revision and activation cutoff, so a rollback period's V1 responses cannot later be fed to the V2 model as permission-scoped history. Permission changes conservatively withhold earlier material rather than trying to redact a mixed answer by guessing its provenance. The orchestrator still selects latest 30 prior messages and includes the current message once; the scope filter can reduce that number. No original turn history storage, quota table or finish function is changed.

This is an assistant tool/data boundary, not a rewrite of QuoteCore's global access policy or an erasure mechanism for old V1 transcripts. Existing legacy APIs and historical storage remain as supplied.

## 6. Proposal and proof model

Private `assistant_v2_actions` stores the immutable proposed snapshot, explicit payload, affected sections, requester, run, version, digest, change rows and operational status. Accepted P0 `sa_action_log` stores the audit-facing change proof and human confirmation. No client can insert or alter either journal directly.

P3 statuses:

```text
proposed -> committed       [business edit + proof in one DB transaction]
proposed -> cancelled       [nothing applied]
proposed -> conflict        [record changed; fresh proposal required]
```

The digest covers the complete canonical proposal including the original snapshot and exact payload. Change text is not silently truncated before confirmation. The API accepts no arbitrary patch and a model tool cannot call confirmation. A proposal's model run must be completed before its card can be confirmed.

On confirmation: lock the action, current membership, new permission/rollout rows and exact business records; recheck permission and full stored snapshot; then apply only whitelisted columns and engine outputs. Post-lock snapshot readers are intentionally VOLATILE: a pre-lock STABLE snapshot is not sufficient for the competing-transaction acceptance case. Run that real database race test before enabling writes.

No session-end revert exists. Hiding the assistant does not mutate anything or end the workflow. Cancelled/conflicted proposals cannot become later executions. “Change it” means request a fresh proposal, rather than replacing a previously reviewed payload under the same proof.

## 7. P4 creation boundary and uncertainty

The existing parent creation API cannot be made one transaction with assistant child inserts without changing locked creation/quota code. This batch does NOT pretend otherwise:

1. Claim the immutable proposal exactly once. Record requester button confirmation.
2. Recheck access, then invoke `createQuoteWithDetails` once.
3. Immediately checkpoint the returned quote ID in the action ledger. Only that same-ID checkpoint is retryable automatically.
4. Call the existing currency and trade helpers for the reviewed values.
5. In one new transaction, lock/recheck the parent and source libraries, insert the exact approved areas/components/entries, update the reviewed pitch, and commit proof/status.

If the parent was created but later work cannot be verified, show `needs_review`. A known parent has an Open button. An unresolved creation blocks further assistant creations for that requester, including a differently worded fresh proposal. Do not delete/recreate a parent, decrement quota, or silently retry creation. The existing creation action remains the sole parent/quota owner.

A timeout/crash can leave `applying` without a checkpoint. That is also a reconciliation task, not a safe retry. The release guide requires a trusted operator process before P4 is enabled. No automatic expiry worker or user-facing recovery override is shipped.

Safe reconciliation procedure: inspect the action ID, requester/company/run times, ledger and creation logs; identify a parent conclusively; compare actual rows with the stored approved payload; either complete a reviewed recovery using that same parent under a separately approved operator procedure, or mark the action failed only after proving no parent was created. An inconclusive result stays blocked. Never paste a service key into the browser or edit quota/billing tables to make a test green.

## 8. Phase gates and integration sequence

### Preflight

- Compare the supplied baseline and the new `docs/SMART_ASSISTANT_P1_P4_FILE_MANIFEST.json`. Preserve the parallel UX branch's later changes with an intentional merge.
- Use the repository's pinned install/build/test tooling on the integrator's side. The external pass could not run the app and did not execute tests or migrations.
- Keep `SMART_ASSISTANT_V2_ENABLED` absent/false during initial deployment. Missing V2 setup must not silently select unrestricted V1 after the switch is explicitly enabled.
- Review the shared production database fact. Identify an explicit test company and authorised write fixtures; take the normal migration precautions.
- Do not reapply the integrated P0 migration. Apply each new file once, in order, using the normal migration ledger.

### P1

Apply `20260924130000_sa_v2_p1_navigation.sql`. Verify the already-required `pg_trgm` extension is present; the migration resolves its actual schema. Confirm table/function grants. Insert the service-controlled company rollout row with only P1 true, and set the server environment switch true after setup.

Run V1 regressions with the switch off, then P1 API/browser/permission/history tests with it on. Owner must successfully find a draft, choose between ambiguous matches, open/hide/reopen and see the intended real page. Stop before P2 if those fail.

### P2

Apply `20260924131000_sa_v2_p2_attention.sql`; enable P2 only for the test company. Compare every count and linked record with the actual source queries, including disabled/inaccessible follow-up data, dates and statuses. There is no write fixture needed for ordinary attention reads, but fixture setup is still real data creation.

### P3

Resolve the three policy values in section 1. Review/apply `20260924132000_sa_v2_p3_actions.sql`; its precision assertion must pass on the actual live schema. Do not remove the assertion to force a migration through. Grant the necessary section Edit permissions through the accepted owner/admin UI, not by weakening the tool checks.

Run direct RPC privilege checks, exact-proof/replay tests, two-connection stale-snapshot tests, rollback/proof atomicity tests and pricing comparisons with the existing builder. Only then enable P3. A screenshot or pure test is not sufficient evidence for this gate.

### P4

Apply `20260924133000_sa_v2_p4_drafts.sql`. Confirm the unchanged parent action, collection bootstrap, workspace currency, Generic Trades state and actual tax seeding with the integrator. Establish the uncertainty reconciliation process above.

Run full creation, concurrent confirmation, all crash/failure windows, existing quota refusal and builder totals/reload checks. Confirm that no already-created parent is duplicated. Only then enable P4.

### Example service-side rollout sequence

These are templates for the trusted integrator, NOT an executable migration and NOT browser calls. Replace the company ID. Execute only the step whose gate has passed.

```sql
-- P1 only, after its migration and setup review:
INSERT INTO public.assistant_v2_rollout(company_id,p1,enabled_at)
VALUES ('REPLACE_WITH_APPROVED_COMPANY_UUID'::uuid,true,clock_timestamp());

-- P2, after its own acceptance gate:
UPDATE public.assistant_v2_rollout SET p2=true,updated_at=clock_timestamp()
WHERE company_id='REPLACE_WITH_APPROVED_COMPANY_UUID'::uuid;

-- P3, only AFTER the owner decisions have been recorded:
UPDATE public.assistant_v2_rollout
SET write_policy='propose_then_confirm',confirmation_policy='requester_button',
    ledger_policy='retain_action_fields',p3=true,updated_at=clock_timestamp()
WHERE company_id='REPLACE_WITH_APPROVED_COMPANY_UUID'::uuid;

-- P4, after creation and recovery validation:
UPDATE public.assistant_v2_rollout SET p4=true,updated_at=clock_timestamp()
WHERE company_id='REPLACE_WITH_APPROVED_COMPANY_UUID'::uuid;
```

Do not paste all four as one “enable everything” script. Changing section permissions never bypasses these phase gates. Flag writes remain service-role controlled; no `companies` column is added.

## 9. Rollback and rollout hazards

Disable P4 before P3, P3 before P2, or set all downstream booleans false in the same service-side statement; the table checks enforce dependencies. Keep additive schema and audit records. Reverting UI/runtime code or turning the server switch off returns to the exact legacy renderer/tool behaviour. That rollback also returns to V1's access model; do not advertise V2 section restrictions while V1 is serving the workspace.

A kill switch cannot undo an already committed write. A command already inside a locked transaction may finish before a flag update obtains its lock. A P4 parent may already exist even when later phases are disabled; preserve and reconcile its identity. Do not run destructive down-migrations or cascade-delete audit data.

P1-P4 use the existing server request lifetime and normal turn limits. Streaming, background jobs and new metering are not slipped into this batch. Large searches and model latency must be measured in integration.

## 10. Module responsibilities

- `v2/contracts.ts`, `navigation.ts`: strict shared codecs, typed targets, destination allowlist.
- `v2/runtime.server.ts`, `http.server.ts`, `database.ts`: current access, bounded same-origin transport, local additive RPC contracts.
- `v2/entities.server.ts`, `session.server.ts`, `tools.server.ts`: re-authorised reads, scoped runs/history/cards, phase-specific tool registration.
- `v2/attention.server.ts`: typed attention output from the P2 database reader.
- `v2/action-domain.ts`, `units.ts`, `storage-number.ts`, `component-plan.ts`: exact proposal validation and adapters into unchanged canonical converters and engine/tracer.
- `v2/actions.server.ts`: proposal hashing/storage, fresh confirmation dispatch and immutable proof.
- `v2/draft-plan.ts`, `creation.server.ts`: explicit draft inputs, engine-backed children, unchanged parent-creation policy and uncertainty handling.
- `components/smart-assistant/v2/*`: persistent shell, voice-note preference, cards, navigation and verified status.
- Existing `orchestrator.ts`: one narrow registry/history seam; original reservation/finish routes remain byte-identical.
- `LegacyChatClient.tsx`, `LegacySmartAssistantLauncher.tsx`: original renderer bodies retained for flag-off behaviour.
- `scripts/test-smart-assistant-v2*.mjs`, `v2/domain.test.ts`: unexecuted integration/pure/browser tests for the integrator.

## 11. Completion definition

“Code supplied” does not mean “release accepted.” Per phase the integrator records: pinned build/lint, existing regressions, phase-specific runtime tests, SQL permissions and constraints, intended record effects, owner mobile result, exact deployed commit and exact gate values. See `SMART_ASSISTANT_P1_P4_ACCEPTANCE.md`.

The next product batch after this one is P5 voice delivery, then streaming/usage and PWA work as approved. Do not call this version full hands-free voice or autonomous control of the entire app.
