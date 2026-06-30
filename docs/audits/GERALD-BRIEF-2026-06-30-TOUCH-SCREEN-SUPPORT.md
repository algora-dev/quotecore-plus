# GERALD AUDIT BRIEF — Touch Screen Support

**Created:** 2026-06-30
**From:** Gavin
**To:** Gerald
**Scope:** Pre-build security & architecture review of the Touch Screen Support feature plan
**Plan document:** `docs/plans/TOUCH-SCREEN-SUPPORT-BUILD-PLAN.md`

---

## Context

QuoteCore+ is currently a desktop-only application. We're adding touch-screen tablet support so users can operate the app on iPads and similar devices. The approach is:

1. **Detect touch devices** automatically (with manual override).
2. **Block canvas-based features** (Drawings editor, Digital Takeoff workstation) on touch devices — these are precision drawing tools that don't work with fingers.
3. **Adapt all other pages** (quotes, orders, invoices, catalog, account, inbox, dashboard) with touch-friendly layouts.
4. **Desktop mode remains unchanged** — all touch-specific CSS is scoped behind a `data-device-mode="touch"` attribute.

## What This Audit Covers

This is a **pre-build audit** of the plan, not a post-implementation review. Gerald should assess:

### 1. Security review of the plan
- The feature adds a `users.device_mode` column (`text DEFAULT 'auto'`, CHECK constraint). Is this safe? Any RLS implications?
- Device mode is user-controlled (they can override via Account settings). Could a user manipulate this to bypass anything? (We don't believe device_mode gates any security-sensitive features — it's purely UI presentation. Confirm this assessment.)
- The "Desktop required" redirect pages — could these leak any information or be bypassed to access canvas features on touch? (The gating is UI-level, not security-level. The canvas endpoints are not protected by device mode — they're just redirected. Is this acceptable, or should the server enforce the gate too?)

### 2. Architecture review
- Is the `DeviceModeProvider` context approach sound? It reads `users.device_mode` server-side, passes as prop, then runs client-side detection for `auto` mode.
- The `data-device-mode` attribute on the layout root — is this a clean scoping mechanism for touch CSS, or are there risks of leakage?
- Touch device detection uses `matchMedia('(pointer: coarse)')`, `navigator.maxTouchPoints`, and viewport width. Is this heuristic reasonable? Any edge cases (touchscreen laptops, hybrid devices)?

### 3. Feature gating approach
- Drawings editor (`/drawings/draw/[id]`) and Takeoff workstation (`/quotes/[id]/takeoff`) will redirect touch users to a "Desktop required" page.
- The drawings **list** page remains accessible — users can view, upload, and manage drawings on touch.
- The quote builder remains accessible — only the "Start Digital Takeoff" button is gated; manual measurement entry works.
- **Question for Gerald:** Should the canvas route gating be server-side (redirect in `page.tsx` server component) or client-side, or both? The plan proposes server-side. Is this sufficient?

### 4. CSS isolation risk
- All touch-specific CSS lives under `[data-device-mode="touch"]` selector.
- Desktop mode never applies this attribute.
- **Question for Gerald:** Is there any risk that touch CSS could affect desktop users? (e.g. if the attribute is incorrectly applied, or if CSS specificity issues arise.)

### 5. No backend logic changes
- This feature is entirely frontend presentation. No API changes, no business logic changes, no payment/billing changes.
- The only DB change is adding one column to `users`.
- **Confirm:** Is there anything in this plan that touches security-sensitive code paths?

---

## What Gerald Should NOT Audit (Out of Scope)

- The actual touch CSS implementation (not yet written)
- Canvas touch gesture handling (explicitly deferred — canvas is blocked on touch, not made touch-compatible)
- Mobile phone layout (tablet-only for now, phone support deferred)
- The existing canvas code (TakeoffWorkstation.tsx, FlashingCanvas.tsx) — unchanged by this feature

---

## Implementation Range

This is a **pre-build** audit. The implementation has not started. Gerald is reviewing the plan document at:

```
docs/plans/TOUCH-SCREEN-SUPPORT-BUILD-PLAN.md
```

Full path:
```
C:\Users\Jimmy\.openclaw\workspace-gavin\projects\quotecore-plus\docs\plans\TOUCH-SCREEN-SUPPORT-BUILD-PLAN.md
```

---

## Key Files Referenced in the Plan

| File | Role |
|------|------|
| `app/(auth)/[workspaceSlug]/layout.tsx` | Workspace shell — will wrap with DeviceModeProvider |
| `app/components/workspace/WorkspaceNav.tsx` | Nav bar — touch targets + lock badge |
| `app/(auth)/[workspaceSlug]/drawings/draw/page.tsx` | Canvas editor — server-side redirect for touch |
| `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/page.tsx` | Takeoff — server-side redirect for touch |
| `app/(auth)/[workspaceSlug]/drawings/flashing-list.tsx` | Drawings list — stays accessible, "Create" gated |
| `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder.tsx` | Quote builder — takeoff button gated, layout adapts |
| `app/(auth)/[workspaceSlug]/account/UserProfileForm.tsx` | Account — device mode toggle added |
| `app/globals.css` | Global styles — touch CSS import |
| `app/lib/supabase/database.types.ts` | Types — will regenerate after migration |

## New Files to Be Created

| File | Purpose |
|------|---------|
| `supabase/migrations/20260630120000_add_device_mode.sql` | DB migration |
| `app/lib/device/detect-mode.ts` | Touch detection utility |
| `app/lib/device/feature-gating.ts` | Canvas gating logic |
| `app/components/device/DeviceModeProvider.tsx` | React context provider |
| `app/components/device/DeviceModeToggle.tsx` | Account settings toggle |
| `app/styles/touch-mode.css` | Touch-specific CSS layer |
| `app/(auth)/[workspaceSlug]/desktop-required/page.tsx` | Fallback page |

---

## Questions for Gerald

1. Is server-side redirect sufficient for canvas gating, or should there be additional enforcement?
2. Are there any RLS or security concerns with the `users.device_mode` column?
3. Is the CSS scoping approach (`[data-device-mode="touch"]`) safe against leakage to desktop?
4. Any concerns with the touch detection heuristic for hybrid devices?
5. Is there anything in this plan that could break existing security measures (rate limiters, RLS policies, auth flows)?

---

## Expected Output from Gerald

Standard audit report format:
- `04-report.md` with severity ratings (Critical / High / Medium / Low)
- Focus on architecture and plan-level risks, not implementation details (since implementation hasn't started)
- Any blockers that should be resolved before building begins
- Recommendations for the implementation phase

---

**Bundle HEAD:** Not applicable — this is a plan-level audit, no code changes yet.
**Branch:** `development` (current HEAD, no touch-related commits)
