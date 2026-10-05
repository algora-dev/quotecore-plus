# File change notes | Phase 3

## `app/(auth)/[workspaceSlug]/quotes/page.tsx` (modified; batch A)
Thin server wrapper around the mechanically preserved Quotes rendering. URL, exported page props and default view unchanged.

## `app/components/workspace/QuoteIndexPage.tsx` (new; batch A)
Shared server presentation: original Queries/props/Quotes JSX retained, new read-only Job Spaces branch, load error and P3-LIST-01.

## `app/(auth)/[workspaceSlug]/job-spaces/page.tsx` (new; batch A)
New route selecting the shared Job Spaces view. No new schema or API.

## `app/(auth)/[workspaceSlug]/job-spaces/JobSpacesList.tsx` (new; batch A)
Read-only C51 work list; search/status/sort, loaded-result paging, honest empty/error/partial states.

## `app/(auth)/[workspaceSlug]/job-spaces/job-space-list-model.ts` (new; batch A)
Pure display/filter/sort/date/summary-link helpers. No pricing or writes.

## `app/(auth)/[workspaceSlug]/job-spaces/job-spaces.css` (new; batch A)
Scoped queue surfaces, mobile cards and IF-01 hover/focus/pressed styling.

## `app/(auth)/[workspaceSlug]/quotes/[id]/summary/page.tsx` (modified; batch A)
Allowlisted Job Spaces return link; preserve it through Current/Original. Other server/action/document code unchanged.

## `app/components/workspace/shell-config.ts` (modified; batch A+B, stage by hunk)
Add Job Spaces label/nav/active-state rules (A); remove ordinary editor rail default while retaining widths/takeoff hidden default (B).

## `app/components/workspace/QcAppShell.tsx` (modified; batch B)
Replace two controls with one C50; cosmetic preference helpers; inert/focus management; retain one children tree and original slots/Q mark.

## `app/components/workspace/QcSidebarTab.tsx` (new; batch B)
One native, accessible 44px-target edge control with forwarded ref.

## `app/components/workspace/sidebar-state.ts` (new; batch B)
Pure two-state preference/override helpers; legacy rail normalizes to expanded.

## `app/components/workspace/qc-shell.css` (modified; batch B)
Transform-based slide/tab, real compact Q sizing, reduced-motion/forced-colour rules, mobile navigation scroll body without footer overlap.

## Documentation and references

Repo-root DESIGN_CHANGES.md is prepended with Phase 3 rules; all earlier design history is retained. Root RETURN_NOTES.md and CONTINUE_HERE.md are new. Every file under docs/ux/phase-3 is new and contains contracts, parity/validation evidence, the continuation brief or labelled fixtures. The full archive manifest lists every original/new file and its hash. Historical phase-1/phase-2ab docs and INTEGRATION_UPDATE.md remain unchanged.

No existing component prop signature changed. QuotesPage still accepts the same params prop; QcAppShell and QcNavigation retain their contracts. New QuoteIndexPage call sites are the original Quotes page wrapper and new Job Spaces page. New QcSidebarTab call site is QcAppShell. New JobSpacesList call site is QuoteIndexPage. No dependency proposed.
