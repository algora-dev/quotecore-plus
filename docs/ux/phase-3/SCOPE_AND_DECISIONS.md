# Scope and locked decisions | Phase 3

## Authority

Baseline: `quotecore-plus-phase-2ab-integrated-2026-09-24.zip`. Root `INTEGRATION_UPDATE.md` is preserved. It reports integration 84cb21fd on the Smart Assistant V2 P0 stack; the real Q-mark fix is present in this archive. Owner subsequently approved Phase 2AB in chat. The archive hash, not an assumed current Git HEAD, identifies this return's source.

The latest archive has no root AGENT_BRIEF.md / DATABASE_AND_SERVICES.md / RETURN_NOTES.md. The previous owner-supplied briefs were reread for the standing boundaries; no old code was used as a baseline. Root RETURN_NOTES.md is newly supplied. Future agents should use this scope plus those standing rules, not silently resurrect the first brief's obsolete phase numbering.

## Owner decisions implemented

1. Add `/{workspaceSlug}/job-spaces` and a Job Spaces sidebar/drawer entry. It lists the non-draft records returned by the existing company-scoped quote-list read. Inclusion is `quote.status !== 'draft'`, NOT a job_status decision.
2. Keep Quotes, its Confirmed/Drafts tabs, status controls, bulk actions, quota notices and creation flow unchanged. `/quotes` remains a page, not a redirect. Drafts do not move.
3. Rows open the existing `quotes/{id}/summary` hub. `from=job-spaces` supplies an allowlisted back link. Inbox and legacy Quotes entry points keep their own return destinations.
4. Replace both desktop controls with one orange edge tab. Expanded -> fully hidden -> expanded. The narrow visible face has a 44px target and explicit hover/focus/pressed states.
5. No public rail button. Ordinary pages including the builder use the expanded/hidden preference. Takeoff retains its hidden default. Rail remains an internal layout capability only. The real `/q-mark.png` asset/rendering is retained, not replaced with a generated Q.
6. Animate the sidebar's transform and the tab position, NOT main/grid/canvas width. Main layout changes once per toggle; the children tree stays mounted. Actual Fabric pointer/zoom parity must be tested after resizing.
7. Mobile keeps an explicit-close drawer. Scrollable navigation body and non-overlapping footer keep all links, including Logout, reachable. Backdrop does not dismiss.

## Deliberately not in scope

No Quotes-list redesign, Draft quotes split, /quotes redirect, new jobs table, project-management workflow, task/calendar/team UI, new quote flow, builder restructuring, guided mode, editor/takeoff/assistant engine edits, API or server-action changes, schema changes, dependencies or config edits.

The existing four-step builder is the approved advanced working experience. Guided mode comes later with the owner's reference tool. Do not reinterpret older "single-page fast mode" discussions as permission to restructure it now.

## Safety boundaries

No API route, server-action module, app/lib file, auth/workspace layout, DB migration/schema, middleware, configuration, dependency manifest/lockfile, existing e2e/script, or environment file was modified. Original files are retained. The Quotes server rendering was mechanically extracted to a shared server presentation component; its original read/creation-prop block and Quotes JSX are identical after line-ending normalization. The feature still owns all calculation, quota, mutation and permission behaviour.
