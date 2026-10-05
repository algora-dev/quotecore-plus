# Renderer map and data boundaries

| Family | Editor | Saved / public | PDF / send | Boundaries |
|---|---|---|---|---|
| Customer Quote / reused Labour editor | QuotePreview + optional selection | Customer page and accept token page now use QuotePreview; separate LabourSheetDocument path retained | Existing quote bundle uses QuotePreview; saved page PDF captures same body | Protected bulk provider subtotal/qty/margins and historical public tax fallback are not silently unified. |
| Invoice | InvoicePreview + optional selection | PublicInvoiceView now composes InvoicePreview; copy actions use a recipient-only slot | Existing InvoicePreview bundle + live PDF selector | Saved-provider totals vs unsaved controller totals remain; separate payment save; original zero-tax controller. |
| Line Order | OrderBody with current header/envelope projection | Existing OrderBody consumers | Existing OrderBody consumers/capture | Uses original lineByLine parsers/calculations; quantity flag hydration issue remains. |
| Visual Order | OrderBody with current component projection | Existing OrderBody consumers | Same clean card layout | One/two columns; linked and persisted image fallback for rendering; save-library image behavior untouched. |

C59 targets are optional render props, not data fields. Recipient/export callers omit selection. Item order and financial outputs are not derived from DOM inspection. New professional typography does not add fields to the underlying documents. Public-route lifecycle/auth/data code stays in its existing owner.
