# Gerald — Pre-Launch Audit Brief

**Date:** 2026-05-18
**Author:** Gavin (with Shaun's sign-off)
**Target reviewer:** Gerald
**Scope:** Full audit of QuoteCore+ for production go-live on `app.quote-core.com`
**Current dev HEAD:** `bd55039` on `development` (15+ commits ahead of `main`)
**Live URL today:** `quotecore-plus-dev.vercel.app` (preview); `quotecore-plus-main.vercel.app` is the production target

---

## What Shaun wants from you

Treat this as a **green-light review**. Either you sign off that we can merge `development → main` and announce launch, or you give us a prioritised list of blockers.

You don't need to re-test the user-facing flows we've already run smoke tests on (listed below) — though you can if anything looks suspicious. Focus your energy on:

1. The **subscription/billing system** — it's the newest, most complex, and most money-critical surface.
2. Anything **security-sensitive** that has changed since your last pass (Phase 1 subscription tiers added a lot of new RLS, RPCs, and webhooks).
3. **Production-readiness gaps** — env vars, monitoring, error handling, deploy hygiene, Cloudflare/Vercel domain setup.
4. **Continued user-flow testing** — we've covered the happy paths; we want you to break the unhappy ones.

---

## Where the project is at

**Phase 1 subscription tiers is code-complete and merged into `development`.** Awaiting:
- Your audit
- Shaun's final smoke pass
- Stripe live-mode price/coupon setup
- Domain proxy decision (in progress — see below)

Once those four are clear, we fast-forward `development → main` and Vercel deploys to `app.quote-core.com`.

### Tech stack snapshot (unchanged from your last review)

- Next.js 16.2.6 + React 18 + TypeScript + Tailwind 4
- Supabase (project `aaavvfttkesdzblttmby`, region `eu-central-1`, single DB serves both Vercel envs)
- Stripe (test mode now; live keys not yet wired)
- Vercel (`quotecore-plus-dev` and `quotecore-plus-main` projects under `algora-dev` org)
- Fabric.js for canvas, jsPDF + html2canvas for PDF gen
- Repo: `github.com/algora-dev/quotecore-plus`

### Domain status

- `app.quote-core.com` is now pointing at `quotecore-plus-main` on Vercel.
- **Cloudflare proxy decision: keep it OFF (grey cloud / DNS-only)**. My recommendation, Shaun has agreed. Vercel handles TLS + WAF + DDoS; doubling up with Cloudflare proxy causes cert renewal failures and silently breaks Stripe webhooks. Marketing site / apex can still proxy through Cloudflare.

---

## What's been built since your last audit

This is the headline list. Full code in commits `69fe397..bd55039` on `development`.

### 1. Subscription tier system (Phase 1)

**Database:**
- `subscription_plans` catalogue table with 6 active tiers + 3 deprecated (`scaling`, `business`, `enterprise` left as `active=false` for historical FK integrity).
- Per-tier columns: `monthly_quote_limit`, `storage_limit_bytes`, `component_limit`, `flashing_limit`, `monthly_material_order_limit`, `included_seats`, six `feat_*` boolean flags, pricing, Stripe price IDs, launch coupon ID, marketing copy.
- `companies` now carries: `plan_code`, `subscription_status` (9-state CHECK), `trial_ends_at`, `current_period_end`, `cancel_at_period_end`, `cancel_at`, `stripe_customer_id`, `stripe_subscription_id`, `first_payment_failure_at`, `dunning_stage_entered_at`, `comp_until`, `seat_count`, `storage_topup_bytes`, etc.
- `company_quote_usage` per-company-per-month counter (atomic via `create_quote_atomic` RPC).
- `subscription_events` audit table written on every Stripe webhook + manual state change.

**SQL functions (all SECURITY DEFINER, search_path-locked):**
- `company_effective_plan_code(uuid) → text` — collapses to `starter` during grace/expired-trial.
- `company_effective_plan_active(uuid) → boolean` — false only for `suspended`/`canceled`.
- `company_has_feature(uuid, text) → boolean` — single-feature check.
- `create_quote_atomic(uuid, uuid, jsonb) → uuid` — advisory-lock per company, raises P0001/P0002/P0003 on failure.
- `company_component_count(uuid)`, `company_flashing_count(uuid)` — for tier-cap reads.
- `require_component_slot(uuid)`, `require_flashing_slot(uuid)` — raise P0010/P0011/P0012 on cap/feature gate.
- BEFORE INSERT trigger on `companies` defaults trial state for new signups.

**Server-side entitlement layer:**
- `app/lib/billing/entitlements.ts` — single `loadCompanyEntitlements(companyId)` (React-cached per request). Returns the full snapshot used everywhere.
- `app/lib/billing/errors.ts` — typed error classes: `FeatureGatedError`, `SubscriptionInactiveError`, `QuoteLimitReachedError`, `ComponentLimitReachedError`, `FlashingLimitReachedError`, `StorageQuotaExceededError`. All extend `BillingError`.
- `app/lib/billing/features.ts` — feature constants + `FEATURE_MIN_PLAN` upgrade-target map.
- Server actions return typed envelopes: `{ok:true, data}` / `{ok:false, code, …}`.

**UI gating:**
- New `<UpgradeModal>` component used at every cap/feature gate.
- `/quotes/new` greys out Digital Measure button on non-feature plans; submit blocked at monthly cap.
- `/quotes` list page intercepts `+ New Quote` at cap.
- `/components` `+ Add Component` checks lifetime cap + counter badge.
- `/flashings` hard server-gate splash on non-feature plans + cap-aware Create/Upload buttons.
- `WorkspaceNav` makes Material Orders a button that opens upgrade modal (not a nav link) on gated plans.
- `/material-orders` + `/flashings/draw` + `/flashings/[id]/edit` all hard server-gated.

### 2. Billing page (`/account?tab=billing`)

- New plan-grid layout: 6 cards (Trial, Starter, Growth, Pro, Pro Plus, Premium-coming-soon).
- Per-card **View modal** with full feature breakdown, numeric caps, feature checklist, marketing blurbs.
- **Start 14-day trial** card (non-Stripe path) with anti-abuse (once-per-company forever, keyed on `stripe_customer_id` presence).
- Trial countdown on current-plan card.
- **Manage subscription** button always visible when `stripe_customer_id` exists — opens Stripe Customer Portal.
- Paid-tier "Choose" buttons disabled for active subscribers (says "Manage to switch") to prevent creating duplicate Stripe subs.
- Strikethrough launch pricing.

### 3. Stripe integration

**Checkout side:**
- Custom price + auto-applied coupon pattern. Customer is billed at MSRP price (e.g. $60) with a `forever` discount coupon (e.g. `-$31`) attached, so Stripe Checkout shows the strikethrough subtotal + discount line + launch total.
- Coupons created in test mode: `qc_starter_launch`, `qc_growth_launch`, `qc_pro_launch`, `qc_pro_plus_launch`. **Live-mode coupons not yet created** (blocker for go-live, see below).
- `discounts: [{coupon: id}]` attached to Checkout Session; `allow_promotion_codes` falls back when no coupon.

**Webhook handler (`app/api/webhooks/stripe/route.ts`):**
- Handles `customer.subscription.{created,updated,deleted}`, `invoice.payment_{succeeded,failed}`, `customer.subscription.trial_will_end`, `charge.dispute.{created,closed,funds_withdrawn,funds_reinstated}`, `customer.deleted`.
- Idempotent via `webhook_deliveries` table (unique constraint on `(provider, event_id)`). Replays return `200 {ok:true, idempotent:true}`.
- Populates `cancel_at_period_end` AND `cancel_at` so both Stripe cancellation flows are detected.
- Dispute events auto-open a `payment_dispute` support ticket and move `subscription_status` to `disputed`. Dispute-closed auto-resolves the ticket.

**Customer Portal:**
- `createCustomerPortalSession()` action returns the portal URL. Stripe handles plan switch + proration, card update, invoices, cancel.

**Lifecycle cron (`/api/cron/process-billing-lifecycle`):**
- Walks `subscription_status` machine: `past_due` → `grace` (day 14) → `suspended` (day 24) → `pending_data_purge` (day 75).
- Currently only changes status; **no actual data purge** (Phase 2 work, documented as TODO in the route header).

### 4. Support ticket system

- `/account?tab=support` user-facing inbox + create flow.
- Categories: Bug, Question, Billing, Feature request, Other.
- Server-side ticket creation captures URL, user-agent, app version automatically.
- Admin dashboard at `/admin/support-tickets`.
- Auto-resolve on dispute closed.

### 5. Docs / help site

- Full rewrite of `/docs/account/billing` + 3 new pages (`trial`, `tier-limits`, `upgrading-and-cancelling`).
- Updated `flashings`, `material-orders`, `components`, `your-first-quote` with cap info.
- Changelog filled in for 2026-03 through 2026-05-18.
- Glossary added 11 new billing terms.
- Sidebar order normalised.

### 6. Smaller changes worth flagging

- Standard Quote (`entry_mode='blank'`) — separate builder, auto-confirm on first save.
- Imperial measurement system (metric / imperial_ft / imperial_rs) — per-quote lock at creation, flashings tool unit-aware.
- 2FA + recovery codes + security questions.
- Email change with double-confirmation, 7-day cooldown.
- Storage quota enforcement at upload finaliser; `QUOTE-DOCUMENTS` bucket is private (signed URLs), `company-logos` is public (intentional).
- Onboarding seeds 8 starter components for new companies.
- Suppression diagnostic admin helper at `/admin/suppressions`.

---

## What we have tested

Shaun and I have run smoke tests on the following. Treat as "happy path is confirmed; please attempt to break".

### Block A — Non-Stripe smoke tests (passed)

| ID | Test | Status |
|---|---|---|
| A1 | New signup lands on trial, all caps applied | ✅ |
| A2 | Component cap at trial (10) blocks Add button | ✅ |
| A3 | Flashing cap at trial (5) blocks Create/Upload | ✅ |
| A4 | Quote cap at trial (10) blocks + New Quote | ✅ |
| A5 | Digital Measure greyed on Starter, opens upgrade modal | ✅ |
| A6 | Flashings nav opens upgrade modal on Starter/Growth | ✅ |
| A7 | Material Orders nav opens upgrade modal on Starter/Growth | ✅ |
| A8 | Direct URL access to `/flashings` and `/material-orders` shows upgrade splash on gated plans | ✅ |
| A9 | Direct URL access to `/flashings/draw` redirects to `/flashings` | ✅ |

### Block B — Stripe webhook tests (passed)

| ID | Test | Status |
|---|---|---|
| B1 | `customer.subscription.created` activates sub correctly | ✅ |
| B2 | `customer.subscription.updated` writes cancel_at_period_end + cancel_at | ✅ |
| B3 | `customer.subscription.deleted` collapses to starter, clears Stripe IDs | ✅ |
| B4 | `invoice.payment_succeeded` clears failure timers | ✅ |
| B5 | `invoice.payment_failed` (single retry → recovery) sets/clears first_payment_failure_at | ✅ |
| B6 | `charge.dispute.created/closed` opens + auto-resolves payment_dispute ticket | ✅ |
| B7 | Checkout with unknown price ID rejected | ✅ |
| B8 | Replayed webhook event returns `idempotent:true` (unique constraint on event_id) | ✅ |
| B9 | DB reset to clean state via SQL | ✅ |

### Block C — Tier / billing flow tests (passed)

| ID | Test | Status |
|---|---|---|
| C1 | Plan grid renders all 6 cards with correct pricing + strikethrough | ✅ |
| C2 | View modal shows correct caps + features per tier | ✅ |
| C3 | "Not included" shown in italic for gated rows | ✅ |
| C4 | Trial activation from billing page (non-Stripe) works | ✅ |
| C5 | Trial countdown updates correctly | ✅ |
| C6 | Stripe Checkout shows MSRP + discount + launch total | ✅ |
| C7 | Trial gate honours cancel_at_period_end | ✅ |
| C8 | Trial gate honours cancel_at (Stripe Dashboard scheduled-cancel flow) | ✅ |
| C9 | Trial card disabled for accounts with prior stripe_customer_id | ✅ |
| C10 | Paid-tier "Choose" disabled when active sub, shows "Manage to switch" | ✅ |

### Build / lint status

- `next build` ✅ passes (`Compiled successfully in ~5s`).
- TypeScript ✅ clean.
- ESLint has 8 pre-existing errors (in BillingPanel, RevisionRequests, etc.) and 163 warnings (mostly `any` types in legacy code). None of these are from the Phase 1 work.

---

## What we have NOT tested (please cover)

These are gaps. Some are blockers; some are nice-to-have. Marked `[BLOCKER]` where appropriate.

### Stripe — live mode setup
- **[BLOCKER]** Live-mode prices not yet created in Stripe (only test mode). All 4 paid tiers need MSRP prices + 4 launch coupons created in the live Stripe account before live mode flips on.
- **[BLOCKER]** Live Stripe env vars not yet set on `quotecore-plus-main`. Need: `STRIPE_SECRET_KEY` (live), `STRIPE_WEBHOOK_SECRET` (live), and `STRIPE_MODE=live` (the canonical mode flag; the code in `app/lib/billing/stripe.ts` reads `STRIPE_MODE` and falls back to sniffing the secret-key prefix as `sk_live_*`).
- Live Stripe webhook endpoint at `https://app.quote-core.com/api/webhooks/stripe` needs to be registered in the live Stripe dashboard with the right event subset.
- **[BLOCKER for verified billing]** Shaun's Stripe account verification is still pending. Whole live-mode flow is gated on that.

### End-to-end Stripe Checkout from production domain
- Once live mode is wired, we need an actual successful Checkout against the live domain using a real card (we have used test cards extensively).
- Confirm webhooks land on `app.quote-core.com` (DNS + reachability + signature verification).

### Cancellation flow against a live sub
- We've tested cancel-via-portal-cancel-at-period-end in test mode. Need to confirm the live-mode webhook fires the same way.

### Dunning / dispute / suspended flows in live
- The cron logic is shared with test mode but the timing in live is real-clock. Worth eyeballing the day-14 / day-24 / day-75 transitions against the dunning cron once a live sub exists.

### Storage quota at scale
- We've tested storage quota enforcement on small uploads. Need a stress test: what happens at exactly 99.9% storage with a 1 MB upload that pushes over? Does the finaliser correctly delete the uploaded object?

### Concurrency edge cases
- `create_quote_atomic` uses a per-company advisory lock so two parallel creates can't both pass the cap check.
- `require_component_slot` and `require_flashing_slot` do **not** take advisory locks (documented as accepted small race window). Worth confirming this is OK or asking us to add locks.

### Cross-browser
- We've tested in Chrome on Windows. Safari (Mac + iOS), Firefox, mobile Chrome — nothing has been formally verified.

### Withdrawn / suspended / canceled accounts trying to do things
- Read access should still work. Write paths should refuse with `SubscriptionInactiveError`. Worth walking through every server action and confirming.

### EU/UK GDPR / Article 27
- Documented as open loop. EU representative is required before paid launch in EU. Shaun has parked this until after paid-mode testing.

### Costa Rica PRODHAB registration
- The legal entity is Costa Rica. PRODHAB database registration needs confirmation with CR lawyer before paid launch.

### Mobile signup flow
- We've tested signup on desktop. Mobile signup has been spot-checked but not run through end-to-end.

---

## What you'll want to audit specifically

### Security
- **RLS policies** on every table. Especially `subscription_plans`, `subscription_events`, `company_quote_usage`, `support_tickets`. Phase 1 added a lot of new tables.
- **SECURITY DEFINER functions** — all use `SET search_path = public`; please verify no privilege escalation paths.
- **Webhook signature verification** — confirm `STRIPE_WEBHOOK_SECRET` is the only auth on the webhook endpoint.
- **Server actions** — confirm every gated mutation calls `requireCompanyContext` or equivalent.
- **Storage buckets** — `QUOTE-DOCUMENTS` should be private (verify on each environment), `company-logos` is intentionally public.
- **Admin routes** — `/admin/*` should require admin role, not just authenticated.

### Production-readiness
- **Error handling** — any unhandled promises? Server actions that throw instead of returning typed errors?
- **Monitoring** — do we have a way to detect "Stripe webhook deliveries are failing" or "create_quote_atomic is returning P0002 unusually often"?
- **Logging** — any `console.log` calls in server code that should be removed or downgraded?
- **Env vars on `quotecore-plus-main`** — verify every required env var is present (Supabase URL + service role key + JWT secret, Stripe live keys when ready, Vercel cron secret, anything for email).
- **Sitemap / robots.txt** — ensure they're correct for the production domain.

### Code hygiene
- 8 pre-existing ESLint errors (none from Phase 1, but worth a sweep).
- A lot of `any` warnings in `FlashingCanvas.tsx` — would you prefer we address before launch or defer?
- Migration files: 4 new migrations added (`20260518133737` to `20260518164411`). All idempotent.

### Specific files I'd start with
- `app/lib/billing/entitlements.ts` — the centre of the universe.
- `app/api/webhooks/stripe/route.ts` — the integration surface.
- `app/(auth)/[workspaceSlug]/account/billing/BillingPanel.tsx` + `actions.ts` — the user-facing money path.
- `app/api/cron/process-billing-lifecycle/route.ts` — the dunning state machine.
- `backend/supabase/migrations/20260515160000_subscription_tiers_phase1.sql` + the v2/v3 migrations.

### Continuing user-flow testing
Shaun would like you to continue exercising:
- The whole billing surface end-to-end as a new user, including signup → trial → upgrade → downgrade → cancel.
- The trial-once-per-account rule (try to abuse it).
- Edge cases on quote/component/flashing caps (off-by-one, race condition, deletion to free a slot then re-add).
- Customer-facing accept/decline/request-changes flow (this hasn't materially changed but it's the customer's first impression).
- Material orders flow from creation through to dispatch (supplier token URL works correctly).
- Email send + follow-up dispatch cron (we tested test mode; verify real send behaviour).

---

## Open loops we already know about

Documented in `MEMORY.md` and the cron route headers; flagged here so you don't list them as findings:

1. **Phase 2 data purge** — `process-billing-lifecycle` only changes status; actual file/quote deletion is Phase 2.
2. **Phase 2 storage quota for `company-logos`** — only `QUOTE-DOCUMENTS` is quota-gated today.
3. **Native `alert()` calls** in material orders forms — deferred until subscription tiers ship to main.
4. **EU/UK Article 27 representative** — before paid launch.
5. **Costa Rica PRODHAB registration** — before paid launch.
6. **Drop legacy `unit` field on flashing measurements** — future cleanup.
7. **Drop legacy `takeoff_canvas_url` / `takeoff_lines_url` columns** — future cleanup.
8. **In-app plan switcher** — today users must go via Stripe Portal to switch tiers. A native switcher (`stripe.subscriptions.update` with proration) is desired follow-up but not a blocker.

---

## Deliverables we need from you

1. **Audit findings** in the same format as your previous reports (Critical / High / Medium / Low with file + line refs).
2. **Go / no-go recommendation** for `development → main` merge.
3. **Production-readiness checklist** — env vars, monitoring, deploy hygiene.
4. **Continuing test plan** — what user-flow scenarios should we run before launch that we haven't yet.
5. **Stripe live-mode handover checklist** — concrete steps Shaun needs to take in the live Stripe Dashboard.

Deliver as you usually do: a single markdown file in `docs/internal/` or `docs/`, dated. Tag specific findings with file/line refs so we can action them quickly.

---

## Useful starting URLs

- **Dev preview:** `https://quotecore-plus-dev.vercel.app` (mirrors `development` branch)
- **Repo:** `https://github.com/algora-dev/quotecore-plus`
- **Latest dev HEAD:** `bd55039`
- **Subscription tiers brief (your prior work):** `docs/internal/subscription-tiers-brief.md`
- **MEMORY.md** in workspace root has the durable architecture facts.

Shaun has full Stripe + Supabase access if you need data; ping him or me.

Thanks Gerald — this one matters. Take the time you need.
