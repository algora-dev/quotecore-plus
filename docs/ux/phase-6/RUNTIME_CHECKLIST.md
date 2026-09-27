# Phase 6 — Runtime acceptance, owned by Gavin

Use approved records/accounts/recipients. Preview and production may share data: no live send, subscription change, destructive replacement or real-account settings update just to inspect UI. Use isolated test data and Stripe test arrangements.

## Build and scope gate

- [ ] Three-way merge against exact baseline; newer Gavin fixes retained.
- [ ] Install unchanged lockfile; full TypeScript and Next build run successfully or new-vs-baseline errors explicitly resolved.
- [ ] Verify manifest/protected hashes; no config/schema/dependency/env/Assistant/Takeoff drift.
- [ ] No hydration errors, duplicate keys, hook-order errors, console warnings or missing styles on direct navigation and client navigation.

## Lists: desktop, 1024px, 390px and narrow phone/browser zoom

- [ ] Quotes confirmed/draft search, sort, status and quota states; correct destination for drafts and numbered quotes.
- [ ] Each keyboard link opens the intended record; checkbox/menu/status controls never accidentally open it.
- [ ] Invoices number/customer/value/date/status remain readable; overdue/system attention and manual status distinctions preserved.
- [ ] Orders are explicitly recent20; six states persist through the existing approved transition paths; all quote/template/custom entry points remain.
- [ ] Single/all/batch selection caps at25, cap notice, serial export progress/audit/partial failure, delete/cancel confirmation and stale-selection behavior.
- [ ] Mobile bulk tray clears actual shell/navigation/safe areas and does not hide final records or Help/Assistant controls.

## Connecting dialogs

- [ ] New Quote manual/digital/blank and template/library/trade/unit choices keep data and validation.
- [ ] New Invoice and Order from quote/template/blank paths; selected lines and final destination correct.
- [ ] Send mode by entity: choose/form/gate/follow-ups; cancel/reopen preserves original semantics; no duplicate send or changed token timing.
- [ ] Attachment library/entity selection and locked/limit states; preexisting defaults retained.
- [ ] Schedule follow-up, accounting export, withdraw/reopen and each confirmation run only on approved fixtures.
- [ ] Native dialogs trap focus away from background, restore trigger, release body scroll on every close/unmount; nested storage/upgrade helpers are clickable in the top layer.
- [ ] Escape and backdrop match existing policy; close/pending/Enter submission work, including legacy backdrop-owning exceptions.
- [ ] Tall/mobile dialogs scroll to final action; soft keyboard and browser zoom don't make controls unreachable.

## Catalogue / uploads

- [ ] CSV choose/drop/keyboard, wrong file, header detection, parse failure, storage blocked, name step, optional mapping and same-column name/description.
- [ ] Long names, many columns, 35k truncation warning, 2k batches, real pending/progress/upload failure, cancel/retry and replacement confirmation.
- [ ] Upload saves catalogue only, not components; source catalogue remains unchanged during component conversion.
- [ ] Own/supplier source; first20 default; filter retains selected off-screen indices; cap20/select-all; required name mapping; independent field choices and unchanged price interpretation.
- [ ] Existing/new destination library, create progress, partial/errors/results and completion callback.
- [ ] Attachments, account/template logos and drawing library: valid/invalid/large file, limits, remove/replace, real preview/progress and storage errors.

## Account / commercial journey

- [ ] Tabs deep links/history and all existing subforms; QAssistant panel remains original.
- [ ] Profile/company/preference/currency/unit/trade/tax/margin/payment values and existing warnings/independent saves.
- [ ] Password/email/recovery/MFA flows, field associations, v2 toggle keyboard operation, cancel/failure/success and recovery-code display.
- [ ] Integrations and support controls retain existing routing/actions.
- [ ] Billing current/effective override, active/inactive/trialing/dunning/cancelling, current/coming-soon/contact plans, details and switch confirmation.
- [ ] Active subscription never opens a duplicate fresh checkout; portal/manage, upgrade/downgrade and returned query banners use existing rules.
- [ ] Signup paid-language, Google/email, draft/ref restore, errors; login/reset/recovery remain correct.
- [ ] Onboarding preference/recovery/completion stages; paid-only paywall after setup; actual entitlement refresh after checkout; logout and return link.
- [ ] Hardcoded prices/guarantee, literal tutorial URL and existing picker/load issues reviewed per AGENT_TODOS.

## Regression and owner acceptance

- [ ] Takeoff accuracy/state/toolbar/mobile selection unchanged; no polling/remount regression.
- [ ] Document Studio interactions, one/two-column order, recipient views/exports unchanged.
- [ ] Quotes/Drafts, Job Spaces, edge tab, Q mark, Assistant and navigation unchanged.
- [ ] Shaun reviews real preview, including phone; record accepted states and remaining issues rather than claiming global approval.
