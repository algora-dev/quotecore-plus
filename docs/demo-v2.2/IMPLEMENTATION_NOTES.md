# Demo V2.2 implementation map

## Source-of-truth contracts

`app/lib/demo/model.ts` defines seed version `qcp-v2.2-20261003`, parsed guide state, semantic record keys, successful event vocabulary and 24-hour lifetime. `commands.ts` accepts only the limited welcome/explore/chapter commands; it cannot accept arbitrary completed events, tenant IDs or resource allowances.

`context.ts` verifies an active demo through the server. `http.ts`, `request-gate.ts`, `egress.ts` and `paid-route.server.ts` are shared app boundary checks. Namespace selection is not authorization; selected credentials are verified. Referrer/header namespace routing for preview deployments is not relied on to establish company ownership.

## Seed and reset

`seed-data.ts`, `seed-plan.ts`, `seed.ts` explicitly create QCP Roofing & Construction with 20 components in three libraries, eight quote/job states, two orders, one invoice, eight tax snapshots, alerts and inert fictional correspondence. No existing company is selected as a seed. Relationships resolve through visitor-specific semantic keys. Historical sent records are inserts of explicitly marked fictional history, not dispatched mail. The prepared SVG is rendered using the existing sharp dependency.

`provision.ts` owns resume/version checks, request throttles, checked writes, compensation and reset. An anonymous auth ID is retained across reset so a new company is not a new allowance. Profiles may move only between verified demo companies. Old sessions are retired, new seed activated and old resources swept. No real account is converted into a demo or vice versa.

`cleanup.ts` retires only an explicit demo session/company, checks active/in-flight work, removes tenant blockers, enumerates and deletes company-folder storage, cascades the company and deletes the anonymous auth user only if it has no remaining application profile/current demo. It is retryable; no successful physical cleanup is inferred from an expiry timestamp. `api/cron/demo-sweep` handles bounded batches and seven-day tombstone/counter retention. Hourly schedule: minute 11.

## Auth

`cookie-config.ts`, `client.ts`, `server.ts`, `middleware.ts`, demo browser/route clients and `routing.ts` consistently distinguish normal from demo sessions. Normal 180-day auth remains separate from 24-hour demo auth. A custom singleton prevents the Supabase default browser singleton from reusing the wrong namespace. Same-host Vercel testing uses demo paths and trusted middleware-selected request context; the final production demo host is `demo.quote-core.com`.

## Guide and real operation hooks

`DemoExperience.tsx` and its stylesheet implement draggable desktop guidance with clamping, keyboard movement/reset, mobile collapse/bottom sheet, accessible native controls and existing Qc UI primitives. Route mismatch pauses page-specific instructions and produces a resume link. `progress.ts` persists guide state via conditional JSON revision updates in existing tutorial_state. `product-events.ts`, `client-events.ts` and checkpoint handling verify owned saved records. Component tests are recalculated on the server using the real engine before acknowledgment.

Component create/edit and real Test Component hooks feed Pricing. `prepared-scan.ts` provides the staged authored detection contract without a paid call. User-confirmed outlines/lines are preserved by later stages. Takeoff receives an optional demo Finish destination; the existing save_takeoff_atomic and recalcAllQuoteComponents machinery still runs. The finish route opens the real customer editor from saved state instead of rewriting the quote with a canned result.

`customer.server.ts` reads actual customer quote lines/tax snapshots/branding. `DemoCustomerResponse` calls a dedicated response route; it cannot send production follow-ups. `tokens.ts` signs purpose/session/quote/expiry-bound capabilities. Normal public recipient paths reject demo rows.

## Real Smart Assistant and usage

`assistant.server.ts` wraps existing turn/transcribe/speak handlers; it does not replace the production assistant engine or tools. Demo turns use the existing non-streaming return path so usage/run reconciliation has a concrete response. The real proposal-and-confirm flow remains intact. Real post-commit action/navigation acknowledgments update guide tasks. `integration.server.ts` enables only the verified demo company's existing rollout after the two explicit integration approvals.

`budget.ts`/`counter.ts` use existing demo_budget_counters and demo_usage. Each bucket uses compare-and-swap. Session scope is keyed by anonymous visitor ID, not the resettable company ID; IP scope uses a server-side HMAC. Twenty-four-hour windows begin with use. Both scopes must debit before a paid call. A partial failure consumes rather than refunds earlier debits. Up to ten user turns, independent transcription/speech counts, and cost-unit allowance are enforced. Duplicate request IDs reconcile or fail closed. Actual token accounting is optional telemetry; conservative admission charges remain.

## Optional self-send

`self-send.server.ts` is an explicit, narrow exception to normal mail suppression. Fixed sender/subject/text/HTML are constructed by the server. Six-digit confirmation code, ten-minute signed challenge, attempt limits, recipient/IP/global ceilings and one-time usage claim precede a quote send. Quote recipient identity is not an arbitrary supplier/customer address field. Delivery goes through the existing Resend client, with an idempotency key and mandatory demo marking. No automatic follow-up or marketing opt-in occurs.

The request is only reported accepted if the provider returns an ID. Network/provider failure retains allowance to avoid duplicate external effects. The public link expires no later than its session and stops working on reset. Keep this feature off until provider, expiry and malicious-recipient tests pass.

## Observability

Provisioning and cleanup failures retain bounded failure state and structured warnings. Guide acknowledgments and usage ledger entries are inspectable. Existing admin demo controls remain. Clarity session replay is disabled on demo routes/host so input/verification details are not copied into that third-party replay system.

This is not a new generic sandbox platform or a completed live security audit. Production deployment requires the integration checks in DATABASE_GATES and TESTING.
