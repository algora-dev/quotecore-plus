---
stepsCompleted: [1]
inputDocuments:
  - '{output_folder}/planning-artifacts/prd.md'
  - '{output_folder}/project-context.md'
  - 'docs/index.md'
  - 'docs/project-overview.md'
  - 'docs/architecture.md'
  - 'docs/data-models.md'
  - 'docs/component-inventory.md'
workflowType: 'architecture'
project_name: 'quotecore-app'
user_name: 'Shaun'
date: '2026-03-30'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
QuoteCore+ currently defines 62 functional requirements across account/access management, template and pricing configuration, quote lifecycle, manual measurement input, shared measurement canvas workflows, AI-assisted measurement, localization, integrations, and governance. Architecturally, this means the system needs more than a set of CRUD pages. It needs a clear domain model, controlled role boundaries, trustworthy quote generation, and a durable measurement subsystem that can support both manual and AI-assisted workflows without divergence.

The most architecturally important functional areas are:
- multi-tenant company isolation
- owner/admin vs worker permissions
- reusable template and pricing framework management
- quote generation, storage, editing, cloning, and customer-ready output
- calibrated digital takeoff with persistent overlays and mappings
- AI-assisted takeoff built on the same shared measurement framework

**Non-Functional Requirements:**
The most important NFR drivers are:
- strict tenant isolation and access control
- quote and pricing integrity
- measurement-session durability and traceability
- responsive user experience across plan interaction and quote workflows
- scalability to at least 1,000+ DAU without fundamental redesign
- auditability for sensitive configuration and quote-affecting changes
- progressive usability for users transitioning from manual workflows

These NFRs will strongly influence architecture decisions around data boundaries, storage strategy, session modeling, security, and system decomposition.

**Scale & Complexity:**
This is a high-complexity brownfield full-stack SaaS project.

- Primary domain: full-stack web SaaS for roofing measurement and quoting
- Complexity level: high
- Estimated architectural components: 8–12 major subsystems or bounded areas

Likely major architectural areas include:
- identity and access
- tenant/company context
- template and pricing domain
- quote lifecycle domain
- measurement session / overlay domain
- document/file handling
- customer-facing quote output
- AI measurement integration path
- supporting cross-cutting concerns like auditability, search, and integrations

### Technical Constraints & Dependencies

- Existing codebase is a brownfield Next.js App Router application with Supabase-backed auth/data access and SQL-first domain modeling.
- The architecture must preserve and build around the existing pricing/domain foundations rather than discard them.
- The current SQL/domain model is more mature than the visible product UX, so architecture should bias toward domain truth rather than current page structure.
- The shared measurement canvas is a first-class strategic requirement and must not be treated as a bolt-on feature.
- Measurement should be treated as its own domain area with session, calibration, geometry/overlay, mapping, and persistence concerns.
- AI-assisted takeoff must extend the same measurement model used by manual digital takeoff rather than creating a separate architectural path.
- Uploaded plans and related files are core architectural dependencies because they support measurement workflows, quote evidence, persistence, permissions, and future AI usage.
- The architecture must support future integrations (payment, email, cloud storage) without overbuilding for them now.
- UX design is not yet formalized in a dedicated artifact, so architecture should remain supportive of rich interactions without hard-coding premature UI assumptions.

### Cross-Cutting Concerns Identified

- tenant isolation and role-based access control
- pricing and quote integrity
- quote trust as a first-class system property
- measurement accuracy, persistence, and traceability
- secure handling of uploaded plans and associated files
- configuration vs execution boundaries between owner/admin and worker roles
- progressive usability for change-resistant users
- architecture support for future AI augmentation without system fork
- auditability of template, pricing, and quote-affecting changes

## Starter Template Evaluation

### Primary Technology Domain

Full-stack web SaaS based on project requirements analysis.

### Starter Options Considered

**Option 1 — Continue with the existing Next.js foundation**
- Current brownfield stack already uses Next.js 16.2.1, React 19.2.4, TypeScript 5.x, and Tailwind 4.
- Preserves current momentum and aligns with the existing codebase.
- Fits the intended GitHub + Vercel deployment path cleanly.
- Avoids risky replatforming while allowing architectural cleanup and restructuring.

**Option 2 — Replatform toward a T3-style starter**
- Attractive for greenfield full-stack typesafe apps.
- Less suitable here because it introduces opinionated full-stack choices that do not align cleanly with the current Supabase/Postgres brownfield direction.
- Would create churn and drift instead of helping the real product move forward.

### Selected Starter: Continue with the Existing Next.js Foundation

**Rationale for Selection:**
QuoteCore+ is already a brownfield Next.js application, and the project preferences support keeping TypeScript, Next.js, Vercel compatibility, and the current Supabase/Postgres direction. The best architectural move is to preserve the existing foundation and reshape it intentionally rather than introducing a different starter template.

**Initialization Command:**

```bash
npm install
npm run dev
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
- TypeScript
- React 19
- Next.js 16 App Router
- Node/npm workflow

**Styling Solution:**
- Tailwind 4 remains the base styling system
- The architecture should improve UI discipline and reuse rather than replacing the styling stack immediately

**Build Tooling:**
- Standard Next.js build and dev pipeline
- Vercel-compatible deployment path

**Testing Framework:**
- No mature automated test stack exists yet
- Testing should be added deliberately as architecture and implementation mature

**Code Organization:**
- Existing route-local page + `actions.ts` pattern
- Shared helpers under `app/lib`
- SQL/domain layer under `backend/supabase`
- This calls for architectural shaping, not starter replacement

**Development Experience:**
- Existing app already provides the shortest path to productive work
- Best next move is architecture-guided restructuring, not starter churn

**Note:** Project initialization using this foundation is already complete because the brownfield app exists. Future implementation stories should focus on architecture-driven restructuring and feature delivery rather than re-scaffolding the project.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Keep Postgres/Supabase as the system of record
- Use SQL-first domain modeling with application-layer validation
- Keep Supabase Auth + company-scoped authorization + RLS enforcement
- Use server-action-first architecture for internal product workflows
- Treat the shared measurement canvas as its own domain subsystem
- Keep Next.js App Router monolith for MVP / early growth
- Deploy via GitHub -> Vercel, with Supabase as the managed backend platform

**Important Decisions (Shape Architecture):**
- Introduce a cleaner internal domain structure instead of keeping all logic route-local forever
- Use Tailwind as the styling base, but adopt a reusable component system for cleaner UX
- Keep quote generation and pricing logic in dedicated domain/service layers, not page files
- Make file storage and plan uploads part of the core architecture early
- Design for future worker-safe execution boundaries and quote/audit traceability

**Deferred Decisions (Post-MVP):**
- Public external API
- Broader integration orchestration
- Heavy caching layers beyond obvious hotspots
- Service decomposition / microservices
- Mobile-native clients

### Data Architecture

- **Primary database:** Supabase Postgres
- **Modeling approach:** SQL-first schema evolution, with application/domain models aligned to DB truth
- **Validation strategy:** application-layer validation at boundaries plus DB constraints as final guardrails
- **Migration approach:** explicit SQL migration workflow / versioned schema changes
- **Caching strategy:** minimal at first; add targeted caching later for read-heavy paths if performance requires it

### Authentication & Security

- **Authentication method:** Supabase Auth
- **Authorization pattern:** company-scoped authorization with owner/admin vs worker role boundaries
- **Security enforcement:** combine application-level permission checks with database-level RLS
- **Sensitive data handling:** uploaded plans, quote data, and measurement sessions treated as protected tenant assets
- **Account hardening path:** MFA-ready, but not a first-release blocker unless product policy elevates it

### API & Communication Patterns

- **Primary internal pattern:** Next.js server actions for product workflows
- **Service boundary pattern:** extract reusable domain logic into internal service/domain modules as the codebase matures
- **Public API:** not a first-release requirement
- **Error handling:** explicit domain-safe error handling at action boundaries
- **Rate limiting:** defer unless public endpoints or abuse patterns make it necessary

### Frontend Architecture

- **App shell:** Next.js App Router
- **State management:** prefer server-first data flow and localized client state; avoid introducing heavy global state unless clearly needed
- **Component architecture:** adopt a reusable component system on top of Tailwind
- **UI system recommendation:** Tailwind + shadcn/ui-style component approach is the best fit for clean, sharp, simple product UX without throwing away current stack alignment
- **Measurement UI:** treat the shared measurement canvas as a first-class frontend/domain subsystem, not a one-off page widget

### Infrastructure & Deployment

- **Code hosting:** GitHub
- **Primary app hosting:** Vercel
- **Backend platform:** Supabase managed services
- **Environment strategy:** separate local / preview / production environments
- **Monitoring/logging:** lightweight but real monitoring from early stages; expand as usage grows
- **Scaling strategy:** scale inside the monolith/platform approach first before considering service separation

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
The main risk areas for agent inconsistency are naming, domain placement, validation boundaries, measurement-system modeling, quote output behavior, and UI/component organization.

### Naming Patterns

**Database Naming Conventions**
- Use **snake_case** for tables, columns, indexes, and foreign keys
- Use plural table names where appropriate (`quotes`, `quote_versions`, `measurement_sessions`)
- Use `_id` suffixes for foreign keys (`company_id`, `template_id`, `quote_id`)
- Keep migration/schema naming explicit and descriptive

**API / Server Action Naming Conventions**
- Use clear verb-driven names for mutations (`createQuote`, `updateTemplate`, `saveMeasurementSession`)
- Use noun-based naming for domain modules (`quote-service`, `measurement-session-service`)
- If API routes are introduced later, use plural resource naming

**Code Naming Conventions**
- Use **camelCase** in application code
- Use **PascalCase** for React components and TypeScript types/interfaces where appropriate
- Use **kebab-case** for route folders and most non-component file names
- Keep names aligned with domain terms from the schema and PRD

### Structure Patterns

**Project Organization**
- Keep route files in `app/`, but move reusable business logic into explicit domain/service modules rather than letting page files grow indefinitely
- Organize major logic by domain area, especially:
  - templates/pricing
  - quotes
  - measurement sessions / overlays
  - auth / company context
- Co-locate route-specific code only when it is genuinely route-specific
- Measurement-session, calibration, geometry, mapping, and persistence logic should live in clearly grouped domain modules rather than being scattered across route files and ad hoc helpers

**File Structure Patterns**
- React components: PascalCase filenames when they are true components
- Domain/service files: kebab-case filenames
- Validation schemas should live alongside the relevant domain/application module rather than being scattered randomly across route files
- Static assets and uploaded-file handling concerns should remain clearly separated from business logic
- Metadata, access checks, and storage references for uploaded plans should follow one consistent pattern and never be embedded casually inside unrelated UI logic

### Format Patterns

**Data & Domain Formats**
- Database / SQL: snake_case
- App code / UI objects: camelCase
- Convert at the boundary instead of leaking SQL-shaped objects directly through UI/application layers
- Use explicit mapping at boundaries where needed instead of mixing conventions sloppily
- Dates in app/system interfaces should default to ISO-style string handling unless a strong reason exists otherwise

**Error / Response Formats**
- Server-action and domain errors should follow a consistent structure
- User-facing errors should be separated from internal technical/logging detail
- Quote- and measurement-affecting failures must be explicit, not silently swallowed

### Communication Patterns

**Domain Boundaries**
- Quote generation logic should not live inside presentation components
- Measurement canvas logic should not be scattered across unrelated pages/files
- AI-assisted measurement should extend the same measurement domain objects used by manual digital takeoff
- Draft vs customer-ready quote states should be reflected consistently in domain logic and naming, not improvised per feature

**State Management**
- Prefer server-first data flow and local/client state only where interaction actually requires it
- Avoid adding global client state unless there is a proven need
- Keep measurement-canvas interaction state isolated and intentionally structured

### Process Patterns

**Validation Patterns**
- Validate at boundaries:
  - form input
  - route params
  - uploaded plan metadata
  - measurement session persistence
  - quote generation inputs
- Use application-level validation plus database constraints, not one or the other alone

**Error Handling Patterns**
- Distinguish:
  - validation errors
  - permission/auth errors
  - domain/business-rule errors
  - system failures
- Never hide pricing or measurement integrity problems behind vague generic failures

**Loading State Patterns**
- Loading and saving states should be explicit for user-critical workflows
- Measurement and quote workflows should make it obvious what is saved, unsaved, processing, or failed
- Avoid ambiguous UX where users cannot tell whether quote or measurement changes were persisted

### Enforcement Guidelines

**All AI Agents MUST:**
- follow camelCase / snake_case / kebab-case / PascalCase conventions consistently
- keep domain logic out of route/page presentation code when it becomes reusable or consequential
- use one shared measurement model for manual and AI-assisted takeoff
- preserve company scoping and permission boundaries in every feature
- keep pricing and quote-trust logic explicit and traceable
- implement important quote- and measurement-affecting operations in a way that supports later tracing/debugging

**Pattern Enforcement**
- Treat this architecture doc + project-context file as the implementation guardrail
- If a task would violate an established pattern, update the architecture/context intentionally rather than drifting silently
- Document meaningful exceptions instead of improvising them in code

### Pattern Examples

**Good Examples:**
- `measurement_sessions`, `measurement_elements`, `quote_versions`
- `createQuote`, `updateTemplate`, `saveMeasurementSession`
- `app/quotes/[id]/page.tsx`
- `app/lib/measurement-session-service.ts`
- `components/QuoteSummaryCard.tsx`

**Anti-Patterns:**
- mixing camelCase and snake_case randomly inside the same layer
- putting quote-calculation logic directly in page components
- creating one measurement model for manual takeoff and another for AI
- hiding role/tenant checks only in the UI layer
- inventing ad hoc naming for the same domain concept in different folders

## Project Structure & Boundaries

### Complete Project Directory Structure

```text
quotecore-app/
├── README.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── next.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
├── .env.local
├── .env.example
├── .gitignore
├── middleware.ts                  # if retained after cleanup; otherwise remove
├── docs/                          # brownfield/project knowledge docs
├── _bmad/                         # BMAD framework
├── {output_folder}/
│   └── planning-artifacts/
│       ├── prd.md
│       ├── architecture.md
│       └── measurement-canvas-spec.md
├── public/
│   ├── assets/
│   └── uploads-placeholders/      # local dev-only placeholders if needed
├── backend/
│   └── supabase/
│       ├── schema/
│       │   ├── 001_core.sql
│       │   ├── 002_global_extras.sql
│       │   ├── 003_rls_auth.sql
│       │   └── ...
│       ├── seeds/
│       └── README.md
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── (marketing)/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/
│   │   │   ├── templates/
│   │   │   ├── quotes/
│   │   │   ├── measurements/
│   │   │   ├── extras/
│   │   │   ├── files/
│   │   │   └── settings/
│   │   └── api/                   # reserve for future public/system endpoints only if needed
│   ├── components/
│   │   ├── ui/                    # reusable primitive components
│   │   ├── layout/                # shell, nav, page wrappers
│   │   ├── forms/                 # form-specific reusable pieces
│   │   ├── quote/                 # quote-facing reusable components
│   │   ├── template/              # template-facing reusable components
│   │   ├── measurement/           # canvas and measurement UI pieces
│   │   └── file/                  # upload/file UI pieces
│   ├── domains/
│   │   ├── auth/
│   │   │   ├── actions/
│   │   │   ├── services/
│   │   │   ├── schemas/
│   │   │   └── types.ts
│   │   ├── company/
│   │   │   ├── services/
│   │   │   ├── schemas/
│   │   │   └── types.ts
│   │   ├── templates/
│   │   │   ├── actions/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── policies/
│   │   │   ├── mappers/
│   │   │   ├── schemas/
│   │   │   └── types.ts
│   │   ├── pricing/
│   │   │   ├── engine/
│   │   │   ├── services/
│   │   │   ├── schemas/
│   │   │   └── types.ts
│   │   ├── quotes/
│   │   │   ├── actions/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── presenters/
│   │   │   ├── mappers/
│   │   │   ├── policies/
│   │   │   ├── schemas/
│   │   │   └── types.ts
│   │   ├── measurements/
│   │   │   ├── actions/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── sessions/
│   │   │   ├── calibration/
│   │   │   ├── geometry/
│   │   │   ├── mapping/
│   │   │   ├── ai-assist/
│   │   │   ├── mappers/
│   │   │   ├── schemas/
│   │   │   └── types.ts
│   │   ├── files/
│   │   │   ├── actions/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── mappers/
│   │   │   ├── schemas/
│   │   │   └── types.ts
│   │   └── permissions/
│   │       ├── services/
│   │       ├── policies/
│   │       └── types.ts
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── server.ts
│   │   │   ├── client.ts
│   │   │   └── admin.ts
│   │   ├── env/
│   │   ├── utils/
│   │   ├── errors/
│   │   ├── logging/
│   │   └── mapping/
│   ├── config/
│   │   ├── app.ts
│   │   ├── auth.ts
│   │   ├── quote.ts
│   │   └── measurement.ts
│   ├── types/
│   │   ├── api.ts
│   │   ├── database.ts
│   │   └── shared.ts
│   └── styles/
│       └── tokens.css             # optional design tokens/theme layer
├── tests/
│   ├── unit/
│   │   ├── pricing/
│   │   ├── quotes/
│   │   ├── measurements/
│   │   └── permissions/
│   ├── integration/
│   │   ├── auth/
│   │   ├── templates/
│   │   ├── quotes/
│   │   └── measurements/
│   ├── e2e/
│   │   ├── onboarding/
│   │   ├── quote-generation/
│   │   └── digital-takeoff/
│   └── fixtures/
└── scripts/
    ├── db/
    ├── seed/
    └── maintenance/
```

### Architectural Boundaries

**API Boundaries:**
- Next.js server actions are the default internal mutation boundary
- Future `/api/*` routes should be reserved for explicit public/system integration needs, not used casually for internal app logic
- Auth and permission checks happen before domain mutations
- Domain services should sit behind route/server-action boundaries

**Component Boundaries:**
- `src/app/` owns routing and page composition
- `src/components/` owns reusable UI pieces
- `src/domains/` owns business/domain logic
- Measurement canvas UI belongs in `components/measurement`, but measurement logic belongs in `domains/measurements`
- Route folders should stay thin; real domain logic should live in domain modules rather than route pages

**Service Boundaries:**
- pricing logic belongs under `domains/pricing`
- quote lifecycle belongs under `domains/quotes`
- template logic belongs under `domains/templates`
- file and upload logic belongs under `domains/files`
- owner/worker access logic belongs under `domains/permissions`
- shared infra helpers belong in `lib/`, not mixed into domain modules

**Data Boundaries:**
- SQL schema remains the source of truth for persistence shape
- domain repositories handle database interaction
- app/UI layers should not directly shape SQL data ad hoc
- measurement session/calibration/geometry/mapping should be treated as first-class persistent data
- mappers/presenters should be used where DB shape, domain shape, and customer-facing shape differ

### Requirements to Structure Mapping

**Feature / Requirement Mapping:**
- account & access management → `domains/auth`, `domains/company`, `domains/permissions`, `(auth)` routes
- template creation/editing → `domains/templates`, `(dashboard)/templates`
- pricing engine → `domains/pricing`
- quote lifecycle → `domains/quotes`, `(dashboard)/quotes`
- manual measurement input → `domains/measurements`, `(dashboard)/measurements`
- calibrated digital takeoff → `domains/measurements`, `components/measurement`
- AI-assisted takeoff later → extends `domains/measurements`, not a parallel subsystem
- file uploads / plan handling → `domains/files`, `(dashboard)/files`
- customer-facing quote output → `domains/quotes/presenters`, quote UI components

**Cross-Cutting Concerns:**
- company scoping → `domains/permissions`, `lib/supabase`, DB/RLS layer
- traceability / auditability → quote + measurement domain services, logging layer
- validation → domain-local `schemas/`
- uploaded-plan protection → `domains/files` + permission layer
- UI consistency → `components/ui`, `components/layout`, styling tokens

### Integration Points

**Internal Communication:**
- routes/pages call server actions
- server actions call domain services
- domain services call repositories / infra helpers
- repositories and infra helpers talk to Supabase/Postgres/storage

**External Integrations:**
- Supabase: auth, DB, storage
- Vercel: deployment/runtime hosting
- GitHub: source control / CI entry point
- future: payment/email/cloud-storage integrations through explicit domain/service boundaries

**Data Flow:**
- user action -> route/server action -> validation -> domain service -> repository/storage -> response/presenter -> UI
- measurement flow -> upload/calibration/geometry -> measurement session persistence -> template mapping -> quote generation

### File Organization Patterns

**Configuration Files:**
- root for build/runtime config
- `src/config/` for app-level domain configuration
- `.env.example` should be maintained as onboarding reference

**Source Organization:**
- `src/app/` for routing
- `src/components/` for reusable UI
- `src/domains/` for business logic
- `src/lib/` for infra/shared helpers
- `src/types/` for cross-domain shared types only

**Test Organization:**
- `tests/unit/` for pricing, permission, and domain logic
- `tests/integration/` for domain-to-data flows
- `tests/e2e/` for onboarding, quote flow, and digital takeoff journeys

**Asset Organization:**
- static public assets in `public/`
- uploaded plan files handled through the file domain/storage layer, not as ad hoc public assets

### Development Workflow Integration

**Development Server Structure:**
- local app runs through standard Next.js dev flow
- Supabase-backed flows remain the main system integration surface

**Build Process Structure:**
- Next.js/Vercel build pipeline remains primary
- SQL/schema changes evolve in versioned backend artifacts

**Deployment Structure:**
- GitHub as source of truth
- Vercel for app deployment
- Supabase for managed backend services

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
The chosen stack and architectural direction are coherent. Next.js App Router, TypeScript, Supabase/Postgres, server-action-first workflows, Tailwind-based UI, and the shared measurement canvas strategy all fit together without obvious contradictions. The brownfield preservation approach also aligns with the product’s real implementation state.

**Pattern Consistency:**
The implementation patterns support the architecture well. Naming conventions, domain boundaries, route-thin rules, validation boundaries, and quote/measurement consistency rules all reinforce the chosen architecture rather than competing with it.

**Structure Alignment:**
The proposed project structure supports the architectural decisions. The measurement domain has a first-class home, quote and pricing logic are separated from presentation, and the structure gives AI agents a clear place to implement features without inventing parallel patterns.

### Requirements Coverage Validation ✅

**Feature Coverage:**
The architecture supports all core product areas defined in the PRD:
- account and access management
- templates and pricing
- quote lifecycle
- manual measurement input
- shared measurement canvas / digital takeoff
- future AI-assisted measurement
- customer-facing quote output
- role-safe execution and tenant isolation

**Functional Requirements Coverage:**
All major FR categories have architectural support, including the owner/admin vs worker model, quote traceability, digital takeoff persistence, and the shared measurement framework that bridges manual and AI-assisted workflows.

**Non-Functional Requirements Coverage:**
The architecture addresses the critical NFRs around:
- tenant isolation
- security and access boundaries
- quote/pricing integrity
- measurement persistence and traceability
- scalability to 1,000+ DAU
- usability and future mobile path
- integration readiness

### Implementation Readiness Validation ✅

**Decision Completeness:**
The architecture includes enough core decisions for implementation to begin without major architectural ambiguity.

**Structure Completeness:**
The project tree is concrete enough to guide implementation and prevent drift across routes, components, domains, and supporting infrastructure.

**Pattern Completeness:**
The implementation patterns are strong enough to keep future agent work consistent, especially around naming, boundaries, quote trust, and the shared measurement system.

### Gap Analysis Results

**Critical Gaps:** None identified.

**Important but Non-Blocking Gaps:**
- customer acceptance/signature workflow detail
- uploaded file format and size policies
- measurement revision/version strategy
- exact observability tooling
- exact testing tool selection

**Nice-to-Have Future Clarifications:**
- architecture decision log/ADR cadence
- richer integration sequencing
- more explicit quote-rendering/export pathways

### Validation Issues Addressed

The main architectural risks identified during validation were:
- treating AI as a separate measurement system
- letting route-local logic remain the long-term code organization strategy
- under-specifying measurement persistence and traceability
- failing to make owner/admin vs worker boundaries structurally meaningful

These issues have been addressed in the current architecture through domain boundaries, structure rules, implementation patterns, and the shared measurement canvas strategy.

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**✅ Architectural Decisions**
- [x] Critical decisions documented
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Core deployment direction identified

**✅ Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**✅ Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements-to-structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- strong alignment between PRD and architecture
- realistic brownfield evolution path
- clear measurement-domain strategy
- strong trust and security posture
- implementation guidance specific enough for consistent agent work

**Areas for Future Enhancement:**
- acceptance/signature workflows
- file handling detail
- richer observability/testing decisions
- more detailed export/share architecture if needed later

### Implementation Handoff

**AI Agent Guidelines:**
- follow architectural decisions exactly as documented
- use the implementation patterns consistently
- keep routes thin and domain logic explicit
- preserve one shared measurement model for manual and AI-assisted workflows
- treat quote trust, tenant isolation, and pricing integrity as core system properties

**First Implementation Priority:**
Use the existing brownfield Next.js foundation and start implementation through architecture-guided restructuring, beginning with the highest-leverage product areas: templates, quotes, measurement domain, and supporting boundaries.
