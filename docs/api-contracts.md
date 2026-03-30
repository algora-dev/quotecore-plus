# QuoteCore - API / Mutation Surface

**Date:** 2026-03-30

## Overview

This project does not currently expose a conventional REST API layer in the repository. Instead, its primary application mutation surface is implemented through Next.js server actions and Supabase data operations.

## Current Server Action Surface

### Authentication

#### `loginAction(formData)`
- **Location:** `app/login/actions.ts`
- **Purpose:** Sign in user with email/password
- **Dependencies:** Supabase SSR client
- **Success path:** redirects to `/templates`

#### `logoutAction()`
- **Location:** `app/actions.ts`
- **Purpose:** Sign out current user
- **Success path:** redirects to `/login`

#### `signupWithCompany(input)`
- **Location:** `app/signup/actions.ts`
- **Purpose:** Creates auth user, company, and owner profile
- **Dependencies:** Supabase admin/service-role client
- **Important note:** this is currently a privileged provisioning flow

### Template Management

#### `createTemplate(formData)`
- **Location:** `app/templates/actions.ts`
- **Writes to:** `templates`
- **Redirect:** `/templates/{id}`

#### `updateTemplate(templateId, formData)`
- **Location:** `app/templates/[id]/actions.ts`
- **Writes to:** `templates`

#### `createMeasurementKey(templateId, formData)`
- **Location:** `app/templates/[id]/actions.ts`
- **Writes to:** `template_measurement_keys`

#### `updateMeasurementKey(templateId, measurementId, formData)`
- **Location:** `app/templates/[id]/actions.ts`
- **Writes to:** `template_measurement_keys`

#### Group and item mutation flows
- **Locations:** nested under `app/templates/[id]/groups/**` and `app/templates/[id]/items/**`
- **Purpose:** create/update groups, items, and item config records
- **Primary tables touched:**
  - `template_item_groups`
  - `template_items`
  - `template_area_configs`
  - `template_direct_configs`
  - `template_fixed_configs`

### Global Extras

#### `createGlobalExtra(formData)`
- **Location:** `app/extras/actions.ts`
- **Writes to:** `global_extras`
- **Redirect:** `/extras/{id}`

## Data Access Pattern

Read operations are mostly page-level Supabase queries inside route components, for example:
- template list/detail pages
- extras pages
- company/user context loading

So the current app is closer to:
- server-rendered views
- server actions for writes
- direct Supabase table access for reads

than to a classic controller/service/API architecture.

## Authentication / Authorization Contract

- Auth provider: Supabase Auth
- User/session resolution: `createSupabaseServerClient()` + `supabase.auth.getUser()`
- Company gating: `requireCompanyContext()`
- RLS policy contract exists in SQL and should be considered part of the API surface

## Not Yet Present

- No clear REST `/api/*` route layer was identified in this repo
- No versioned external API contract was found
- No OpenAPI/Swagger schema was found
- No dedicated public quote-acceptance route implementation was found in app code yet, despite the schema supporting it

## Architectural Implication

Future BMAD planning should treat the current mutation layer as **server-action-first**, not API-first. If the product later needs external integrations, mobile clients, or public programmatic access, a more formal API boundary may need to be introduced.

---

_Generated using BMAD Method `document-project` workflow_
