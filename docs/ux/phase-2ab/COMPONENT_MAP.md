# Component contracts and code association | 2.2

Always use the installed implementation contract, not a similarly named historical proposed file. No second component library.

| ID | Actual module / role | State and boundary |
|---|---|---|
| C01/C02/C03 | `app/components/ui/v2/QcButton.tsx` | Existing variants primary, secondary, ghost, glass, danger; native form/ref semantics. Icons must have accessible labels. |
| C11 | `summary/SummaryTabs.tsx` | Job-specific tabs; six optional-slot sections. Existing required props remain. Not a global save controller. |
| C22 | `summary/job-space/JobHeader.tsx` | Display identity/status and server-supplied send/expiry slots. `primarySend` controls emphasis only, not permission. |
| C23 | `app/components/workspace/QcAppShell.tsx` | Single stable children tree, routes choose default width/navigation mode, preferences are cosmetic. |
| C24 | `app/components/workspace/QcNavigation.tsx` + `shell-config.ts` | Existing links and gates, never an authorisation replacement. |
| C27/C29 | Existing `QcDialog.tsx`, `qc-overlays.css` | Explicit dismissal; native dialog focus/body-lock mechanics retained. Mobile menu is the same dialog recipe as a side sheet. |
| C36/C37 | Existing SummaryFilesPanel and FileUploader | Styled upload toggle; handlers and storage rules unchanged. |
| C38 | `summary/job-space/job-space.css` document surround | Costing/customer/labour documents retain their own content. Horizontal overflow belongs inside this surround, not the app. |
| C39 | `summary/ActivityCardClient.tsx` | New hub branch only with JobSpaceContext. Non-hub consumers remain on the original presentation. |
| C47 | `summary/job-space/JobCapabilityCard.tsx` | Icon/title/status/description/actions; noninteractive outer card. Never put buttons inside clickable card links. |
| C48 | `app/components/workspace/HomeDashboard.tsx` | Task-led Home; optional real recentWork; explicit not-loaded state. |
| C49 | `app/components/ui/v2/QcIcon.tsx` | Typed SVG icon vocabulary, decorative aria-hidden by default. Name the owning control. |

## Existing signatures

SummaryTabs keeps all original required props. New OPTIONAL props: `overview?: ReactNode`, `filesPanel?: ReactNode`, `activityPanel?: ReactNode`, `managementActions?: ReactNode`, `initialSection?: JobSection`. Its only source caller is `summary/page.tsx`, updated here. Exported name unchanged.

ActivityCardClient props/export unchanged. Additional context creates hub layout only when inside SummaryTabs. Legacy callers: `summary/ActivityCard.tsx`, `app/components/activity/OrderActivityCard.tsx`, `app/components/activity/InvoiceActivityCard.tsx`. All must be regression-tested; only first participates in new JobSpaceContext.

DownloadSummaryPDFButton, SummaryFilesPanel and SendToAppButton public props unchanged. Internal preview helpers were moved from SummaryTabs to `job-space/SummaryDocumentPreviews.tsx`; formulas and required inputs retained. All new modules are documented above; no existing handler/DB payload signatures were renamed.

## Capability extension protocol

Use C47 when the capability belongs to this quote/job, then provide a real capability state and explicit actions. Retain stable identity, pathname and section IDs. A future Schedule/Tasks/Team section can follow C11/C47 after its data/actions/permissions are approved; this does not authorise implementing a project model now.

Prefer one orange primary action for the current task. Header Send is orange only when an existing customer quote is ready and no finalised/withdrawn or unresolved-request state calls for a different next action. In other states the existing Send control remains available with quiet emphasis and its original guards. Do not duplicate bright actions across every card.
