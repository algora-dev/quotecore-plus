# Gavin-owned follow-ups — do not silently broaden Phase 6

| ID | Existing source condition | Required follow-up / Phase 6 treatment |
|---|---|---|
| P6-DATA-01 | Quotes loader has error context but the QuotesList contract does not receive it. | Pass a truthful error signal under the owned loader contract; don't claim empty records mean a successful query. Source comment is in QuoteIndexPage. |
| P6-DATA-02 | Orders loads at most 20 recent records. | Complete-history search/pagination needs a separate data change. This return explicitly labels recent scope. |
| P6-DATA-03 | Several quote/template creation pickers catch failed loads and expose empty arrays. | Give pickers distinguishable empty/error state in owned loading code. Current loading and empty behavior is retained. |
| P6-CATALOG-01 | AddFromCatalogModal triggers `loadMyCatalogs()` through useMemo during render. | Review moving to an effect with correct dependencies/cancellation. Existing timing is retained here. The static fixture skips this side effect and does not test it. |
| P6-ONBOARD-01 | Completed onboarding has literal `href="/${companySlug}/tutorials"`. | Resolve the intended current tutorial route. This pre-existing link was not silently rewired. |
| P6-STATUS-01 | Brief lists ready/ordered; UI and action allowlists include delivered/paid/pickup/waiting. | Reconcile documentation and test actual DB acceptance. All six source choices remain. |
| P6-BILLING-01 | Signup prices/guarantee copy is hardcoded; plan cards use current plan inputs. | Verify commercial copy against the actual catalogue/terms. No amount, guarantee term or checkout contract has been changed. The misleading all-plans/all-features claim was replaced with selected-plan wording. |
| P6-BILLING-02 | Paywall passes its existing `hasActiveSubscription={false}` snapshot. | Verify return-from-checkout/dunning/portal timing under real entitlements. Phase 6 only adds presentation context. |

## Integration gates, not backend tasks

- P6-VERIFY-01: run dependency-complete baseline/return TypeScript and Next builds. Missing dependency diagnostics here are not application defects, and a syntax pass is not a substitute.
- P6-DIALOG-01: real nested C27/C53 focus, Escape, scrolling, top-layer stacking, body-lock release and form submission checks. Backdrop-callback exceptions are intentionally unchanged.
- P6-SHELL-01: check mobile bulk bars against the real navigation safe area and utility overlays. No global shell or Assistant change is bundled.

This list is deliberately explicit. None of these observations authorizes a new backend/data/lifecycle change inside the UX merge without Gavin's review.
