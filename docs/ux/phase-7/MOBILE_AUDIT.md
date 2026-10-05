# Mobile review coverage

`validation/mobile-route-audit.csv` inventories 65 authenticated route files. It records source/back/redirect evidence and the pure parent resolver, not live visits. Protected workspaces keep their owner exit. A missing literal BackButton in a page file is not itself a missing runtime back control: many owners render it in nested components.

`validation/fixtures/browser-report.json` records 160 isolated browser layouts for 40 source states at desktop, phone, narrow phone and landscape. Source render report lists every module/mocked dependency.

Included P6 states: Quotes/all/drafts/bulk, order/invoice lists, invoice creation, catalogue upload/mapping/component conversion, billing/paywall, company settings, login/signup/onboarding and Send options. Included P7 states: Resources, library/document filter/empty/partial-failure/chooser, message list/edit, quote/invoice/order/structure editors, Pricing/component creation, supplier directory/library/portal/profile, Inbox/bulk/settings, Quotes loader failure and invoice quote/template-load failures.

Fixes observed from the specimens: pricing search/library controls are full width on phones; filters and Quotes statuses wrap; component actions are visible rather than hover-only; supplier time inputs stack; native dialog content and footer stay within the specimen viewport; wide data tables have a named focusable internal scroll area; library defaults, hover, focus and pressed are visibly distinct.

## Live verification still required

Real navigation/safe areas, on-screen keyboard, C27/C53 top-layer focus/Escape, loader/save state transitions, page scroll restoration, disabled/entitlement timing, full shell utility drawers and protected editor dirty state. Public/marketing/admin screens are not included in a claim of redesigned authenticated-product pages. Existing protected editor/mobile implementations have not been silently reskinned by C64.
