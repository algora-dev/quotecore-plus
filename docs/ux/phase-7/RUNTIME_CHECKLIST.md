# Phase 7 integration / owner acceptance

## Release safety

- Compare incoming baseline and manifest; preserve newer work. Run dependency-complete TypeScript, Next build and lint. Verify unchanged protected files before and after merge.
- Check the orange edge tab, real Q mark/MainQCP, shell remembered mode, notification polling and absence of workspace remount/reset.
- Verify no Resources button on Quotes and catalogue's dedicated 190px Actions column unchanged.

## Templates

- Browse both libraries with zero, one, many and long-named records. Search/filter/clear. Include same ID in different table types and confirm independent React rows/actions.
- Open old list links/deep links and new destinations; verify correct view and deterministic back route. Create, edit, cancel, delete/confirm/failure and retry each supported template type.
- Quote structures: profile/components/extras/notes/header reference persist and still appear under Quote creation. Save-from-quote still works. Inactive/plan-gated component cases retain current rules.
- Quote header: all logo/contact/customer/company/footer fields, preview, storage block and starter-record guards. Copy-existing remains truthfully unavailable until separate implementation.
- Order: standalone create/edit manager closes to library after success, all existing parent callers retain list mode. Supplier/reference/colours/notes/logo/delivery fields round-trip and appear in order selection.
- Invoice: multiple differently named full templates, header/footer, account number/sort code/payment link, notes/terms; create Invoice from each and verify exact selected name/data. Do not alter invoice output code to make a test pass.
- Message: General and each real kind; write text then change purpose without losing text; variable insertion at cursor; empty saved subject/body not replaced; company-wide default; original attachment entitlement; failed attachment list must not clear baked file. Confirm all named templates remain offered across Quote/Order/Invoice Send.
- Failed list subsection shows warning without erasing successful sections. Verify refresh after save/delete and no stale selector after navigation.
- Native nested dialog focus, Tab/Shift+Tab, Escape/backdrop, close pending, Enter-submit, focus restoration, scrollbar release. Dirty field loss follows existing owner contracts; no new blanket autosave is claimed.

## Pricing / suppliers / Inbox

- Pricing: every measurement type including specialised fields, main/extras, library selection/default, search/filter, active slot caps, CRUD, Flashings, supplier data and catalogue add; hidden-on-hover actions now work by touch/keyboard.
- Catalogue: 35k/2k parsing constraints and 20 conversion selection cap, destination, mixed units, off-filter selection, storage/provider failures and unmount mid-load. No render-time fetch; no update after cancelled initial load. Wide table scroll works via keyboard/touch, not entire-page overflow.
- Suppliers: directory filters/library selection, entitlement gates, complete profile including time inputs, privacy/tax/location, publish/edit/convert, updates/subscriptions and error/pending flows.
- Inbox: read/unread/expand, each type/folder, selection/all/bulk, navigation with from=inbox, preference toggles and rollback failure. Header failure is not empty success. Still an alert index, not a chat thread.

## Mobile sweep

At 390px, 320px and landscape; also 1440px desktop. Use real soft keyboard and safe-area devices.
- Every audited ordinary deep page has an in-app parent; explicit .qc-page-back beats fallback. Direct bookmarks and missing browser history work.
- Protected Takeoff/Builder/Studio/drawing/Assistant keep their existing exit and dirty guards; no fallback bypass. Toggle nav while an editor is dirty and confirm mount/state retained.
- Dialog footer/actions remain reachable above keyboard; no duplicated back row; main bottom navigation does not cover bulk actions; open long message/profile/template forms.
- P6 Quotes all/draft/bulk/error, Orders, Invoices/create, send/attachments, catalogue upload/map/conversion, account/company/security/billing, login/signup/onboarding/paywall. Route audit distinguishes static/source coverage from runtime pending.

## Commercial / errors

- Force Quotes loader failure; distinguish retry from empty. Force quote/template-picker HTTP and JSON errors; verify selection not accidentally created; template failure requires explicit continue without template.
- Onboarding completed Tutorials link resolves correct workspace path.
- Paywall labels follow supplied plan cents; checkout keys/prices/entitlements unchanged. Signup uses existing pricing destination. Existing refund/guarantee copy awaits owner confirmation, not guessed metadata.

Owner acceptance: clear two-template-destination model; named selections match; mobile back works; no older inaccessible component/supplier/inbox control remains on tested paths; no regression in protected workspaces. Capture actual deployed screenshots only after these gates.
