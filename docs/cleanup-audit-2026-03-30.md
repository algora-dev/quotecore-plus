# QuoteCore+ Cleanup Audit - 2026-03-30

## Goal

Prepare the brownfield repo for implementation by fixing high-signal inconsistencies and reducing misleading/stale structure without doing a risky rewrite.

## High-Priority Items

### 1. Package manifest drift
- Verify whether `package.json` is missing dependencies that the code actively imports.
- Align `package.json` and lockfile with actual runtime needs.
- This is a safe, high-priority fix.

### 2. Placeholder product routes
- `app/page.tsx` is still a create-next-app placeholder.
- `app/quotes/page.tsx` is a placeholder.
- `app/settings/page.tsx` is a placeholder.
- Decide whether to replace, quarantine, or keep temporarily with clearer intent.

### 3. Empty / misleading implementation docs
- `documentation/active/implementation/backend-notes.md`
- `documentation/active/implementation/rls-auth.md`
- `documentation/active/implementation/signup-flow.md`
- `documentation/active/implementation/dashboard-shell.md`
- Decide whether these should be deleted, consolidated, or replaced.

## Medium-Priority Items

### 4. BMAD artifact folder normalization
- There is a literal `{output_folder}` directory.
- Not urgent, but should eventually be normalized to reduce confusion.

### 5. Structure alignment prep
- Current repo does not yet reflect the target architecture (`src/`, `domains/`, reusable component boundaries, etc.).
- This should be handled through planned refactor/alignment work, not a blind cleanup sweep.

## Low-Priority Items

### 6. Cosmetic consistency cleanup
- Naming consistency
- Non-critical doc reshuffling
- Minor folder hygiene

## Proposed Cleanup Sequence

1. Verify and fix manifest drift
2. Document placeholder routes explicitly so they do not mislead implementation
3. Review empty implementation-note files before deleting anything
4. Delay deeper structure refactors until implementation starts

## Destructive Actions Deferred

No file deletions or moves should happen until reviewed explicitly.
