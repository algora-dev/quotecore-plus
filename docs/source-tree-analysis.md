# QuoteCore - Source Tree Analysis

**Date:** 2026-03-30

## Overview

QuoteCore is structured as a single Next.js application with co-located UI routes and server actions, plus SQL-first backend artifacts. The app mixes generated scaffold leftovers with meaningful brownfield implementation work, which is important for future cleanup and planning.

## Complete Directory Structure

```text
quotecore-app/
├── app/                           # App Router pages, layouts, route-adjacent server actions
│   ├── layout.tsx                 # Root layout
│   ├── page.tsx                   # Placeholder landing page from create-next-app
│   ├── actions.ts                 # Logout server action
│   ├── login/                     # Login UI + action
│   ├── signup/                    # Company+owner signup UI + action
│   ├── templates/                 # Template CRUD and nested configuration flows
│   │   ├── page.tsx
│   │   ├── actions.ts
│   │   ├── new/
│   │   └── [id]/
│   │       ├── page.tsx
│   │       ├── actions.ts
│   │       ├── edit/
│   │       ├── groups/
│   │       ├── items/
│   │       └── measurements/
│   ├── extras/                    # Global extras CRUD
│   ├── quotes/                    # Placeholder quote list / quote builder entry
│   ├── settings/                  # Settings placeholder
│   └── lib/
│       ├── pricing/engine.ts      # Manual-first pricing engine core
│       └── supabase/server.ts     # Supabase SSR + company context helpers
├── backend/
│   └── supabase/
│       ├── quotecore_schema_v1.sql        # Core schema
│       ├── quotecore_rls_auth_v1.sql      # RLS/auth policies
│       └── quotecore_global_extras_v1.sql # Global extras extension tables
├── documentation/
│   └── active/implementation/     # Existing implementation notes inherited with project
├── docs/                          # BMAD-generated project knowledge output
├── _bmad/                         # Installed BMAD framework and workflows
├── {output_folder}/               # BMAD-created artifacts folder placeholder from install config expansion
├── public/                        # Default static assets from Next scaffold
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tsconfig.json
├── eslint.config.mjs
├── .env.local                     # Local environment variables (ignored)
└── middleware*.ts                 # Disabled / experimental middleware files
```

## Critical Directories

### `app/`

Primary application surface.

**Purpose:** Contains route-rendered UI and many of the domain workflows.
**Contains:** auth pages, template management, extras management, placeholder quote/settings pages, root layout, server actions.
**Entry Points:** `app/layout.tsx`, `app/page.tsx`

### `app/lib/`

Shared implementation helpers.

**Purpose:** Houses reusable logic that should eventually become a more explicit service/domain layer.
**Contains:** pricing calculations and Supabase server helpers.

### `app/templates/`

Current center of gravity for real product functionality.

**Purpose:** Configure reusable templates that later drive quotes.
**Contains:** template CRUD, measurement keys, item groups, items, edit flows.

### `app/extras/`

Reusable optional quote extras.

**Purpose:** Manage company-scoped extras outside individual templates.
**Contains:** list, create, detail, and action logic for global extras.

### `backend/supabase/`

SQL-first backend contract.

**Purpose:** Defines the actual domain model and tenancy rules more clearly than the UI does.
**Contains:** schema, row-level security/auth policies, extras schema extension.

### `documentation/active/implementation/`

Inherited project notes.

**Purpose:** Captures prior implementation intent and handoff-style notes.
**Contains:** backend notes, dashboard notes, auth/RLS notes, signup-flow notes.

### `docs/`

Generated brownfield documentation.

**Purpose:** Primary AI-readable project knowledge location for future BMAD workflows.
**Contains:** project scan report and generated architecture/context docs.

### `_bmad/`

Installed BMAD framework.

**Purpose:** Provides analysis, planning, architecture, epics/stories, and implementation workflows.
**Contains:** core BMAD framework plus the `bmm` module.

## Entry Points

- **Main Entry:** `app/layout.tsx`
- **Primary route shell:** `app/page.tsx`
- **Current operational product entry after auth:** `/templates`
- **Auth entry points:** `/login`, `/signup`

## File Organization Patterns

- Pages and server actions are frequently co-located.
- Domain CRUD is nested under route folders rather than extracted into services/controllers.
- SQL is used as the most concrete source of truth for the data model.
- Existing notes live in `documentation/`, while BMAD output now lives in `docs/`.
- The repository still carries scaffold leftovers (`app/page.tsx`, `public/*`) alongside production-intent code.

## Key File Types

### TypeScript React pages
- **Pattern:** `app/**/page.tsx`
- **Purpose:** Route UI / SSR views
- **Examples:** `app/login/page.tsx`, `app/templates/page.tsx`

### Server actions
- **Pattern:** `app/**/actions.ts`
- **Purpose:** Auth and CRUD mutations
- **Examples:** `app/login/actions.ts`, `app/templates/[id]/actions.ts`

### SQL schema / policies
- **Pattern:** `backend/supabase/*.sql`
- **Purpose:** Domain schema, auth, tenancy, policy rules
- **Examples:** `quotecore_schema_v1.sql`, `quotecore_rls_auth_v1.sql`

### Documentation
- **Pattern:** `documentation/**/*.md`, `docs/*.md`
- **Purpose:** Legacy implementation notes and BMAD-generated knowledge
- **Examples:** `documentation/active/implementation/dashboard-shell.md`, `docs/project-overview.md`

## Asset Locations

- **Static assets:** `public/` (default scaffold assets only at present)
- **Styles:** `app/globals.css`

## Configuration Files

- **`package.json`**: runtime scripts and dependencies
- **`tsconfig.json`**: TypeScript config with strict mode
- **`next.config.ts`**: Next.js config shell
- **`postcss.config.mjs`**: PostCSS/Tailwind integration
- **`eslint.config.mjs`**: lint config
- **`.env.local`**: local environment variables for Supabase and related secrets

## Notes for Development

- The app is operationally a brownfield project, but structurally still mid-transition.
- `app/page.tsx` and `public/*` indicate scaffold remnants that should eventually be replaced or removed.
- `quotes/` and `settings/` are not yet mature product areas.
- The SQL layer is currently more complete than the front-end quote workflow.
- The BMAD install created a literal `{output_folder}` directory, which is harmless but should be normalized later if the team wants cleaner artifact paths.

---

_Generated using BMAD Method `document-project` workflow_
