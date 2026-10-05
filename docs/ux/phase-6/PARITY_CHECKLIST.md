# Phase 6 — Capability parity ledger

Status below means **retained in source**, not runtime acceptance. Every row requires the corresponding browser test before release.

| Surface | Capabilities retained | Presentation change |
|---|---|---|
| Quotes | Confirmed + Drafts; search/sort/status filters; quota gating; New Quote/Resource Library; draft vs Job Space destinations; lifecycle/job/recipient context; bundle export and audit; delete; 25 selection cap | Clear hierarchy, secondary Resource Library, keyboard identity link, accessible selection, stacked small-screen metadata, common bulk tray |
| Orders | Recent 20, Custom/From Quote/template creation; family picker routes; all six states; responses; view/edit/export/delete; 25 cap | Truthful recent scope, shared rows and actions; no new full-history filters |
| Invoices | Search/status/attention/overdue; customer/value/date; edit/public view; current status menu; draft delete/non-draft cancel; payment-related actions; 25 cap | Common rows, useful mobile labels, keyboard identity link, native confirmation appearance opt-in |
| New Quote | Manual/digital/blank, units/trade/library/template and all creation guards | Fields and choices use common controls; same form/controller |
| New Invoice | Blank/template/from quote, selection and loading states | Common dialog/choices and selection table |
| Order-from-quote | Quote selection, line selection, existing destination and calculation inputs | Consistent cards/table/buttons; format family remains Phase 5 owned |
| Send | Configured entity modes, recipients, text/templates, attachments, library lock, send gate, optional follow-ups, real pending/error state | Clear mode cards, common step feedback and scoped dialog; same hook and actions |
| Quote lifecycle + accounting | Withdraw/reopen, scheduling, export app selection and confirmations | Current buttons and scoped dialogs; same handlers |
| Attachments | Selectable library/entity files, limits/locks, upload/remove/preview, progress and errors | Common file entry and selection summary |
| Catalogue upload/replace | CSV parser/header handling, optional mapping, 35k cap, 2k batches, replacement confirmation/backdrop behavior, actual failures | Named stages, clearer preview/mapping and save meaning; table scrolls on phones |
| Catalogue conversion | Own/supplier catalogue, mapping incl required name, filtered rows, original indices, max20 first20 default, choose/new library, real create results | Selection summary includes off-filter selections; explicit destination and next step |
| Profile/company/logos | Existing name/logo/company save paths, image handling, supported validation | Reading/form hierarchy, consistent file controls |
| Preferences/tax/payment | Currency/unit/trade/margins/tax fields and warnings, independent bank/payment fields | Explicit v2 TaxEditor appearance only; no financial calculation or persistence change |
| Security | Password/recovery answers/email/MFA/enrolment/disable/recovery codes and original verification | Current fields, focusable v2 password toggle, scoped panel and controls |
| Integrations/support | Current connect/export/support actions and state | Layout/buttons only |
| Billing | Current/effective/purchased plans, details, restrictions, storage, cancel/dunning/change/portal/contact/coming soon | Account vs activation presentation; same server inputs/actions/guards |
| Auth/onboarding | Email/password/Google, ref/draft context, reset/recovery, locale/unit/security preferences, existing redirects and paid gate | Consistent cards, readable named stages, explicit paid subscription language |
| Excluded major workspaces | Takeoff/mobile/Assistant/navigation/Job Spaces/Document Studio/public renderers | No workflow, engine, state or output changes |

## Source evidence

`validation/source-parity.json` compares the 58 modified TSX sources against archived originals. All original 463 event attribute bindings, disabled expressions, audited native form/data bindings, uppercase constants and non-JSX function declarations remain. The two new files are C61–63 and their scoped CSS. Wrapper changes, CSS and added accessibility handlers still need runtime regression tests; source equivalence of callbacks does not prove total behavioral equivalence.
