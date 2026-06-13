# DRAFT — Guide Me Flows  
**Date:** 2026-06-05  
**Author:** Gavin (subagent)  
**Status:** DRAFT — awaiting Shaun's proofread  

> **Do not paste into code until Shaun has reviewed and signed off.**  
> These blocks are ready to paste into `guides.generic.ts` (guide objects) and `intents.ts` (BASE_INTENTS entries) once approved.

---

## Index

| # | Guide ID | Name | Steps |
|---|----------|------|-------|
| 1 | `catalog-upload` | Upload & Map a Catalog | 6 |
| 2 | `catalog-add-to-quote` | Add a Catalog Item to a Quote | 7 |
| 3 | `attachments-send` | Attach & Send Files to a Customer | 7 |
| 4 | `order-line-by-line` | Build a Line-by-Line Material Order | 8 |
| 5 | `order-from-quote` | Create an Order from a Quote | 7 |

**Total steps: 35**

---

## Anchors Status Summary

**Confirmed EXISTS in app code** (used by these guides):
- `upload-catalog` — catalog-list.tsx ✅
- `nav-quotes` — WorkspaceNav.tsx ✅
- `nav-orders` — WorkspaceNav.tsx ✅
- `cl-left-panel` — CustomerQuoteEditor.tsx ✅
- `cl-save-return` — CustomerQuoteEditor.tsx ✅
- `send-quote` — SendQuoteButton.tsx ✅
- `cl-send-modal` — SendQuoteButton.tsx ✅
- `cl-send-mode` — SendQuoteButton.tsx ✅
- `mo-custom-order` — orders-hub.tsx ✅
- `mo-order-from-quote` — orders-hub.tsx ✅
- `mo-header-form` — order-create-form.tsx ✅
- `mo-save` — order-create-form.tsx ✅

**`data-assistant-id` (new format, supported by runtime fallback):**
- `order-lbl-controls` — OrderLineByLineEditor.tsx (exists as `data-assistant-id`, NOT `data-copilot`) ✅ (usable as `[data-assistant-id="order-lbl-controls"]`)

**NEEDS `data-copilot` anchor added** (see per-guide "Anchors needed" sections below):  
18 new anchors across 5 components. Full list per guide below.

---

## Guide 1 — `catalog-upload`

```ts
{
  id: 'catalog-upload',
  name: 'Upload & Map a Catalog',
  description: 'Import a supplier CSV price list and map the columns so items can be searched on quote lines.',
  steps: [
    {
      id: 'catalog-upload-nav',
      target: '[data-copilot="upload-catalog"]',
      title: 'Catalog Library',
      description: 'This is your Catalog Library — where you import supplier CSV price lists as searchable catalogs. Click _"Upload catalog"_ to start the import wizard.',
      position: 'bottom',
      page: '/catalogs',
      validation: 'click',
      validationTarget: '[data-copilot="catalog-wizard-drop"]',
      nudgeText: 'Please click "Upload catalog" to continue.',
    },
    {
      id: 'catalog-upload-drop',
      target: '[data-copilot="catalog-wizard-drop"]',
      title: 'Choose Your CSV File',
      description: 'Drop your CSV file here or click to browse. _One item per row works best._ No headers in your file? No problem — columns are automatically labelled A, B, C…',
      position: 'bottom',
      page: '/catalogs',
      validation: 'none',
    },
    {
      id: 'catalog-upload-name',
      target: '[data-copilot="catalog-wizard-name"]',
      title: 'Name the Catalog',
      description: 'Give it a recognisable name so you can find it when quoting — for example: _"Supplier Price List 2026"_ or _"Hardware Catalog"_. The file name is used as a default; you can change it any time.',
      position: 'bottom',
      page: '/catalogs',
      validation: 'input',
      nudgeText: 'Enter a catalog name to continue.',
    },
    {
      id: 'catalog-upload-map',
      target: '[data-copilot="catalog-wizard-map"]',
      title: 'Preview & Map Columns',
      description: 'The wizard shows your first few rows. Map each column to a field: _Item / Description_ (the main line text), _Description / Quantity_ (optional detail appended after the item), and _Price_ (the amount that fills the quote line). Auto-detection picks likely matches — adjust if needed.',
      position: 'top',
      page: '/catalogs',
      validation: 'none',
    },
    {
      id: 'catalog-upload-multimaps',
      target: '[data-copilot="catalog-wizard-map"]',
      title: 'Multiple Maps',
      description: 'Need the same file with different column mappings? Once the catalog is saved, open it from the Catalog Library and use the _Maps_ tab to add extra mappings — no re-upload or extra storage needed.',
      position: 'top',
      page: '/catalogs',
      validation: 'none',
    },
    {
      id: 'catalog-upload-save',
      target: '[data-copilot="catalog-wizard-save"]',
      title: 'Save the Catalog',
      description: 'Click _"Save catalog"_ to import all rows. Once the status shows _Ready_, the catalog is available to search on any quote line. Large files import in chunks — you can leave the page safely.',
      position: 'top',
      page: '/catalogs',
      validation: 'none',
    },
  ],
},
```

### Intents (add to `BASE_INTENTS` in intents.ts)

```ts
'catalog-upload': [
  'upload a catalog',
  'import a supplier price list',
  'add a CSV price list',
  'map columns in my catalog',
  'how do I get supplier prices into the app',
  'create a catalog',
],
```

### Anchors needed for this guide

- `catalog-wizard-drop` — **upload-wizard.tsx**, the file drop-zone `<div>` in Step 0 (the large dashed-border click/drag target)
- `catalog-wizard-name` — **upload-wizard.tsx**, the catalog name `<input>` in Step 1
- `catalog-wizard-map` — **upload-wizard.tsx**, the column-mapping `<div>` wrapper in Step 2 (the section containing the three mapping `<select>` dropdowns)
- `catalog-wizard-save` — **upload-wizard.tsx**, the `"Save catalog"` `<button>` in Step 3

---

## Guide 2 — `catalog-add-to-quote`

```ts
{
  id: 'catalog-add-to-quote',
  name: 'Add a Catalog Item to a Quote',
  description: 'Search your supplier catalog and insert a priced line directly onto a customer quote.',
  steps: [
    {
      id: 'catalog-atq-nav',
      target: '[data-copilot="nav-quotes"]',
      title: 'Go to Quotes',
      description: 'Click _"Quotes"_ to open your quotes hub. Open an existing confirmed quote, then navigate to the Customer Quote editor using the _Customer Quote_ tab on the summary page.',
      position: 'bottom',
      validation: 'none',
    },
    {
      id: 'catalog-atq-left-panel',
      target: '[data-copilot="cl-left-panel"]',
      title: 'Quote Line Controls',
      description: 'This is the left-hand controls panel in the Customer Quote editor. All your quote lines are listed here. You can show, hide, edit, or reorder them — and add new lines using the button below.',
      position: 'right',
      page: '/quotes/[id]/customer-edit',
      validation: 'none',
    },
    {
      id: 'catalog-atq-add-line',
      target: '[data-copilot="cl-add-line-btn"]',
      title: 'Add a New Line',
      description: 'Click _"+ Add New Line"_ to open the line picker. It gives you three options: a custom line, a component from your library, or a catalog search.',
      position: 'bottom',
      page: '/quotes/[id]/customer-edit',
      validation: 'click',
      validationTarget: '[data-copilot="add-line-tabs"]',
      nudgeText: 'Please click "+ Add New Line" to continue.',
    },
    {
      id: 'catalog-atq-tab',
      target: '[data-copilot="add-line-catalog-tab"]',
      title: 'Switch to Catalog Search',
      description: 'Click the _"Search catalog"_ tab. If no catalogs are listed, go to your _Resources → Catalogs_ section first and upload a supplier CSV.',
      position: 'bottom',
      page: '/quotes/[id]/customer-edit',
      validation: 'click',
      nudgeText: 'Please click "Search catalog" to continue.',
    },
    {
      id: 'catalog-atq-search',
      target: '[data-copilot="catalog-search-input"]',
      title: 'Search for an Item',
      description: 'Type a product name, code, or keyword to search your catalog. Results appear instantly. _Tip: use the catalog dropdown above the search box to narrow results to a specific price list._',
      position: 'bottom',
      page: '/quotes/[id]/customer-edit',
      validation: 'input',
    },
    {
      id: 'catalog-atq-result',
      target: '[data-copilot="catalog-search-results"]',
      title: 'Select a Result',
      description: 'Click a result to highlight it. The item description and price are shown. You can adjust the price in the field provided before adding.',
      position: 'top',
      page: '/quotes/[id]/customer-edit',
      validation: 'none',
    },
    {
      id: 'catalog-atq-save',
      target: '[data-copilot="cl-save-return"]',
      title: 'Save and Return',
      description: 'The catalog item is added as a line on the quote. Check the right-hand preview — use the pencil icon to edit any line. When you are happy, click _"Save and Return"_ to go back to the quote summary.',
      position: 'right',
      page: '/quotes/[id]/customer-edit',
      validation: 'none',
    },
  ],
},
```

### Intents

```ts
'catalog-add-to-quote': [
  'add a catalog item to a quote',
  'search catalog on a quote',
  'find a supplier price and add it to my quote',
  'insert a priced item from my catalog',
  'use my catalog when quoting',
],
```

### Anchors needed for this guide

- `cl-add-line-btn` — **CustomerQuoteEditor.tsx**, the `"+ Add New Line"` trigger `<button>` in the left panel
- `add-line-tabs` — **AddLineModal.tsx**, the tabs row `<div>` wrapping the three option buttons (Custom line / Add a component / Search catalog)
- `add-line-catalog-tab` — **AddLineModal.tsx**, the `"Search catalog"` tab `<button>` specifically
- `catalog-search-input` — **CatalogSearchModal.tsx**, the main search `<input>` field
- `catalog-search-results` — **CatalogSearchModal.tsx**, the results list container `<div>`

---

## Guide 3 — `attachments-send`

```ts
{
  id: 'attachments-send',
  name: 'Attach & Send Files to a Customer',
  description: 'Upload images or drawings to your attachment library, then send them with a customer quote.',
  steps: [
    {
      id: 'attachments-send-nav',
      target: '[data-copilot="nav-resources"]',
      title: 'Go to Resources',
      description: 'Click _"Resources"_ in the navigation to open your resource library. The _Attachments_ tab is where your reusable files live. _If you do not see "Resources" in the nav, ask your admin to check your plan._',
      position: 'bottom',
      validation: 'none',
    },
    {
      id: 'attachments-send-tab',
      target: '[data-copilot="resources-tab-attachments"]',
      title: 'Attachments Tab',
      description: 'Click the _"Attachments"_ tab to see your file library. You can upload images, drawings, PDFs — anything you regularly send with quotes. _Attachment library is available on Pro and above._',
      position: 'bottom',
      page: '/resources',
      validation: 'click',
      nudgeText: 'Please click the "Attachments" tab to continue.',
    },
    {
      id: 'attachments-send-upload',
      target: '[data-copilot="attachment-upload-btn"]',
      title: 'Upload a File',
      description: 'Click _"Upload file"_ to add an image or document to your library. Give it a clear name — for example: _"Safety Data Sheet", "Product Spec Sheet", "Workspace Terms"._ Once uploaded, it can be attached to any quote.',
      position: 'bottom',
      page: '/resources',
      validation: 'none',
    },
    {
      id: 'attachments-send-goto-quote',
      target: '[data-copilot="nav-quotes"]',
      title: 'Open Your Quote',
      description: 'Now go to _"Quotes"_ and open a confirmed quote you want to send. On the summary page, click _"Send Quote"_ to open the send modal.',
      position: 'bottom',
      validation: 'none',
    },
    {
      id: 'attachments-send-btn',
      target: '[data-copilot="send-quote"]',
      title: 'Send Quote',
      description: 'Click _"Send Quote"_ to open the send options. You can send via email, copy a link, or set up a send template.',
      position: 'top',
      page: '/quotes/[id]/summary',
      validation: 'click',
      validationTarget: '[data-copilot="cl-send-modal"]',
      nudgeText: 'Please click "Send Quote" to continue.',
    },
    {
      id: 'attachments-send-picker',
      target: '[data-copilot="attachment-send-picker"]',
      title: 'Select Attachments',
      description: 'The _"Attachments"_ picker appears in the send modal. Click it to expand the file list. Tick the files you want to include — _library files_ come from your attachment library, _quote files_ are documents uploaded directly to this job.',
      position: 'bottom',
      page: '/quotes/[id]/summary',
      validation: 'none',
    },
    {
      id: 'attachments-send-confirm',
      target: '[data-copilot="cl-send-mode"]',
      title: 'Send with Attachments',
      description: 'With your files selected, complete the send — enter the customer\'s email or copy the link. _Attachments are included automatically in whatever delivery method you choose._ The customer sees them alongside the quote.',
      position: 'top',
      page: '/quotes/[id]/summary',
      validation: 'none',
    },
  ],
},
```

### Intents

```ts
'attachments-send': [
  'attach a file to a quote',
  'send images to a customer',
  'attach drawings when sending a quote',
  'upload a file to my attachment library',
  'send a document with my quote',
  'how do I attach files to a quote',
],
```

### Anchors needed for this guide

- `nav-resources` — **WorkspaceNav.tsx**, a new nav link for the Resources page (`/${slug}/resources`) — _the nav currently shows only Components, Quotes, and Material Orders; Resources is not linked from the main nav_
- `resources-tab-attachments` — **TemplatesPageClient.tsx** (`/resources`), the `"Attachments"` tab button in the tab row
- `attachment-upload-btn` — **attachment-list.tsx**, the `"Upload file"` `<button>` in the top-right of the list
- `attachment-send-picker` — **AttachmentSendPicker.tsx**, the outer `<div>` container (the collapsed dropdown control that says "Select files" / "N files attached")

---

## Guide 4 — `order-line-by-line`

```ts
{
  id: 'order-line-by-line',
  name: 'Build a Line-by-Line Material Order',
  description: 'Create a clean text-based material order with individual priced lines — ideal for sending to a supplier with a clear itemised list.',
  steps: [
    {
      id: 'olbl-nav',
      target: '[data-copilot="nav-orders"]',
      title: 'Material Orders',
      description: 'Click _"Material Orders"_ to go to the orders hub. From here you can create new orders or manage existing ones.',
      position: 'bottom',
      validation: 'none',
    },
    {
      id: 'olbl-custom',
      target: '[data-copilot="mo-custom-order"]',
      title: 'Start a Custom Order',
      description: 'Click _"Custom Order"_ to start a blank order from scratch. A layout picker will appear — choose your order format before building it.',
      position: 'bottom',
      page: '/material-orders',
      validation: 'click',
      validationTarget: '[data-copilot="order-layout-picker"]',
      nudgeText: 'Please click "Custom Order" to continue.',
    },
    {
      id: 'olbl-layout-pick',
      target: '[data-copilot="order-layout-line-by-line"]',
      title: 'Choose Line by Line',
      description: 'Select _"Line by Line"_ from the layout picker. This creates a clean text list — item, description, qty, and price — just like a customer quote. _You cannot switch layout after saving, so choose carefully._',
      position: 'top',
      page: '/material-orders',
      validation: 'click',
      nudgeText: 'Please select "Line by Line" to continue.',
    },
    {
      id: 'olbl-controls',
      target: '[data-assistant-id="order-lbl-controls"]',
      title: 'Order Items Panel',
      description: 'This is the _Order items_ panel on the left. It lists every line you add. The right-hand side shows a live print preview so you can see exactly how the order will look.',
      position: 'right',
      page: '/material-orders/create',
      validation: 'none',
    },
    {
      id: 'olbl-add-line',
      target: '[data-copilot="order-lbl-add-line"]',
      title: 'Add Lines',
      description: 'Click _"+ Add New Line"_ to add items. You have three options: a _Custom line_ (free text + price), a _Component_ from your library, or a _Catalog search_ (searches your imported supplier price lists). Add as many lines as you need.',
      position: 'bottom',
      page: '/material-orders/create',
      validation: 'none',
    },
    {
      id: 'olbl-line-controls',
      target: '[data-copilot="order-lbl-add-line"]',
      title: 'Line Controls',
      description: 'Each line has three quick toggles: _Show_ (include or hide it on the order), _Price_ (show or hide the price for that line), and _In total_ (include or exclude it from the subtotal). Use the _Edit_ link to change the text or amount.',
      position: 'bottom',
      page: '/material-orders/create',
      validation: 'none',
    },
    {
      id: 'olbl-footer',
      target: '[data-copilot="order-lbl-footer"]',
      title: 'Footer (Optional)',
      description: 'Add any footer text below the items — for example: _"Payment terms: 14 days", "Delivery instructions", or "Call before delivering"._ This prints under the item list.',
      position: 'top',
      page: '/material-orders/create',
      validation: 'none',
    },
    {
      id: 'olbl-taxes',
      target: '[data-copilot="order-lbl-taxes"]',
      title: 'Taxes (Optional)',
      description: 'Orders have no tax applied by default. If you need to include _GST, VAT,_ or any other tax, add it here. You can type a custom rate or apply a company default if one is saved in your settings.',
      position: 'top',
      page: '/material-orders/create',
      validation: 'none',
    },
  ],
},
```

### Intents

```ts
'order-line-by-line': [
  'build a line by line material order',
  'create a text list order for a supplier',
  'make a priced line order',
  'order materials with individual line items',
  'create a material order with prices',
],
```

### Anchors needed for this guide

- `order-layout-picker` — **OrderLayoutPickerModal.tsx**, the `<div>` (or `<button>`) grid containing the three layout option cards
- `order-layout-line-by-line` — **OrderLayoutPickerModal.tsx**, specifically the `"Line by Line"` card `<button>`
- `order-lbl-add-line` — **OrderLineByLineEditor.tsx**, the `"+ Add New Line"` `<button>` at the bottom of the Order items panel
- `order-lbl-footer` — **OrderLineByLineEditor.tsx**, the footer section `<div>` (the rounded card containing the "Footer (optional)" heading and `<textarea>`)
- `order-lbl-taxes` — **OrderLineByLineEditor.tsx**, the taxes section `<div>` (the rounded card containing the "Taxes (optional)" heading)

> **Note:** `order-lbl-controls` already exists in the file as `data-assistant-id="order-lbl-controls"` (not `data-copilot`). The runtime supports both attributes via the `useAssistantHints` fallback, so the step uses `[data-assistant-id="order-lbl-controls"]` as written. No new attribute needed for that step, but if full parity is wanted, add `data-copilot="order-lbl-controls"` alongside it.

---

## Guide 5 — `order-from-quote`

```ts
{
  id: 'order-from-quote',
  name: 'Create an Order from a Quote',
  description: 'Pre-populate a material order from a confirmed quote — all priced lines carried over automatically.',
  steps: [
    {
      id: 'ofq-nav',
      target: '[data-copilot="nav-orders"]',
      title: 'Material Orders',
      description: 'Click _"Material Orders"_ to go to the orders hub.',
      position: 'bottom',
      validation: 'none',
    },
    {
      id: 'ofq-hub-card',
      target: '[data-copilot="mo-order-from-quote"]',
      title: 'Order from Quote',
      description: 'Click _"Order from Quote"_ to pre-populate an order with data from a confirmed quote. A layout picker will appear — choose how you want the order to look before selecting your quote.',
      position: 'bottom',
      page: '/material-orders',
      validation: 'click',
      validationTarget: '[data-copilot="order-layout-picker"]',
      nudgeText: 'Please click "Order from Quote" to continue.',
    },
    {
      id: 'ofq-layout',
      target: '[data-copilot="order-layout-line-by-line"]',
      title: 'Choose a Layout',
      description: 'Select _"Line by Line"_ for a clean itemised list with prices — ideal when you want to show the supplier exactly what you need and how much you expect to pay. Or choose Single/Double Column if you prefer the components-and-images format.',
      position: 'top',
      page: '/material-orders',
      validation: 'none',
    },
    {
      id: 'ofq-select-quote',
      target: '[data-copilot="order-from-quote-list"]',
      title: 'Select a Quote',
      description: 'Find and click the quote you want to order from. You can search by quote number, client name, or job name, and filter by status. _Only confirmed quotes with priced components appear here._',
      position: 'top',
      page: '/material-orders/order-from-quote',
      validation: 'none',
    },
    {
      id: 'ofq-confirm',
      target: '[data-copilot="order-from-quote-confirm"]',
      title: 'Confirm Quote Selection',
      description: 'Click _"Create Order from this Quote"_ (or similar confirm button) to open the order editor pre-populated with all the quote\'s priced lines.',
      position: 'bottom',
      page: '/material-orders/order-from-quote',
      validation: 'click',
      nudgeText: 'Please select a quote and confirm to continue.',
    },
    {
      id: 'ofq-review',
      target: '[data-copilot="mo-header-form"]',
      title: 'Fill In Supplier Details',
      description: 'The order editor opens with all quote lines pre-filled. Add your supplier name, reference, and delivery details in the header form. _Review each line — you can edit, hide, or remove any item before saving._',
      position: 'bottom',
      page: '/material-orders/create',
      validation: 'none',
    },
    {
      id: 'ofq-save',
      target: '[data-copilot="mo-save"]',
      title: 'Save the Order',
      description: 'Click _"Save Order"_ when everything looks right. From the preview page you can print, download, or send the order to your supplier. The quote is not modified — the order is a separate document.',
      position: 'left',
      page: '/material-orders/create',
      validation: 'none',
    },
  ],
},
```

### Intents

```ts
'order-from-quote': [
  'create an order from a quote',
  'order materials from a confirmed quote',
  'pre-populate a material order',
  'turn a quote into a material order',
  'order from my quote',
  'order materials for a job',
],
```

### Anchors needed for this guide

- `order-layout-picker` — same as Guide 4 (**OrderLayoutPickerModal.tsx** grid of cards) — can share one anchor addition
- `order-layout-line-by-line` — same as Guide 4 (**OrderLayoutPickerModal.tsx** "Line by Line" card) — can share
- `order-from-quote-list` — **quote-selector.tsx** (`/material-orders/order-from-quote`), the quotes list container `<div>` (the scrollable grid of quote rows)
- `order-from-quote-confirm` — **quote-selector.tsx**, the _"Create Order from this Quote"_ / confirm `<button>` that fires `handleConfirm()`

---

## Full Anchor Needs Summary

The following `data-copilot` attributes need to be added to components. Gavin can add these in a single pass before the guides go live.

| Anchor ID | File | Element to annotate |
|-----------|------|---------------------|
| `catalog-wizard-drop` | `app/(auth)/[workspaceSlug]/catalogs/upload-wizard.tsx` | Step 0 file drop-zone `<div>` (the large dashed-border click/drag target) |
| `catalog-wizard-name` | `app/(auth)/[workspaceSlug]/catalogs/upload-wizard.tsx` | Step 1 catalog name `<input>` |
| `catalog-wizard-map` | `app/(auth)/[workspaceSlug]/catalogs/upload-wizard.tsx` | Step 2 column-mapping section wrapper `<div>` (parent of the 3 `<select>` dropdowns) |
| `catalog-wizard-save` | `app/(auth)/[workspaceSlug]/catalogs/upload-wizard.tsx` | Step 3 `"Save catalog"` `<button>` |
| `cl-add-line-btn` | `app/(auth)/[workspaceSlug]/quotes/[id]/customer-edit/CustomerQuoteEditor.tsx` | `"+ Add New Line"` trigger `<button>` in left panel |
| `add-line-tabs` | `app/(auth)/[workspaceSlug]/quotes/[id]/customer-edit/AddLineModal.tsx` | The tabs row `<div>` (flex container wrapping all 3 tab buttons) |
| `add-line-catalog-tab` | `app/(auth)/[workspaceSlug]/quotes/[id]/customer-edit/AddLineModal.tsx` | The `"Search catalog"` tab `<button>` specifically |
| `catalog-search-input` | `app/(auth)/[workspaceSlug]/quotes/[id]/customer-edit/CatalogSearchModal.tsx` | Main search `<input>` field |
| `catalog-search-results` | `app/(auth)/[workspaceSlug]/quotes/[id]/customer-edit/CatalogSearchModal.tsx` | Results list container `<div>` |
| `nav-resources` | `app/components/workspace/WorkspaceNav.tsx` | New nav link for `/${slug}/resources` — **nav item does not currently exist in WorkspaceNav** (discuss with Shaun: add Resources to main nav, or guide users another way) |
| `resources-tab-attachments` | `app/(auth)/[workspaceSlug]/resources/TemplatesPageClient.tsx` | The `"Attachments"` tab `<button>` in the tabs row |
| `attachment-upload-btn` | `app/(auth)/[workspaceSlug]/attachments/attachment-list.tsx` | `"Upload file"` `<button>` in the top-right header |
| `attachment-send-picker` | `app/components/attachments/AttachmentSendPicker.tsx` | Outer `<div ref={containerRef}>` (the collapsed dropdown control) |
| `order-layout-picker` | `app/(auth)/[workspaceSlug]/material-orders/OrderLayoutPickerModal.tsx` | The 3-card `<div>` grid container |
| `order-layout-line-by-line` | `app/(auth)/[workspaceSlug]/material-orders/OrderLayoutPickerModal.tsx` | The `"Line by Line"` card `<button>` specifically |
| `order-lbl-add-line` | `app/(auth)/[workspaceSlug]/material-orders/create/OrderLineByLineEditor.tsx` | `"+ Add New Line"` `<button>` at the bottom of the Order items panel |
| `order-lbl-footer` | `app/(auth)/[workspaceSlug]/material-orders/create/OrderLineByLineEditor.tsx` | Footer section rounded card `<div>` |
| `order-lbl-taxes` | `app/(auth)/[workspaceSlug]/material-orders/create/OrderLineByLineEditor.tsx` | Taxes section rounded card `<div>` |
| `order-from-quote-list` | `app/(auth)/[workspaceSlug]/material-orders/order-from-quote/quote-selector.tsx` | The quote rows list container `<div>` |
| `order-from-quote-confirm` | `app/(auth)/[workspaceSlug]/material-orders/order-from-quote/quote-selector.tsx` | The confirm `<button>` that calls `handleConfirm()` |

**Total new anchors: 20**  
_(Note: `order-layout-picker` and `order-layout-line-by-line` appear in both Guides 4 and 5 — adding them once covers both.)_

---

## Shaun — Key Decision Point

**`nav-resources`:** The Resources page (`/resources`) houses both Catalogs and Attachments, but it is _not currently linked_ in the main WorkspaceNav (which only shows Components, Quotes, Material Orders). The `attachments-send` guide needs a way to tell the user how to navigate there. Options:

1. **Add "Resources" to the main nav** (recommended — most discoverable; would also unlock guide step 1 cleanly)
2. **Direct users via Account** if Resources is reachable there
3. **Skip the nav step** and assume users know the URL — not ideal for first-time guidance

Similarly, the Catalogs page (`/catalogs`) has no main nav link. The `catalog-upload` guide starts directly from the `upload-catalog` button (which lives on `/catalogs`), so the guide assumes the user is already there. If Q needs to route users to `/catalogs`, a `nav-catalogs` anchor (or a Resources tab anchor) would be needed.

Please confirm your preferred approach so Gavin can implement the right anchors.
