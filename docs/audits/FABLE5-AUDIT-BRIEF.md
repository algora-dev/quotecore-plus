# Fable 5 Full-Codebase Audit Brief

## Project: QuoteCore+
**What it is:** A construction/roofing quoting SaaS platform. Users measure plans (canvas/takeoff), build quotes with Smart Components™, send quotes to customers, manage orders, create invoices, track jobs, and communicate — all from one app.

**Long-term goal:** Become one of the biggest end-to-end quote, order, job management, and invoicing platforms in the world. This audit is about finding what we've missed — subtle bugs, design flaws, performance issues, UX gaps, code quality problems, and improvement opportunities that other models (GLM 5.2, Sonnet, Opus) may have glazed over.

**Current state:** Production live on app.quote-core.com. ~280 source files, 15MB. Next.js 16 + React 18 + TypeScript + Tailwind CSS 4 + Supabase + Stripe + Fabric.js + jsPDF. Both `dev` and `main` branches are in sync at `d9d8570`.

## Tech Stack
- **Frontend:** Next.js 16 (App Router), React 18, TypeScript (strict), Tailwind CSS 4
- **Backend:** Supabase (PostgreSQL, Auth, Storage, RLS, Edge Functions)
- **Payments:** Stripe (subscriptions, webhooks, test + live mode)
- **Canvas:** Fabric.js v7 (measurement tools, takeoff drawing)
- **PDF:** jsPDF + html2canvas
- **Deployment:** Vercel (preview + production)
- **AI Assistant:** "Q" — in-app assistant with guide engine, early-intent router, workflow system

## Key Subsystems (by directory)
- `app/(auth)/[workspaceSlug]/quotes/` — quote list, quote builder, takeoff, summary, labor sheets
- `app/(auth)/[workspaceSlug]/orders/` — order management (orders hub, order responses)
- `app/(auth)/[workspaceSlug]/invoices/` — invoice creation, templates, line-by-line editor
- `app/(auth)/[workspaceSlug]/resources/` — component library, templates (quote, order, invoice, email, message)
- `app/(auth)/[workspaceSlug]/settings/` — company settings, security (MFA, recovery, security questions), payment details
- `app/admin/` — admin dashboard: users, admins, rate limits, settings, support tickets, suppressions
- `app/api/` — API routes: Stripe webhooks, assistant chat/workflow, cron jobs, alerts, attachments, uploads
- `app/components/` — shared components: assistant, billing, editor, send, alerts, docs
- `app/lib/` — business logic: billing/entitlements, assistant (orchestrator, early-intent, sessions, tools), security (rate limit, hmac, pick-fields), email, PDF, measurements, storage, trades, pricing engine
- `supabase/migrations/` — 80+ SQL migrations (schema, RLS, triggers, RPCs, cron)
- `backend/` — legacy migrations + schema snapshots
- `scripts/` — test scripts, seed scripts, utilities

## Critical Patterns to Check

### 1. Security
- **RLS policies** — any leaks across company boundaries? (We've had 3 RLS bugs found by Gerald already)
- **Auth flow** — session handling, admin impersonation (magic-link swap), token refresh
- **Rate limiting** — fail-open vs fail-closed on sensitive endpoints
- **Input validation** — server actions, API routes, SQL injection vectors
- **Secrets exposure** — any keys/tokens in client-side code?

### 2. Logic & Correctness
- **Pricing engine** (`app/lib/pricing/engine.ts`) — edge cases in calculation (quantity, margins, unit conversion)
- **Stripe webhooks** (`app/api/webhooks/stripe/route.ts`) — idempotency, error handling, all event types covered?
- **Measurement conversion** (`app/lib/measurements/`) — metric/imperial_ft/imperial_rs edge cases
- **Quote lifecycle** — draft → sent → viewed → accepted/declined/disputed → revision → order → invoice. Any state transitions that can break?
- **Order/invoice creation** — atomic RPCs, data integrity checks
- **Scheduled messages** — cron dispatch, race conditions, sentinel pattern

### 3. Performance
- **N+1 queries** — server actions that fetch in loops
- **Bundle size** — large client components, missing dynamic imports
- **Canvas performance** — Fabric.js object counts, re-renders
- **Database indexes** — are commonly queried columns indexed?
- **Image/file handling** — upload flow, storage cleanup, orphaned objects

### 4. Code Quality
- **TypeScript** — any `any` types, missing return types, unsafe casts
- **Component structure** — files over 300 lines that should be split
- **Error handling** — try/catch patterns, error boundaries, user-facing error messages
- **Consistency** — naming conventions, file organisation, import patterns
- **Dead code** — unused exports, disabled middleware files, legacy scripts

### 5. UX & Design Consistency
- **Design system adherence** — read `docs/DESIGN_SYSTEM.md`. Are all components following the patterns?
- **Loading states** — are all async actions showing loading feedback?
- **Error states** — are errors surfaced clearly to users?
- **Empty states** — do all list views have proper empty states?
- **Accessibility** — keyboard navigation, ARIA labels, contrast
- **Mobile responsiveness** — do all pages work on mobile?

### 6. Architecture & Scalability
- **Multi-tenancy** — company isolation, RLS as the enforcement layer
- **Feature gating** — subscription tiers, entitlements, storage limits
- **Cron jobs** — are all 6 cron endpoints in `vercel.json`? (We know `dispatch-scheduled-messages` may be missing)
- **Database schema** — normalisation, constraints, trigger complexity
- **API design** — REST patterns, response consistency, error codes

## Audit Instructions

### What to produce:
1. **Findings document** — categorised by:
   - 🔴 Critical (bugs, security issues, data loss risks)
   - 🟡 High (significant logic errors, performance problems, UX failures)
   - 🔵 Medium (code quality, consistency, minor UX issues)
   - ⚪ Low (polish, optimisation, nice-to-haves)
   - 💡 Suggestions (improvement ideas, architecture enhancements)

2. **For each finding:**
   - File path + line numbers (approximate)
   - What the issue is
   - Why it matters (impact)
   - Suggested fix (brief, actionable)

3. **Improvement Plan** — a prioritised list of recommended changes, grouped into:
   - **Quick wins** (< 1 hour each, high impact)
   - **Medium effort** (1-4 hours, meaningful improvement)
   - **Larger investments** (4+ hours, significant value)
   - **Backlog** (good ideas, not urgent)

### How to audit:
- Read files systematically by directory
- Focus on logic and correctness first, then security, then quality, then UX
- Look for patterns that repeat across files (consistency issues)
- Check for edge cases in business logic (empty states, null handling, concurrent operations)
- Compare implementation against the design system
- Look at SQL migrations for schema issues, missing indexes, RLS gaps
- Check for race conditions in async operations
- Look for error paths that silently fail

### Scope:
Everything. No exclusions. All source files, all migrations, all scripts, all docs patterns.

### Output:
Write your full findings to `docs/audits/FABLE5-AUDIT-REPORT.md` and the improvement plan to `docs/audits/FABLE5-IMPROVEMENT-PLAN.md`.
