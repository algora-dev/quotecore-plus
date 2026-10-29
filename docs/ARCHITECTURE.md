# QuoteCore+ system architecture

Companion to the README (product narrative) - this doc is the engineering map.
Last updated 2026-10-29.

## Topology

One Next.js App Router application serves marketing, the authenticated app,
public free tools and API routes. One Supabase project provides Postgres,
auth, storage and edge functions. Vercel runs two projects: production
(git-linked, builds main only) and testing (CLI-deployed, git-disconnected).

## Route surface

| Area | Path root | Notes |
| --- | --- | --- |
| Authenticated app | `app/(auth)/[workspaceSlug]/` | takeoff workstation, quotes, orders, invoices, settings; paywalled by entitlements |
| Public marketing | `app/(public)/` | homepage (domain-aware), feature pages, free tools, guided demo |
| Customer-facing links | `app/accept/[token]`, `app/invoice/[token]`, `app/orders/[token]`, `app/file/[token]`, `app/m/[token]` | anonymous token pages; deny + no-leak behavior covered by security E2E |
| API | `app/api/` | webhooks (Stripe), admin, free tools, attachments, integrations, public takeoff calculate |
| MCP | `app/mcp/route.ts` | Model Context Protocol endpoint for the ToolLayer AI-agent API |

## Data layer

- PostgreSQL via Supabase. Row Level Security on user-facing tables; tenant
  scoping is workspace/company id columns enforced by RLS.
- Service-role clients exist only in server contexts (integrations token
  storage, dispatch, admin tooling); never in client bundles.
- SECURITY DEFINER functions (e.g. supplier publishing contracts) carry
  explicit revoke/grant lists; audit trail tables record commercial events.
- Migrations live in two roots (see docs/db/MIGRATION_INVENTORY.md);
  live DB state is the source of truth, types are spliced, never wholesale
  regenerated.

## Billing

A single resolver (`app/lib/billing/company-type.ts` `resolveBillingType()`)
classifies every company as `legacy | custom_metered | custom_admin_granted`
and all metered sites funnel through it. Guards:
`npm run check:billing` (strict resolver contract) and
`npm run smoke:billing` (behavioral matrix against testing).

## AI systems

- AI Scan Assist: 3-stage pipeline, deterministic post-processing (45-degree
  gate, collinear merge, stroke-style evidence), usage logged per scan in
  `ai_scan_usage`; free-tools scans burn zero credits by owner decision.
- Smart Assistant: intent + tools with confirmation gates, record snapshots
  and proposal digests; commercial actions require explicit confirm.
- Rate limits on AI-spend paths fail CLOSED (docs/security/RATE_LIMIT_AUDIT.md).

## Background work

pg_cron dispatch job (every minute) claims scheduled-message rows atomically
and dispatches via HTTP with a vault-held secret. Dunning and follow-ups
hook the same queue.

## Documents and files

Quote documents and attachments live in private buckets behind signed URLs;
company logos are public. PDF generation is jsPDF + html2canvas client-side.

## Testing and gates

- Playwright E2E: security, entitlements, public-link privacy, mobile, email
  suites under `e2e/specs` with fixtures in `e2e/fixtures`.
- Node test-runner suites: takeoff precision, calibration, topology,
  supplier pricing, roof-takeoff builder.
- Debt ratchet: `node scripts/debt-ratchet.cjs` (tsc + lint baselines).
- Deploy-time smoke: billing matrix on every testing deploy (hard rule).

## Known debt (pointers)

- docs/debt/TSC_TRIAGE.md - 81 tsc errors, categorized paydown plan
- scripts/debt-baseline.json - lint 8,973 baseline
- AGENTS.md repo root - branch/promotion protocol and hard rules
