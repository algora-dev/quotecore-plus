# Smoke Test Fixes — Full Brief

**Author:** Gavin (QuoteCore+ Agent)
**Date:** 2026-05-26
**Status:** v2 — Approved by Gerald with addenda (2026-05-26) + Shaun's D1–D5 decisions applied. This is the implementation contract.
**Gerald audit:** `workspace-gerald/audits/quotecore-plus-smoke-test-fixes-brief-2026-05-26/04-report.md`
**Source documents:**
- `docs/smoke-tests/smoke-test-professional.md` (Shaun's annotated Pro smoke test)
- `docs/smoke-tests/AdditionalSmokeTestIssues.txt` (additional issues list)

---

## Purpose

Shaun ran the Starter and Professional smoke tests on 2026-05-25. Many bugs and UX gaps surfaced. This brief consolidates **every issue** into a single plan with **why** each fix matters, **how** it will be implemented, **which files/migrations/tables** are touched, and a **risk + complexity rating** so Gerald can identify weaknesses before we build.

Shipping order: **P0 → P1 → P2**, each tier gated by its own dedicated smoke test before moving on.

Out of scope for this brief: the in-progress bug already hotfixed (email template delete FK violation — fixed in commit `9697519` on `development`).

---

## Tier overview

| Tier | Items | Theme | Smoke-test gate |
|---|---|---|---|
| **P0** | 2 | Production blockers — paying customer impact | "Phase 1 smoke test" |
| **P1** | 5 (P1-1 split into a + b) | Core UX gaps in paid features | "Phase 2 smoke test" |
| **P2** | 8 | Polish, consistency, copy, infra | "Phase 3 smoke test" |
| **Go-Live** | — | Fresh audit by Gavin + Gerald, new master smoke test | "Go-live smoke test" |

### Gerald's audit decisions (locked, 2026-05-26)

| Code | Decision |
|---|---|
| D1 | Material orders: simple one-off "Order accepted" alert on confirm + status-pill dropdown on the order row (`ordered`, `order accepted`, `order delivered`, `paid/completed`). Full lifecycle enum deferred to PM mode. |
| D2 | Activity timeline: **separate `order_activity_events` table** (Option B). No rename of `quote_activity_events`. |
| D3 | Material-order-from-quote picker filter: only quotes with status `accepted`. User can manually set a quote to `accepted` to unlock it for ordering. |
| D4 | Existing inline tool mapping in `TakeoffWorkstation.tsx:357-379` has a bug (`length_x_height` → area). P1-2 fixes the bug AND introduces the central helper in one ticket. |
| D5 | P1-1 is split: **P1-1a hydration + RPC aggregate fix** ships before **P1-1b multi-page UX**. |

### Safer implementation order (per Gerald)

1. **P0-1** Stripe customer-id repair helper (conservative, subscription-first)
2. **P0-2** Follow-up entitlement UI gate
3. **P1-1a** Takeoff hydration + RPC component-aggregate fix + session lock
4. **P1-1b** Multi-page takeoff UX (prompt, page switcher, manual-mode block)
5. **P1-3** Material-order entitlement gates on all direct routes/actions + Confirm-Order timestamp + status pill
6. **P1-4** Billing cancel CTA
7. **P1-2** Wrong-tool guard + central measurement-type helper (also fixes existing `length_x_height` mapping bug)
8. **P2 quick wins:** trade labels, radio visual, em dash user-facing sweep
9. **P2 larger work:** hyperlink token system, copilot refactor, separate orders activity table, billing quota boxes

---

# Tier P0 — Production blockers

## P0-1. Stripe customer-ID mismatch (T13) [REVISED per Gerald H-02]

**Symptom:** When the Pro tier smoke-test user clicks "Manage subscription", Stripe returns:
> `No such customer: 'cus_UXWHxulYOoHgHJ'; a similar object exists in test mode, but a live mode key was used to make this request.`

**Why it matters:** A paying customer cannot manage their subscription. Worst-case audit-grade failure — billing surface is broken for at least one paid user.

**Gerald's correction (H-02):** Blindly nulling/recreating `stripe_customer_id` is unsafe — it can create a second billing identity and orphan real invoice/dunning/dispute mapping for the actual subscription. `cus_*` IDs do not encode mode, but `stripe_subscription_id` does point to a real Stripe object in whichever mode it was created. **Repair from subscription, do not nuke and recreate.**

**Root cause hypothesis:** A `companies.stripe_customer_id` was written by either (a) a dev flow that used the test-mode Stripe key while production was already live, or (b) a stale row created during dev that was never overwritten when the same email signed up on live.

**How we fix it (per Gerald's recommended pattern):**

1. **Inspect first.** Run a one-off audit query against live DB, capture results in `docs/internal/stripe-customer-audit-2026-05-26.md`:
   ```sql
   SELECT id, name, stripe_customer_id, stripe_subscription_id,
          plan_code, subscription_status, current_period_end, created_at
   FROM companies
   WHERE stripe_customer_id IS NOT NULL
   ORDER BY created_at;
   ```
   For each `cus_*` value, hit the live Stripe API and check existence.

2. **Build a conservative repair helper** `repairStripeCustomerIfStale(companyId)` in `app/lib/billing/stripe.ts`. Runs on portal/checkout entry when a `No such customer` error is caught:
   1. If `companies.stripe_subscription_id` is set → retrieve the subscription in current Stripe mode
      - If retrieval succeeds → set `companies.stripe_customer_id = subscription.customer`. Log the repair.
      - If retrieval fails → fall through to step 2.
   2. If local `subscription_status` is `active`, `past_due`, or `trialing` AND step 1 failed → **do NOT auto-null**. Return a `STRIPE_CUSTOMER_REPAIR_FAILED` error and surface a "contact support" message to the user. Alert Shaun via logs.
   3. Only when local `subscription_status` is terminal (`cancelled`, `suspended`, never paid) AND no valid Stripe subscription found → safe to null `stripe_customer_id` and let the next checkout create a fresh customer.

3. **Add `stripe_mode` metadata column** on `companies` (text, nullable, values `'test' | 'live'`) so future debugging knows which Stripe environment created the row. Backfilled to `'live'` for all current rows (since we are on live). Set by checkout and webhook on every write going forward.

4. **Apply repair to known affected user only** if audit shows just one row is bad. Run helper for that one company manually. Otherwise the helper handles it on next portal/checkout attempt.

5. **Wire the helper into both call sites:**
   - `app/(auth)/[workspaceSlug]/account/billing/actions.ts` portal open (around current lines 147–228)
   - Checkout session creation path

**Files touched:**
- `app/lib/billing/stripe.ts` — add `repairStripeCustomerIfStale()` + error catch
- `app/(auth)/[workspaceSlug]/account/billing/actions.ts` — call helper around portal/checkout
- new migration `2026MMDD_add_stripe_mode_to_companies.sql` — add `stripe_mode` column
- new `docs/internal/stripe-customer-audit-2026-05-26.md` — audit results
- update `database.types.ts` after migration

**Risk:** Medium-High — touches live billing surface. Must dry-run against Stripe test mode with a deliberately mismatched customer ID before live.
**Complexity:** Medium.
**Acceptance:**
- Pro user with broken `cus_*` → clicks Manage Subscription → helper repairs from subscription → portal loads
- Pro user with broken `cus_*` AND no recoverable subscription → clear "contact support" message, no silent data loss
- New companies get `stripe_mode='live'` stamped on first Stripe write
- All existing rows backfilled to `stripe_mode='live'`

---

## P0-2. Follow-up post-send prompt missing on Pro (T6/T7)

**Symptom:** After sending a quote on a Pro plan account, the post-send "Schedule follow-up" prompt never appeared. Couldn't be tested. Blocks T7.

**Why it matters:** Follow-ups are a **Pro-tier feature** per the subscription tiers brief. If Pro users can't access it, the tier has a gating bug — either feature unavailable to all Pro users, or the prompt has regressed for everyone.

**Confirmed intent (from Shaun, 2026-05-26):** "Yes, Pro should have follow up access, but nothing below pro tier should."

**Gerald confirmed (H-03):** Server-side scheduling already enforces the `followups` entitlement — this is purely a UI gating mismatch. `summary/page.tsx:48-52` computes entitlements but never passes them to `SendQuoteButton`. The post-send prompt at `SendQuoteButton.tsx:709-717` only checks "successful send + not dismissed + template exists". Growth/Starter users see the prompt and then hit a server 403.

**How we fix it:**
1. **Diagnose (already done by Gerald):**
   - `app/lib/billing/entitlements.ts` already exposes `features.followups`
   - Server-side schedule action already enforces it
   - Client gap: `SendQuoteButton` is never told whether followups is enabled
2. **Define the canonical rule:**
   - Starter plan → **NO** follow-up prompt or access
   - Pro plan → **YES** follow-up prompt + scheduled messages
   - Business+ → **YES** (inherits Pro)
3. **Fix the gate:**
   - If entitlement is missing for Pro → add it
   - If the prompt is gated incorrectly → fix the check
   - Add a server-side enforcement in `scheduleMessage` action so this can't be bypassed by client tampering (defense in depth)
4. **Add a unit test:** plan code matrix → expected entitlement result. `tests/unit/entitlements-followups.test.ts`.

**Implementation specifics (post-Gerald):**
- Add `canFollowups: boolean` prop to `SendQuoteButton`. Compute from `entitlements.features.followups` in `summary/page.tsx`.
- Post-send prompt logic in `SendQuoteButton.tsx:709-717` gains a `canFollowups` guard — prompt only renders for Pro+.
- For Pro users with **zero email templates**, replace the post-send prompt with a "Create your first follow-up template" CTA — prevents the dead-end "no prompt, no idea why" state Gerald flagged.
- Verify the existing server-side `requireFeature('followups')` is present on schedule actions. Add it if missing (defense in depth).

**Files touched:**
- `app/lib/billing/entitlements.ts` (verify only)
- `app/lib/billing/features.ts` (verify only)
- `app/(auth)/[workspaceSlug]/quotes/[id]/summary/page.tsx` — pass `canFollowups` prop
- `app/(auth)/[workspaceSlug]/quotes/[id]/summary/SendQuoteButton.tsx` — consume prop, guard prompt, add zero-templates CTA
- server action that creates scheduled messages — verify `requireFeature` guard
- new `tests/unit/entitlements-followups.test.ts`

**Risk:** Low — feature gating change, additive.
**Complexity:** Small.
**Acceptance:**
- Starter account: no post-send prompt; direct POST to schedule endpoint returns 403
- Pro account with templates: prompt appears, scheduled message saves, dispatcher fires on schedule
- Pro account with zero templates: "Create your first follow-up template" CTA appears instead of dead-end

---

# Tier P0 smoke test (Phase 1)

After both P0 items ship to `development`:

1. **Pro Stripe portal access** — Pro user clicks "Manage subscription" → Stripe portal opens with their subscription visible. No errors.
2. **Starter follow-up gate** — Starter user sends a quote → no post-send follow-up prompt appears. Direct POST to scheduled-messages endpoint returns 403.
3. **Pro follow-up flow** — Pro user sends a quote → prompt appears → schedules a 1-day follow-up → row visible on quote summary → force-run dispatch works.
4. **Pro follow-up suppression on acceptance** — Customer accepts quote → scheduled follow-up auto-cancels with reason "Customer accepted the quote".

All 4 must pass before any P1 work.

---

# Tier P1 — Core UX gaps

## P1-1. Digital takeoff data integrity + multi-page UX (T4) [SPLIT INTO 1a + 1b per Gerald C-01, H-01]

**Symptom:** Opening a new digital takeoff session on an existing quote wiped previous measurements AND mis-calculated new ones. No path to add a second area/page to an existing takeoff.

**Why it matters:** Digital takeoff is the **headline Pro feature**. Losing previous measurements is silent data corruption. Users with multi-area jobs have no working flow.

**Gerald's findings:** Bigger than my brief said. Two distinct data-integrity bugs sit underneath the UX gap, and they must be fixed FIRST or the UX prompt is dangerous.

- **C-01:** Takeoff route never hydrates existing `takeoff_pages` or `quote_takeoff_measurements`. Workstation always initialises to a fresh in-memory `Page 1` with empty measurement state (`TakeoffWorkstation.tsx:118-143`). On save, only the in-memory state is sent. The RPC deletes existing rows for the current page before insert. Net effect: **reopen → add 1 measurement → save → prior measurements deleted.**
- **H-01:** `save_takeoff_atomic` deletes ALL `quote_component_entries` for the component, not just the current page's entries (`20260525130000_save_takeoff_atomic_trade_compat_v2.sql:220-234`). Component totals are recalculated from remaining entries. **Net effect: same component measured on page 1 and page 2 → saving page 2 wipes page 1's contribution to component totals.**

Fix order is non-negotiable per D5: **P1-1a (hydration + RPC aggregate fix) ships before P1-1b (UX).**

---

### P1-1a. Takeoff hydration + RPC aggregate fix + session lock (data integrity)

**Goal:** Make takeoff load and save correctly before any UX changes go in.

**How we fix it:**

1. **Hydrate existing state on takeoff route load:**
   - In `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/page.tsx`, after the existing quote/plan-file/library load, fetch:
     - `takeoff_sessions` row for the quote (if any)
     - all `takeoff_pages` for that session (id, page_number, plan_image_url, signed image URL)
     - all `quote_takeoff_measurements` for that quote, grouped by `page_id`
   - Pass hydrated state into `TakeoffWorkstation` via props.
   - `TakeoffWorkstation.tsx:118-143` initial state changes from "empty single page" to "hydrated from props if provided, else single empty page".

2. **RPC aggregate fix in `save_takeoff_atomic`:**
   - New migration: `2026MMDD_save_takeoff_atomic_quote_scoped_components.sql`
   - Rewrite component-entry rebuild logic so it:
     1. Page-scoped delete of `quote_takeoff_measurements` (as today) for the saving page
     2. Insert new measurements for that page (as today)
     3. Aggregate `quote_component_entries` from ALL measurements for the quote (across all pages) inside the transaction — not current-page only
     4. Delete + insert the aggregated component entries
   - This guarantees component totals always reflect every page's contribution.

3. **Session lock + version guard:**
   - Add `takeoff_sessions.version int NOT NULL DEFAULT 0` column.
   - On save, RPC checks `version` matches client's last-known value; on mismatch, returns `STALE_TAKEOFF_VERSION` error.
   - Client shows: *"Your takeoff was edited in another tab. Reload to continue."*
   - Acquire `pg_advisory_xact_lock(quote_id)` inside the RPC to serialize concurrent saves.

4. **Verify `saveTakeoffMeasurements` action passes full-quote context:** check `actions.ts:186-210` and update if it sends current-page-only component totals.

**Files touched:**
- `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/page.tsx` — hydrate state
- `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/TakeoffWorkstation.tsx` — accept hydrated props, init from them
- `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/actions.ts` — fix `saveTakeoffMeasurements` aggregate, send version
- new migration `2026MMDD_save_takeoff_atomic_quote_scoped_components.sql`
- new migration `2026MMDD_takeoff_sessions_version.sql`
- update `database.types.ts`

**Risk:** High — touches data integrity of the headline feature. Requires careful migration + smoke testing.
**Complexity:** Medium-High.
**Acceptance:**
- Hydration: saved page with 2 measurements → reopen → the 2 measurements visible in the canvas
- Append: above + add a 3rd measurement → save → all 3 persist in DB
- Cross-page component integrity: same component on page 1 (qty 5) and page 2 (qty 3) → save either page → component total stays at qty 8
- Stale version: open takeoff in 2 tabs → save tab A → save tab B without reload → clear stale-version error
- All existing single-page takeoff flows still work

---

### P1-1b. Multi-page takeoff UX (prompt, page switcher, manual-mode block)

**Pre-requisite:** P1-1a must be shipped first. Otherwise "add to existing" silently destroys data.

**Confirmed intent (from Shaun):**
- Prompt only fires when there is a saved/existing session with measurements
- If user goes into takeoff on a manual-mode quote → block digital takeoff entry entirely (button disabled, hover tooltip explains why)

**How we fix it:**
1. **Routing decision logic** on the takeoff entry button:
   - Quote was created via **manual mode** (no plan ever uploaded) → button disabled, tooltip: *"Not available for manually-built quotes. Create a new digital takeoff quote to access."*
   - Quote has **no existing takeoff session** → button opens fresh takeoff (current behaviour)
   - Quote has **existing takeoff session with measurements** → modal prompt: *"This quote already has a saved takeoff. Do you want to: (a) Add measurements to the current area, or (b) Add a new area as a second page?"*
2. **"Add to existing"** flow:
   - Load existing canvas state (already hydrated per P1-1a), allow new shapes/measurements to be drawn on top
   - On save, new measurements are appended; existing measurements preserved by hydration + aggregate fix
3. **"New area"** flow:
   - Create a new `takeoff_pages` row in the existing `takeoff_sessions` row
   - Allow upload of a new plan image
   - Save into the new page
4. **UI surface for multiple pages:**
   - On the quote summary / takeoff entry, show a list of pages with thumbnails
   - Each page links into its own canvas; switching pages is non-destructive

**Files touched:**
- `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/page.tsx` — entry logic, prompt
- `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/TakeoffWorkstation.tsx` — page switcher UI
- Quote summary page — surface page list + manual-mode button gating

**Risk:** Medium — UX heavy but P1-1a removes the data-loss risk underneath.
**Complexity:** Medium.
**Acceptance:**
- Manual-mode quote → takeoff button disabled with tooltip
- New digital quote → takeoff opens fresh canvas
- Quote with saved takeoff → prompt appears → "add to existing" appends correctly, "new area" creates page 2
- Switching between pages preserves all measurements
- Reload preserves all pages and measurements

---

## P1-2. Wrong-tool measurement in digital takeoff (Additional A8) [REVISED per Gerald M-04 + D4]

**Symptom:** User can select an area-type component then measure it with a lineal or point tool. The saved measurement is silently wrong.

**Why it matters:** Pricing accuracy is the core promise of the product. Silent miscalculation is the worst failure mode — user thinks the quote is right when it isn't.

**Gerald's finding (M-04) + D4 decision:** The existing inline mapping in `TakeoffWorkstation.tsx:357-379` maps `length_x_height` → Area tool, which **contradicts the locked mapping below** (`length_x_height` should be Line tool, stored as area). No central helper, no modal/blocking guard. **This ticket migrates the existing mapping to the central helper AND fixes the bug in one move.**

**How we fix it:**
1. **Auto-select the matching tool** when a component is picked: read `component.measurement_type` (already on the row) and set the canvas active tool accordingly:
   - `area`, `volume` → **Area tool**
     - `area` stored as m²
     - `volume` = area drawn × component's stored depth value (m³)
   - `length_x_height` → **Line tool**
     - Stored as area (m²). Line drawn × component's stored height value. e.g. `2.0m line × 2.4m height = 4.8m²`
   - `multi_lineal_lxh` → **Multi Line tool**
     - Stored as area (m²). Sum of segments × component's stored height value. e.g. `(2.0 + 2.0 + 2.0) × 2.4 = 14.4m²`
   - `lineal` → **Line tool**
     - Displays point-to-point length per item (m)
   - `multi_lineal` → **Multi Line tool**
     - Displays combined total length of all segments (m)
   - `point` → **Point tool**
   - `hours`, `fixed_per_segment`, `fixed` → **no canvas tool** (manual entry only)
2. **Warning modal** if the user changes the tool after a component is selected:
   - Title: "Measurement tool mismatch"
   - Body: *"This component expects the `<Line>` tool. Using `<Multi Line>` will produce an inaccurate measurement. Are you sure you want to continue?"* (tool names substituted dynamically)
   - Buttons: "Use the correct tool" (default) / "Continue anyway"
3. **Bake the tool ↔ measurement-type mapping** into a single `app/lib/takeoff/tool-for-measurement-type.ts` helper so this is one source of truth. The four canvas tools are: **Area**, **Line**, **Multi Line**, **Point**.

**Files touched:**
- `app/lib/takeoff/tool-for-measurement-type.ts` (new helper — single source of truth)
- `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/TakeoffWorkstation.tsx` — replace inline mapping at lines 357-379 with helper, add tool-change guard, modal
- new modal component

**Risk:** Low.
**Complexity:** Small-Medium.
**Acceptance:**
- Selecting a component auto-activates the matching tool per the mapping above
- Switching to the wrong tool shows warning modal with correct tool names substituted
- "Use correct tool" reverts the tool; "Continue anyway" allows it but logs an entry
- Existing measurement saves are unaffected

---

## P1-3. Material order entitlement gates + Confirm Order + status pill (T10) [REVISED per Gerald H-04, M-01, M-02, M-03]

**Symptom:** "Confirm Order" button does nothing. Other order URL-linked buttons unwired. Plus Gerald found broader gating + DB constraint issues stacked on top.

**Gerald's findings stacked into this ticket:**
- **H-04:** `/material-orders/create` and `saveDraftOrder()` call `requireCompanyContext()` but NOT `requireFeature('material_orders')`. A non-Pro user can bookmark direct routes and bypass the hub-page splash.
- **M-01:** My original brief proposed `status='confirmed'` but DB CHECK constraint only allows `ready` and `ordered` (`20260415120000_rename_draft_to_ready.sql`). Supplier confirmation already writes `confirmed_at` timestamp, not status.
- **M-02:** Existing UI dropdown shows `delivered`, `paid`, `pickup`, `waiting` (`order-list.tsx:14-23`) but DB rejects them — silent failure.
- **M-03:** "Confirmed quotes" picker on order-from-quote page uses `.neq('status','draft')` but copy says "confirmed quotes".

**Decisions locked (D1, D3):**
- D1: One-off "Order accepted" alert on confirm. Status pill on the order row with dropdown options: **`ordered`**, **`order accepted`**, **`order delivered`**, **`paid/completed`**. No big lifecycle enum overhaul — deferred to PM mode.
- D3: Order-from-quote picker filters by quote status `accepted` only. Users can manually change a quote to `accepted` to unlock ordering.

**How we fix it:**

1. **Add entitlement gates to every material-order surface (H-04 fix):**
   - Add `await requireFeature(companyId, 'material_orders')` to every page loader: `/material-orders`, `/material-orders/create`, `/material-orders/[id]`, `/material-orders/order-from-quote`, `/material-orders/templates`, supplier-link generation.
   - Add same guard to every write action: `saveDraftOrder`, send-order, status-change, supplier-confirm.
   - Keep hub splash for UX, but defense in depth means a direct route hit must fail closed.

2. **Migrate `material_orders.status` enum to support new pill values (D1):**
   - New migration `2026MMDD_material_orders_status_pill.sql`:
     - Drop existing CHECK constraint
     - Add new CHECK: `status IN ('ready','ordered','order_accepted','order_delivered','paid_completed')`
     - Backfill: existing rows keep their current status (`ready` or `ordered`)
   - Status pill component on the order row in `order-list.tsx` shows the 4 user-facing options (`ordered`, `order accepted`, `order delivered`, `paid/completed`). Wire dropdown to status-update server action.
   - Remove invalid dropdown options `delivered`, `paid`, `pickup`, `waiting` from the UI (M-02 fix).

3. **Wire "Confirm Order" button:**
   - Single-purpose action `confirmMaterialOrder(orderId)`:
     - `requireFeature('material_orders')` guard
     - Sets `material_orders.confirmed_at = now()` AND `status = 'order_accepted'`
     - Writes a row to `order_activity_events` (depends on P2-4 — if P2-4 not yet shipped, write minimal log to existing audit/log table or defer the activity row until P2-4)
     - Returns success
   - Client shows alert: *"Order accepted. Status updated."*

4. **Fix M-03 quote picker:**
   - Change `.neq('status','draft')` to `.eq('status','accepted')` in `order-from-quote/page.tsx:16-39`.
   - Empty-state copy: *"No accepted quotes found. Mark a quote as accepted to start an order."*

5. **Audit and wire other dead buttons** (kept from original brief): document every button in `docs/internal/material-orders-button-audit.md` and wire ones that should fire (mark delivered, cancel order, supplier email confirmation link).

**Files touched:**
- new migration `2026MMDD_material_orders_status_pill.sql`
- `app/(auth)/[workspaceSlug]/material-orders/page.tsx` — entitlement guard hardening
- `app/(auth)/[workspaceSlug]/material-orders/create/page.tsx` — add `requireFeature`
- `app/(auth)/[workspaceSlug]/material-orders/create/order-actions.ts` — add `requireFeature` to every write
- `app/(auth)/[workspaceSlug]/material-orders/[id]/page.tsx` — add `requireFeature` + Confirm button
- `app/(auth)/[workspaceSlug]/material-orders/actions.ts` — add `confirmMaterialOrder()`, status-update guards
- `app/(auth)/[workspaceSlug]/material-orders/order-list.tsx` — new pill dropdown options, remove invalid
- `app/(auth)/[workspaceSlug]/material-orders/order-list-actions.ts` — accept only valid statuses
- `app/(auth)/[workspaceSlug]/material-orders/order-from-quote/page.tsx` — status filter fix
- update `database.types.ts`
- new `docs/internal/material-orders-button-audit.md`

**Risk:** Medium — status enum migration + multiple entitlement gates. Test that existing rows survive.
**Complexity:** Medium.
**Acceptance:**
- Non-Pro user hits `/material-orders/create` directly → blocked with feature splash
- Pro user clicks Confirm Order → alert appears, status changes to `order_accepted`, `confirmed_at` stamped
- Status pill dropdown shows only the 4 valid options; selecting one persists
- Order-from-quote picker shows only `accepted` quotes
- All other order buttons either do what they say or are removed

---

## P1-4. Cancel subscription must be clickable from plan card (T13)

**Symptom:** On the billing page, the Pro tier card shows "Your current plan" as a button that does nothing. Only path to cancel is via "Manage subscription" → full Stripe portal. Users get lost.

**Why it matters:** Cancellation friction is a churn risk multiplier. Worse: it makes the app look broken.

**How we fix it:**
1. **Change the current plan card layout** so the bottom button reads "Cancel subscription" (not "Your current plan") for the active plan.
2. **Make it route directly to the Stripe cancel page** (same backend call as the existing "Manage subscription" link, but with `?action=cancel` or whatever Stripe portal supports). If the Stripe portal can't deep-link to cancel, route to a confirmation modal first that asks the user to confirm, then opens the portal.
3. **Keep "Manage subscription"** as a separate broader-scope action elsewhere on the page.

**Files touched:**
- `app/(auth)/[workspaceSlug]/account/billing/page.tsx` (or PlanCard component)
- `app/(auth)/[workspaceSlug]/account/billing/actions.ts` — add `openStripeCancelPortal()`
- `app/lib/billing/stripe.ts` — Stripe customer-portal session creation with deep-link flow

**Risk:** Low.
**Complexity:** Small.
**Acceptance:**
- Active plan card shows clickable "Cancel subscription" button
- Click routes to Stripe cancel flow
- "Manage subscription" still exists for broader management
- Works on both Starter and Pro tier accounts

---

# Tier P1 smoke test (Phase 2) [EXPANDED for P1-1a/b split + Gerald-flagged data integrity]

After all P1 items ship to `development`:

**P1-1a data integrity gates (must pass before P1-1b is acceptable):**
1. **Hydration** — quote with 2 saved measurements on page 1 → reopen takeoff → both measurements visible in canvas before any edits
2. **Append** — above + draw 3rd measurement → save → reload → all 3 persist
3. **Cross-page component integrity** — component X measured qty 5 on page 1, qty 3 on page 2 → save page 2 alone → component total = qty 8 (not qty 3)
4. **Stale-version guard** — open same takeoff in 2 browser tabs → save in tab A → save in tab B → tab B shows clear stale-version error, no silent overwrite

**P1-1b UX:**
5. **Manual-mode takeoff blocked** — manual quote → takeoff button disabled + tooltip
6. **Multi-page takeoff** — new digital quote → 1st area saves → reopen → prompt appears → "add to existing" → adds correctly; reopen → "new area" → creates page 2 with own upload
3. **Wrong-tool warning** — select area component → tool auto-changes to area → manual switch to lineal triggers modal
7. **Wrong-tool guard** — select an `area` component → tool auto-changes to Area; select `length_x_height` component → tool auto-changes to Line; manually switch to Multi Line → modal warns with correct tool names
8. **Material-order entitlement** — Starter user navigates directly to `/material-orders/create` → blocked with feature splash, no order created
9. **Confirm Order works** — Pro user opens a sent order → click Confirm → "Order accepted" alert + status pill shows `order accepted` + `confirmed_at` stamped in DB
10. **Status pill dropdown** — selecting `order delivered` and `paid/completed` persists; invalid options (`delivered`, `paid`, `pickup`, `waiting`) are gone from UI
11. **Order-from-quote picker** — only `accepted` quotes shown; quotes in other statuses hidden
12. **Cancel subscription button** — billing page → click Cancel → reaches Stripe cancel page directly
13. **Stripe customer repair** — simulate broken `cus_*` ID for a Pro user with valid subscription → helper repairs from subscription → portal opens. Simulate broken `cus_*` with no recoverable subscription → clear support message, no silent null.
14. **All P0 tests still pass**

---

# Tier P2 — Polish, consistency, copy, infra

## P2-1. Email hyperlink drop-in system (T5)

**Symptom:** Plain URLs in send-from-QuoteCore+ email templates trigger spam filters. No way to add a hyperlink with custom display text other than typing raw HTML or pasting a full URL.

**Why it matters:** Deliverability. Customers don't receive quotes → revenue loss.

**Workflow agreed with Shaun:** Manually delete existing templates first (now possible — see hotfix). New rules apply to all future template/message creation. No migration needed.

**Gerald's correction (M-05):** Current send code escapes `<`/`>` to prevent injection (`SendQuoteButton.tsx:35-49`). A naive "allow `<a>` tags" approach either keeps escaping anchors (feature fails) or opens HTML injection (security hole). **Use a tokenized format, not raw HTML.**

**How we fix it (tokenized approach):**
1. **Block raw URL paste/typing** in the template body and manual message editor:
   - On paste/blur, regex-detect raw URLs (`https?://...`)
   - Show inline warning: *"Adding a raw URL looks unprofessional and likely to flag your email as spam. Use the hyperlink tool instead."*
2. **Build a hyperlink drop-in component using a token format:**
   - Button in the template/message editor toolbar: "Insert hyperlink"
   - Modal opens with two fields:
     - **URL selector** (dropdown of system-generated URL tokens only — `quote_url`, `order_url`, `accept_url`, `stop_url`, etc.)
     - **Display text** (user-defined: "Click Here", "View Quote", "Open Order", whatever)
   - On insert, a **link token** is placed into the body, e.g. `{{link:quote_url|View quote}}`
   - The token format is parsed at render time — NEVER stored as raw HTML
3. **Render at send time:**
   - Update the email render pipeline (`app/lib/email/render.ts` or equivalent) to:
     1. Validate every `{{link:TOKEN|TEXT}}` against the allowed-token registry (`app/lib/templates/url-tokens.ts`)
     2. Reject the message at send time if any unknown token is present
     3. Render valid tokens to sanitized `<a href="REAL_URL" rel="noopener noreferrer">ESCAPED_TEXT</a>` — text is HTML-escaped, URL is from the trusted registry only
   - Preserve the existing `<`/`>` escaping for all other content. Anchor tags are NOT user-pasteable; only the renderer can produce them.
4. **Validation guards:**
   - Server-side on template save: parse the body for tokens; reject if any token uses a non-allowlisted name or malformed syntax
   - Server-side on send: re-validate (defense in depth)
   - Reject raw `<a` HTML in the body — user-friendly error

**Files touched:**
- `app/(auth)/[workspaceSlug]/templates/EmailTemplateEditor.tsx` — toolbar button, paste guard, render of inserted tokens (as visible chips, not raw HTML)
- new `app/components/HyperlinkInserter.tsx` — the modal
- `app/lib/templates/url-tokens.ts` — registry of allowed system URL tokens (single source of truth)
- `app/lib/templates/link-token-parser.ts` — tokenize/parse `{{link:TOKEN|TEXT}}` syntax
- `app/(auth)/[workspaceSlug]/templates/email-actions.ts` — server-side token validation in createEmailTemplate / updateEmailTemplate
- `app/lib/email/render.ts` (or wherever the {{...}} replacement happens) — token → sanitized anchor render
- `app/(auth)/[workspaceSlug]/quotes/[id]/summary/SendQuoteButton.tsx` — update paste-time URL detection to also handle tokens

**Risk:** Medium — touches send pipeline + injection surface. Test against Gmail/Outlook spam scoring AND attempt malicious tokens.
**Complexity:** Medium.
**Acceptance:**
- Pasting a raw URL into template body shows warning + blocks save
- Hyperlink tool inserts visible token chip with user's chosen display text
- Sent email shows clickable link with correct anchor text, no raw URL visible
- Unknown token in body → send rejected with clear error
- Attempting to paste raw `<a href=...>` HTML → rejected on save
- Spam score (e.g. mail-tester.com) improves vs current state

---

## P2-2. Copilot overhaul (Additional A3, A4)

**Symptom (multiple):**
- Modal placement covers the next action target (e.g. Components button on step 6)
- Inconsistency: some steps auto-advance on completion, some require manual "Next" click — users get confused
- Step 3 wording: "Add roof area" should be "Name your roof area"
- Roofing copilot only — nothing for other trades
- Users sometimes click "Next" expecting it to complete the in-app action

**Why it matters:** Activation. If first-time users can't complete onboarding, they churn before paying.

**Confirmed intent (from Shaun):**
- Generic copilot = clone of roofing copilot, modal text/tasks edited per trade
- Create a file listing every lesson + step + modal text so Shaun can do the rewrite himself, Gavin implements from his edits

**How we fix it:**

### P2-2a. Modal placement rule (global)
1. Define a **target zone registry** for every copilot step: each step declares `{ targetElementId | targetSelector, requiredClearancePx }`.
2. The copilot modal layout engine reads the target zone, computes the next-action element's bounding rect, and chooses a placement (top/bottom/left/right) that NEVER overlaps the target rect + clearance.
3. If no placement fits without overlap (small screens), fall back to bottom-of-screen with an arrow pointer.
4. Test matrix: 13" laptop, 24" desktop, common aspect ratios (16:9, 16:10, 3:2).

### P2-2b. Step rename
- Step 3: "Add roof area" → "Name your roof area"

### P2-2c. Auto-advance vs manual-Next consistency
1. Audit every step. For each, decide:
   - **Action-required step** (user must click a real app button): copilot detects completion via event/DOM mutation and auto-advances. No "Next" button visible.
   - **Read-only / explainer step** (no in-app action needed): "Next" button visible.
2. Never both. Never ambiguous.

### P2-2d. Lessons + steps audit file
1. Create `docs/internal/copilot-lessons-audit.md`:
   ```md
   ## Lesson: First Quote (Roofing)
   ### Step 1 — title
   - Current text: "..."
   - Target element: `[data-copilot="..."]`
   - Auto-advance trigger: click on target
   - Generic-trade rewrite: __________________
   ### Step 2 — ...
   ```
2. Shaun fills in the "Generic-trade rewrite" column for every step.
3. Gavin clones the roofing copilot config into `app/lib/copilot/lessons/generic.ts` and seeds it from Shaun's rewrites.
4. Trade routing: on copilot start, look up `companies.default_trade` (or quote.trade); roofing → roofing lessons, anything else → generic lessons.

### P2-2e. Copilot reset prompt + help docs
1. On lesson completion, show: "Want to do this lesson again later? Reset here →" linking to `/account/notifications` with the reset section highlighted.
2. Add help-docs page: `docs/copilot/reset-lessons.md` (and the matching MDX route).

**Files touched:**
- `app/lib/copilot/positioning.ts` — placement engine (new)
- `app/lib/copilot/lessons/roofing.ts` — refactor to declare target zones + advance modes
- `app/lib/copilot/lessons/generic.ts` (new)
- `app/components/Copilot.tsx` — modal renderer using positioning engine
- `app/(auth)/[workspaceSlug]/account/notifications/page.tsx` — reset section highlight via query param
- `docs/copilot/reset-lessons.md` + MDX route
- new `docs/internal/copilot-lessons-audit.md` (Shaun fills in)

**Risk:** Medium — UX heavy, lots of moving parts, easy to regress activation.
**Complexity:** Large. Best split into sub-tickets: positioning engine first, then audit doc, then generic lessons, then reset prompt.
**Acceptance:**
- Modal never overlaps the next action target on any tested screen size
- Every step either auto-advances OR shows Next — never both
- Step 3 text reads "Name your roof area"
- Generic copilot exists for non-roofing trades
- Audit doc lists every step with placeholders for Shaun's rewrites
- Reset prompt fires on completion + help-docs entry exists

---

## P2-3. Trade-aware "Flashings" / "Drawings & Images" label (T9, A7)

**Symptom:** "Flashings" button shown for all trades, including ones where it makes no sense (landscaping, painting).

**Why it matters:** Looks unprofessional. Confuses non-roofing users.

**Confirmed intent (from Shaun):** Trade-aware. Labels:
| Trade | Button label |
|---|---|
| Roofing | "Flashings" |
| All other trades | "Drawings & Images" |

**How we fix it:**
1. Single helper: `app/lib/trades/drawings-label.ts` — `getDrawingsLabel(trade: string): string` → returns the right label.
2. Replace every hard-coded "Flashings" string in the UI with the helper output. Each UI surface knows the active trade (from quote/company default).
3. Server-side data model is unchanged — `flashings` table keeps its name internally.

**Files touched:**
- `app/lib/trades/drawings-label.ts` (new)
- `app/(auth)/[workspaceSlug]/flashings/page.tsx` and child components — use helper for title + button
- Components page button for opening drawings — use helper
- Sidebar nav — trade-aware label
- Any email/PDF references to "Flashings" — use helper

**Risk:** Low.
**Complexity:** Small.
**Acceptance:**
- Roofing quote shows "Flashings"
- Landscaping quote shows "Drawings & Images"
- No "Flashings" string visible to a non-roofing user

---

## P2-4. Orders activity timeline (A6)

**Symptom:** Quotes have a full activity timeline (created → sent → accepted). Orders have nothing — users can't see what's happened with an order.

**Why it matters:** Operational visibility. As soon as users have multiple orders in flight, they need this.

**Architectural decision (D2, confirmed by Gerald): Option B — separate `order_activity_events` table.**

**Why separate (not the shared rename I originally proposed):**
- Renaming a live `quote_activity_events` table pre-launch is too risky (RLS, indexes, triggers, existing consumers all touched at once)
- Future PM mode will likely build its own activity model on top of the orders side, so a separate table is the natural fit
- Quote activity timeline keeps working untouched

**How we fix it:**
1. **Migration `2026MMDD_order_activity_events.sql`:**
   - New table `order_activity_events` mirroring the shape of `quote_activity_events`:
     - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
     - `order_id uuid NOT NULL REFERENCES material_orders(id) ON DELETE CASCADE`
     - `company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE`
     - `event_type text NOT NULL` with CHECK on allowed values: `created`, `sent`, `order_accepted`, `order_delivered`, `paid_completed`, `cancelled`, `info_requested`
     - `payload jsonb NOT NULL DEFAULT '{}'`
     - `created_at timestamptz NOT NULL DEFAULT now()`
     - `created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL`
   - Indexes: `(order_id, created_at DESC)`, `(company_id, created_at DESC)`
   - RLS: same patterns as `quote_activity_events` (insert/select scoped by company membership)
2. **Logger helper:** `app/lib/activity/log-order-event.ts` — single entry point.
3. **Renderer:** new `OrderActivityTimeline.tsx`, mirroring `QuoteActivityTimeline.tsx`. Some duplication is acceptable per D2.
4. **Wire order events:** every status transition (P1-3) writes a row; send-order writes a row; supplier confirmation link writes a row.

**Files touched:**
- new migration `2026MMDD_order_activity_events.sql`
- `app/lib/activity/log-order-event.ts` (new)
- `app/components/OrderActivityTimeline.tsx` (new)
- material orders actions — call logger on every transition
- order detail page — render timeline
- update `database.types.ts`

**Risk:** Low — net-new table, no touching of existing live data.
**Complexity:** Small-Medium.
**Acceptance:**
- Order detail page shows timeline of every event
- Quote activity timeline unchanged (no regression — separate table)
- RLS scopes correctly
- Each P1-3 status transition writes a row

---

## P2-5. Billing page = quota dashboard + per-page quota button consistency (A1, A8 from second list)

**Symptom:**
- Billing page already shows subscription status and storage. No view of quote / component / order quotas.
- Quotes page has a "this month" box showing plan + count → Shaun wants this on billing page, not on the Quotes page.
- Components page already shows quota inside `+ Add Component` button — Shaun likes this pattern.
- Orders page shows nothing.
- Inconsistent across the app.

**Why it matters:** Users hunt across pages to understand what they have. Need a single account/billing view + consistent in-context counters.

**Confirmed intent (from Shaun):**

| Page | Pattern |
|---|---|
| Quotes | Inside `+ New Quote` button: `+ New Quote (12/50)`. Remove the "this month" box. |
| Components | Stay as-is (already inside `+ Add Component` button). |
| Orders | New button next to "Material Orders" title showing `12/50`. Click goes to billing. |
| Billing | Three quota boxes (Quotes / Components / Orders) — same layout as the old quotes-page box. |

**How we fix it:**
1. **Single quota helper:** `app/lib/billing/quotas.ts` — `getCompanyQuotas(companyId): { quotes: {used, max}, components: {used, max}, orders: {used, max} }`. Server-side, RLS-respecting. Storage already has its own helper + display on billing — left untouched.
2. **Quotes page:** remove the "this month" box, embed quota into the `+ New Quote` button.
3. **Components page:** verify current pattern matches the helper's output (probably already does).
4. **Orders page:** add a clickable badge next to the page title.
5. **Billing page:** add three new quota boxes (Quotes / Components / Orders) alongside the existing storage display.
6. **No server schema changes** — existing fields on `companies` cover plan/usage; usage counts are derived queries.

**Files touched:**
- `app/lib/billing/quotas.ts` (new)
- `app/(auth)/[workspaceSlug]/quotes/page.tsx` — button + remove box
- `app/(auth)/[workspaceSlug]/material-orders/page.tsx` — title-adjacent badge
- `app/(auth)/[workspaceSlug]/account/billing/page.tsx` — quota boxes
- (Components page verified, edit only if helper changes the shape)

**Risk:** Low.
**Complexity:** Small-Medium.
**Acceptance:**
- All three pages show their counts in the agreed pattern
- Billing page shows all three new quota boxes alongside the existing storage display (storage display unchanged)
- Clicking the order quota badge takes the user to billing
- Quota counts match between pages and billing

---

## P2-6. Customer quote editor radio button visual (A2)

**Symptom:** Radio button for show/hide on customer quote editor:
- Hover effect works on both states
- But solid orange fill disappears when "hidden" state — should be empty circle (outline only); solid orange when "showing"

**Why it matters:** Polish. Currently looks like a bug.

**How we fix it:**
- CSS-only fix on the radio component:
  - State "hidden" → border-only circle (outline)
  - State "showing" → solid orange fill
  - Hover (both states) → orange glow halo

**Files touched:**
- `app/(auth)/[workspaceSlug]/customer-quote-templates/create/...` — the radio component

**Risk:** Negligible.
**Complexity:** Very small.
**Acceptance:** Visual matches spec.

---

## P2-7. Em dash sweep + lint rule (A5)

**Symptom:** Long dashes (`—` U+2014, `–` U+2013) appearing in send-from-QuoteCore+ emails, signup recovery questions, and other user-facing copy. Should be `-` (hyphen U+002D).

**Why it matters:** Looks unprofessional / non-native. Shaun called this out previously and it wasn't done thoroughly.

**Confirmed intent (from Shaun):**
- Fix the specific places he flagged (recovery questions, send-from-QuoteCore+ email copy)
- Repo-wide regex sweep replacing `—`/`–` with `-`
- Add a lint/CI rule so future regressions are blocked

**Open question for Gerald/Shaun:** Should the sweep include `docs/`, `MEMORY.md`, and other internal markdown? My recommendation is **exclude internal docs** (they use em dashes stylistically) and **only sweep user-facing copy** (app strings, email templates, signup flow text). Lint rule covers all `.ts/.tsx` user-facing strings.

**How we fix it:**
1. Targeted fix to the two flagged areas: signup recovery questions, send-from-QuoteCore+ email copy.
2. Repo sweep `git grep` for `—` and `–` in non-doc files:
   ```
   git grep -l "—\|–" -- '*.ts' '*.tsx' '*.sql'
   ```
3. Replace with `-` after manual review (some might be code comments).
4. Add ESLint rule: `no-em-dash` custom rule in `.eslintrc` that warns on `—` and `–` in JSX/TS string literals.
5. Show Shaun a diff list before committing.

**Files touched:**
- Many small text edits across user-facing TSX/TS strings
- `.eslintrc.js` — custom rule
- `eslint-plugin-quotecore/no-em-dash.js` (new tiny plugin or inline rule)

**Risk:** Low. Sweep needs careful diff review.
**Complexity:** Small.
**Acceptance:**
- Specific flagged areas use `-`
- Repo sweep complete, manually reviewed
- Lint rule blocks new violations

---

## P2-8. Copilot reset documentation (A4)

Already covered under **P2-2e** above. Not a separate ticket.

---

# Tier P2 smoke test (Phase 3)

After all P2 items ship to `development`:

1. **Hyperlink system** — paste raw URL in email template → warning + blocked. Insert hyperlink with custom text → renders correctly in sent email.
2. **Copilot placement** — run roofing copilot on 1024x768 and 1920x1080 → modal never overlaps next-action button.
3. **Copilot consistency** — every step either auto-advances or shows Next, never both.
4. **Copilot step 3 rename** — reads "Name your roof area".
5. **Generic copilot exists** — landscaping quote triggers generic copilot, not roofing.
6. **Copilot reset prompt** — completing a lesson shows reset prompt; help docs page exists.
7. **Trade-aware labels** — roofing → "Flashings"; landscaping → "Drawings & Images".
8. **Orders activity timeline** — sent → confirmed → received all log to timeline.
9. **Billing dashboard** — three new quota boxes (Quotes / Components / Orders) visible alongside the existing storage display. Counts match.
10. **Quote button quota** — `+ New Quote (12/50)` visible, old box removed.
11. **Orders quota badge** — clickable, routes to billing.
12. **Radio button visual** — hidden = empty circle; showing = solid orange.
13. **Em dash sweep** — no em dashes in flagged areas; lint catches new violations.
14. **All P0 + P1 tests still pass.**

---

# Phase 4 — Go-Live audit + new master smoke test

After all P2 ships and Phase 3 smoke test passes:

1. **Fresh audit** by Gavin + Gerald — read every change top-to-bottom, look for missed gaps.
2. **Define a brand-new "Go-Live" smoke test** — built from the audited state, not from old assumptions.
3. **Shaun runs the new smoke test on both Starter and Pro accounts.**
4. **Sign-off** → ready for paid public launch.

---

# Resolved questions (closed by Gerald audit 2026-05-26)

1. **P0-1 (Stripe):** Safer pattern than nulling — **repair from `stripe_subscription_id` first**, fail loudly to support if active subscription can't be recovered, never auto-null mid-billing. See revised P0-1.
2. **P0-2 (entitlements):** Server-side already enforces `followups`; the gap is purely UI. **H-04 also found material-order direct routes bypass gating** — folded into P1-3. Defense-in-depth pass for other features deferred to Phase 4 Go-Live audit.
3. **P1-1 (multi-page takeoff):** Yes — add `pg_advisory_xact_lock(quote_id)` inside RPC + `takeoff_sessions.version` guard for stale saves. Folded into P1-1a.
4. **P2-4 (activity table):** **Option B — separate `order_activity_events` table.** Renaming a live table pre-launch is too risky.
5. **P2-7 (em dashes):** User-facing app strings, emails, templates, signup/recovery copy only. Internal docs/`MEMORY.md` excluded.
6. **Hidden P1 inside P2:** P2-4 would only become P1 if Confirm Order's acceptance criteria required an activity row. Per Gerald: keep P2-4 as P2; P1-3 falls back to a minimal log entry if P2-4 hasn't shipped yet.
7. **Tier ordering:** P0 → P1 first; do not batch P2 activity rename/table work with P0/P1. Tiny isolated P2s (P2-3 labels, P2-6 radio visual) may be batched with P0 only if they touch zero shared systems.

---

# Risk summary

| Tier | Items | Highest-risk item | Why |
|---|---|---|---|
| P0 | 2 | P0-1 Stripe customer repair | Live billing surface; conservative subscription-first repair pattern required |
| P1 | 5 | P1-1a Takeoff hydration + RPC aggregate fix | Data integrity of headline feature; new migrations + advisory lock |
| P2 | 8 | P2-1 Hyperlink token system | Send-pipeline + injection surface; tokenized format with strict allowlist |

---

# Cost discipline (per AGENTS.md)

Drafting this brief was done on Opus 4.7 (analysis-heavy). Implementation will switch to Sonnet 4.6 for the building work since most P2 + half of P1 is "execute from a written plan" — exactly Sonnet's lane.

---

**End of brief.**
