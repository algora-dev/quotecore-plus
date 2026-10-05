# Capability parity and consumer map

| Family | Existing storage / actions retained | Preserved capabilities / consumers | New presentation |
|---|---|---|---|
| Quote structure | `templates`, resources/data + resources/actions | Name, description, roofing profile, notes, customer header reference, components/extras and quantities; Quote creation/Builder consumes original IDs | Unified Quote filter, explicit Structure badge, existing structure builder/editor |
| Quote header/footer | `customer_quote_templates`, quotes/actions loader, resources/actions and existing create/edit owners | Name, company/customer/contact details, logo, footer, save-from-quote and sample preview; customer quote/template selectors unchanged | Quote chooser separates header/footer from estimating structure |
| Order details | `material_order_templates`, material-orders/template-actions | Name/description, supplier/contact, order type, reference, from/company/contact/address, delivery/address, logo/colours/notes; existing order selection | Same existing TemplateManager/Form, standalone create/edit mode inside common library |
| Invoice | `invoice_templates`, invoices/template-actions | Name, logo/header, company/contact/address, footer, payment account/no/sort code/link, notes/terms; Invoice creation selectors use same names/IDs | Searchable Invoice filter and section-labelled complete editor; multiple named payment setups |
| Message | `email_templates`, resources/email-actions | Name, subject/body, real kind, merge-variable insertion, company-wide default, attachment and entitlements; all Send controllers load all company messages | One manager, name/subject search, purpose filter, General choice, wording preview |
| Labour-sheet templates | Existing protected owners | Entirely unchanged | Not conflated with document/header systems |
| Pricing Library | All original actions/data and handler bodies | Main/extras, library/default/filter/measurement types, active slots, smart properties, units/cost/labour, edit/delete, Flashings, catalogue add, publishing/subscription/supplier updates | C64 hierarchy and responsive controls; progressive disclosure only |
| Suppliers | Existing loader/action ownership | Directory/search/trade/type, supplier profile/hours/location/tax, catalogue publishing/conversion, component subscriptions/updates, library detail selection | Common surfaces and C63 dialogs; all original fields retained |
| Inbox | Existing alert queries, NOTIFICATION_MATRIX, actions | Active/To Do/Archived, read/expand/type filters, batch select/actions, navigation origin, notification preferences, optimistic rollback | Readable index not chat; truthfully visible loader failure |
| Ordinary mobile navigation | Shell modes/mount ownership unchanged | Single orange edge tab, real marks, existing utility/mobile controls | In-flow deterministic fallback, explicit back wins |
| Stateful editors | All original owners | Takeoff/mobile/Assistant/Builder/Studio state and exit paths | No internals touched; no extra fallback replacing their guards |

## Renamed / moved destinations

- `/resources?tab=...` legacy categories forward to their existing group or unified templates library.
- `/resources/quote-templates` → `/resources/document-templates?type=quote&kind=quote-structure`.
- `/resources/quote-header-templates` and customer-quote-template list → Quote header view.
- `/resources/order-header-templates` → Orders view. `/resources/invoice-templates` → Invoices view.
- `/resources/message-templates` remains the message URL, now the common manager.
- Existing create/edit/save-from-quote URLs remain valid. No database IDs or stored template names are changed.

## Important distinctions

Visibility is not deletion. Filtering a list does not change record data. Message purpose does not restrict Send selection. Invoice payment profiles are ordinary named invoice templates with their supported header/footer/notes/terms fields still available. Structures are not reusable customer-document lines. No new duplicate action, per-document message default or new `invoice_send` kind is claimed.

The original save payloads/field names and non-presentation handlers are compared in validation. The nine intentionally changed existing handler bodies are separately recorded; they concern cancellation and template-manager/navigation completion, not persisted field calculations.
