# QuoteCore - Project Overview

**Date:** 2026-03-30
**Type:** Web application (monolith)
**Architecture:** Next.js App Router + Supabase-backed server actions

## Executive Summary

QuoteCore is a browser-based SaaS roofing measurement and quoting platform. The current implementation is a brownfield Next.js application that already contains the foundations for tenant-aware authentication, template-driven quote configuration, pricing logic, and supporting Supabase/Postgres schema work. The intended product direction is broader than the current codebase: today the project is primarily a manual-first quoting system with configurable measurement inputs and pricing structures, while the long-term differentiator is AI-assisted roof-plan measurement and quoting.

## Project Classification

- **Repository Type:** Monolith
- **Project Type(s):** Web
- **Primary Language(s):** TypeScript, SQL
- **Architecture Pattern:** Server-rendered web app with server actions and database-driven domain model

## Technology Stack Summary

| Category | Technology | Version / Notes | Why it matters |
| --- | --- | --- | --- |
| Frontend framework | Next.js | 16.2.1 | App Router application shell and routing |
| UI library | React | 19.2.4 | Component rendering |
| Language | TypeScript | strict mode enabled | Main application language |
| Styling | Tailwind CSS 4 + globals.css | installed but lightly used | Available styling foundation, but current UI still relies heavily on inline styles |
| Backend pattern | Next.js server actions | app/*/actions.ts | Handles auth and CRUD-style mutations |
| Data/auth platform | Supabase | via `@supabase/ssr` and admin client usage in app code | Auth, tenancy, server-side data access |
| Database | Postgres / Supabase SQL | custom SQL schema in `backend/supabase/` | Core quote/template/pricing model |
| Package manager | npm | lockfile present | Standard JS dependency workflow |
| BMAD integration | BMAD Method v6 (bmm module) | installed in `_bmad/` | Planning / story / architecture framework for future work |

## Key Features Present Today

- Email/password login flow
- Signup flow that creates a company and owner account
- Company-scoped data access helpers
- Template management UI
- Measurement key management for templates
- Item group and item configuration flows
- Global extras CRUD foundation
- Pricing engine core for manual-first quote calculations
- SQL schema for companies, templates, quotes, quote versions, measurements, modifiers, notifications, and acceptance flows
- Separate SQL for RLS/auth policies and global extras support

## Major Capabilities Not Yet Complete

- Real quote builder / quote creation workflow
- Polished dashboard experience
- Customer-facing quote presentation flow inside the app
- Shared measurement canvas / calibrated digital takeoff workflow
- AI-assisted roof-plan measurement built on the shared measurement canvas
- Mature component system / design system
- End-to-end tests and deployment docs
- Production hardening and final architecture cleanup

## Architecture Highlights

- The repo is a single Next.js app rather than a split frontend/backend monorepo.
- Business logic is currently split across:
  - route/page files in `app/`
  - server actions in route-adjacent `actions.ts` files
  - reusable pricing and Supabase helpers in `app/lib/`
  - SQL-first backend artifacts under `backend/supabase/`
- The product is clearly multi-tenant at the domain level: most major entities are scoped to `company_id`.
- The app is still transitional: some pages are functional admin/configuration screens, while the landing page and dashboard experience remain placeholder-grade.

## Development Overview

### Prerequisites

- Node.js / npm
- Supabase project and environment variables
- SQL access for schema / RLS scripts

### Getting Started

The repo behaves like a standard Next.js application. Environment variables are expected in `.env.local`, the app runs with `npm run dev`, and Supabase is required for authentication and data-backed pages to work.

### Key Commands

- **Install:** `npm install`
- **Dev:** `npm run dev`
- **Build:** `npm run build`
- **Lint:** `npm run lint`
- **Start:** `npm run start`

## Repository Structure

The app is centered around `app/` for routes, `app/lib/` for shared helpers, `backend/supabase/` for schema and policy SQL, `documentation/` for inherited implementation notes, `_bmad/` for the BMAD framework, and `docs/` for generated brownfield project knowledge.

## Documentation Map

For detailed information, see:

- [index.md](./index.md) - Master documentation index
- [architecture.md](./architecture.md) - Detailed technical architecture
- [source-tree-analysis.md](./source-tree-analysis.md) - Directory structure
- [development-guide.md](./development-guide.md) - Development workflow
- [component-inventory.md](./component-inventory.md) - Route/component inventory
- [api-contracts.md](./api-contracts.md) - Server actions and data interaction surface
- [data-models.md](./data-models.md) - Domain schema overview

---

_Generated using BMAD Method `document-project` workflow_
ing BMAD Method `document-project` workflow_
