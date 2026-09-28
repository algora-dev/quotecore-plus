# QuoteCore+ Live Demo --- Architecture V2 & Zero-Context Agent Handoff

**Status:** LOCKED / HOLD\
**Prepared:** 2026-09-26\
**Implementation state:** Not built\
**Reconnaissance baseline:** `ux/phase-4` @ `99e8b0c7`, plus read-only
production Supabase catalog/auth-config inspection.

> **New-agent instruction:** Read this file in full before changing
> code. Do not start the full demo build until the current UX/mobile
> overhaul and Smart Assistant V2 are complete and merged. Then run the
> delta audit below against the final target branch. This file is the
> architecture contract; Plan v1 and the evidence packs are supporting
> history.

## 1. Context and purpose

QuoteCore+ is a construction/roofing quoting SaaS using Next.js App
Router, React/TypeScript, Tailwind, Supabase auth/DB/storage/RLS,
Fabric.js takeoff, jsPDF/html2canvas, Stripe and Vercel. Core surfaces
include quotes, priced components, catalogs, digital takeoff, material
orders, invoices, job spaces, inbox/messages, alerts, supplier
directory, Smart Assistant, AI takeoff and templates.

The old 14-day trial was removed. The product now has public free tools
and a paid-app funnel. The live demo fills the gap:

**free tools → live demo → paid QuoteCore+**

It must expose the real app without requiring signup, login click, card
or payment details.

## 2. Timing, scale and threat model

**LOCKED:** Full implementation waits until the UX/mobile overhaul and
Smart Assistant V2 are complete/merged. The demo exists to showcase
those final experiences.

Expected traffic is roughly 100--300 visitors/month initially, with
\~1,000/month a reasonable ceiling before reassessing architecture.

Threat model is ordinary internet misuse. Do not initially add device
fingerprinting, VPN detection, mandatory CAPTCHA, Redis fraud
infrastructure or complex scoring. Hard cost/external-effect boundaries
remain server-enforced.

## 3. Locked product behaviour

-   Public entry: `https://quote-core.com/demo`.
-   One deliberately authored fictional roofing/construction business.
-   Independent mutable sandbox per visitor; zero crossover.
-   Real QuoteCore+ CRUD, not a canned simulation.
-   Seeded people/businesses/addresses/contact details are fictional.
-   Demo is resumable for **24 hours** after successful provisioning.
-   Closing browser/tab/device does not intentionally reset it.
-   **Reset Demo / Start Again** creates a fresh sandbox.
-   Smart Assistant, transcription and AI takeoff have a small
    allowance.
-   Target maximum AI exposure ≈ **\$0.50 equivalent per visitor/IP
    budget window**, calibrated after final SA V2/takeoff testing.
-   AI exhaustion leaves non-AI functionality working.
-   No real outbound email, customer/public URLs, Stripe, accounting
    export/connect, supplier submission or destructive
    account/team/integration actions.
-   No normal app PDF/download action or hosted document delivery.
-   Browser print/screenshots/extraction of already-rendered client
    content are accepted limitations.
-   Rendered customer-facing demo documents visibly say DEMO.
-   Desktop and final mobile UX both support the complete experience.

## 4. Final architecture

**LOCKED:**

`quote-core.com/demo` → `demo.quote-core.com` → isolated Supabase
anonymous auth → privileged provisioner → per-session cloned company →
normal QuoteCore+ + existing RLS → demo capability/AI guards → 24-hour
logical expiry → asynchronous cleanup.

Each demo gets one anonymous auth user, app `users` profile, cloned
company, unique workspace slug, `demo_sessions` row, tutorial state,
session AI allowance and IP AI allowance that survives resets/new
sessions within its window.

Rejected for V2: copy-on-write overlays, pre-warmed pools,
Redis/Upstash, custom auth replacing Supabase, duplicate demo
implementations, browser-close destruction and mandatory CAPTCHA at
launch.

### Why clone-on-entry

Verified tenant structure is favourable: `companies` is tenant root;
users belong through `users.company_id`; core RLS resolves `auth.uid()`
to company; inspected ownership policies did not require
email/non-anonymous status. A provisioned anonymous user therefore fits
normal RLS. Initial company/profile provisioning must be service-role.

Estimated lean clone: \~35--45 populated tables, \~700--1,400 rows, plus
a few storage assets. This is small at expected traffic. Copy-on-write
would spread demo/session logic throughout the workspace; clone-on-entry
keeps normal app semantics.

## 5. Authentication isolation

A logged-in paying customer must be able to use the demo without their
real session being replaced.

Reconnaissance found `app/lib/supabase/cookie-config.ts` centralizes
cookie configuration and hostname already flows through the main
browser/server factories.

Normal cookie: `sb-qcp-auth`\
Demo cookie: `sb-qcp-demo-auth`

Hosts: - `quote-core.com` marketing - `app.quote-core.com` normal app -
`demo.quote-core.com` demo

Hostname selects which auth cookie is read/written. Demo reset/sign-out
cannot touch normal auth; normal sign-out cannot touch demo auth.

Host isolation was selected over path-scoped `/demo/[workspaceSlug]`
because the workspace route tree is `/{workspaceSlug}` and hostname is
already available.

Never upgrade/link the anonymous demo identity into a permanent account.
Conversion crosses to the normal app host,
e.g. `https://app.quote-core.com/signup`. Any future "keep demo work"
feature must migrate data explicitly.

**Operational prerequisite:** production inspection confirmed anonymous
Supabase sign-in is currently disabled
(`external_anonymous_users_enabled = False`). Do not enable it now.
Enable in test when implementation is ready, and production only during
controlled launch.

## 6. RLS, demo plan and launch security prerequisite

Feature-gated DB policies resolve through `subscription_plans`;
therefore `plan_code='demo'` requires a real plan row with appropriate
features/caps.

Avoid duplicate `companies.is_demo` unless implementation proves a
concrete need. `demo_sessions` + plan code should normally suffice.

Reconnaissance found an overly permissive `quote_files` INSERT policy
(`WITH CHECK(true)`). Before public anonymous demo auth is exposed,
re-check and fix it if still present so inserts are company/quote
scoped. It may have changed by implementation time.

## 7. Session lifecycle

Recommended statuses: `provisioning`, `active`, `terminating`,
`expired`, `cleanup_pending`, `cleanup_failed`, `deleted`.

New demo: 1. Rate-limit creation. 2. Create anonymous Supabase identity.
3. Create `demo_sessions` as `provisioning`. 4. Privileged provisioner
creates company/profile/data. 5. Validate clone. 6. Set
activation/expiry. 7. Mark `active`. 8. Establish demo auth cookie. 9.
Redirect to unique slug such as `demo-x7k2q`.

Returning within 24 hours resumes the same workspace.

Reset prevents new work on the old sandbox, cleans it and provisions a
fresh one. It does **not** reset IP AI allowance.

At `expires_at`, server access/writes/new AI admission fail closed.
Physical deletion may happen later; correctness must not depend on cron
timing.

Multiple tabs share one demo. Reset/expiry must stop other tabs mutating
the old workspace; server validation is authoritative.

## 8. Frozen template, clone manifest and provisioning

Maintain one explicit frozen fictional template company. It is never
directly served, contains no real PII/live public tokens/external
integration identities, is versioned/frozen deliberately and contains
deterministic data for the guided tasks. Prefer authoring it through the
real UI then freezing.

Create a version-controlled **clone manifest** defining tables cloned,
dependency order, fresh-ID mapping, transformed columns, exclusions,
storage behaviour, date shifting and post-clone validation. Do not
dynamically clone every table with `company_id`.

Do not clone AI usage/cost ledgers, AI reservations, inappropriate prior
diagnostics, subscription events, integration
credentials/connections/exports, supplier applications/subscriptions,
webhook history, production usage counters, public/customer tokens or
external-system identifiers.

Historical takeoff FK/naming drift was found; use the final schema
rather than column-name assumptions. Treat JSON/JSONB snapshots as
opaque unless tests prove embedded IDs need remapping.

Prefer a transactional DB clone routine/RPC where practical rather than
dozens of independently committed requests. Auth-user creation remains
outside the DB transaction, so implement compensating cleanup. A partial
provision must never become `active`.

`companies.slug` uniqueness was verified. The random slug is an
identifier, not authorization; RLS remains authoritative.

### Relative dates

Shift selected visitor-facing dates at clone time so messages, current
quotes, accepted work, invoices and alerts remain believable. Do not
blindly rewrite every audit timestamp. Put date-shift rules in the clone
manifest.

## 9. Storage

`QUOTE-DOCUMENTS` was verified as company-folder scoped
(`<company_id>/...`), and a provisioned anonymous user fits normal
storage isolation.

Visitor uploads remain under the cloned company and are capped by
count/size.

For static seed plans: prefer safely reusable immutable seed assets if
final implementation permits this without weakening isolation; otherwise
copy only the minimum 1--2 required plan assets. Do not build a complex
shared-storage subsystem solely to save a few copies.

Cleanup explicitly deletes demo-owned storage; orphan sweeping is a
backstop.

## 10. Capability sandbox

Use three layers: UX treatment, server/action guard, and DB/feature
policy where appropriate. Server enforcement is authoritative.

Allowed internal activity includes quote/component/measurement CRUD,
digital takeoff, limited uploads, internal orders/invoices, approved
templates/job spaces, metered AI, seeded inbox/history and read-only
supplier-directory exploration.

Prohibited external activity includes all outbound app email,
quote/order/invoice sends, customer/public token creation, customer
acceptance, hosted public docs, Stripe, Xero/QB, real supplier
enquiries/applications, and team/account/2FA/integration mutations.

Where educationally useful, leave prohibited controls visible but
disabled with explanation instead of pretending the capability does not
exist. Hide irrelevant/destructive surfaces.

### PDF/document rule

Current PDF generation was verified as client-side jsPDF/html2canvas, so
"server-block all PDF generation" is impossible. Remove normal download
affordances, create no hosted/public document or share token, visibly
mark rendered docs DEMO, and accept browser
print/screenshots/extraction.

## 11. AI metering

**LOCKED:** Postgres, not Redis/Upstash.

Existing infrastructure already includes atomic distributed Postgres
rate limiting plus Smart Assistant/scan accounting. Build one shared
demo AI-budget service.

Every paid operation passes both a session budget and an IP budget.
Store IP as a server-side HMAC, not raw IP or a plain unsalted hash. IP
window is 24 hours and survives Reset Demo/new anonymous sessions.

Use integer credits. Final action costs are calibrated after SA
V2/takeoff testing.

Contract: - `reserveDemoCredits()` before provider cost; -
`settleDemoCredits()` when actual usage is known; -
`releaseDemoReservation()` when failure occurs before meaningful cost.

Session + IP admission must be atomic to prevent parallel overspend.

Queued AI scans reserve **at enqueue**, not worker execution. Attach
reservation/job reference and settle/release on completion/failure.

Snapshot transcription had no usage ledger; unless final code changes,
charge a conservative fixed amount at admission.

When budget is exhausted, AI stops cleanly, non-AI app continues and
conversion UI appears.

Suggested `demo_usage` fields: id, demo_session_id, ip_hmac,
action_type/variant, reservation_credits, actual_credits, status,
timestamps, optional provider/model and request/job reference.

Suggested `demo_budget_counters`: scope (`session`/`ip`), scope_key,
window_start, expires_at, reserved_credits, settled_credits, updated_at.

Use a transactional DB function for reservation across both scopes.

## 12. Guided experience and UX

Use **four guided tasks**, then free roam.

1.  **Build a quote manually** --- quote list, seeded draft,
    measurements, own component pricing, line items, live totals.
    Quoting path A.
2.  **Measure from a plan** --- takeoff entry, calibration/measurement,
    canvas, component pricing, priced quote. Path B.
3.  **Ask Smart Assistant** --- controlled realistic message,
    conversational interpretation and quote/price assistance. Path C.
4.  **Quote → order → invoice** --- seeded accepted quote, material
    order, invoice and downstream workflow.

After task 4 show **"You're ready --- explore QuoteCore+"** rather than
a fifth artificial task.

Task definitions are config-driven with route/state prerequisite,
semantic target, coach copy, completion event and optional mobile
variant. Avoid brittle CSS-only targeting; expose stable semantic demo
targets such as `data-demo-target`.

Desktop uses anchored coach/highlight UI; mobile uses mobile-safe bottom
sheets/coach treatment.

Tutorial progress persists for the 24-hour demo (e.g. in
`demo_sessions`), not only `sessionStorage`. Visitor can skip/dismiss
and reopen/restart guidance.

Initial welcome explains fictional data, 24-hour lifetime, Reset Demo,
limited AI and disabled external sending. Persistent banner provides
DEMO indicator, lifetime/expiry indication, tutorial access, Reset Demo
and conversion CTA.

## 13. Anti-abuse and observability

Initial controls: - generous IP/HMAC limit on fresh demo provisioning; -
hard AI budgets; - upload count/size cap; - 24-hour lifetime; - external
capability suppression; - optional high-volume write limits only if
telemetry proves necessary.

No CAPTCHA initially; add only if bot farming is observed.

Record at minimum: entry, provisioning start/success/failure, clone
latency, resume, reset, expiry, cleanup start/success/failure, tutorial
completion, AI reserve/settle/release, AI denial, upload denial, blocked
external-action attempts and unexpectedly high active-demo counts.

## 14. Cleanup

Cleanup is idempotent/retryable.

Known snapshot blockers included assistant turn reservations, assistant
usage events, Smart Assistant runs and scheduled messages created by the
demo user.

Safe sequence: 1. mark session terminating/expired to stop new work; 2.
cancel/invalidate pending AI jobs where possible; 3. remove known
NO-ACTION/RESTRICT blockers; 4. delete demo-owned storage; 5. delete
company and allow company cascades; 6. delete Supabase anonymous auth
user; 7. mark/tombstone demo session; 8. use existing orphan/rate-limit
sweepers as backstops.

Do not depend on `pg_cron`; production inspection found actual
scheduling through Vercel app-level crons.

## 15. Expected additive schema

Likely additions: - `subscription_plans`: add `demo` row. -
`demo_templates`: source company, version, status/freeze metadata (or
equivalent explicit config). - `demo_sessions`: anon_user_id,
company_id, template_version, ip_hmac, status,
created/activated/expires/last_seen timestamps, tutorial_state, cleanup
timestamps, failure context. - `demo_usage`: AI action ledger. -
`demo_budget_counters`: atomic cost state. - DB helpers/RPCs for
clone/provision, AI reserve/settle/release and cleanup where useful.

Important repo fact: reconnaissance found two migration trees and the
live DB ahead of both. The live catalog was schema ground truth at that
time. Follow the established additive migration/deployment process and
re-check this before implementation.

## 16. Mandatory delta audit after UX/SA merges

Before implementing, compare the final target branch/live schema against
this contract and answer:

**What changed since `ux/phase-4 @ 99e8b0c7` that invalidates or
materially changes Architecture V2?**

Inspect: - workspace routes; - Supabase cookie/client factories; -
middleware; - entitlements/plan logic; - RLS, especially
`quote_files`; - tenant/clone graph and FK blockers; - send/email/share
choke points; - PDF implementation; - Smart Assistant model-bearing
routes; - takeoff model-bearing routes/queue; - AI usage accounting,
especially transcription; - storage paths/policies; - cleanup
blockers; - final mobile components/targets used by guided tasks.

Also verify these small prior unknowns: 1. anonymous
`getAuthenticatorAssuranceLevel()` behaviour; 2. anonymous refresh-token
rotation through isolated demo cookie; 3. final seed-plan
storage/signed-URL behaviour from demo host; 4. Vercel custom-domain
availability/config; 5. exact final AI credit calibration; 6. final
upload/write caps; 7. seeded content contains no real PII.

Do not repeat all historical reconnaissance unless structural changes
demand it. If the delta audit finds no architecture-breaking change,
proceed directly to implementation.

## 17. Build order

### Phase 1 --- Security/foundation

-   re-check/fix `quote_files` RLS;
-   add demo plan;
-   add demo session/budget schema;
-   implement hostname classification;
-   implement isolated demo auth cookie;
-   implement demo-host middleware/route guards.

### Phase 2 --- Provisioning

-   enable anonymous auth in test environment;
-   anonymous mint;
-   clone manifest;
-   transactional clone/provisioner;
-   compensating cleanup;
-   unique slug;
-   clone validation.

### Phase 3 --- Lifecycle

-   resume;
-   24-hour access enforcement;
-   Reset Demo;
-   expiry UI;
-   multi-tab behaviour;
-   cleanup cron/retries.

### Phase 4 --- Capability sandbox

-   email/send/share blocks;
-   billing/integration/supplier guards;
-   PDF/download UX suppression;
-   DEMO watermark.

### Phase 5 --- AI budget

-   counters/ledger;
-   IP HMAC;
-   Smart Assistant turn guard;
-   transcription guard;
-   scan-v3/scan-job enqueue/calibration guards;
-   in-app parse guard where exposed;
-   exhaustion UX.

### Phase 6 --- Demo shell

-   welcome;
-   persistent banner;
-   reset/expiry;
-   conversion CTAs;
-   disabled-action explanations.

### Phase 7 --- Guided tasks

-   semantic targets;
-   task config;
-   desktop/mobile coach;
-   persisted progress;
-   completion events.

### Phase 8 --- Seed content

Create realistic fictional UK roofing data supporting all four tasks:
component/pricing library, draft quote, takeoff-ready plan, Smart
Assistant scenario, accepted quote, orders, invoices, inbox, alerts,
templates and relative dates.

### Phase 9 --- Hardening/e2e

Run the matrix below.

### Phase 10 --- Controlled launch

-   configure `demo.quote-core.com` DNS/Vercel;
-   enable anonymous Supabase auth in production;
-   deploy quietly;
-   observe provision failures, AI spend, abuse, cleanup and conversion;
-   then expose primary marketing CTAs.

## 18. Required test matrix

### Auth isolation

Normal logged-in user opens demo; both sessions coexist. Demo
reset/sign-out does not affect normal account. Normal sign-out does not
affect demo. Signup CTA never upgrades demo identity.

### Tenant isolation

Two independent browsers get different auth users/company IDs/slugs.
Changes never cross. Direct resource requests across companies fail
through RLS.

### Provisioning failures

Inject failures after auth creation, company creation, partial clone and
storage preparation. No partial workspace becomes usable; cleanup
recovers.

### Reset/multi-tab

Reset from one tab invalidates old workspace in other tabs; fresh demo
is independent; IP AI allowance remains.

### Expiry

After `expires_at`, pages cannot continue mutating and APIs/AI fail
closed even before physical cleanup.

### External negative tests

Attempt UI and direct HTTP/action invocation for quote/invoice/order
send, arbitrary email, share-token creation, customer accept, Stripe,
Xero/QB, supplier submission and protected settings. All fail safely.

### Documents

No app-provided PDF/download action; rendered docs show demo
identification; no hosted/public URL is created.

### AI races

Parallel calls near budget limit cannot spend the same remaining
credits. Queued scans reserve at enqueue. Failed eligible operations
release reservations; settlement returns unused reservation.

### Cleanup

Create representative SA runs/reservations, messages, takeoff jobs,
uploads, quotes, orders and invoices. Expire/clean. Verify tenant
rows/storage/auth user are gone and retry is harmless.

### Mobile

All four tasks complete on the actual production mobile layout, not a
simplified demo-only path.

## 19. Success criteria

Public marketing exposure is allowed only when: - `/demo` needs no
signup/login/payment action; - normal entry reaches usable workspace in
\~5 seconds under normal conditions; - valid visitor resumes within 24
hours; - Reset Demo produces a fresh sandbox; - visitors cannot
see/mutate each other's data; - normal account and demo coexist in one
browser; - four tasks work on desktop/mobile; - visitors experience all
three quote-entry methods plus downstream order/invoice flow; - AI
allowance cannot be reset by simply resetting/recreating demo from same
IP window; - AI exhaustion degrades gracefully; - no outbound
email/customer share/Stripe/accounting/supplier external action is
possible; - seed contains no real PII; - no app-supported PDF/download
path is exposed; - expired demos cannot continue writing before
cleanup; - cleanup removes tenant data/storage/auth identity; - failures
and AI cost are observable.

## 20. Non-goals

V2 does not attempt to: - persist demo work into signup; - perfectly
identify a human across devices/networks; - defeat determined VPN/IP
rotation; - make screenshots/browser printing impossible; - create a
generic sandbox platform; - support multiple demo businesses; - provide
collaborative/team demo; - simulate external accounting/supplier
connections; - optimize for traffic orders of magnitude above launch
assumptions.

## 21. Final implementation principle

The demo should contain as little demo-specific business logic as
possible.

Preferred pattern:

**real QuoteCore+ feature + disposable isolated tenant + explicit
boundary around external/costly effects**

Not:

**a second demo implementation of QuoteCore+.**

The closer the demo remains to the actual app, the more accurately it
demonstrates the product and the less duplicate behaviour must be
maintained.

------------------------------------------------------------------------

# Appendix A --- Verified reconnaissance facts future agents should know

These were verified against the 2026-09-26 snapshot and must be
rechecked if relevant after the delta audit:

-   Supabase anonymous sign-in support exists in the installed client
    generation but was unused and disabled in live auth config.
-   No `auth.users` DB trigger automatically created company/profile
    data; an unprovisioned anonymous user failed closed under workspace
    RLS.
-   Existing auth cookie configuration was centralized and
    hostname-aware.
-   `companies.slug` had a unique index.
-   `QUOTE-DOCUMENTS` policies were company-folder scoped.
-   Smart Assistant V2 `session/navigation/actions` routes appeared
    non-LLM; model entry remained turn/transcribe.
-   Transcription had no usage ledger.
-   AI scan jobs are queued; demo budget must gate at enqueue.
-   Existing distributed rate limiting uses Postgres and is
    serverless-safe.
-   Ordinary workspace CRUD appeared company-local; escape vectors were
    concentrated in send/share/billing/integration/supplier actions.
-   PDF generation was client-side.
-   Cleanup had known NO-ACTION/RESTRICT blockers that must be deleted
    before company/user deletion.
-   Vercel app-level crons, not usable `pg_cron`, were the effective
    scheduling mechanism.
-   Existing seed code was a useful provisioning pattern but no
    full-company clone routine existed.
-   Two migration trees existed and live DB was ahead of both.

# Appendix B --- Decision log

1.  **Clone-on-entry vs COW:** clone-on-entry selected.
2.  **Supabase anon vs custom session:** Supabase anonymous auth
    selected.
3.  **Normal/demo auth collision:** separate demo hostname + cookie
    namespace selected.
4.  **Session lifetime:** 24-hour resumable demo selected; browser-close
    reset rejected.
5.  **Reset:** explicit Reset Demo selected; IP AI allowance survives.
6.  **AI store:** Postgres selected; Redis/Upstash rejected.
7.  **AI semantics:** reserve-before-cost + settle/release selected.
8.  **Queued AI:** reserve at enqueue.
9.  **Anti-abuse:** observability + hard limits first;
    CAPTCHA/fingerprinting deferred.
10. **Guidance:** four tasks + free roam.
11. **Routing:** random per-session workspace slug retained.
12. **PDF:** remove app affordances + watermark; accept browser
    extraction.
13. **Implementation timing:** hold until UX/mobile + SA V2 merge, then
    delta audit.
