# Gavin runtime / owner review checklist

## Cross-editor

Build/typecheck/lint with pinned dependencies. Test mounted editors inside the actual shell at 1440/1280/1024/800, sidebar open/hidden, keyboard-only, Help Drawer, zoom/text scaling and browser resize. No draft reset or route refresh from selection, clean preview, panel hide/show or column switch. Check focus handoff, visible focus/hover/pressed feedback and nested modal focus/escape behavior.

Click every supported paper target: company/header, invoice dates/payment/notes/terms/footer, quote totals/footer, each line and each order component/image. Inspector must match selection. Unavailable identity fields must be clearly read-only, not fake editable controls. All items restores hidden lines. Enter/Space can activate targets; clean preview has no editing overlays.

## Customer Quote / reused Labour Sheet

Existing component/custom/catalog insertion, AI image/PDF/text import, roof-area/extras grouping and missing-component states; every visibility/price/units/in-total toggle; quantity column; header/footer templates; tax scopes; global/per-line material and labor margins; zero/disabled margin fallbacks; recomputation on Apply; full-size preview. Test local draft Apply/Cancel/Keep editing/Discard, remove/reorder, save while dirty, failed save and return. Preserve each reused Labour Sheet title, save action and flags.

## Invoice

All line fields and flags, original quantity × unit-price totals and inclusion; dates, notes/terms/footer, header modal; separate payment save/dirty fields; library/import; Activity; read-only paid/cancelled status. Autosave dirty closures, slow requests and rejection. Only approved recipient: Send/test-tip, customer-link mark-sent, cancellation, confirm payment, public payment report/dispute. No accidental real status transition in a cosmetic test.

## Orders

Picker produces Line-by-line or Visual; existing direct double links still load. Single/double toggles change layout only and persist after save/reopen. Line Order item editing, price/quantity/total flags, taxes/footer and exact supplier/header context. Visual modal/embedded form: single/linear/area/volume/freestyle, metric and all supported imperial modes, variables, angle tool, per-pack override/priced quantities, image selection/search, library/catalogue, empty lines, deletion/end reorder guards. Test dirty selected component while changing columns and while selecting another section. Verify original save waits and errors; orphan-image and quantity hydration TODOs.

## Output / public / PDF

Compare live draft, saved view, actual downloaded PDF, bundle/sent attachment and public link using the same approved record. Inspect numeric values, flags, hidden/in-total effects, historical nulls, taxes, quantities, margins, logos, long descriptions, page breaks, last odd 2-column card, very tall drawings and CORS failures. Resolve P5-EXPORT-01/02 before financial sign-off. Native print and html2canvas/jsPDF are different gates.

Public quote: UUID/rate-limit/expiry/withdrawal guards, remaining-days notice, view stamp, decisions/requote/request-change, download and attachments. Public invoice: saved amounts, all visibility flags, bank/clipboard/pay-online plus status actions. Public orders: confirm/change/question and print still work. No selection chrome in any recipient output.

## Owner review

Review all four real editor experiences and their actual outputs together. The phase is not approved by generated concepts, static fixtures or this checklist. After integration supply a newer ZIP as the next authoritative baseline.
