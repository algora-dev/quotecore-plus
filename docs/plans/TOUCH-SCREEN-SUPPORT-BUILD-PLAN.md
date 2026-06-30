# Touch Screen Support — Build Plan

**Created:** 2026-06-30
**Author:** Gavin
**Status:** Updated post-Gerald audit (2026-06-30) — all findings addressed
**Audited by:** Gerald (pre-build, report: `workspace-gerald/audits/quotecore-plus-touch-support-2026-06-30/04-report.md`)
**Branch:** `development` (new feature branch to be created)

---

## Objective

Enable touch-screen tablet and mobile users to operate QuoteCore+ for all non-canvas features. Canvas-based precision drawing tools (Drawings editor, Digital Takeoff workstation) are gated and blocked on touch devices. Users can still view, upload, and manage drawings/images — they just can't open the canvas editors.

## Design Decisions

### 1. Automatic detection with manual override + resolved-mode cookie
- Detect touch devices automatically on page load using `pointer: coarse` media query + `maxTouchPoints > 0` + viewport width heuristic.
- Store user preference as `device_mode` on `users` table (values: `auto` | `desktop` | `touch`). Default is `auto`.
- **Resolved-mode cookie** (Gerald M-01): when `auto` mode resolves client-side, persist the result in a cookie (`qc_resolved_device_mode=touch|desktop`) so the server can read it on subsequent navigations. This prevents misclassification on direct URL access for iPad/hybrid devices.
- Users can manually override to `desktop` (e.g. touchscreen laptop with stylus) or `touch` via Account settings.
- **Server-side resolution** uses: stored override → resolved-mode cookie → User-Agent fallback (conservative).

### 2. Canvas features gated, not hidden — server + client enforcement
- Drawings list page (`/drawings`) — fully accessible on touch. Users can view, upload, delete, and manage drawings.
- Drawings canvas editor (`/drawings/draw`) — blocked on touch. Server-side redirect + client guard.
- Drawings edit form (`/drawings/[id]/edit`) — **also blocked on touch** (Gerald L-02). This route uses Fabric Canvas for editing flashing measurements and must be gated.
- Takeoff results on a quote — visible on touch (read-only display of measurements).
- Takeoff workstation (`/quotes/[id]/takeoff`) — blocked on touch. Server-side redirect + client guard. **Gate must run before any side effects** (Gerald M-02) — see Phase 2.2.
- Quote builder — accessible on touch. Takeoff launch buttons in `FilesManager.tsx` are gated (Gerald M-03). Manual measurement entry still works.

### 3. Toggle approach (opt-in layout mode)
- When `device_mode` resolves to `touch`, the app applies touch-optimised CSS and layout adaptations.
- Desktop mode is the unchanged default. Zero visual or behavioural difference for desktop users.
- All touch-specific styling lives behind a `data-device-mode="touch"` attribute on the workspace layout root.
- **CSS selectors are surgical, not universal** (Gerald L-03): no `*:hover` resets. Use explicit utility classes (`.touch-target`, `.touch-tap`) and page-specific rules for known sticky-hover classes. See Phase 3 for details.

---

## Scope

### In scope
- Touch device detection + mode persistence
- Touch-mode CSS layer (targets, hover replacement, active states)
- Layout adaptation for tablet/touch (sidebars → drawers, panel stacking, nav reflow)
- Feature gating for canvas editors (draw + takeoff)
- "Desktop required" fallback page
- Quote builder + order form touch layouts
- Testing & polish

### Out of scope (deferred)
- Canvas touch gestures (pinch-to-zoom, two-finger pan, touch drawing)
- FlashingCanvas touch support
- TakeoffWorkstation touch support
- Mobile phone layout (portrait phone screens < 600px) — tablet landscape and portrait only for now

---

## Build Plan

### Phase 1: Foundation (estimated 3-4 days)

#### 1.1 Database migration
- Add `users.device_mode` column: `text DEFAULT 'auto' CHECK (device_mode IN ('auto', 'desktop', 'touch'))`
- Migration file: `supabase/migrations/20260630120000_add_device_mode.sql`
- Regenerate database types.

#### 1.2 Touch device detection utility
- New file: `app/lib/device/detect-mode.ts`
- **Client-side** function `detectTouchMode()`:
  - `window.matchMedia('(pointer: coarse)').matches` → strong signal
  - `navigator.maxTouchPoints > 0` → supporting signal
  - Viewport width < 1024px → supporting signal (tablet range)
  - Returns `true` if 2+ signals match, `false` otherwise
- **Server-side** function `getResolvedDeviceMode()` (Gerald M-01):
  - Reads in priority: `users.device_mode` override → `qc_resolved_device_mode` cookie → User-Agent fallback
  - Returns `'desktop' | 'touch'`
  - Used by server components (canvas route pages) to gate before client hydration
  - Conservative User-Agent fallback: treat as desktop if uncertain (avoids false-blocking desktop users)

#### 1.3 Mode context + provider + cookie persistence
- New file: `app/components/device/DeviceModeProvider.tsx`
- React context that:
  - Reads `users.device_mode` from server (passed as prop from layout)
  - If `auto`, runs `detectTouchMode()` on mount and resolves to `desktop` | `touch`
  - **Persists resolved mode to `qc_resolved_device_mode` cookie** (1-year expiry) so server components can gate on subsequent navigations (Gerald M-01)
  - Calls `router.refresh()` after first resolution so server-rendered content (including route gates) picks up the cookie
  - Applies `data-device-mode` attribute to the workspace layout root
  - Exposes `deviceMode`, `isTouch`, and `isResolved` to consumers
- Wrap the workspace layout (`app/(auth)/[workspaceSlug]/layout.tsx`) with this provider.
- **Client guard for canvas routes** (Gerald M-01): `TakeoffWorkstation.tsx` and `FlashingCanvas.tsx` mount a small guard effect that redirects to `/desktop-required` if `isTouch === true` after hydration. This catches the edge case where a touch device loads the canvas URL directly before the cookie is set.

#### 1.4 Account settings toggle
- Add "Device Mode" section to Account > Profile (or a new "Display" tab).
- Three options: Auto (default), Desktop, Touch — radio buttons.
- Saves to `users.device_mode` via server action.
- **Server action writes only `profile.id`** (Gerald L-01): derive target user from `requireCompanyContext()` / `getCurrentProfile()`, update `.eq('id', profile.id)`. Never accept a client-supplied `userId`. Pattern matches existing `updateAssistantEnabled`.
- On save, refreshes the page so the layout re-renders with the new mode. Also clears the `qc_resolved_device_mode` cookie if mode is explicitly set (override takes precedence).

#### 1.5 Feature gating utility
- New file: `app/lib/device/feature-gating.ts`
- `isCanvasAllowed(deviceMode: 'desktop' | 'touch'): boolean` — returns `false` for touch
- Shared between client and server components

#### 1.6 "Desktop required" page
- New file: `app/(auth)/[workspaceSlug]/desktop-required/page.tsx`
- Clean, on-brand page explaining the feature requires a desktop computer.
- Includes a link back to the dashboard.
- Used by both the drawings editor and takeoff workstation redirects.

---

### Phase 2: Feature Gating (estimated 2-3 days)

#### 2.1 Drawings editor gate — two routes (Gerald L-02)
- **`/drawings/draw`** (create canvas — `drawings/draw/page.tsx`):
  - Call `getResolvedDeviceMode()` at the top of the server component.
  - If touch, `redirect()` to `/${slug}/desktop-required?feature=drawing` before any canvas hydration.
- **`/drawings/[id]/edit`** (edit canvas — `drawings/[id]/edit/page.tsx`):
  - Same gate. This route renders `edit-form.tsx` which uses Fabric Canvas for editing — must be blocked on touch.
- In the drawings list (`flashing-list.tsx`):
  - "Create New Drawing" button: on touch, show a tooltip/badge "Desktop required" and link to the desktop-required page instead of the editor.
  - Existing drawings in the list are still clickable to view/manage (open detail page, not canvas editor).
  - Upload to drawings library — fully accessible on touch.
- **Client guard** (Gerald M-01): `FlashingCanvas.tsx` mounts a redirect effect if `isTouch === true` after hydration. Backstop for direct URL access before cookie is set.

#### 2.2 Takeoff workstation gate — before side effects (Gerald M-02)
- In `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/page.tsx`:
  - **Gate at the very top** of the server component, immediately after `params`/`searchParams` parsing and **before** any `createTakeoffPageForArea`, signed URL generation, or quote/takeoff writes.
  - Call `getResolvedDeviceMode()`. If touch, `redirect()` to `/${slug}/desktop-required?feature=takeoff`.
  - This is critical: the takeoff route can create new takeoff page/roof-area state when `mode=new-page` and no `pageId` is present. The gate must run before any of that logic.
- **Client guard** (Gerald M-01): `TakeoffWorkstation.tsx` mounts a redirect effect if `isTouch === true` after hydration.

#### 2.3 Takeoff launch surface — FilesManager.tsx (Gerald M-03)
- The plan originally named only `quote-builder.tsx` as the takeoff launch surface. **This was wrong.** The actual takeoff navigation lives in `FilesManager.tsx` (3 entry points):
  1. First-time start: `router.push('/.../takeoff')` (line ~195)
  2. Continue/add to existing: `router.push('/.../takeoff?mode=add')` (line ~215)
  3. New area new plan: `router.push('/.../takeoff?mode=new-page&areaName=...')` (line ~229)
- `FilesManager.tsx` must consume `DeviceModeProvider` (or receive `isTouch` as prop from `quote-builder.tsx` which renders it at line 575).
- **All 3 takeoff entry points** in `FilesManager.tsx` must be gated on touch:
  - Replace each `router.push(...takeoff...)` with a redirect to `/desktop-required?feature=takeoff` when `isTouch`.
  - Show a lock badge + "Desktop required" tooltip on the takeoff buttons.
- The server-side route redirect (Phase 2.2) is the backstop, but the client-side gate in FilesManager prevents the confusing flow of navigating to a blocked route.

#### 2.4 Nav indicator on touch
- Drawings nav item: show a small lock badge on touch devices (same pattern as plan-gated features).
- Takeoff buttons in FilesManager: show lock badge + tooltip.

---

### Phase 3: Touch-Mode CSS Layer (estimated 2-3 days)

#### 3.1 Global touch CSS — surgical selectors (Gerald L-03)
- New file: `app/styles/touch-mode.css` (imported in `globals.css`)
- Rules scoped under `[data-device-mode="touch"]`.
- **No universal `*:hover` resets** (Gerald L-03). Instead, neutralise known sticky-hover classes surgically.

**Touch target sizing — explicit utility, not global button override:**
```css
[data-device-mode="touch"] .touch-target {
  min-height: 44px;
  min-width: 44px;
}
```
- Apply `.touch-target` class explicitly to interactive elements that need it (nav pills, icon buttons, header buttons). Not a blanket override on all `<button>` / `<a>` elements — that would affect dense controls, modal buttons, and form inputs in unintended ways.

**Surgical hover neutralisation — known sticky classes only:**
```css
/* Neutralise the specific hover classes that get stuck on touch.
   Each is a known pattern from the design system. */
[data-device-mode="touch"] .hover\:bg-orange-50\/40:hover {
  background-color: transparent;
}
[data-device-mode="touch"] .hover\:bg-slate-50:hover {
  background-color: transparent;
}
[data-device-mode="touch"] .hover\:bg-slate-100:hover {
  background-color: transparent;
}
[data-device-mode="touch"] .icon-btn:active {
  background-color: rgba(255, 107, 53, 0.12);
}
```
- Add more surgical rules as identified during testing. Do NOT add a catch-all `*:hover` reset.

#### 3.2 Tailwind utility additions
- Add to `app/globals.css` under `@theme` or as custom utilities:
  - `.touch-target` — applies `min-h-[44px] min-w-[44px]` for explicit use
  - `.touch-tap` — `active:` state for touch feedback
- These are available in both modes but primarily used in touch components.

#### 3.3 Nav bar adaptation
- `WorkspaceNav.tsx`:
  - On touch, nav pills get `min-h-[44px]` and wider `px-4 py-2` (up from `px-3 py-1`).
  - `flex-wrap` already exists — on touch, switch to a horizontal scroll container with `overflow-x-auto` if pills overflow.
  - Lock badge on Drawings nav item (touch only).

#### 3.4 Header adaptation
- Header buttons (AlertBell, InboxLink, HelpDrawerTrigger, Account, Logout):
  - Increase tap targets to 44px minimum.
  - Increase spacing between buttons (`gap-3` → `gap-4`).

---

### Phase 4: Layout Adaptation (estimated 3-4 days)

#### 4.1 Workspace layout
- `app/(auth)/[workspaceSlug]/layout.tsx`:
  - On touch, `max-w-6xl px-6` → `max-w-full px-4` (use full width on tablet).
  - Header: `flex-col gap-3` stacks better on touch.
  - Main content: `px-6 py-10` → `px-4 py-6` (less wasted space on tablet).

#### 4.2 List pages (Quotes, Invoices, Orders)
- These already have `sm:` / `md:` breakpoints that collapse grids on narrow screens.
- Touch-specific: increase row height (`py-3` → `py-4`), increase checkbox size, ensure action buttons meet 44px target.
- `QuotesList.tsx`, `InvoiceList.tsx`, `OrdersHub` — audit each row layout for touch targets.

#### 4.3 Quote builder
- `quote-builder.tsx` (2,187 lines):
  - Currently a fixed multi-column desktop layout.
  - On touch, stack panels vertically (takeoff → components → extras → review).
  - Each phase becomes a full-width section instead of a side-by-side panel.
  - Tab navigation between phases (optional — vertical scroll may be sufficient).
  - The takeoff button is gated (Phase 2.2).

#### 4.4 Order create form
- `order-create-form.tsx` (2,228 lines):
  - Currently 4 responsive breakpoints — better than quote builder but still desktop-first.
  - On touch, stack the form panels vertically.
  - `OrderLineByLineEditor` table: on touch, increase row height and ensure `w-12` columns (Qty) are wider for tap input.

#### 4.5 Customer quote editor
- `CustomerQuoteEditor.tsx` (1,527 lines):
  - Already has 5 breakpoints — reasonably responsive.
  - Touch-specific: increase input heights, ensure the line-item table rows are tall enough for tap.

#### 4.6 Modals
- Most modals are `max-w-md` or `max-w-lg` centred — these work fine on tablet.
- Touch-specific: increase button heights inside modals, ensure close button is 44px target.
- Full-screen modals (if any) should use safe-area insets on tablets with notches.

#### 4.7 Inbox / Message Center
- `InboxList.tsx` already has responsive patterns.
- Touch: increase row heights, ensure toggle switches are 44px targets.

---

### Phase 5: Testing & Polish (estimated 2-3 days)

#### 5.1 Manual testing matrix
| Device | Mode | What to test |
|--------|------|-------------|
| iPad (10.9") landscape | Touch | All non-canvas pages, nav, modals, forms |
| iPad (10.9") portrait | Touch | Same as above, check layout reflow |
| iPad Mini landscape | Touch | Narrower width — check nav overflow |
| Desktop (1920px) | Desktop | Full regression — zero changes expected |
| Desktop (1366px) | Desktop | Same regression |
| Touchscreen laptop | Auto → Desktop override | Canvas works, no touch CSS applied |

#### 5.2 Feature gating verification — direct URLs (Gerald M-01, M-02, M-03)
- Touch device → direct URL `/drawings/draw` → redirects to desktop-required ✅
- Touch device → direct URL `/drawings/[id]/edit` → redirects to desktop-required ✅ (Gerald L-02)
- Touch device → direct URL `/quotes/[id]/takeoff` → redirects to desktop-required ✅
- Touch device → direct URL `/quotes/[id]/takeoff?mode=new-page&areaName=Test` → redirects **before any state mutation** ✅ (Gerald M-02)
- Touch device → direct URL `/quotes/[id]/takeoff?mode=add` → redirects ✅
- Touch device → first visit (no cookie) → client guard redirects after hydration ✅ (Gerald M-01)
- Touch device → second visit (cookie set) → server redirect, no flash of canvas ✅
- Touch device → drawings list → can view, upload, manage, but "Create" links to desktop-required ✅
- Touch device → quote builder → FilesManager takeoff buttons gated, manual entry works ✅ (Gerald M-03)
- Touch device → Account settings → override to Desktop → canvas accessible ✅
- Desktop device → all canvas features work unchanged ✅
- Desktop device → `data-device-mode` attribute never set to `touch` ✅
- Touchscreen laptop (auto) → resolves to touch → can override to Desktop → canvas works ✅

#### 5.3 Smoke test checklist
- Add new items to `docs/smoke-tests/CHECKLIST.md`:
  - Touch mode: nav and layout on tablet
  - Touch mode: quote create/edit without takeoff
  - Touch mode: order create
  - Touch mode: invoice create/send
  - Touch mode: drawings list (view + upload, no editor)
  - Touch mode: account settings (including device mode toggle)
  - Desktop regression: full smoke test suite unchanged

#### 5.4 Build verification
- `npm run build` must pass.
- No TypeScript errors.
- No new ESLint warnings.

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/20260630120000_add_device_mode.sql` | DB migration |
| `app/lib/device/detect-mode.ts` | Touch detection utility |
| `app/lib/device/feature-gating.ts` | Canvas gating logic |
| `app/components/device/DeviceModeProvider.tsx` | React context provider |
| `app/components/device/DeviceModeToggle.tsx` | Account settings toggle |
| `app/styles/touch-mode.css` | Touch-specific CSS layer |
| `app/(auth)/[workspaceSlug]/desktop-required/page.tsx` | Fallback page |

## Files to Modify

| File | Change |
|------|--------|
| `app/(auth)/[workspaceSlug]/layout.tsx` | Wrap with DeviceModeProvider, apply data attribute, adjust spacing for touch |
| `app/components/workspace/WorkspaceNav.tsx` | Touch targets, nav overflow, lock badge on drawings |
| `app/(auth)/[workspaceSlug]/drawings/draw/page.tsx` | Server-side redirect for touch (Gerald M-01) |
| `app/(auth)/[workspaceSlug]/drawings/[id]/edit/page.tsx` | Server-side redirect for touch (Gerald L-02 — edit form uses Fabric Canvas) |
| `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/page.tsx` | Server-side redirect for touch, **before any side effects** (Gerald M-02) |
| `app/(auth)/[workspaceSlug]/drawings/flashing-list.tsx` | Gate "Create" button on touch |
| `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder.tsx` | Pass `isTouch` to FilesManager, touch layout stacking |
| `app/(auth)/[workspaceSlug]/quotes/[id]/FilesManager.tsx` | **Gate all 3 takeoff entry points** (Gerald M-03) |
| `app/(auth)/[workspaceSlug]/drawings/draw/FlashingCanvas.tsx` | Client guard: redirect if `isTouch` after hydration (Gerald M-01) |
| `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/TakeoffWorkstation.tsx` | Client guard: redirect if `isTouch` after hydration (Gerald M-01) |
| `app/(auth)/[workspaceSlug]/account/UserProfileForm.tsx` | Add device mode toggle section |
| `app/globals.css` | Import touch-mode.css, add touch utilities |
| `app/(auth)/[workspaceSlug]/quotes/QuotesList.tsx` | Touch row heights, tap targets |
| `app/(auth)/[workspaceSlug]/invoices/InvoiceList.tsx` | Touch row heights, tap targets |
| `app/(auth)/[workspaceSlug]/material-orders/create/order-create-form.tsx` | Touch layout stacking |
| `app/(auth)/[workspaceSlug]/quotes/[id]/customer-edit/CustomerQuoteEditor.tsx` | Touch input heights |
| `app/(auth)/[workspaceSlug]/inbox/InboxList.tsx` | Touch row heights, toggle targets |
| `app/components/alerts/AlertBell.tsx` | Touch tap target |
| `app/components/docs/HelpDrawer.tsx` | Touch tap target for trigger |

## Database Changes

Single migration, additive only:
```sql
ALTER TABLE users ADD COLUMN device_mode text DEFAULT 'auto'
  CHECK (device_mode IN ('auto', 'desktop', 'touch'));
```

No existing columns or data affected.

**RLS note (Gerald L-01):** The existing `public.users` UPDATE policy allows same-company updates, not just self-only. This is a pre-existing pattern (the same policy covers `assistant_enabled` and other user prefs). The server action for `device_mode` must follow the `updateAssistantEnabled` pattern: derive the target from `getCurrentProfile()` and update `.eq('id', profile.id)`. Never accept a client-supplied `userId`. The broad RLS policy itself is a separate security concern flagged by Gerald for a future hardening pass — not in scope for this feature.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Desktop regression | Very low | High | All touch CSS scoped under `[data-device-mode="touch"]`. Desktop never gets this attribute. |
| Touch detection false positive | Low | Medium | Manual override available. User can force desktop mode. |
| Touch detection false negative | Low | Low | User can force touch mode via Account settings. |
| Canvas redirect breaks deep links | Low | Medium | Desktop-required page explains the limitation; user can switch to desktop override to access. |
| Layout breaks on unusual viewport sizes | Medium | Low | Test on common tablet sizes (768px, 834px, 1024px). Unusual sizes fall back to touch layout which is designed to be flexible. |

**Overall risk: LOW.** No backend logic changes. No data migration risk. All touch changes are CSS-scoped and opt-in. Desktop mode is byte-for-byte unchanged.

### Gerald audit findings addressed
| Finding | Severity | How addressed |
|---------|----------|---------------|
| M-01: Server-only redirect incomplete for `auto` mode | Medium | Resolved-mode cookie + client guard on canvas components + `router.refresh()` after detection |
| M-02: Gate must run before takeoff route side effects | Medium | Gate placed at top of `takeoff/page.tsx`, before any `createTakeoffPageForArea` or writes |
| M-03: Plan misses actual takeoff launch component | Medium | `FilesManager.tsx` identified as the real launch surface — all 3 entry points gated |
| L-01: `users.device_mode` inherits broad same-company UPDATE RLS | Low | Server action follows `updateAssistantEnabled` pattern (`.eq('id', profile.id)`). Broad RLS flagged for separate hardening pass. |
| L-02: Drawings route name doesn't match app structure | Low | Corrected: `/drawings/draw` (create) + `/drawings/[id]/edit` (edit, uses Fabric Canvas) — both gated |
| L-03: CSS selectors too broad | Low | Removed universal `*:hover` reset. Replaced with surgical `.touch-target` utility + known sticky-hover class neutralisation only. |

---

## Estimated Timeline

| Phase | Days | Running Total |
|-------|------|---------------|
| Phase 1: Foundation | 3-4 | 3-4 |
| Phase 2: Feature gating (incl. Gerald M-01/M-02/M-03 fixes) | 2-3 | 5-7 |
| Phase 3: Touch CSS layer (surgical, Gerald L-03) | 2-3 | 7-10 |
| Phase 4: Layout adaptation | 3-4 | 10-14 |
| Phase 5: Testing & polish (incl. direct URL regression) | 2-3 | 12-17 |
| **Total** | **12-17 days** | |

Approximately 2-2.5 weeks of focused work. Can be compressed if Phase 3 and Phase 4 are worked in parallel.

---

## Future Phase (Out of Scope)

**Canvas touch support** — when prioritised, this would add:
- Pinch-to-zoom and two-finger pan to TakeoffWorkstation and FlashingCanvas
- Touch-optimised drawing (larger hit areas, snap-to-grid for precision)
- Stylus support for precise input
- Estimated 1-2 weeks additional effort

This is intentionally deferred. The gating mechanism built in Phase 2 is designed to be removed cleanly when canvas touch support is ready — just delete the redirect and the feature is unlocked.
