# Capability parity and protected boundaries

| Area | Preserved | Presentation change |
|---|---|---|
| Inbox data | Existing server page query/permission gate, date ordering/limit, original alert taxonomy | Page description and readable v2 body; loaded-limit explanation |
| Inbox filters/folders | Active/todo/archived; all/quotes/orders/invoices/messages/suppliers; title/body search | Quieter folders + labelled Type select |
| Inbox selection | Independent selection; visible-selected-only actions; original dedupe/busy guards | Bulk controls appear only with a selection; hidden selection explained |
| Inbox mutations | Same endpoint, payload, partial outcome resolver, rollback and confirmations | Expanded native rows; no hover dependence |
| Inbox navigation | Same quote/invoice/order/supplier routes and inbox return context | Plain destination labels; expand separate from open |
| Preferences | Same 13 event keys, four channels, app/email flags, ANY master semantics, update actions/rollback | Per-channel cards, event disclosure, focus/accessible switches |
| Entry | Same three stages, all metric/imperial/squares choices, default/custom mode, seven-custom guard | Stateless presentation component and focused next action |
| Upload | Same file callbacks, limits, PDF page conversion, errors, image-start sequence | Clear file help and native file overlay; drop hands to same callback |
| Canvas/touch | Entire `TakeoffPhase`, stage branches, dynamic import, page IDs, history/precision and AI-credit paths | No canvas restyle or alternate mount |
| Component builder | All types/rates/pack/waste/pitch settings, original validation and normalization | Grouped fields and explicit fixed-footer dialog; flooring still hides pitch |
| Report | Same measurement grouping, unit conversion, pitch/waste helpers, cost math and generator payload | Typography, rows, totals and long-print pagination |
| Save-to-app | Same local draft context, POST body/state, signup URL and new tab | An anchor reopens the same saved ID if the tab was blocked; does not save again |
| Shared trade consumers | Cladding/flooring component/report logic and no flat-area pitch unchanged | They inherit the common dialog/report CSS, not the roofing entry controller |
| Supplier | Same uploads, publish/save/follow/price handlers and guards | Accessible stateful controls, errors and quieter banner remove |
| Catalogue | Same edit/mapping functions; Papa parser; start/batch-2000/finish replacement sequence | Wrapped tabs; native replacement dialog, pending Cancel guard |
| Saved order | Same mark/reset/send/edit/back/print/download calls and OrderBody props | Action chrome + persistent failures; confirmation remains explicit |

## Automated preservation evidence

96 normalized-AST comparisons cover controller functions, component-save normalization, report calculations/convert/save and the complete `TakeoffPhase` plus output/takeoff stage branches. `OrderBody` JSX props are compared directly. The only model normalization allowed in the comparator is CRLF/LF and `export` on the extracted function. See `validation/source-contracts.json`.

3,508 baseline paths retained; 3,498 byte-identical; exactly 10 modified production files. All existing `app/lib`, APIs, actions, SQL, marketing/header and v2 primitives match the supplied ZIP. `validation/integrity-results.json` names the checked groups (overlapping; do not sum them).

No permission, pricing, schema, dependency, authentication, credit, subscription, preference-event or persistence contract was changed. UI-only additions include selection/focus presentation, the saved-draft fallback link and native-dialog dismissal/pending guard. These require browser acceptance but not new backend functionality.
