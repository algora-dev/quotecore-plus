# Phase 2A + 2B | Source-file change notes

Relative to the integrated Phase 1 archive, not the rejected Phase 2 return. All other original source files are unchanged. New documents and visual fixtures are listed in CHANGED_FILES.json.

## `app/(auth)/[workspaceSlug]/layout.tsx`
Replace desktop/mobile header composition with one stable QcAppShell. Preserve every auth, company, entitlements, notice and assistant data statement; mount bell and inbox once.

## `app/(auth)/[workspaceSlug]/page.tsx`
Compose task-led Home from the existing data and MeasureJobButton; preserve welcome and all calculator/document/takeoff draft restorers. Add HOME-01 data connection point.

## `app/components/ui/v2/QcIcon.tsx`
Add a typed SVG icon set for the shared shell and job capability language (C49). No image/font dependency.

## `app/components/ui/v2/qc.css`
Retain Gavin's orange-wash hover and add a visible orange-ink boundary for ghost/glass controls. No token or builder-flow changes.

## `app/components/workspace/QcAppShell.tsx`
Implement C23 shell with expanded/rail/hidden desktop states, per-user/company preference, scoped route overrides, native mobile drawer and stable main content.

## `app/components/workspace/QcNavigation.tsx`
Implement C24 grouped navigation, current-route labels, plan lock affordances, explicit mobile navigation and existing destinations.

## `app/components/workspace/shell-config.ts`
Typed route-to-width/default mapping and navigation registry. Existing routes only; no data or network operations.

## `app/components/workspace/qc-shell.css`
Shared shell dimensions, sticky glass utility bar, responsive drawer, focus/hover, touch immersive cooperation and print treatment.

## `app/components/workspace/HomeDashboard.tsx`
C48 Home composition with real actions, honest missing-recent-work state and optional typed recentWork. No fake rows in app code.

## `app/components/workspace/qc-home.css`
Home and shared solid hub-surface anatomy, orange emphasis, responsive task cards and reusable text links.

## `app/(auth)/[workspaceSlug]/quotes/[id]/summary/page.tsx`
Compose real Job Space header and Overview from existing loaded values; preserve await expressions and snapshot logic; relocate detailed documents, files, notes and activity into stable sections; add JOB-01.

## `app/(auth)/[workspaceSlug]/quotes/[id]/summary/SummaryTabs.tsx`
Keep public component signature; add optional hub slots, Overview default, six sections, local URL tab state, keyboard tabs and stable mounted contents. Retain switch-to-customer-tab event.

## `app/(auth)/[workspaceSlug]/quotes/[id]/summary/ActivityCardClient.tsx`
Add a JobSpaceContext-only communication hub presentation. Keep legacy Orders/Invoices callers on their existing branch; same counts, bodies and schedule/delete controls.

## `app/(auth)/[workspaceSlug]/quotes/[id]/summary/SummaryFilesPanel.tsx`
Add visible Add file/Cancel upload wording using shared button recipe. Signed uploads, storage checks and file handlers unchanged.

## `app/(auth)/[workspaceSlug]/quotes/[id]/summary/SendToAppButton.tsx`
Remove backdrop dismissal in line with the locked modal rule and label the explicit Close button. Xero/QBO flow unchanged.

## `app/(auth)/[workspaceSlug]/quotes/[id]/summary/DownloadSummaryPDFButton.tsx`
Use visible PDF action label and existing application feedback dialog in place of browser alerts. PDF conversion helper unchanged.

## `app/(auth)/[workspaceSlug]/quotes/[id]/summary/job-space/JobHeader.tsx`
C22 job identity, current status, existing send/expiry slots, edit-pricing shortcut and state-based primary-send emphasis. No lifecycle mutation.

## `app/(auth)/[workspaceSlug]/quotes/[id]/summary/job-space/JobCapabilityCard.tsx`
C47 solid capability card with title, real status and explicit separate actions. Not a nested interactive card; future capabilities can reuse it.

## `app/(auth)/[workspaceSlug]/quotes/[id]/summary/job-space/JobOverview.tsx`
State-aware focus ribbon, existing internal values, six capability cards, actual recorded dates, existing route shortcuts and optional linked-document lists.

## `app/(auth)/[workspaceSlug]/quotes/[id]/summary/job-space/JobOrderAction.tsx`
Reuse the current order-layout chooser and current quote-line selection route. Carry existing layout/column options; no direct order creation.

## `app/(auth)/[workspaceSlug]/quotes/[id]/summary/job-space/JobSpaceContext.tsx`
Local section-navigation contract shared by hub cards and communication. No global state, save or router refresh.

## `app/(auth)/[workspaceSlug]/quotes/[id]/summary/job-space/SummaryDocumentPreviews.tsx`
Extract original customer/labour/PDF previews without changing their calculation declarations. Application feedback replaces browser alerts in PDF helper.

## `app/(auth)/[workspaceSlug]/quotes/[id]/summary/job-space/summary-types.ts`
Extract original required SummaryTabs props and add optional presentation slots. No database-column renames.

## `app/(auth)/[workspaceSlug]/quotes/[id]/summary/job-space/job-space.css`
Card-based Job Space, compact status/cost snapshot, document-scroll island, mobile stacking, interaction feedback and frosted legacy-dialog surround.
