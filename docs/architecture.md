# QuoteCore - Architecture

**Date:** 2026-03-30
**Project Type:** Web application
**Architecture Style:** Monolithic Next.js App Router application with Supabase-backed data/auth and SQL-first domain modeling

## Executive Summary

QuoteCore is currently implemented as a single Next.js web application that combines SSR/route rendering, server-side actions, and tenant-aware data access. Its strongest existing architectural foundation is not the UI but the domain schema and pricing model: the SQL files define a rich, company-scoped quoting system, while the UI is still catching up around template and extras management.

## Technology Stack

| Category | Technology | Notes |
| --- | --- | --- |
| Application framework | Next.js 16 | App Router-based web app |
| Rendering/UI | React 19 | Standard component rendering |
| Language | TypeScript | strict mode enabled |
| Styling | Tailwind 4 + CSS + inline styles | Tailwind installed, current UX mostly inline/barebones |
| Data/Auth | Supabase | SSR client + admin client patterns in app code |
| Database | Postgres | modeled via SQL files under `backend/supabase/` |
| Package management | npm | `package-lock.json` present |
| Planning framework | BMAD v6 | installed locally in `_bmad/` |

## High-Level Architecture

### 1. Presentation Layer

Implemented in `app/` via App Router pages:
- login/signup pages
- templates listing/detail/edit flows
- extras flows
- quote/settings placeholders

This layer is currently functional for internal configuration workflows but not yet mature for end-user product polish.

### 2. Application / Mutation Layer

Implemented through route-adjacent server actions (`actions.ts` files).

Responsibilities include:
- auth login/logout/signup
- template creation and editing
- measurement key creation/editing
- extras creation
- item/group config persistence

This is effectively the app’s current service layer, though it is distributed rather than centralized.

### 3. Shared Domain Helpers

Implemented in `app/lib/`.

- `app/lib/supabase/server.ts` provides SSR client creation, user lookup, and company context enforcement.
- `app/lib/pricing/engine.ts` provides the current calculation core for area-derived, direct-measurement, and fixed/custom quote lines.

### 4. Data / Policy Layer

Implemented in SQL under `backend/supabase/`.

This is one of the most mature parts of the project and includes:
- companies/users tenancy model
- templates, items, groups, measurement keys, modifiers, pitch bands
- quotes, quote versions, measurements, attachments, notifications, acceptance flows
- global extras extension
- row-level security and helper functions

## Core Architectural Patterns

### Multi-tenant company scoping
Most core entities are company-bound, either directly through `company_id` or indirectly through parent records. This is the core SaaS boundary.

### SQL-first domain definition
The SQL files currently express the product domain more completely than the UI. In practical terms, the schema is the clearest architectural contract for future development.

### Configuration-first quoting
The implemented UI focuses on configuring templates, measurement keys, items, and extras before building live quote-generation UX. This indicates the current build phase is “quote system design/configuration” rather than “quote execution UX.”

### Manual-first pricing engine
The pricing engine supports area-derived, direct-measurement, and fixed/custom calculation paths, including pitch adjustments, waste, modifiers, margins, and totals. This is an important bridge between current manual workflows and future AI-assisted measurement ingestion.

## Current Domain Model Highlights

Main business entities:
- `companies`
- `users`
- `templates`
- `template_measurement_keys`
- `template_item_groups`
- `template_items`
- `template_*_configs`
- `template_modifiers`
- `quotes`
- `quote_measurements`
- `quote_items`
- `quote_versions`
- `customer_quote_views`
- `quote_acceptances`
- `notifications`
- `global_extras`

This is already the skeleton of a serious quoting platform, not a toy prototype.

## Authentication and Authorization

Current auth approach:
- login uses Supabase password sign-in
- signup uses an admin client to create auth user + company + profile
- company membership is enforced in data-access helpers
- SQL RLS policies are prepared for tenant isolation

Important architectural note:
- The app is already thinking in terms of secure multi-tenant access.
- However, some flows still need confirmation/hardening before production readiness.

## Route / Feature Inventory

Most implemented product areas today:
- `/login`
- `/signup`
- `/templates`
- `/templates/[id]`
- nested template configuration routes
- `/extras`

Still immature or placeholder areas:
- `/` landing page
- `/quotes`
- `/settings`
- dashboard-level information architecture
- customer-facing quote presentation in-app
- AI roof-plan analysis flow

## Architectural Gaps / Risks

1. **UI maturity lags domain maturity**
   - The schema and pricing logic are more advanced than the actual product UX.

2. **Service logic is fragmented**
   - Route-local server actions work, but scaling this codebase will likely need clearer domain/service boundaries.

3. **Scaffold residue remains**
   - The project still carries create-next-app leftovers, which can confuse future planning if not cleaned up.

4. **Quote creation workflow is incomplete**
   - The core value path from template -> measurement input -> generated quote -> acceptance is not yet fully surfaced as a cohesive user journey.

5. **AI measurement capability is absent from current implementation layer**
   - It is part of product intent, but not yet an implemented subsystem here.

## Testing Strategy

No meaningful automated test suite was discovered during this pass. The project currently appears to rely on manual local testing and direct page/action verification.

## Deployment / Operations

Deployment configuration was not found in a mature form during this pass. The app currently looks optimized for local development rather than production deployment documentation.

## Recommended Architectural Direction

For BMAD-driven progress, the best next architecture path is:
1. preserve the existing schema and pricing foundations
2. generate strong project-context documentation
3. define the end-to-end quote creation flow clearly
4. break the product into epics/stories around real user journeys
5. gradually separate domain/service concerns from route-local action code
6. only then push hard on UX polish and AI measurement integration

In short: **the system should be treated as a real brownfield foundation, not rewritten from scratch — but it does need structural clarification before rapid feature expansion.**

---

_Generated using BMAD Method `document-project` workflow_
