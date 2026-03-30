---
project_name: 'quotecore-app'
user_name: 'Shaun'
date: '2026-03-30'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 46
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- **Framework:** Next.js 16.2.1 with App Router
- **UI:** React 19.2.4
- **Language:** TypeScript 5.x in strict mode
- **Styling:** Tailwind CSS 4 + `app/globals.css`, but current implementation still uses many inline styles
- **Backend/Data Access:** Supabase SSR client for authenticated reads; Supabase admin/service-role usage exists for privileged signup/provisioning flows
- **Database:** Postgres / Supabase SQL schema defined in `backend/supabase/*.sql`
- **App Pattern:** monolithic web app with route-local pages and `actions.ts` server actions
- **Package Manager:** npm with `package-lock.json`
- **Planning Framework:** BMAD v6 (`bmm`) installed locally

## Critical Implementation Rules

### Language-Specific Rules

- Treat this as a **strict TypeScript** codebase. Prefer explicit typing for domain shapes, Supabase result handling, and pricing-related data.
- Do **not** weaken the type system with casual `any`. If a type is unclear, define or narrow it.
- Prefer **server-safe async/await flows** with explicit validation at the boundary of `FormData`, route params, and Supabase responses.
- Keep parsing/normalization close to the input boundary:
  - trim strings
  - coerce numeric inputs deliberately
  - validate enums before persistence
- Throw clear errors for invalid state rather than silently accepting malformed data.
- Keep domain logic reusable when it stops being route-specific; do not bury important calculation logic inside UI pages.

### Framework-Specific Rules

- Treat QuoteCore as a **Next.js App Router app with server-action-first mutations**, not a classic REST API project.
- Prefer keeping reads in server-rendered pages and writes in explicit `actions.ts` files unless there is a clear architectural reason to extract further.
- Enforce **company context** before touching company-scoped data. Follow the existing `requireCompanyContext()` pattern rather than inventing parallel tenancy checks.
- Keep privileged operations clearly separated. Any flow using the **Supabase service role** must remain tightly scoped and intentional.
- Reuse `app/lib/supabase/server.ts` patterns for authenticated server access instead of ad-hoc client creation.
- Do not introduce new UX structure as one-off page hacks if the feature really belongs to a broader dashboard/shell pattern.
- When implementing new quote flows, align with the existing domain model first; do not bend the schema just to fit a quick UI shortcut.

### Testing Rules

- Assume this project is currently **manual-test-heavy**; do not pretend strong automated coverage already exists.
- For new non-trivial logic, prefer creating code that is **easy to test later**, even if the first pass is manually verified.
- Prioritize tests around:
  - pricing calculations
  - quote generation logic
  - tenancy / company-scoping behavior
  - auth-sensitive mutations
- When adding stories that change business logic, include a clear **verification path** even if formal tests are not yet present.
- Do not introduce fragile UI-only checks as a substitute for validating domain logic.
- If a feature touches pricing, measurements, or quote totals, verification must cover real numeric outcomes and edge cases.

### Code Quality & Style Rules

- Favor **clarity over cleverness**. This codebase is still being structurally stabilized.
- Keep business/domain logic out of presentation code once it starts becoming reusable or consequential.
- Follow the existing route-oriented file placement unless there is a clear reason to extract shared logic into `app/lib/` or another focused domain location.
- New UI work should move the project toward a cleaner reusable pattern, not deepen the current inline-style sprawl.
- Do not create random parallel naming schemes; stay consistent with the current route and file organization.
- Keep forms, persistence logic, and calculation logic conceptually separate even when they live near each other.
- Prefer small, explicit helpers over giant mixed-responsibility page files.
- Preserve the schema as a source of truth; code should reflect domain intent rather than hand-wave around it.

### Development Workflow Rules

- Treat work as **story-driven implementation**, not vague task execution.
- When a request is underspecified, translate it into:
  - user outcome
  - constraints
  - acceptance criteria
  - affected domain areas
- Prefer building from the existing brownfield foundation rather than restarting or bypassing current domain structures.
- Update BMAD artifacts when structure or assumptions materially change.
- Keep the `docs/` brownfield documentation and project context aligned with reality as the system evolves.
- Commit meaningful checkpoints so the project can be restored at clear workflow boundaries.
- Use BMAD to reduce ambiguity and back-and-forth; the developer workflow should absorb most of the translation burden, not the human.

### Critical Don't-Miss Rules

- Do **not** treat the current weak UX as evidence that the domain model is weak. The schema/pricing layer is more mature than the UI.
- Do **not** solve workflow gaps by bypassing tenancy rules, company scoping, or RLS assumptions.
- Do **not** force the product into generic SaaS patterns that conflict with roofing quote realities.
- Do **not** build new quote flows without respecting the existing template -> measurement -> item -> quote domain structure.
- Do **not** overfit early UI work to placeholder layouts that are likely to be replaced.
- Do **not** use the Supabase service role in normal request flows unless the operation is explicitly privileged.
- Do **not** silently coerce pricing or measurement values in ways that hide data errors.
- Do **not** build separate manual-measurement and AI-measurement systems if one shared measurement canvas can serve both.
- Do **not** skip documenting meaningful architectural or workflow shifts once implementation starts moving faster.

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code.
- Follow all rules exactly as documented.
- When in doubt, prefer the more restrictive option.
- Update this file if new patterns emerge or existing rules stop matching reality.

**For Humans:**

- Keep this file lean and focused on agent needs.
- Update when the technology stack or core patterns change.
- Review periodically to remove stale or obvious rules.
- Use this as the implementation guardrail, not as a substitute for PRD/architecture/story artifacts.

Last Updated: 2026-03-30
rchitecture/story artifacts.

Last Updated: 2026-03-30
