# Selective legacy punch list

Eight visible quick wins, not a mechanical rewrite of old utility classes.

| Priority / ID | Surface and source | Implemented fix | Existing behavior retained |
|---|---|---|---|
| 1 / L01 | Catalogue replacement — `catalogs/replace-catalog-modal.tsx` | Replace click-away overlay with native v2 dialog; fixed Cancel footer, body/table scroll; prevent dismiss while replacing/parsing | CSV parse and API start/batch/finish handlers unchanged |
| 2 / L02 | Catalogue editing — `catalogs/edit-catalog-modal.tsx` | Three native v2 tab buttons wrap at phone widths, selected state is explicit | Name, saved mapping and row-preview flows unchanged |
| 3 / L03 | Saved order action bar — `material-orders/[orderId]/preview/order-preview.tsx` | Consistent wrapping actions and native mark-ordered confirmation | Send/reset/edit/print/mark conditions and OrderBody unchanged |
| 4 / L04 | Saved order feedback — same file | Persistent PDF failure and inline status-update failure replace browser popups | Same download and status requests; no auto-retry or lifecycle change |
| 5 / L05 | Supplier dashboard accordion — `supplier/SupplierDashboard.tsx` | Four existing disclosure triggers announce expanded state | Existing open/closed state and content preserved |
| 6 / L06 | Supplier custom pricing/types — same file | 44px accessible switch, selected type chips use aria-pressed | Same setters, availability and saving behavior |
| 7 / L07 | Supplier banner remove — same file | Quiet named remove icon, rather than primary-brand prominence | Existing remove callback/confirmation retained |
| 8 / L08 | Supplier feedback/help — same file | Persistent error announcements and more readable small text | No provider contract, status or success claim changes |

## Explicitly deferred

- Smart Assistant mobile text/layout and all associated workflow logic: owner excluded.
- Shared Takeoff/offcuts/mobile precision styling and every engine constraint: active protected lane.
- Recipient Quote/Invoice/Order renderers, Advanced Builder and pricing calculator: not legacy targets for this bundle.
- Marketing homepage content/funnel and dark/light section redesign: header Phase A remains unchanged; requires its own approved content pass.
- `/takeoff-demo`, legacy v1 free tool, free cladding/flooring entry screens, other independent public generators: not wholesale restyled here. Cladding/flooring common report/dialog inherit the approved shared presentation and are smoke-test consumers.
- Raw catalogue/provider/paging functionality, unrelated admin/security dialogs and application-wide alert removal: retain existing behavior; raise a separate evidence-backed issue rather than blindly replace classes.

This list closes the agreed small completion scope, not an assertion that every runtime/mobile state of the product has been accepted. Capture additional friction during owner testing and prioritise it by frequency/consequence.
