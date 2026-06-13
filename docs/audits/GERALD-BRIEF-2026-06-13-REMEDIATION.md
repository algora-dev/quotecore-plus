# Gerald Audit Brief — Pre-Live Remediation Verification (2026-06-13)

**Requested by:** Shaun (via Gavin)
**Brief written by:** Gavin
**Bundle HEAD:** `4af724d` on `development`
**Baseline (original audit):** `7ac2429` (your 2026-06-12 pre-live audit bundle)
**Scope:** Verify that every finding from `04-report.md` is correctly fixed. Nothing new was shipped in this remediaton pass — only security/correctness fixes to your findings. This is the final gate before `development → main`.

Reports land in `workspace-gerald/audits/...`. Shaun coordinates kicking off the run.

---

## Commits in scope (all on `development`, oldest → newest)

| Commit | Finding | Summary |
|--------|---------|---------|
| `aeb6a6e` | C-01 | Cron secret rotation + Vault-backed prod-targeted pg_cron |
| `9bc9b38` | H-01 | Atomic scheduled-message dispatch (claim RPC) |
| `86ec34d` | H-02 | Invoice mutation gate (`requireInvoiceFeature`) |
| `65c86fa` | H-03 | Atomic invoice creation (advisory-lock RPC) |
| `305e8b8` | H-04 | Invoice child-table composite tenant FK |
| `5e105f3` | H-05 | Q assistant session company_id scoping |
| `feb65c3` | M-01..M-07 + L-01 | All medium/low hardening |
| `4af724d` | — | Smoke-test checklist docs only |

---

## Finding-by-finding verification guide

### C-01 (Critical) — `aeb6a6e` ✅ (already confirmed last session)
**Finding:** Cron secret leaked in `cron.job` literal; dispatcher targeted dev URL.
**Fix:** Secret in Supabase Vault (`cron.job` reads via `vault.decrypted_secrets`); cron repointed to `https://app.quote-core.com/api/cron/dispatch-scheduled-messages`; old migration body neutralised.
**Verify:**
- `SELECT jobid, command FROM cron.job WHERE jobid=2` — confirm `vault.decrypted_secrets` lookup, no literal token, no dev URL.
- `SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='cron_dispatch_secret'` — should exist and be non-empty (you won't see the value, just that it's present).
- Migration `20260613100000` smoke check: self-verifying `DO` block that RAISEs on non-prod target or literal secret — confirm it ran clean.

### H-01 (High) — `9bc9b38` ✅ (already confirmed last session)
**Finding:** Scheduled-message dispatcher sent before flipping status; double-send possible.
**Fix:** `claim_due_scheduled_messages` RPC (`UPDATE … FOR UPDATE SKIP LOCKED`) + `dispatching` status; all 6 terminal send-path guards check `status='dispatching'`.
**Verify:**
- Migration `20260613110000`: `dispatching` added to status CHECK, `claimed_at` column, 2 partial indexes, both RPCs locked to `service_role`.
- `claim_due_scheduled_messages` is callable by service_role, NOT by authenticated/anon.

### H-02 (High) — `86ec34d`
**Finding:** Free/expired-trial companies could mutate existing invoices and templates despite `feat_invoices=false`.
**Fix:** `requireInvoiceFeature(companyId)` added as the second line of 7 mutation actions in `actions.ts` + 2 in `template-actions.ts`. Throws same typed billing errors (`FeatureGatedError`/`SubscriptionInactiveError`) the UI already converts to upgrade prompts.
**Key decision:** Wind-down/read paths intentionally ungated: `listInvoices`, `cancelInvoice`, `updateInvoiceStatus('cancelled')`, `deleteInvoice` (draft), `resolveInvoiceDispute`, `deleteInvoiceTemplate`. Everything else requires `invoices` feature.
**Verify:**
- `app/lib/billing/entitlements.ts` — confirm `requireInvoiceFeature` wraps `requireFeature(companyId, 'invoices')`.
- `app/(auth)/[workspaceSlug]/invoices/actions.ts` — every value-extracting action (`saveInvoiceLines`, `saveInvoiceMeta`, `saveInvoicePaymentDetails`, `resetInvoice`, `confirmPaymentReceived`, `updateInvoiceStatus` when status≠'cancelled', `markInvoiceSentByLink`) has the gate as its second line.
- `template-actions.ts` — `createInvoiceTemplate` and `updateInvoiceTemplate` gated; `deleteInvoiceTemplate` ungated (intentional wind-down).
- Confirm no invoice mutation route/API handler bypasses this (check `app/api/invoices/` for any POST/PUT/PATCH that doesn't go through the server actions above).

### H-03 (High) — `65c86fa`
**Finding:** `requireInvoiceSlot()` counted then the app inserted in a separate statement — raceable.
**Fix:** `create_invoice_atomic(p_company_id, p_user_id, p_payload jsonb)` RPC: `pg_advisory_xact_lock` (invoice-namespace salt `XOR 6586966975248322561`), then active/feature/cap checks (P0001/P0012/P0015), then `generate_invoice_number`, then whitelisted `INSERT`, all in one transaction. `service_role` only — `REVOKE` from `anon, authenticated`. App callers use `createInvoiceAtomic()` in `entitlements.ts` which maps SQLSTATE to typed billing errors.
**Verify:**
- Migration `20260613120000`: RPC body has the advisory lock, all three checks (active/feature/monthly-cap), whitelisted column projection (confirm `company_id` and `user_id` come from params, not payload), `REVOKE`/`GRANT` correct.
- `SECURITY DEFINER` on the function — confirm `search_path = public`.
- `app/(auth)/[workspaceSlug]/invoices/actions.ts` — `createBlankInvoice` and `createInvoiceFromQuote` call `createInvoiceAtomic`; neither calls `requireInvoiceSlot` any more; neither does a bare `admin.from('invoices').insert()` for creation.
- `createInvoiceAtomic` in `entitlements.ts` is the only RPC wrapper; it maps P0001/P0012/P0015 to the same typed errors as `requireInvoiceSlot` previously did.

### H-04 (High) — `305e8b8`
**Finding:** `invoice_lines`/`invoice_activity`/`invoice_disputes` RLS only checked child `company_id`; nothing enforced that `invoice_id` belonged to the same company. Service-role reads by `invoice_id` alone could render cross-tenant child rows.
**Fix:** Migration `20260613130000`: `UNIQUE (id, company_id)` on `invoices` (cheap — id is already PK); composite FK `(invoice_id, company_id) REFERENCES invoices(id, company_id) ON DELETE CASCADE` on all three child tables. Verified 0 existing violations before applying. App: `.eq('company_id', invoice.company_id)` added to the service-role child reads in `/invoice/[token]/page.tsx` and `[id]/page.tsx`.
**Verify:**
- Migration `20260613130000`: constraint names `invoice_lines_invoice_company_fk`, `invoice_activity_invoice_company_fk`, `invoice_disputes_invoice_company_fk` exist on live DB.
- `UNIQUE (id, company_id)` constraint `invoices_id_company_id_key` exists on `invoices`.
- Confirm existing `ON DELETE CASCADE` behaviour is preserved for parent-invoice deletion (child rows still cascade).
- `app/invoice/[token]/page.tsx`: `invoice_lines` select has both `.eq('invoice_id', invoice.id)` AND `.eq('company_id', invoice.company_id)`.
- `app/(auth)/[workspaceSlug]/invoices/[id]/page.tsx`: same double-filter on lines.
- Check if `invoice_activity` and `invoice_disputes` are also read in these pages / via any other service-role path — confirm they also apply a company_id filter where the admin client is used.

### H-05 (High) — `5e105f3`
**Finding:** `ensureSession()` only checked `user_id`; browser used one global session key. Multi-workspace user bled Company A's chat/context into Company B.
**Fix (server — authoritative):** `sessions.ts` now selects `id, user_id, company_id` and requires BOTH to match before reusing a session. Non-match → create fresh session scoped to the current company.
**Fix (client — defence-in-depth):** `assistantPersistence.ts` namespaces `sessionStorage` keys by workspace slug (`qc-assistant-chat-v1:<slug>`, `qc-assistant-guide-v1:<slug>`), derived from `window.location.pathname` at call time with a guard for non-workspace routes.
**Verify:**
- `app/lib/assistant/sessions.ts` `ensureSession()`: select includes `company_id`; the reuse `if` checks `data.company_id === input.companyId`.
- `assistantPersistence.ts`: `workspaceScope()` function, `CHAT_KEY` and `GUIDE_KEY` are functions (not constants), each calling `workspaceScope()`. Non-workspace route fallback returns `'default'`.
- The `companyId` passed to `ensureSession` is sourced from `requireCompanyContext()` on the server (session-derived, not client-supplied) — confirm via `app/api/assistant/chat/route.ts` → `resolveServerContext` chain.

### M-01 (Medium) — `feb65c3`
**Finding:** Payment-reported and dispute public routes validated status first, then updated by id only — a race with owner `confirmPaymentReceived` could downgrade a just-paid invoice.
**Fix:** Both routes now put the lifecycle predicate ON the UPDATE:
- Payment-sent: `.in('status', ['sent', 'viewed'])` on the update; checks `updated.length === 0` → 409.
- Dispute: `.not('status', 'in', '("paid","cancelled")')` on the update; checks 0 rows → 409. Dispute INSERT moved to AFTER the status transition succeeds.
**Verify:**
- `app/api/invoices/public/[token]/payment-sent/route.ts`: confirm the original status pre-check is REMOVED (or confirm both exist — the remaining pre-check is fine as a fast-fail but the update itself is now the guard).
- `app/api/invoices/public/[token]/dispute/route.ts`: update happens BEFORE `invoice_disputes.insert()`.
- Confirm the activity log + alert only fire when `updated.length > 0`.

### M-02 (Medium) — `feb65c3`
**Finding:** `generate_invoice_number` was `SECURITY DEFINER` with no grant lockdown; direct RPC callers could burn/skip invoice numbers.
**Fix:** Migration `20260613140000`: `REVOKE ALL … FROM PUBLIC; REVOKE ALL … FROM anon, authenticated; GRANT EXECUTE … TO service_role`.
**Verify:**
- Live: `SELECT grantee, privilege_type FROM information_schema.routine_privileges WHERE routine_name='generate_invoice_number' AND routine_schema='public'` — only `service_role` should have EXECUTE.

### M-03 (Medium) — `feb65c3`
**Finding:** Chat route accepted any role + non-string content; `maxTotalInputChars` existed but was never enforced.
**Fix:** Added a per-message validation loop after the maxHistoryMessages slice: role must be `'user'|'assistant'`; content must be `string`; per-message length ≤ `maxUserMessageChars`; accumulates `totalInputChars` and rejects if > `maxTotalInputChars`.
**Verify:**
- `app/api/assistant/chat/route.ts`: validation loop iterates `body.messages` before `lastUser` extraction.
- Confirm `system`, `tool`, `function` roles are rejected (not explicitly whitelisted).
- Confirm `totalInputChars` check happens even for short individual messages.
- Confirm `MODEL_LIMITS` is imported (M-05 import); confirm `REQUEST_LIMITS.maxTotalInputChars` is the cap value used.

### M-04 (Medium) — `feb65c3` + migration `20260613150000`
**Finding:** `recordTokenUsage` did select → (update | insert); concurrent turns lost increments.
**Fix:** `increment_assistant_token_usage(company, user, date, month_key, tokens)` RPC: `INSERT … ON CONFLICT (company_id, user_id, usage_date) DO UPDATE SET total_tokens = total_tokens + EXCLUDED.total_tokens`. `service_role` only. `recordTokenUsage` in `costGuard.ts` now calls this RPC.
**Verify:**
- Migration `20260613150000`: `LANGUAGE sql` (not plpgsql — safe, no side-effects), `SECURITY DEFINER`, correct `REVOKE`/`GRANT`. `GREATEST(p_tokens, 0)` prevents negative increments.
- `app/lib/assistant/costGuard.ts`: `recordTokenUsage` calls `.rpc('increment_assistant_token_usage', …)`, no longer does select-then-update.

### M-05 (Medium) — `feb65c3`
**Finding:** `turnTimeoutMs` config existed but was never wired; stalled turns held SSE open indefinitely.
**Fix:** `setTimeout(turnTimeoutMs)` on the `AbortController` in the SSE stream; timer cleared in the `finally` block and `cancel()`. SSE error emitted with `timedOut` flag for a distinct client message.
**Verify:**
- `app/api/assistant/chat/route.ts`: `turnTimer` set before `runAssistantTurn`; `clearTimeout(turnTimer)` in `finally` AND in `cancel()`. `timedOut` flag distinguishes server-timeout from client-abort in the error SSE.
- `MODEL_LIMITS.turnTimeoutMs` is the source (config-driven, not a hardcoded value).

### M-06 (Medium) — `feb65c3`
**Finding:** `match_doc_chunks` was revoked from clients but had no explicit `service_role` grant.
**Fix:** Migration `20260613140000`: dynamic `DO $$` block resolves the function's arg signature from `pg_proc` and issues `REVOKE … FROM PUBLIC, anon, authenticated; GRANT EXECUTE … TO service_role`.
**Verify:**
- Live: `SELECT grantee, privilege_type FROM information_schema.routine_privileges WHERE routine_name='match_doc_chunks' AND routine_schema='public'` — `service_role` EXECUTE present; `authenticated`/`anon` absent.
- `app/lib/assistant/knowledge.ts`: confirm it uses the service/admin client (not the authenticated client) when calling `match_doc_chunks`.

### M-07 (Medium) — `feb65c3`
**Finding:** "Max 3 open follow-ups per document" was app-only count-then-insert; double-clicks or parallel requests could exceed the cap.
**Fix:** `BEFORE INSERT` trigger `trg_enforce_open_followup_cap` on `scheduled_messages`: takes a per-parent `pg_advisory_xact_lock` (salt `XOR 7711577975248322561`), counts `status='scheduled'` siblings for the same `COALESCE(quote_id, order_id, invoice_id)`, raises `P0017 open_followup_cap_reached` if `count >= 3`. Only fires when `NEW.status = 'scheduled'` and a parent is set.
**Verify:**
- Migration `20260613140000`: trigger function `SECURITY DEFINER`, advisory lock taken before count, RAISE uses `ERRCODE = 'P0017'`.
- Trigger is `BEFORE INSERT` (not AFTER) — correct for aborting the insert.
- App still has the pre-check (count-then-fast-fail in `scheduled.ts`) for UX; confirm it was not removed.
- Confirm the trigger doesn't fire for `status='sent'`/`'cancelled'` inserts (e.g. sentinel rows with `fire_at='9999-01-01'` have `status='scheduled'` — check that the 3-cap is still correct for those or whether they should be excluded).

### L-01 (Low) — `feb65c3`
**Finding:** Quote revision-request bulk-clear lacked explicit `company_id` filter; order/invoice equivalents had it.
**Fix:** `.eq('company_id', companyId)` added to the `quote_revision_requests` update.
**Verify:**
- `app/api/alerts/bulk/route.ts`: all three side-effect updates (quotes, orders, invoices) now have `.eq('company_id', companyId)`.

### L-02 (Low) — **DEFERRED (Shaun's call pre/post launch)**
`qcp:start-guide` bridge and `/api/assistant/workflow` are unthrottled with no workflow-ID allowlist. Nuisance-spam only, not a tenancy issue. Not a blocker.

---

## Not in scope for this re-audit
- New feature work (Tutorials, trial→Free, Message Center, etc.) — already in the 2026-06-12 audit scope.
- Structural items not touched by these commits (RLS on quotes/orders, Stripe webhook, etc.).
- L-02 (deferred by Shaun).

## Passing criteria
All C/H/M findings above confirmed closed. L-01 confirmed. `development → main` merge cleared.
