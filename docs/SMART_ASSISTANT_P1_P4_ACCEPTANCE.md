# Smart Assistant P1-P4 acceptance and evidence guide

Date: 2026-09-24. All runtime checks in this file are for the integrator. They were NOT executed in the external static pass. Use the complete implementation contract alongside this guide.

## 1. Evidence rules

- A preview URL is not an isolated database. The supplied integrator says production DB serves both dev and main.
- Use explicit test companies and labelled records with the owner's approval. Write tests can consume actual quote allowance through the unchanged creation path.
- Do not use service-role credentials as user credentials in a browser or API test. Use real authenticated members and a separate trusted database-review channel.
- Do not create fixture proposals by inserting forged “committed” action rows. Generate proposals/cards through the real normal assistant turn, so run ownership, completion, scope and quota checks are exercised.
- Do not use forced clicks, DOM `.click()`, hidden-overlay helpers or mocked successful application saves as owner-flow acceptance.
- Missing fixtures are BLOCKED, not passed. The scripts exit 2 for missing required evidence, 1 for failures and 0 only for their executed scope passing.
- Record exact source SHA, schema migration version, phase flags, permission revision and environment when reporting a pass.

## 2. Toolchain gates

Use the source package's package manager and lockfile. Run the existing pinned install, lint and production build commands. No dependency/lockfile change is needed for this batch.

```sh
# Run from quotecore-plus/ with the project's already-installed toolchain.
npx --no-install tsx --test app/lib/smart-assistant/section-permissions.test.ts
npx --no-install tsx --test app/lib/smart-assistant/v2/domain.test.ts
# Run normal repository ESLint/Next build and the existing V1 harness as well.
```

Check `package.json` before invoking project-specific scripts. Do not use `npx` without `--no-install` to fetch a different toolchain. The supplied domain test has static type checking only in this delivery; no executed-test count is claimed.

Run `scripts/test-smart-assistant.mjs` against the intended authorised test target exactly as in the existing project instructions. Required locked regressions: request replay before refusal, request-id conflict, one active run, quota charge behaviour, service-only finish, cross-tenant isolation and transcription limits. Retain the existing pricing/takeoff regressions on the merged UX branch too.

## 3. API harness setup

`scripts/test-smart-assistant-v2.mjs` exercises all three new route paths. It does not seed data or bypass existing auth. Create a private JSON fixture outside the returned repository and never commit cookies/storage state:

```json
{
  "baseUrl": "https://YOUR-APP-HOST",
  "workspaceSlug": "APPROVED-WORKSPACE",
  "assistantName": "EXACT VISIBLE ASSISTANT NAME",
  "phase": 1,
  "a": {
    "cookie": "REAL USER A COOKIE HEADER",
    "userId": "USER_A_UUID",
    "companyId": "COMPANY_A_UUID",
    "conversationId": "A_OWN_CONVERSATION_UUID",
    "recordCardId": "REAL COMPLETED RECORD_CARD_UUID",
    "targetId": "REAL FIRST_OR_SELECTED_TARGET_UUID",
    "attentionCardId": "REAL_ATTENTION_CARD_UUID_FOR_P2",
    "confirmActionId": "FRESH_COMPONENT_PROPOSAL_UUID_FOR_P3",
    "cancelActionId": "SEPARATE_FRESH_PROPOSAL_UUID_FOR_P3",
    "creationActionId": "FRESH_DRAFT_PROPOSAL_UUID_FOR_P4"
  },
  "b": { "cookie": "ANOTHER MEMBER IN COMPANY A" },
  "foreign": { "cookie": "MEMBER IN COMPANY B" },
  "expectedDestination": "/APPROVED-WORKSPACE/quotes/ACTUAL-UUID",
  "expectedRecordButton": "EXACT ACCESSIBLE BUTTON NAME INCLUDING DETAIL",
  "expectedAttention": {
    "viewed_quotes": { "state": "available", "count": 2 },
    "supplier_waiting": { "state": "available", "count": 1 },
    "overdue_invoices": { "state": "available", "count": 1 },
    "followups": { "state": "hidden", "count": null }
  }
}
```

Use the actual attention group keys in the deployed P2 response if source labels differ; expected values must be independently counted from fixture rows, not copied blindly from the response under test. Omit later-phase fixture fields while integrating earlier phases. For browser smoke, the target must be the first record option unless `expectedRecordButton` names the intended accessible button exactly.

```sh
export SA_V2_FIXTURES=/secure/local/sa-v2-fixtures.json
export SA_V2_TEST_ACK=preview-is-not-isolated
export SA_V2_TEST_REPORT=/secure/local/sa-v2-results.json
node scripts/test-smart-assistant-v2.mjs

# Only for explicitly approved P3/P4 write fixtures:
export SA_V2_TEST_WRITES=1
node scripts/test-smart-assistant-v2.mjs
unset SA_V2_TEST_WRITES
```

The harness checks route behaviour, exact IDs and terminal/replayed responses. Inspect the database independently to prove number of actual mutations, atomicity, parent count and quota behaviour. A repeated 200 response alone does not prove those.

## 4. Real browser smoke

Uses the existing `@playwright/test` installation, not a new browser dependency. Supply an existing authorised browser storage state for user A:

```sh
export SA_V2_STORAGE_STATE=/secure/local/sa-v2-browser-state.json
export SA_V2_BROWSER=webkit  # repeat with chromium
export SA_V2_SCREENSHOT=/secure/local/sa-v2-after-navigation.png
node scripts/test-smart-assistant-v2-browser.mjs
```

The smoke selects voice preference without recording, asserts the absence of a permanent textbox, checks exactly Menu/Hide in the header, types a draft, hides/reopens, verifies draft retention, taps a real record button, asserts navigation and auto-hide, then reopens without historic navigation replay. It is not an OS microphone/PWA/keyboard test or an end-to-end quote save test.

## 5. P1 mandatory cases

| ID | Test | Required outcome |
|---|---|---|
| P1-01 | Global switch absent/false, migrations not yet applied | Exact legacy chat available; V2 UI does not force missing RPC calls. |
| P1-02 | Switch explicitly true but migration missing | Clear setup error, no silent unrestricted fallback. |
| P1-03 | Company gate off / another company | V2 unavailable for that company; flags cannot be changed by members. |
| P1-04 | Quote readable, Draft quotes Hidden; combined search | No draft content or destination leaks. Reverse the permissions and repeat. |
| P1-05 | Customer contact readable but its source quote Hidden | No contact result. Customer Hidden with Quote View withholds contact email/phone/address while quote identity remains usable. |
| P1-06 | Duplicate names across records and tenants | Only own permitted records; explicit choices for ambiguity. |
| P1-07 | Manual, digital, blank draft and non-draft records | Each lands at its actual route, not a generic guessed editor. |
| P1-08 | Orders, invoices and library components | Correct page; component highlight uses the existing supported query parameter. |
| P1-09 | Current page “this quote” / unsupported page | Freshly reads exact current record or asks which; does not invent an ID. |
| P1-10 | Forged card/record/company/conversation or external URL | Rejected at server; no client navigation. |
| P1-11 | Same-company B replays A card; foreign tenant | Denied, including direct authenticated RPC probes. |
| P1-12 | Permission revoked during the model turn | No late output accepted under old access; incurred usage still reaches the existing failure accounting. |
| P1-13 | Permission revision changes after an old mixed answer | Old answer/cards are withheld from current V2 UI/model context. |
| P1-14 | Disable V2, complete V1 turn, re-enable V2 | V1 rollback-period content never becomes V2 scoped history. Inspect `assistant_v2_run_scopes`. |
| P1-15 | Open/hide/reopen and hard refresh | Conversation resumes; old auto-open card never replays. Hard refresh need not restore unsent plaintext. |
| P1-16 | Slow navigation / failed navigation | Hide occurs after destination arrival; timeout leaves visible recoverable error. |
| P1-17 | Lost turn HTTP response / retry same ID | Existing turn admission prevents duplicate spend; UI uses recent run status to recover. |
| P1-18 | Malicious text in a record / prompt injection | Treated as data. No arbitrary URL/SQL/tool or confirmation authority. |
| P1-19 | Model attempts unavailable section/tool/calculate | Tool absent or rejected; calculate remains unregistered. |
| P1-20 | Knowledge question needing unclassified uploaded chunks | V2 states limit instead of silently calling V1 unrestricted knowledge retrieval. |
| P1-21 | Same-account switch and old browser tab | Re-authorisation prevents stale user/company context from crossing accounts. |
| P1-22 | Microphone permission refusal, stop, hide while transcribing | Visible errors; tracks stop; cancelled transcription never populates hidden/new session. |

## 6. P2 mandatory cases

| ID | Test | Required outcome |
|---|---|---|
| P2-01 | Every group with independent zero/one/many fixtures | Exact expected count and corresponding links; max ten links not mistaken for full count. |
| P2-02 | Viewed but accepted/withdrawn/not-shared quote | Not misclassified as pending customer response. |
| P2-03 | Sent order with later supplier response / unsent order | Not listed as waiting for a first response. |
| P2-04 | Paid/draft/cancelled invoice and due-date boundary | Only qualifying unpaid overdue invoices; UTC rule documented. |
| P2-05 | Follow-up source unavailable or Emails Hidden | `unavailable`/`hidden`, never fabricated zero. |
| P2-06 | Follow-ups on hidden drafts vs permitted quotes | Source permission intersection and deduplicated links. |
| P2-07 | Two due events for one quote, different dates | Count follows the implemented event semantics; linked quote appears once, earliest due first. |
| P2-08 | Phase disabled | No attention tool/API output bypass. |

## 7. P3 mandatory cases

| ID | Test | Required outcome |
|---|---|---|
| P3-01 | Any policy missing, phase off, View instead of Edit | Server rejects writes; UI not a security boundary. |
| P3-02 | Exact proposal through normal completed run | Nothing changes before Confirm. Card shows target context, changes, units/currency and engine costs. |
| P3-03 | Typed/voice “yes”, fake reply Confirm, forged digest/version | No execution authority; valid requester button required. |
| P3-04 | Same-company nonrequester confirmation | Denied. |
| P3-05 | Simultaneous duplicate Confirm; network replay | One mutation/proof; same terminal action returned. |
| P3-06 | Cancel then late Confirm; hide then Confirm | Cancel stays terminal; hide preserves unexecuted proposal. |
| P3-07 | Edit quote/component/library/entry after proposal | Conflict, no overwrite. |
| P3-08 | Two real DB connections: A waits for quote lock; B changes source and commits | Post-lock snapshot detects B's update; no stale overwrite. Do not replace this with a pure reducer test. |
| P3-09 | Downgrade permissions or change workspace while confirmation waits | Current access checked after locks; no cross-workspace update. |
| P3-10 | Direct authenticated RPC access to private journal/snapshot/confirm | Denied; service-only functions are not indirectly exposed. |
| P3-11 | Direct cancel/read RPC after section hidden or phase off | No hidden proposal contents leak. |
| P3-12 | Force proof update failure or missing child inside approved test transaction | Business changes roll back with proof; no partial committed result. |
| P3-13 | Existing manual scalar component rate/quantity/waste/pitch | Compare saved rows, source entries, audit and totals with the real builder's equivalent operation. |
| P3-14 | Metres/feet, square metres/feet/roofing squares, volume, counts | Explicit units only; reciprocal rate conversion is correct; no currency conversion. |
| P3-15 | Decimal ties, four-place precision, small measurement rounding to zero | Stored input/engine result agree; invalid tiny measurement refused. |
| P3-16 | Pack component material rate / missing pack pricing | Refused or redirected, not silently ignored. |
| P3-17 | Takeoff/combined/dimensional measurement geometry | Quantity/waste/pitch refuse safely; allowed rate-only path preserves provenance and measured quantity. |
| P3-18 | Source library deleted / no source entries | Safe refusal, not zeroed totals. |
| P3-19 | Shared/accepted/withdrawn/blank quote | No mutation. |
| P3-20 | Customer name without Customers Edit | Rejected despite quote Edit. |
| P3-21 | Re-open target after committed field change | Updated saved data visible, exact committed proof retained. |
| P3-22 | Repeated no-op requests, malformed/nonnumeric/oversized inputs | No unintended operation; visible, bounded errors. |

P3 does not replace the global builder calculation policy. If any source variant differs from this adapter's assumptions, leave that variant blocked or disable P3 while reconciling the adapter. Do not edit the pricing engine to make an assistant test pass.

## 8. P4 mandatory cases

| ID | Test | Required outcome |
|---|---|---|
| P4-01 | Collection bootstrap missing / currency mismatch / trade not enabled | Clear refusal; no implicit side-effect setup during proposal. |
| P4-02 | Header-only manual draft | Existing creation policy invoked once, correct customer/job/system/currency/trade, draft status. |
| P4-03 | Explicit plan area vs surface area | Pitch applied once where appropriate; correct stored areas after reload. |
| P4-04 | Components with plan/actual quantities and area links | Exact reviewed basis, defaults, compatible collection and correct saved linkage. |
| P4-05 | Duplicate Confirm / replay / second proposal while first applying | One parent identity. Another logical creation is blocked while previous outcome uncertain. |
| P4-06 | Existing quota/plan/storage denial | Existing refusal preserved; no bypass or quota reversal. |
| P4-07 | Kill/fail after claim but before parent call | Applying is not automatically re-claimed; trusted reconciliation required. |
| P4-08 | Parent created but response/checkpoint lost | No second parent creation; unknown result remains blocked. |
| P4-09 | Known parent checkpoint saved, then currency/helper fails | Parent link retained, `needs_review`, no duplicate create. |
| P4-10 | Library/collection/trade/defaults change after review | No unreviewed children inserted; safe conflict/uncertain recovery. |
| P4-11 | Child insertion or proof commit failure | Child transaction rolls back; parent identity retained for recovery. |
| P4-12 | Parent edited by real builder during save | Do not overwrite competing work; preserve parent and report reconciliation. |
| P4-13 | Lost final HTTP acknowledgement, completed DB transaction | Refresh returns committed same parent; no duplicate. |
| P4-14 | Real builder reload and recalculation | Exact quantities/rates/audit survive; customer-facing margins/taxes from normal engine. |
| P4-15 | Hidden/read-only dependent sections | No draft creation registration or execution. |
| P4-16 | Unsupported template/takeoff cloning/specialised dimensions | Explicitly redirect; no hallucinated copied geometry. |
| P4-17 | Successful confirm while visible vs hidden | Visible assistant can navigate/hide; hidden assistant does not unexpectedly commandeer the user's current page. |
| P4-18 | New draft then supported P3 edit | Fresh record read and fresh proposal; no stale cached assumptions. |

## 9. Database review checklist

Review the four draft SQL files before application. Verify actual tables, columns, enum labels, installed extension schema and numeric precision against the live schema; supplied generated types are a snapshot, not proof of production migrations.

After each apply, inspect `pg_proc` function ACLs/security/volatility/search paths, table grants, RLS flags and phase constraints. In particular, private snapshot, scope bind, card add, proposal, confirm, creation claim/checkpoint/finish/uncertain functions must not be executable by authenticated/anon roles. Only the explicitly user-scoped runtime/session/read/search/context/navigation-related readers and own cancellation interfaces are exposed. A definer function is not safe merely because its table has RLS.

Check `sa_action_log` existing constraints and references are compatible. No existing quota/auth/pricing function definition may differ from baseline. Confirm new private operational rows are not queryable directly by browser users. Validate snapshot/proof fields do not contain secrets or acceptance tokens.

## 10. Owner device pass after machine gates

Use the actual iPhone browser and installed PWA, plus a desktop regression check. Owner time should assess: whether Menu/Hide is obvious; voice start/stop/transcript/Send is unmistakable; buttons are easy to tap; opening a quote exposes the correct screen; reopening resumes the task; before/after changes are understandable; confirmation and save feedback are trustworthy; an interrupted save never looks successful; and the saved draft is genuinely useful in the builder.

No quantitative runtime performance or success-rate target has been claimed by the external pass. Record observed latency, failed requests and real gesture behaviour; do not replace results with screenshot appearance or a static model answer.

## 11. Completion log template

```text
Phase:
Merged commit:
Source manifest verified:
Migration reviewed/applied:
DB environment and test company:
Policy approval reference (P3+):
Server env switch and per-company gates:
Pinned build/lint:
V1 regression results:
Pure test actual executed count:
New API harness pass/fail/blocked:
Database permission/concurrency/atomicity evidence:
Browser and real-device evidence:
Known limitations accepted:
Owner approval:
Next phase may be enabled: yes/no
```
