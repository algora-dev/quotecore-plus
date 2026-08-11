# Active Smart Components - Reviewed Implementation Plan

> Created 2026-08-11. Codebase review completed 2026-08-11. Awaiting build approval.

## Goal

Replace the hard creation cap with a global **active Smart Component** allowance:

- A company may store and edit any number of Smart Components across any number of libraries.
- Only active components can be selected for new work in quotes, takeoff, custom lines, invoices, and reusable templates.
- The allowance is global to the company, not per library.
- Activation is a one-click action on the main Smart Components page.
- Deactivation never deletes or breaks existing quotes, measurements, templates, invoices, or orders.

## Tier Shape

| Plan | Active Smart Components | Price |
|---|---:|---:|
| Trial (14 days) | 10 | $0 |
| Free | 5 | $0 |
| Starter | 20 | $19/month |
| Pro | 50 | $39/month |
| Pro Plus | 200 | $59/month |

Keep `subscription_plans.component_limit` as the source of truth, but define it everywhere as the maximum number of **active non-system Smart Components**, not stored rows.

## Audit Findings and Improvements

1. **Reuse `is_active`.** `deleteComponent()` performs a hard delete, so the first plan's soft-delete concern is based on stale comments. No second status column is needed.
2. **Use Active/Inactive, not Locked.** Inactive components stay readable and editable; locked implies lost access.
3. **Enforce in SQL first.** Inserts also come from calculator drafts, CSV/catalogue imports, supplier-library imports, onboarding seeds, and other actions. Updating only `createComponent()` would leave bypasses.
4. **Exclude system rows.** `company_component_count()` currently includes active `is_system=true` AI/takeoff placeholders. They must not consume customer allowance.
5. **Remove the stale client count floor.** `Math.max(componentCount, activeCount)` cannot fall after a deactivate/delete. Actions must return an authoritative active count.
6. **Remove batch-import cap rejection.** Current prechecks reject whole imports. Imports should fill remaining active slots in input order and store overflow inactive.
7. **Validate writes, not just pickers.** Crafted requests must not be able to attach an inactive component to new work.
8. **Preserve historical joins.** Existing quote/takeoff/template/invoice/order references must still resolve inactive components.
9. **Fix trial lifecycle drift.** The cron persists expired trials as active `free`, but checked-in effective-plan SQL still resolves the pre-Free `starter`/inactive behaviour before cron execution.
10. **Keep the 50%-off email separate.** That requires its own approved Stripe promotion and email specification.

## Product Invariants

1. `is_active=true` consumes one company allowance slot.
2. `is_active=false` remains stored, editable, searchable, and unavailable for new selection.
3. `is_system=true` does not consume allowance and remains available internally.
4. Creation/import never fails solely because the active allowance is full.
5. Activation over cap fails atomically with `component_limit_reached`.
6. The allowance spans all libraries.
7. Downgrades deactivate deterministic overflow; they never delete data.
8. Existing work keeps its component snapshot/reference after deactivation.

## Phase 1 - Database and Entitlements

Create one additive migration in `backend/supabase/migrations/`:

1. Set limits: Trial 10, Free 5, Starter 20, Pro 50, Pro Plus 200.
2. Update comments from “lifetime/soft-delete cap” to “active non-system component allowance”.
3. Change `company_component_count()` to count `is_active=true AND is_system=false` for the company.
4. Keep `require_component_slot()` and its per-company advisory lock as the atomic activation gate.
5. Replace the insert-trigger behaviour:
   - Reject all component writes for genuinely write-inactive companies.
   - Exempt `is_system=true` from quota.
   - For requested active user rows, call `require_component_slot()`.
   - Catch only `P0010`, set `NEW.is_active=false`, and allow the insert.
   - Re-raise subscription/security errors.
6. Keep the false-to-true update trigger as the hard activation boundary, including direct PostgREST updates.
7. Add idempotent `reconcile_company_component_limit(company_id)`:
   - Read the effective allowance and exclude system rows.
   - Keep up to the limit active and deactivate overflow only.
   - Use deterministic `created_at ASC, id ASC` ordering.
   - Do nothing for an unlimited allowance.
8. Reconcile over-cap companies after applying the new values.
9. Add/confirm a partial index for active non-system count/picker queries.
10. When an entitlement snapshot detects `activeCount > limit`, run the idempotent reconcile function before returning picker/management data. This closes the gap between a time-based trial expiry and the next cron run.

No destructive schema change or RLS relaxation is required.

## Phase 2 - Creation, Imports, and Toggle Action

Update `app/(auth)/[workspaceSlug]/components/actions.ts`:

1. Remove the early cap failure from `createComponent()` and let SQL return the real inserted state.
2. Return the row plus `status: 'active' | 'inactive'`, authoritative `activeCount`, and `limit`.
3. Remove `is_active` from the generic edit whitelist.
4. Add dedicated `setComponentActive(componentId, nextActive)` that checks ownership, updates only status, maps `P0010`, returns the new count/limit, and revalidates affected routes.

Update every producer to rely on the database invariant rather than reject at cap:

- `app/lib/free-tools/createComponentFromDraft.ts`
- `app/(auth)/[workspaceSlug]/components/catalog-actions.ts`
- `app/(auth)/[workspaceSlug]/supplier/catalogue-actions.ts`
- `app/(auth)/[workspaceSlug]/supplier-directory/actions.ts`
- `app/(auth)/onboarding/actions.ts` and starter seed/RPC paths
- `app/components/CreateSmartComponentModal.tsx`

Batch imports preserve input order. Show a result such as **“30 imported: 4 active, 26 inactive.”**

## Phase 3 - Main Smart Components UX

Follow `docs/DESIGN_SYSTEM.md` in `component-list.tsx`.

### Global summary

- Limited: **“10 of 20 active Smart Components”**
- Unlimited: **“37 active Smart Components - Unlimited”**
- Help text: **“Active components can be used across QuoteCore+. Inactive components stay saved and editable.”**
- At cap, show a small rounded-full Upgrade action, but do not block Add Component.

### Rows

1. Apply filters first, then sort active rows first. Secondary order is library/name for All Libraries and existing order/name within a selected library.
2. Active rows get a subtle orange cue using the existing row language; inactive rows remain readable with muted secondary text.
3. Show a design-system status badge with dot: **Active** or **Inactive**.
4. Add an always-visible rounded-full **Activate/Deactivate** action with outline 24x24 Heroicon, `aria-pressed`, loading state, tooltip, and 44px mobile target.
5. Do not use a star; it reads as “favourite”.
6. Editing and deleting remain unchanged for both states.
7. Search, Main/Extras, and library filters continue to work.

### Feedback

- Free slot: **“Component created and active.”**
- At cap: **“Component created as inactive. Deactivate another component or upgrade to use it.”**
- Activation at cap: keep it inactive and open `UpgradeModal` explaining both choices.

## Phase 4 - Active for New Use Everywhere

Use picker filtering for UX and server validation for security.

### Load all for management/history

Do not filter active state from the main library, admin views, or existing quote, takeoff, template, invoice, material-order, and quote-derived order reads.

### Active non-system only for new selection

Audit and update:

- Manual and blank/custom quote builders under `app/(auth)/[workspaceSlug]/quotes/`
- Customer quote edit add-line flow
- Labour-sheet add-component flow
- Invoice add-line component picker
- Digital takeoff manual selector
- Reusable template create/edit pickers
- Supplier/public publication and selection flows

Takeoff must retain `is_system=true` AI placeholders while exposing only active non-system rows in the manual picker.

### Write-boundary validation

Add shared `assertComponentActiveForNewUse(companyId, componentId, { allowSystem })` and call it when:

- Attaching a component to a quote/custom quote
- Saving new takeoff measurements for a user component
- Creating/updating template component links
- Applying template components to a new quote

Template application skips inactive items and returns a visible warning naming them; it must not silently reintroduce them or fail the whole quote.

## Phase 5 - Trial Expiry and Downgrades

1. Make expired unpaid trials resolve immediately to `free` and remain active under Free rights.
2. On the next authenticated entitlement load, detect the expired unpaid trial, persist the active Free transition, and reconcile components atomically/idempotently so enforcement does not wait for the daily cron.
3. Keep `app/api/cron/expire-trials/route.ts` as the fallback persistence/audit transition to active Free.
4. Call `reconcile_company_component_limit()` in every downgrade transition before success.
5. Call the same function after Stripe webhook downgrades/cancellations and admin plan changes.
6. Keep transition/event writing and reconciliation idempotent for retries and cron overlap.
7. Upgrades do not auto-activate old inactive rows; users choose their expanded active set.

The promotional expiry email remains separate billing/email work.

## Phase 6 - Copy and Documentation

Replace ambiguous “Components”/“Components (total)” with **Active Smart Components** in account billing, admin plan management, pricing docs, quota errors, and onboarding/trial copy.

Use one explanation: **“Create and store unlimited Smart Components. Your plan controls how many can be active and used across QuoteCore+ at once.”**

## Validation

### Database

1. Below-cap insert is active; at-cap insert succeeds inactive.
2. A batch crossing cap fills remaining slots and stores overflow inactive.
3. Activation below cap succeeds; activation at cap returns `P0010` unchanged.
4. Deactivate/swap counts remain accurate and concurrent activations cannot exceed cap.
5. System rows do not count and remain available to AI Takeoff.
6. Write-inactive companies cannot bypass the lock with `is_active=false`.
7. Downgrade reconciliation deactivates overflow without deletion.

### Product

1. All Libraries and individual libraries show active rows first.
2. Counter updates after create/import/activate/deactivate/delete without refresh.
3. Both states remain editable.
4. Every new-use picker hides inactive rows and crafted calls are rejected.
5. Existing quotes, takeoffs, templates, invoices, and orders still render.
6. Template quote creation warns about skipped inactive items.
7. Trial-to-Free and paid downgrades enforce limits without data loss.
8. Mobile actions meet 44px targets; desktop density stays intact.

### Release

1. Add focused Playwright entitlement/component coverage.
2. Run `npm run lint` and `npm run build`.
3. Apply the additive migration to shared Supabase.
4. Preview-smoke Trial, Free, Starter, Pro, and Pro Plus fixtures.
5. Batch one logical commit and one `development` push.

## Expected Files

- `backend/supabase/migrations/<timestamp>_active_smart_components.sql`
- `app/lib/billing/entitlements.ts`
- A focused component-eligibility helper
- Component actions/list/catalog import files
- Calculator draft and supplier import files
- Relevant quote/takeoff/invoice/labour/customer-edit/template loaders and actions
- `app/api/cron/expire-trials/route.ts`
- Stripe/admin downgrade paths
- Billing/admin copy and `docs/pricing/` tier tables
- Focused Playwright coverage

## Definition of Done

Users can store unlimited Smart Components, clearly manage one global active set across all libraries, use only active components for new work, retain historical data, and move between plans without deletion or inconsistent enforcement.
