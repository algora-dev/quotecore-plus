# Phase 7 design changes

## Information architecture

Resources groups Templates, Pricing & suppliers, and Files & tools. Catalogues, attachments, drawings, tutorials and existing calculators stay reachable. Quotes does not regain the owner-removed Resources button.

Document Templates presents saved names first, type second, existing contextual actions in their own region. Search spans name/description/type; All/Quotes/Orders/Invoices filters are local presentation state. Creation chooses document and then the supported subtype. Old list routes redirect; old edit/create URLs stay valid.

Message Templates uses name/subject search and real-purpose filtering. New templates default to General, with user wording preserved while switching purpose. Subject/body editing has a live wording preview; variable and default/attachment details use disclosure. This preview does not claim to render the final delivery email.

## Shared components

C64 `QcLibrary` composes `QcJourney` and opts into library/search/filter/row/choice/editor patterns. Errors have truthful partial/unavailable descriptions and an explicit retry; empties distinguish no data from no matches. C63 native dialogs remain the modal owner. C64 fixes pressed-over-hover precedence only in its local scope.

C65 `QcMobileReturn` uses the pure `workspaceReturn` / `ownsWorkspaceExit` contract. It renders in flow, has no effect, router refresh, browser-history write, state or key. A page's `.qc-page-back` suppresses the fallback. Secondary pages point to a meaningful parent rather than an unpredictable external history entry. Existing BackButton callers use this parent policy, with optional explicit origin-aware href; Pricing Library honours `from=inbox`.

## Surface refinements

Pricing: readable name/type/cost grouping, labelled full-width search and library picker, wrapping type filters, always-available component actions, current active slots and collection controls. Main/extras and all measurement semantics stay intact.

Supplier: directory/detail/portal share hierarchy; profiles retain complete contact/location/hours/tax fields; phone time pairs stack to avoid clipped native controls; publishing/conversion/subscription dialogs use C63.

Inbox: existing folders, read/unread, type filters, expanded information, item/bulk actions and notification settings. No conversational reply UI is invented. Phone folders are compact; row actions and settings targets remain reachable.

P6 mobile specimens cover Quotes (all/drafts/bulk/error), invoices/create/order lists, catalogue stages, send options, login/signup/onboarding, billing/paywall and company settings. Wide catalogue data remains an explicitly labelled keyboard-focusable internal scroll region, not page-wide overflow.

No output template CSS, financial formula, plan amount, auth redirect, API, server action or pricing engine changes.
