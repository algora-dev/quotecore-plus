# Fable 5 Codebase Audit — QuoteCore+
**Date:** 2026-07-02 · **Auditor:** Fable 5 (subagent) · **Scope:** full repo at `projects/quotecore-plus`

Legend: 🔴 Critical · 🟡 High · 🔵 Medium · ⚪ Low · 💡 Suggestion

---

## 1. Security & Auth

### 🔴 F-01 — Middleware public-path prefix matching bypasses auth for whole classes of URLs
**File:** `middleware.ts` (~lines 5–45, `isPublicPath`)
`isPublicPath` uses `PUBLIC_PATHS.some(p => pathname.startsWith(p))` with raw prefixes like `'/m'`, `'/orders'`, `'/accept'`, `'/docs'`, `'/terms'`. Because there is no segment-boundary check, **any top-level path starting with those strings is treated as public**. Most damaging: `'/m'` matches *every* path whose first segment starts with "m" — e.g. a workspace slug like `/meadow-roofing/quotes` or `/mfa-anything` skips the middleware auth redirect entirely. Similarly a workspace whose slug is (or starts with) `orders`, `docs`, `terms`, `accept`, `signup`, etc. never gets the middleware gate or the 2FA gate.
**Impact:** The 2FA enforcement gate lives *only* in middleware. Page-level `requireUser()` still blocks anonymous access, but an AAL1 session (password stolen, MFA not yet passed) can reach any workspace whose slug starts with `m` (or other prefixes) without ever clearing `/2fa`. That's a real MFA bypass, not just a redirect nicety.
**Fix:** Match on segment boundary: `pathname === p || pathname.startsWith(p + '/')`, and change `'/m'` to require exactly `/m/<token>` shape. Additionally, reserve public-route prefixes (`m`, `orders`, `invoice`, `file`, `docs`, `accept`, `admin`, `api`, etc.) as forbidden workspace slugs at company-creation time (DB CHECK or app-level blocklist).

### 🔴 F-02 — `dispatch-scheduled-messages` cron absent from `vercel.json`
**Files:** `vercel.json`; `app/api/cron/dispatch-scheduled-messages/route.ts` (header comment claims "Scheduled every 30 minutes in vercel.json")
`vercel.json` has 5 crons; the scheduled-messages dispatcher is not one of them. There are pg_cron migrations (`20260611150000_pg_cron_dispatch_scheduled_messages.sql`, `20260613100000_pg_cron_dispatch_vault_prod.sql`), so dispatch *may* now run via pg_cron — but then the route comment is stale/misleading, and if the pg_cron job was never enabled in prod, **scheduled follow-ups silently never send** (data written, customer promise broken, no error surfaced).
**Fix:** Verify in prod which mechanism actually fires (`select * from cron.job`). Either add the cron to `vercel.json` or update the route comment to state pg_cron is the trigger, and add a monitoring check (admin CronStatusTab already exists — wire "last dispatch ran at" into it with an alert threshold).

### 🟡 F-03 — Login has no application-level rate limiting; resend-confirmation is unthrottled
**File:** `app/login/actions.ts` (whole file)
`loginAction` performs `signInWithPassword` with no `checkRateLimit` call (recovery flow has one; login doesn't). `resendConfirmationAction` can be invoked in a loop with any email → email-bombing vector and mailbox provider reputation damage (Supabase's built-in throttles are coarse and per-project, not per-attacker).
**Fix:** Add `checkRateLimit('login-ip:'+ip, ...)` + a per-email bucket to `loginAction`, and a strict bucket (e.g. 3/hour per email) with `failClosed: true` on `resendConfirmationAction`.

### 🟡 F-04 — Rate limiter defaults to fail-open; audit which sensitive buckets pass `failClosed`
**File:** `app/lib/security/rateLimit.ts` (~line 70)
Default fail-open is a reasonable global choice, but the option only helps if used. `failClosed` appears in the token-gated public routes and recovery — good — but any *newly added* sensitive endpoint silently inherits fail-open. A DB outage window = unlimited brute-force on anything that didn't opt in.
**Fix:** Invert the ergonomics for security buckets: export a `checkRateLimitStrict()` wrapper with failClosed baked in, and lint/grep in CI for `checkRateLimit(` in `**/recover*`, `**/2fa*`, `**/admin*` paths.

### 🟡 F-05 — Impersonation session check adds 1–2 service-role queries to every authenticated render
**File:** `app/lib/supabase/server.ts` (`getCurrentProfile`, ~lines 95–160)
For every non-admin user on every request, the code queries `admin_impersonation_sessions` with the service-role client to decide whether to show the "being impersonated" banner — even though impersonation is vanishingly rare. That's a hidden per-request latency + connection cost across the whole app, and it uses service role where RLS-scoped access would do.
**Fix:** Gate the second check behind a cheap signal (e.g. a short-TTL flag column on `users` set/cleared when impersonation starts/ends, or only check when an `qcp_impersonation_active` cookie/header hints it). Also note both `admin_impersonation_sessions` queries filter on `target_user_id`/`id` + `ended_at is null` + `started_at >` — confirm a partial index exists (`WHERE ended_at IS NULL`).

### 🔵 F-06 — `getClientIP` trusts first hop of `x-forwarded-for`
**File:** `app/lib/security/rateLimit.ts` (~line 95)
On Vercel this is generally sanitised, but if the app is ever fronted differently (or hit directly), the first XFF hop is attacker-controlled, letting rate-limit buckets be rotated per request.
**Fix:** Prefer Vercel's `x-vercel-forwarded-for` / `request.ip` when available; fall back to XFF.

### 🔵 F-07 — Middleware skips `/api` wholesale
**File:** `middleware.ts` (`isStaticAsset`)
Every API route must self-enforce auth. Cron routes and webhooks do; but this is a standing footgun — a new `/api/*` route with a forgotten auth check is publicly reachable with zero defence-in-depth.
**Fix:** Document the invariant in AGENTS.md; consider an allowlist of intentionally-public API prefixes and a smoke test that unauthenticated requests to everything else return 401.

### ⚪ F-08 — RLS regression tests missing for the fixed leak class
**File:** `supabase/migrations/20260629110000_fix_quote_components_rls_leak.sql`
The null-FK OR-branch leak pattern (Gerald H-01) is a *class* of bug — any policy joining through an optional FK can repeat it. There's no automated cross-company RLS test harness in `scripts/`.
**Fix:** Add a script that creates two companies + a user each and asserts zero cross-visibility on all tenant tables (quotes, components, invoices, orders, messages, attachments, notes).

---

## 2. Logic & Correctness

### 🟡 F-09 — Pack-pricing strategies silently return £0 material cost on missing pack data
**File:** `app/lib/pricing/engine.ts` (`computeMaterialCostByStrategy`, ~lines 140–175)
If `packPrice`/`packSize`/`packCoverageM2` are null/0, the function returns `0` — a quote line with real quantity and **zero material cost**. The comment says the DB CHECK prevents bad writes, but legacy rows, imports (catalog upload wizard), or a strategy switched after creation can still hit this. A contractor could send a materially underpriced quote with no visible signal.
**Fix:** Return a discriminated result (`{cost, ok}`) or throw a typed error; at minimum have recalc callers flag lines where strategy≠per_unit and computed cost is 0 while quantity>0, and show a ⚠ badge in the builder.

### 🟡 F-10 — `hipValleyPitchFactor` hard-codes a 45° hip assumption
**File:** `app/lib/pricing/engine.ts` (~lines 55–62)
The compound-angle formula assumes plan angle 45°. Real hips on non-square roofs deviate; on long/narrow roofs the error can be several percent of hip length. The assumption is documented in code but (as far as observed) not surfaced to the user anywhere.
**Fix:** Either expose the hip plan angle as an optional input, or add a tooltip in takeoff/builder stating "hip/valley lengths assume 45° plan angle".

### 🔵 F-11 — Conversion helpers bake `toFixed` rounding into *values*, not just display
**File:** `app/lib/measurements/conversions.ts` (throughout)
`convertLinear`, `convertAreaFt2`, `convertAreaRs`, and the *rate* converters all round via `Number(x.toFixed(n))` and are named as generic converters, not display formatters. Any call site that converts → does math → converts back accumulates rounding error (e.g. rates at 2dp per-ft on cheap items lose up to ~0.5% each pass). `convertArea` returning a **string** "for backwards compat" is an invitation to `parseFloat` bugs.
**Fix:** Split into `toDisplayX()` (rounded) and `convertX()` (full precision); deprecate string-returning `convertArea`; grep call sites doing arithmetic on converted values.

### 🔵 F-12 — `applyWaste` treats `fixed_per_segment` identically to `fixed` in manual mode by design — but nothing validates the takeoff path did its conversion
**File:** `app/lib/pricing/engine.ts` (~lines 75–90)
The comment says "the digital takeoff path converts multi-segment counts before calling this function". That contract is enforced only by convention across `TakeoffWorkstation.tsx` (178KB) and `takeoff/actions.ts` (32KB). If any takeoff call site forgets, waste is under-applied by (segments−1)×fixed with no error.
**Fix:** Pass `segmentCount` into `applyWaste` and compute `value + wasteFixed * segmentCount`, defaulting to 1 — makes the invariant structural instead of conventional.

### 🔵 F-13 — Stripe webhook: `checkout.session.completed` before subscription events relies on Stripe ordering
**File:** `app/api/webhooks/stripe/route.ts`
The handler design is strong (raw-log-first idempotency, reprocess-on-unprocessed-duplicate, live refetch, price allowlist). One residual gap: `customer.subscription.created` for a company with no current sub is accepted as the first-link exception — if `checkout.session.completed` is delayed/lost, does the sub event alone resolve the company (via customer id) or quarantine forever? Verify the `customer_not_found` quarantine path re-processes once checkout lands (quarantined events are 200-acked and never retried, so ordering inversion could leave a paid company un-linked until a later sub.updated).
**Fix:** On `checkout.session.completed`, after linking, re-scan `webhook_deliveries` for quarantined `customer_not_found` events for that customer and replay them (or trigger a live subscription refetch, which invariant 5 already supports).

### ⚪ F-14 — Login redirects to `/onboarding` on missing profile but never surfaces DB errors
**File:** `app/login/actions.ts` (~lines 55–75)
`profile` query error is ignored (`data` destructured only); a transient DB failure sends a fully-onboarded user to `/onboarding`. Low frequency, confusing when it happens.
**Fix:** Check `error` and return `code: 'OTHER'` instead of redirecting.

---

## 3. Performance

### 🟡 F-15 — Monster client components will hurt bundle size, TTI, and maintainability
**Files (sizes):** `takeoff/TakeoffWorkstation.tsx` **178KB**, `material-orders/create/order-create-form.tsx` **108KB**, `quotes/[id]/quote-builder.tsx` **105KB**, `drawings/draw/FlashingCanvas.tsx` **93KB**, `components/component-list.tsx` **81KB**, `customer-edit/CustomerQuoteEditor.tsx` **75KB**, `summary/SendQuoteButton.tsx` **65KB**, `[id]/InvoiceEditor.tsx` **54KB**, `SendOrderButton.tsx` **47KB**, `SendInvoiceButton.tsx` **43KB**.
A "button" at 65KB is a modal-workflow-monolith. These files violate the project's own ~300-line rule by 10–20×, make every edit high-risk, defeat React re-render granularity, and ship as single chunks.
**Fix:** Incremental extraction: pull modal bodies, per-tab panels, and pure helpers out; `next/dynamic` the send modals and takeoff canvas. Prioritise SendQuoteButton/SendInvoiceButton (shared send-flow logic is clearly triplicated across quote/order/invoice — see F-22).

### 🟡 F-16 — Server-side business logic files at 83–85KB
**Files:** `quotes/actions.ts` (85KB), `lib/messages/scheduled.ts` (83KB), `admin/users/[userId]/actions.ts` (38KB), `takeoff/actions.ts` (33KB)
Single server-action files this large make N+1 patterns and auth-check omissions hard to review, and every action shares one import graph (slower cold starts on Vercel).
**Fix:** Split by lifecycle domain (create/duplicate/status/delete), keep one shared `assertQuoteOwnership` helper.

### 🔵 F-17 — Missing-index review for hot admin/impersonation and webhook queries
**Files:** migrations
`webhook_deliveries` lookups by `(provider, event_id)` are covered by the UNIQUE constraint; but verify indexes for: `admin_impersonation_sessions (target_user_id, ended_at, started_at)`, `scheduled_messages (status, fire_at)` (partial `WHERE status='scheduled'` ideal), `rate_limits` prune key, `quotes (company_id, status)` for list filters, `alerts (user_id, read_at)`.
**Fix:** One migration adding partial indexes after `EXPLAIN` on prod-shaped data.

---

## 4. Code Quality & Hygiene

### 🟡 F-18 — Repo root is littered with dead one-off codemods and disabled middleware
**Files:** `middleware.diasbled.ts` (typo'd), `middleware.disabled2.ts`, `apply-pill-buttons-slice*.js` (×4), `fix-*.js/.py` (×8), `update_takeoff_*.py`, `header_fix.py`, `apply-branding.js`, `find-duplicate.js`, plus ~10 stale `PROGRESS_*/STATUS-*/NEXT-*` markdown files and a `{output_folder}` directory.
Beyond clutter: the two disabled middleware files contain old auth logic that a future dev (or AI agent) could mistake for live behaviour; typo'd filename suggests a panic-rename in prod history.
**Fix:** Delete or move to `scripts/archive/`; add `.gitignore` entries; keep root to config + docs.

### 🔵 F-19 — 225 `any`-typed sites despite "strict, no any" policy
**Files:** app-wide (`as any` / `: any`), measured via grep.
Hotspots inevitably concentrate in the big files (takeoff, send buttons, Fabric.js interop). Each is a hole in the RLS-typed Supabase safety net — `as any` on a `.update()` payload can write columns the types would have caught.
**Fix:** Ratchet: add `eslint no-explicit-any` as warn, fail CI if count rises; burn down starting with `app/lib/**` and server actions (highest blast radius), leave Fabric.js interop for last with a typed wrapper.

### 🔵 F-20 — `test-query.ts` debug file shipped inside a route directory
**File:** `app/(auth)/[workspaceSlug]/material-orders/create/test-query.ts`
Dev scratch file in the app tree; imports may drag it into the build graph.
**Fix:** Delete or relocate to `scripts/`.

### 🔵 F-21 — Route-comment drift
**Files:** `app/api/cron/dispatch-scheduled-messages/route.ts` (claims vercel.json scheduling — false); `app/lib/security/rateLimit.ts` docstring says "recovery flow" for failClosed but the flag's use has broadened.
Stale comments in security/infra code actively mislead future audits.
**Fix:** Correct alongside F-02.

### 💡 F-22 — Send-flow triplication (quote/order/invoice)
**Files:** `SendQuoteButton.tsx` (65KB), `SendOrderButton.tsx` (47KB), `SendInvoiceButton.tsx` (43KB), plus 3× `send-*-actions.ts`
Same conceptual flow (recipients → template merge → attachments → test-send tip → schedule) implemented three times. Every send-pipeline bug must be fixed thrice; drift already likely.
**Fix:** Extract a shared `<SendDocumentModal entityKind=...>` + one server send orchestrator with per-entity adapters. This is the single highest-leverage refactor in the codebase.

### 💡 F-23 — Copilot guide content as 144KB of TS source
**Files:** `app/components/copilot/guides.ts` (67KB) + `guides.generic.ts` (77KB)
Guide text compiled into the client bundle (verify they're not statically imported into shared layouts). Editing guides requires a deploy.
**Fix:** Move to JSON/MDX loaded on demand (the assistant already has `workflows.generated.json` precedent), dynamic-import per guide.

---

## 5. UX & Design Consistency (spot checks)

### 🔵 F-24 — Public token pages depend on strict rate-limit availability for DoS protection only
**Files:** `app/accept/[token]/*`, `app/invoice/[token]/*`, `app/orders/[token]/*`, `app/m/[token]/*`
Token entropy is the real gate (HMAC or UUID) — good. But `orders`/`invoice` use *random UUID in URL* rather than HMAC+expiry: no expiry means a forwarded email link works forever, including after the order/invoice is superseded.
**Fix:** Consider adding an expiry/rotate mechanism (regenerate token on resend; keep last N valid), or at least a "link disabled" toggle per document.

### ⚪ F-25 — Design-system enforcement is manual
`docs/DESIGN_SYSTEM.md` rules (rounded-full buttons, no `bg-orange-500`, blur overlays) rely on review discipline across 280 files.
**Fix:** Add a grep-based CI check for the explicit "NEVER" patterns (`bg-orange-500`, `rounded-lg` inside `<button`, `hover:bg-slate-50` on list rows). Cheap and catches drift from all agents/models working on the repo.

---

## 6. What's in good shape (brief)
- **Stripe webhook** is genuinely well-engineered: signature-first, raw-log idempotency with reprocess-on-unprocessed-duplicate, live refetch, price allowlist, correct retry semantics.
- **HMAC token helper**: constant-time compare, per-flow secrets, expiry enforced. Solid.
- **Distributed rate limiter** design (Postgres RPC) fixes the earlier cold-start reset correctly.
- **RLS leak fix** (20260629) is the right shape (scoping via direct FK, separate consistency check).
- **`requireUser`/`requireAdmin`** with React `cache` dedupe is clean.
- Migration hygiene in `supabase/migrations` (recent 23) is good: constraints, atomic claim for scheduled messages, integrity migrations.

---

## Summary
| Severity | Count | Headline |
|---|---|---|
| 🔴 Critical | 2 | Middleware prefix-match auth/2FA bypass (F-01); scheduled-message dispatch possibly never firing (F-02) |
| 🟡 High | 7 | Login rate limiting, fail-open defaults, per-request impersonation queries, silent £0 pack pricing, 45° hip assumption, monster components, monster action files |
| 🔵 Medium | 9 | Conversion rounding, waste-contract fragility, webhook ordering edge, dead files, `any` count, comment drift, indexes, token expiry |
| ⚪ Low | 3 | RLS test harness, login error path, DS enforcement |
| 💡 Suggestions | 2 | Send-flow unification, guide content extraction |
