# Experience 1: Pricing Activation & Smart Component Testing

## Delivered experience

The library editor now answers: what is it, how is it measured, what does it cost, how is material purchased, and what allowances apply? Fields remain direct-editable; there is no mandatory next/previous wizard. Advanced measurement options follow the existing Generic Trades gate. Notes, order-image attachments and order eligibility are in an optional disclosure, still mounted and included in the same save.

Test component works on the current unsaved draft. Enter a measurement, Calculate, then valid changes update the result. It does not create a quote, assign a customer, call a server, save prices, select a recommended rate or verify commercial adequacy. Current costs use the company's currency. Rate/purchasing/allowance units are the existing canonical metric units; sample measurements can be metric, feet/square feet or roofing squares. Unit changes intentionally clear the sample rather than reinterpret a number.

On desktop, settings and the test are side by side. At 1050px and below, Settings and Test component are views of the SAME mounted state. They are not separate forms/editors. Returning to settings keeps the test; returning to the test recomputes against any draft changes. Testing cannot trigger Save by Enter or block Save through invalid sample inputs. Save remains an explicit action in Settings.

## Starter-led learning

The inline optional introduction uses two tasks: test a familiar component; create/copy your own using business costs and test it. No example prices were changed or generated. Components already configured by a company may be ready; starters are explicitly not recommended prices. Per-visit checkmarks mean a real calculation and creation happened in this visit, not verified pricing. The guide may be hidden and reopened. Existing dismissal storage is reused with truthful failure fallback.

Use these settings for a new component copies the current draft, including the established settings and attached images, into the existing create flow and clears the unique SKU. A copied legacy `linear` row uses the canonical `lineal` enum for the new record. It does not persist a duplicate until Save succeeds.

Home gives a pricing-first invitation only after a successful empty recent-work read. Existing work prioritises an actual continue route. Unknown data is not empty data. Supplier workspaces and signup-calculator draft recovery do not receive the new pricing-first emphasis. Already-configured companies can go straight to a job; there is no gate. The existing welcome becomes a small optional inline invitation, keeping Tutorials accessible.

## Catalogue: intentionally limited

The existing basic import still maps name, SKU, material cost and notes. A selected source row is shown next to the chosen field mappings so the user sees the consequence. No new schema, parsing inference or rate conversion is added. Existing 20-row selection cap, 60-character name handling, duplicate/SKU/entitlement policies, public/private sources, search/incremental row rendering and destination-library flow remain. Numeric malformed cells no longer crash local search; this does NOT fix the separate protected CSV export route.

After acknowledged creation the result stays on screen. Review components is an explicit navigation choice; parent no longer reloads before the success message can be read. The return view shows all libraries for that visit, so the previous library filter cannot hide imported records. Imported components are explicitly basic records whose measurement, purchasing, labour, waste and pitch still need checking.

## Not included

No Guided Quote mode, global navigation redesign, Smart Assistant tools/prompts, Takeoff/mobile-canvas changes, new database flags for reviewed prices, catalogue labour/pack/waste schema expansion, broad historical-quote migration, financial advice or market rates. Advanced Builder inline component dialogs keep their existing behaviour in this pass; the new editor/tester is the Pricing Library experience. Original files for older inline/type-specific components remain for their other callers and history.
