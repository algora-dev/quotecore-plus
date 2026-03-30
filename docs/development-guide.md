# QuoteCore - Development Guide

**Date:** 2026-03-30

## Prerequisites

- Node.js
- npm
- Supabase project credentials
- Local `.env.local` file with required keys
- Access to Supabase SQL editor or migration workflow for schema scripts

## Local Setup

1. Open the project root:
   `C:\Users\Jimmy\.openclaw\workspace-jimmy\projects\quotecore-main\QuoteCore+\quotecore-app`
2. Install dependencies:
   `npm install`
3. Ensure `.env.local` contains the expected Supabase values.
4. Start the app:
   `npm run dev`

## Core Environment Variables

Based on the current code, the following are required at minimum:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

The service role key is currently required for the signup flow because company + user provisioning is handled server-side.

## Main Commands

- `npm run dev` — start local dev server
- `npm run build` — production build
- `npm run start` — run built app
- `npm run lint` — lint codebase

## Database / Backend Setup

The SQL artifacts in `backend/supabase/` are a key part of local setup:

1. Run `quotecore_schema_v1.sql`
2. Run `quotecore_global_extras_v1.sql`
3. Run `quotecore_rls_auth_v1.sql`

These scripts establish:
- tenancy model
- templates/items/quotes domain
- global extras extension
- row-level security and helper functions

## Development Workflow Recommendations

### Current practical workflow

1. run app locally
2. verify auth flow works
3. verify Supabase schema matches app expectations
4. test template and extras flows manually
5. iterate feature work route-by-route

### BMAD-oriented workflow going forward

1. update brownfield docs in `docs/`
2. generate / maintain project context
3. create PRD and architecture artifacts when scope changes meaningfully
4. convert tasks into stories
5. implement one story at a time
6. review code and update docs as necessary

## Testing Status

No automated tests were identified during this scan.

Current quality strategy appears to be manual testing through:
- auth pages
- template pages
- extras pages
- direct verification against Supabase data

## Known Development Risks

- quote flow is incomplete, so not all product paths can be exercised end-to-end yet
- current UI quality may obscure actual backend maturity
- route-local logic may become hard to maintain if feature velocity increases without refactoring
- some scaffold leftovers can create confusion about which parts are authoritative

## Recommended Immediate Dev Hygiene

- confirm exact env variable set in a sanitized onboarding doc
- replace placeholder landing page and quote placeholders when those stories begin
- decide whether middleware files are dead or pending
- add at least basic smoke tests once quote flow matures
- normalize BMAD artifact output path if `{output_folder}` is not intentional

---

_Generated using BMAD Method `document-project` workflow_
