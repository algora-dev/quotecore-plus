# QuoteCore+ Master Implementation Plan
**Owner:** Shaun · **Last revised:** 2026-05-19 · **Status:** Living document

This is the single source of truth for what QuoteCore+ becomes after Phase 1
launch. It synthesises three inputs:
1. `projects/qcp_master_feature_brief_and_implementation_plan.md` — Shaun's
   product vision (13 systems, 6 phases).
2. `projects/# Quotecore+ AI Mobile Assistant.md` — Shaun's AI/mobile
   whitepaper.
3. `C:\Users\Jimmy\.openclaw\workspace-gerald\audits\quotecore-plus-future-features-2026-05-19\04-report.md`
   — Gerald's architectural review.

Where the docs disagree, Gerald's sequencing wins because it accounts for
the security debt + the realities of the current Next.js/Supabase/Stripe
stack (a Flutter/NestJS rewrite right now would stall revenue).

The order is ruthlessly sequenced: **fix what we have → build operational
foundations → ship the mobile companion → layer AI on top → expand
financial workflows → growth & advanced AI.**

---

## Section A — Headline Direction

**What we're building:** "The operational operating system for trades
businesses." Quoting is the wedge. The moat is structured workflow data +
mobile-first daily operations + an AI interface that knows the user's
business.

**What we're NOT doing right now:**
- Rewriting to Flutter/NestJS/Firebase. That stack is fine as an eventual
  target, but starting it before Phase 2 ships kills revenue and adds two
  new attack surfaces while the original Phase 1 surface is still healing.
  Keep Next.js + Supabase + Stripe + Resend until at least the mobile
  companion phase, then evaluate.
- Building a general-purpose AI assistant. Domain-specific, retrieval-
  grounded, tool-calling AI with human-confirmed writes. No autonomous
  invoices, no autonomous customer email, no autonomous billing actions.
- Multi-trade generalization in the near term. Roofing excellence first.
  Add `trade_type` / `vertical` extension seams as we go so we don't paint
  ourselves into roofing-only naming, but don't refactor for plumbing
  until roofing converts.

**Strategic principle:** every feature added between now and the mobile
phase should pass two tests:
1. Does it make the operational object model more truthful (jobs, tasks,
   schedules, events, notifications)?
2. Will it eventually be reachable from a mobile client AND an AI tool
   call through the SAME server-side action with the SAME permission
   check?

If yes to both, build it. If no, defer.

---

## Section B — Build Order (the canonical sequence)

This is the master order. Subsequent sections expand each item.

### Phase 0 — Pre-flight (NOW, blocks paid launch)
- P0.1 Land Gerald's launch audit closures (commits `20b0abe..4fb5820` on
  `feature/tier-gating-v2`). Awaiting Gerald re-audit.
- P0.2 Stripe LIVE mode verified end-to-end (account verification cleared,
  live products + prices + coupons seeded, webhook endpoint live, one real
  live Checkout + sub.created round-trip captured in `webhook_deliveries`).
- P0.3 `feature/tier-gating-v2` → `development` → Shaun smoke tests → `main`.

### Phase 1 — Foundations (while app is live; pre-mobile, pre-AI)
- P1.1 RBAC / permission helper. **(Foundational; everything later depends on this.)**
- P1.2 `activity_events` append-only audit table.
- P1.3 Idempotency-key infrastructure for background actions.
- P1.4 `jobs` / `tasks` / `schedule_events` / `assignments` schema (behind
  feature flags; not exposed in UI yet).
- P1.5 Server-only domain actions for task/schedule/status mutations
  (shared by web, future mobile, future AI).
- P1.6 Unified notification/event model (centralize the alert + outbound
  message + scheduled message foundations under one event API).
- P1.7 Admin tooling foundations: admin RBAC (move `users.is_admin` boolean
  to roles), every admin action logged, MFA enforced.
- P1.8 Transition-prep items from Gerald's "Current Code Changes" list
  (extension seams: `trade_type`, generic naming for new tables, storage
  finaliser as the upload boundary going forward).

### Phase 2 — Operational systems (ships to web first; mobile uses the same APIs)
- P2.1 Job/project page (jobs are first-class, not derived from
  `quotes.job_status`).
- P2.2 Task management (assignee, due, priority, related job/quote/
  customer, comments).
- P2.3 Calendar / scheduling (day/week/month views, drag-and-drop,
  conflict detection, recurring, timezone-aware).
- P2.4 Team assignment (which user owns which job/task/event).
- P2.5 In-app alerts tied to events (drive everything through the
  notification event model from P1.6).
- P2.6 Extend the existing scheduled-messages pipeline for operational
  reminders (overdue follow-up, missing site visit, quote unaccepted >N
  days).

### Phase 3 — Mobile companion MVP
- P3.1 Auth + session refresh (Supabase Auth tokens; pick framework after
  P2 is live — likely Expo/React Native for shared JS skill set or Flutter
  if mobile-native UX wins out).
- P3.2 Today view (jobs, tasks, alerts).
- P3.3 Quote/job lookup (read-only at first).
- P3.4 Push notifications (one new infra dep: FCM or Expo Push).
- P3.5 Simple status updates (manual job status change, mark task done).
- P3.6 Job notes + photos (uploads via the existing signed-upload-URL
  flow — H-05 closure already supports the mobile case if it uses the same
  API).
- P3.7 NO AI in this phase. AI ships in P4 after the read APIs are stable.

### Phase 4 — AI assistant MVP (read-heavy, retrieval-grounded)
- P4.1 Tool registry: every AI-callable action is a server-side function
  that already exists in P1.5 (task.create, note.add, schedule.propose,
  job.status.update). Permission checks are the SAME as web/mobile.
- P4.2 Retrieval layer: pgvector embeddings on quote/job/task/customer
  records + summary text. NO model memory.
- P4.3 Intent classifier → tool call → permission check → propose to user
  → human confirms → execute → audit-log to `activity_events`.
- P4.4 Voice (Whisper / GPT-4o transcribe in, GPT-4o TTS out) once the
  text flow is solid.
- P4.5 No AI writes that touch billing, invoices, customer email, plan
  state, discounts, or approvals.

### Phase 5 — Financial expansion
- P5.1 Invoice system (generated from quotes; Stripe-paid links;
  branded; ledger-backed).
- P5.2 Deposit + quote acceptance with deposit gating.
- P5.3 Payment tracking + immutable payment ledger.
- P5.4 Custom email branding (per-company sending domain, SPF/DKIM, MJML
  templates).

### Phase 6 — Growth + advanced AI
- P6.1 Discount code system.
- P6.2 Referral / affiliate.
- P6.3 Analytics (PostHog or equivalent).
- P6.4 Multimodal AI (roof photos, plan analysis).
- P6.5 Predictive workflows (win/loss prediction, upsell suggestions).
- P6.6 Semi-autonomous automation (drafts only; human approval mandatory).

### Phase 7 — Multi-trade
- P7.1 Activate the extension seams added in P1.8 (`trade_type` becomes
  real; per-trade modules; per-trade templates).
- P7.2 Decide first non-roofing vertical based on customer demand.

---

## Section C — Stripe LIVE mode status (verified 2026-05-19)

Verified by inspecting Vercel env (`vercel env ls`):
- `STRIPE_SECRET_KEY` exists in Production / Preview / Development.
- `STRIPE_PUBLISHABLE_KEY` and `STRIPE_WEBHOOK_SECRET` exist across all
  three environments.

**What still needs to happen before flipping live mode on:**
1. **Confirm `sk_live_*` is the production key.** Code in
   `app/lib/billing/stripe.ts` detects mode via `STRIPE_MODE=live` env OR
   `sk_live_*` prefix sniff. Set `STRIPE_MODE=live` on
   `quotecore-plus-main` (Production env) explicitly to remove any
   ambiguity.
2. **Seed live products + prices + coupons.** Run `node
   scripts/seed-stripe-products.mjs` against the live Stripe account.
   Script is idempotent (uses metadata + lookup_key). It prints SQL to
   paste into Supabase to populate `subscription_plans.stripe_price_id_live`
   and the live coupon IDs.
3. **Create the live webhook endpoint.** Stripe dashboard → Webhooks →
   add `https://app.quote-core.com/api/webhooks/stripe` (or whatever the
   prod domain ends at). Events: `checkout.session.completed`,
   `customer.subscription.created/.updated/.deleted`,
   `invoice.payment_succeeded/.payment_failed`,
   `charge.dispute.created/.closed`. Copy the live signing secret into
   `STRIPE_WEBHOOK_SECRET` on Production.
4. **Run one controlled live test.** Real card, Starter checkout, verify
   `webhook_deliveries` row, sub.created handler fires, `companies` row
   gets `plan_code='starter' / status='active'`. Then immediately cancel
   via Customer Portal so the test sub doesn't keep billing. Document the
   test in `memory/2026-05-XX.md`.

Until #4 is done, the launch is not actually launchable; the code is
ready, the wiring isn't fully verified.

---

## Section D — System-by-system implementation notes

The numbering matches Shaun's master brief. Each entry has:
- **Why:** the business case.
- **Phase:** which of the build-order phases it slots into.
- **Build now:** transition-prep work to do BEFORE the feature ships, so
  later migration is cheap.
- **Defer:** what we're explicitly NOT doing in this round.

### 1. AI Mobile Assistant — Phase 4 (read first), Phase 6 (advanced)
**Why:** the fastest operational interface to QuoteCore+. Voice + chat
retrieval. Differentiator against ServiceTitan/Jobber once the operational
data model is rich enough to query.

**Build now:**
- The tool registry pattern: every server action that could be an AI tool
  must already exist as a typed server action with a permission check and
  an audit log entry. No AI-specific code paths. Land this in P1.5.
- pgvector extension enabled on Supabase (free; one-time `CREATE EXTENSION
  vector;`). Don't populate embeddings yet — just have the capability.
- A `tool_call_log` table shape sketched (entity_type, entity_id,
  proposed_action, confirmation_status, executed_at, actor=ai). Likely a
  view over `activity_events` rather than a new table.

**Defer:**
- The actual LLM integration, voice pipeline, RAG stack, and orchestration
  layer until P4. Picking LangChain vs custom orchestration is a P4
  decision, not now.
- Realtime voice API (expensive; commit only after the text MVP shows
  retention).
- Per-user AI billing/credits — that's a Phase 5 decision tied to invoice
  + plan work.

**Cost guardrails:** the whitepaper estimates light = $4-12/mo, medium =
$12-35/mo, heavy = $30-80/mo. Means AI must be a paid add-on or capped per
plan; budget for it in the tier matrix when AI ships, not before.

### 2. Mobile App — Phase 3
**Why:** trades users are in vans / on ladders / in customer kitchens.
Desktop-only ≈ multi-hour delays per workflow.

**Build now:**
- The signed-upload-URL flow (already shipped in H-05) is the canonical
  mobile upload path. No new infra needed.
- Every server action that a mobile screen will call should be reachable
  via Supabase from a non-browser context (it already is — we use the
  user's JWT). Mobile auth = the same Supabase Auth, just a different
  client SDK.
- Push-notification capability: design the notification event model
  (P1.6) so adding a "push" channel later is one new column + one delivery
  worker, not a refactor.

**Defer:**
- Choosing Flutter vs React Native / Expo. Decide when we kick off P3 —
  by then we'll know whether the team learning Dart is worth Flutter's UX
  wins, or whether keeping TypeScript across web + mobile (Expo) is the
  bigger lever.
- Native module work (camera, sensors). The MVP is push + dashboard +
  uploads.

### 3. Project Management / Schedule System — Phase 2
**Why:** highest-value operational feature after quoting. Currently QCP
has `quotes.job_status` doing double duty as a job lifecycle field, which
breaks the moment a job has more than one quote OR more than one schedule
event.

**Build now (transition-prep in P1.4):**
- Schema for `jobs`, `tasks`, `schedule_events`, `job_assignments`,
  `activity_events`. Feature-flagged off in UI. Triggers can start
  writing rows when quotes are accepted, so by the time P2 launches the
  history is already there.
- Generic naming: `jobs.trade_type` column from day one. No
  `roof_pitch_default` on the generic `jobs` table — roof-specific stays
  on roof-specific modules.

**Defer:**
- Route optimisation, weather-aware scheduling, AI conflict detection.
  Phase 6.

### 4. Image & File Compression — Phase 2/3 (mobile-driven)
**Why:** mobile photo uploads will dwarf desktop uploads. Without
compression, storage costs spike and mobile UX degrades.

**Build now:**
- The storage finaliser (already shipped) is the enforcement boundary.
  Add `original_size`, `compressed_size`, `thumbnail_path` fields to
  `quote_files` (or wherever the new mobile uploads land) so derivatives
  can be tracked alongside originals.
- Keep originals by default. Gerald's caution is legit — contractors need
  proof images. Compression generates derivatives, not destructive
  replacements.

**Defer:**
- The actual compression worker (Sharp + BullMQ pattern, or Supabase
  Edge Function for sync). Build when mobile starts producing volume.
- Video transcoding. Phase 6+.
- Malware/virus scanning for uploaded docs. Only when we accept arbitrary
  customer-uploaded files (we don't yet).

### 5. Admin Backend — Phase 1
**Why:** support, billing oversight, suspension, debugging. Already partly
exists (`/admin/(dashboard)`, `requireAdmin()`).

**Build now:**
- Move `users.is_admin` boolean → `admin_roles` table with named
  permissions (`admin.support`, `admin.billing.read`, `admin.billing.write`,
  `admin.impersonate`, `admin.debug.read`, etc). Boolean is OK for
  support-tickets v1, NOT OK for billing impersonation. Migrate before
  Phase 5 invoices land.
- MFA required for any user with an admin role.
- Every admin action writes to `activity_events` (or a sister
  `admin_action_log`) with actor, action, target, before/after diff,
  IP. Non-negotiable before billing tools land.

**Defer:**
- Raw-SQL admin query tool. Gerald's right: this is a backdoor. Curated
  read-only diagnostics only in v1 (account lookup, sub status, Stripe
  IDs, webhook delivery list, storage usage, recent errors, support
  ticket context).
- Impersonation. High-risk feature; design properly (read-only mode +
  banner + time-bounded + audit trail) before building.

### 6. Invoice System — Phase 5
**Why:** captures more of the contractor workflow than quoting alone.
Improves cash flow + retention.

**Build now:** nothing direct, but the operational data model (P2 jobs +
schedule_events) is the prereq. Invoices should be tied to jobs, not
free-standing.

**Defer:** all invoicing UI/PDF/email until P5. The Stripe webhook
hardening from Phase 0 covers the future payment-webhook needs, so the
infra prerequisite is already met.

### 7. Deposit & Quote Acceptance — Phase 5
**Why:** customer commitment + cash flow.

**Build now:**
- The existing public accept-quote flow (`/accept/[token]`) is the seam.
  Add a Stripe Checkout step option in P5; the acceptance lifecycle is
  already wired.
- Idempotency keys on deposit payments (P1.3 covers this generically).

**Defer:** financing integrations, installment plans (Phase 6+).

### 8. Multi-Trade Expansion — Phase 7
**Why:** TAM expansion long-term. Roofing is the wedge; the platform value
is operational, not vertical-specific.

**Build now (extension seams only):**
- `companies.trade_type text DEFAULT 'roofing'` — even though only roofing
  exists today, having the column means we don't have to backfill later.
- `subscription_plans.included_trades text[]` — Phase 7 plan tiering hook.
- Avoid roof-specific naming on new generic tables. `flashing_library`
  stays roof-specific (it IS roof-specific); `jobs`, `tasks`,
  `schedule_events`, `activity_events` are generic.

**Defer:**
- Per-trade modules until customer demand. Don't pre-build for plumbing.
- Trade-specific templates / pricing until P7 kicks off.

### 9. Custom Email Branding — Phase 5
**Why:** customer-facing emails shouldn't say "QuoteCore+"; they should
say the contractor's brand. White-labelled communications = perceived
value.

**Build now:**
- Per-company email template settings table sketch
  (`company_email_templates`: company_id, template_type, subject_template,
  body_mjml, from_name, reply_to). Build the schema; populate later.
- Resend supports per-account custom domains. Document the DKIM/SPF setup
  in `docs/internal/email-domains.md` so when P5 ships we're not figuring
  it out under deadline.

**Defer:** the actual UI + MJML editor + domain verification UX until P5.

### 10. Referral & Affiliate — Phase 6
**Why:** growth lever once retention proves out. Compounds.

**Build now:** nothing. This is downstream of Phase 5 invoices/billing
maturity. Pre-building it before subscription state is rock-solid creates
revenue abuse risk.

### 11. Discount Code System — Phase 6
**Why:** promotional campaigns, onboarding offers, affiliate.

**Build now:** the Stripe coupon infrastructure is already wired (the
launch-discount coupons in `subscription_plans.launch_coupon_id_*` from
the 18 May launch-coupons migration). Phase 6 work is the user-facing
code-entry UI + admin code-creation tools, not the Stripe primitive.

### 12. Internal Messaging — Phase 2.5 (job-scoped) / Phase 6 (broad chat)
**Why:** centralise team + customer communication; reduce SMS/WhatsApp
fragmentation.

**Build now:** the existing `outbound_messages` + `scheduled_messages` +
suppression/reply-token infrastructure is the foundation. Don't replace
it. Generalise it.

**Phase 2.5 minimum:**
- Job/quote comment threads (mentions, attachments, push when mobile
  ships).
- Reuse the message audit + reply-token + suppression logic.

**Defer:** generic Slack-style chat. Gerald's right that this is a giant
build that doesn't earn its keep until much later. Job-scoped messaging
delivers 80% of the value at 20% of the build.

### 13. Alerts & Notification System — Phase 1.6 (foundation), Phase 3 (push)
**Why:** missed follow-ups + delayed payments are revenue leaks.

**Build now (P1.6):**
- Unified `notification_events` table: company_id, actor_user_id,
  recipient_user_id, event_type, payload, idempotency_key,
  delivered_at_in_app, delivered_at_email, delivered_at_push,
  read_at, created_at.
- User delivery preferences: per-user per-event-type channel toggles.
- Idempotency keys on every event production site so scheduled/AI/
  background events can't double-fire.

**Defer:** push delivery (P3) and SMS (no plan to ship SMS unless
explicitly demanded).

---

## Section E — "Build now" checklist (concrete code changes)

Things that can land between today and Phase 2 kickoff. Each makes a
later phase cheaper. Ordered by dependency.

| # | Item | Why now | Effort | Phase it unblocks |
|---|------|---------|--------|-------------------|
| 1 | RBAC / permission helper (`requirePermission(profile, 'quote.update_status')` etc) | Every later mutation goes through it. Shipping AI/mobile without this guarantees a security incident. | Half day | P1.5, P3, P4 |
| 2 | `activity_events` append-only audit table + helper to write rows | Used by ~everything in P2+. Cheaper to write event-emitting code on day one than retrofit. | Half day | P1.6, P4 (AI audit), P5 (admin) |
| 3 | Idempotency-key middleware for cron + webhook + AI tool routes | Existing webhook idempotency is event-id-based; generalise to a `(scope, key, expires_at)` table so push/AI/scheduled-message paths share it. | Half day | P1.6, P3, P4 |
| 4 | Schema for `jobs`, `tasks`, `schedule_events`, `job_assignments` (behind feature flag, no UI) | Migrations are cheap before there's data; expensive after. Triggers can start populating from quote-acceptance events. | 1 day | P2 (whole phase) |
| 5 | `companies.trade_type text DEFAULT 'roofing'` + plan-side `included_trades text[]` | Multi-trade extension seam. Free to add now. | 15 min | P7 |
| 6 | Move `users.is_admin` bool → `admin_roles` table; require MFA for any role | Boolean was OK for support tickets; insufficient for billing/impersonation. Must land before invoices (P5). | Half day + MFA enforcement | P1.7, P5 |
| 7 | `tool_call_log` view or table for AI action logging (proposed → confirmed → executed) | Lets us turn on AI in P4 without bolting audit on after the fact. | 1-2 hours | P4 |
| 8 | Add `original_size`, `compressed_size`, `thumbnail_path` to `quote_files` (mobile uploads land here) | Mobile photo flood will start in P3. Compression worker arrives later but the column is free now. | 15 min | P3/P4 |
| 9 | Enable `CREATE EXTENSION vector` on Supabase | Free; future-proofs the RAG layer. Embeddings can populate later. | 1 min | P4 |
| 10 | `company_email_templates` schema sketch | Per-company branding is P5, but the table shape is free. | 30 min | P5 |
| 11 | Generic-naming audit of any new tables created in P1: no roofing-specific terms on tables that belong to the generic operational layer | Pre-empts a painful rename when multi-trade lands. | Code review only | P7 |
| 12 | Notification preferences table (`user_notification_prefs`: user_id, event_type, channel_inapp/email/push) | P3 needs to know whether to push. Schema first, UI later. | 1 hour | P1.6, P3 |

**Total for the "build now" checklist:** roughly 3-4 days of focused
work, all of which can happen on a sibling branch (`feature/foundations-v1`)
while the audit-closure branch goes back to Gerald.

---

## Section F — Stack decisions (locked vs deferred)

### Locked
- **Web framework:** Next.js 16. No rewrite.
- **Database:** Supabase Postgres. No migration to "real" Postgres yet.
- **Auth:** Supabase Auth. (Not Auth0/Firebase Auth as the docs suggest —
  we already have it working with MFA, recovery flows, RLS integration.)
- **Storage:** Supabase Storage. (Not AWS S3 / Cloudflare R2 yet — the
  signed-upload-URL flow shipped in H-05 makes our current setup
  defensible. Migrate to R2 later only if egress costs justify.)
- **Payments:** Stripe.
- **Email:** Resend.
- **Hosting:** Vercel.

### Deferred decisions (the docs propose specific stacks; we'll pick at
the relevant phase)
| Decision | Doc suggests | Decide at | Notes |
|----------|--------------|-----------|-------|
| Mobile framework | Flutter | P3 kickoff | Strong case for Expo/React Native (TypeScript shared with web). Flutter only if mobile-UX-perfectionism wins. |
| Vector DB | pgvector / Pinecone | P4 kickoff | pgvector by default (same Postgres, no new infra). Pinecone only if scale demands. |
| LLM orchestration | LangChain / custom | P4 kickoff | Custom orchestration likely — LangChain adds abstraction layers we'd fight. |
| Background job queue | BullMQ | When P2/P3 work actually exceeds Vercel Cron | Vercel Cron + Supabase Edge Functions cover us through P3. BullMQ + a worker service only if/when we hit real throughput. |
| Analytics | PostHog | P6.3 | PostHog is the right answer; just don't pay for it yet. |
| Push notifications | Firebase Cloud Messaging | P3.4 | FCM for Android, APNs for iOS, OR Expo Push to abstract both. Decide when P3 starts. |

### Rejected (for now)
- NestJS as a separate backend service. Reason: Next.js server actions +
  API routes are sufficient through P4. NestJS adds a service to deploy,
  scale, and secure independently — only justified at heavy background-job
  scale.
- Firebase as a Supabase replacement. We have working RLS + Auth + Storage
  + Realtime + Postgres. Switching is a giant migration with zero new
  capability for the user.

---

## Section G — Security posture (must-haves before any of this ships)

Lessons from the 2026-05-18 Gerald audit applied to the future roadmap.

1. **Every mutation must have a permission check.** No exceptions for AI,
   mobile, or background jobs.
2. **Every mutation must produce an `activity_events` row** with actor
   (user / ai / system / cron), action, before/after diff where relevant.
3. **Every SECURITY DEFINER function** added must follow the explicit
   REVOKE/GRANT pattern from migration `20260519100100`. Default-deny.
4. **No AI / mobile / background path bypasses RLS without using the
   admin client AND running its own permission check first.**
5. **Notification fan-out is idempotent.** A scheduled message that fires
   twice must deliver once. Idempotency keys.
6. **Storage uploads from any client (web, mobile) go through the
   signed-upload-URL flow.** No direct authenticated INSERT on
   `storage.objects`.
7. **Admin actions require MFA.** Boolean `is_admin` is acceptable for
   support tickets only; everything else needs the role system from E.6
   above.
8. **Any new RLS policy that touches sensitive fields gets a regression
   test script** in the `scripts/test-*.mjs` pattern. The 185-check suite
   from the May audit closure is the floor, not the ceiling.

---

## Section H — Risks + active mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| AI / mobile writes amplify Phase 1 RLS flaws | Critical (Gerald) | Phase 0 closures applied; re-audit pending. Phase 4 AI ships ONLY after Phase 1 RBAC + audit. |
| Architecture rewrite stalls revenue | High | Locked Next.js/Supabase/Stripe through P4. Mobile framework decision deferred to P3 kickoff. |
| Scheduling/tasks bolted onto `quotes.job_status` instead of a real domain model | High | P1.4 ships `jobs/tasks/schedule_events` as first-class tables. `quotes.job_status` becomes legacy. |
| Admin tools become a backdoor | High | RBAC + MFA + audit log + curated read-only diagnostics. NO raw SQL UI in v1. |
| Notification fan-out duplicates | High | Idempotency-key table in P1.3; every notification site uses it. |
| Multi-trade over-generalisation | Medium | `trade_type` extension seam only. No per-trade modules until P7 + demand. |
| File compression destroys evidence | Medium | Compression generates derivatives; originals preserved. |
| Per-user AI cost spirals | Medium | Whitepaper costs are $4-80/mo. AI ships as paid add-on or capped tier. Pricing decided in P5 alongside invoice work. |
| Live Stripe verification not actually verified | Medium | Section C checklist. Don't claim launched until one real live round-trip is captured. |

---

## Section I — How to use this document

1. **At the start of every new feature**: open this file, find the
   relevant Phase / numbered item, read Gerald's caution + the "Build
   now" entries. Cross-reference Section E to see whether the prerequisite
   foundations have shipped.
2. **At the start of every new branch**: confirm the work serves Section
   B's current phase OR is a Section E "build now" item. Anything else is
   scope creep.
3. **When this doc and a Shaun directive disagree**: Shaun wins, this doc
   gets updated.
4. **When this doc and a Gerald audit disagree**: pause, discuss with
   Shaun, then update.
5. **Quarterly**: re-read; the locked vs deferred table will shift as
   phases ship.

---

## Section J — Open questions for Shaun

1. **Live Stripe verification:** account verification cleared per your
   message. Want me to run Section C steps 1-4 next session (set
   `STRIPE_MODE=live` on Production, seed live products, create the live
   webhook, run one live Checkout test)?
2. **`feature/foundations-v1` branch:** OK to open this as the home for
   Section E build-now items, parallel to `feature/tier-gating-v2` which
   awaits Gerald re-audit? Or hold all foundation work until the audit
   branch merges?
3. **Mobile framework gut feel:** any preference between Expo/React Native
   (shared TypeScript stack) and Flutter (best native UX)? Asking now so
   we can think about it across Phase 1; not blocking.
4. **AI billing model:** the whitepaper proposes three options
   (included tier / usage add-on / credit system). Want me to draft a
   recommended option as part of P5 planning, or wait until we're closer
   to P4?
5. **Multi-trade priority:** any signal yet on whether the second
   vertical should be plumbing, electrical, solar, or HVAC? Doesn't
   need answering now (Phase 7) but useful for naming decisions in P1.
