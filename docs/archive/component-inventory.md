# QuoteCore - Component and Route Inventory

**Date:** 2026-03-30

## Overview

QuoteCore currently organizes most product functionality around route-level pages rather than a mature shared component library. In other words, the dominant “components” today are feature routes and their paired server actions.

## Major Product Areas

### Authentication

- **`app/login/page.tsx`**
  - Email/password login form
  - Uses `loginAction`
- **`app/signup/page.tsx`**
  - Company + owner signup form
  - Uses `signupWithCompany`
- **`app/actions.ts`**
  - logout action

### Template Management

- **`app/templates/page.tsx`**
  - Lists company templates
- **`app/templates/new/page.tsx`**
  - Creates new templates
- **`app/templates/[id]/page.tsx`**
  - Template detail view
  - surfaces measurement keys, groups, and items
- **`app/templates/[id]/edit/page.tsx`**
  - Edits template metadata
- **`app/templates/[id]/groups/**`**
  - group creation and editing
- **`app/templates/[id]/items/**`**
  - item creation and editing
  - area/direct/fixed config editing
- **`app/templates/[id]/measurements/**`**
  - measurement key creation and editing

### Global Extras

- **`app/extras/page.tsx`**
  - List of company-scoped global extras
- **`app/extras/new/page.tsx`**
  - Create extra flow
- **`app/extras/[id]/page.tsx`**
  - Extra detail / editing path

### Quotes / Settings

- **`app/quotes/page.tsx`**
  - Placeholder only
- **`app/settings/page.tsx`**
  - Placeholder / early shell

### Shared Foundations

- **`app/layout.tsx`**
  - global shell, fonts, root page structure
- **`app/globals.css`**
  - global styling
- **`app/lib/supabase/server.ts`**
  - data access / auth context helper
- **`app/lib/pricing/engine.ts`**
  - pricing and quote calculation logic

## Current UI Characteristics

- Mostly server-rendered route pages
- Heavy use of inline styles for layout and spacing
- Little evidence of a reusable design system
- Functional admin-style CRUD screens rather than polished product UX
- Minimal abstraction of reusable visual components

## Reusable Patterns Observed

1. **Route + action pairing**
   - many features are structured as page + `actions.ts`

2. **Company-context enforcement**
   - feature pages use `requireCompanyContext()` before querying company-scoped data

3. **Supabase table-driven views**
   - pages map directly onto Supabase tables or related table groups

4. **Form-first UX**
   - CRUD forms dominate the current experience

## Missing / Underdeveloped Component Areas

- dashboard shell / navigation system
- reusable cards, tables, form controls, and feedback components
- customer-facing quote presentation components
- measurement visualization components
- upload/review components for future AI roof-plan workflow
- proper empty states / error states / loading states

## Implication for Future Work

The project does not yet need a giant component inventory so much as it needs a **UI architecture decision**:
- either continue with route-local forms and progressively clean them up
- or establish a real design system / shared component layer before UX expansion

Given the product ambition, the second path is likely the healthier long-term move.

---

_Generated using BMAD Method `document-project` workflow_
