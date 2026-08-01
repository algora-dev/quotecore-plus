# QuoteCore+ Integration Strategy

> **Status:** Decisions confirmed. Ready for Gavin's review.
> **Author:** Ron
> **Date:** 2026-08-01
> **Target integrations (Phase 1):** Zapier, JobNimbus, Fergus

---

## 1. Goal

Let users build quotes in QuoteCore+ (measuring, components, labour, customer lines), then push that data into external platforms so they can manage the job from there.

**The pitch:** "I prefer using QuoteCore+ because it's much better at measuring jobs and giving me a good quote. Then I send that quote to [Xero / JobNimbus / Fergus] and manage the job from there."

This opens up the market - users on other platforms can adopt QuoteCore+ for measuring and quoting without abandoning their existing job management system.

---

## 2. Architecture: Reusable Connector Pattern

### 2.1 Core Principle

QuoteCore+ produces **one standardised export object** containing all relevant quote data. A separate **connector layer** converts this standard object into the exact fields, formats, and workflows required by each external platform.

Core QuoteCore+ business logic is never duplicated inside connectors. Connectors are isolated, configurable adapters that sit outside the main application logic.

### 2.2 Architecture Diagram

```
QuoteCore+ Workflow
    |
    v
[Standard Export Builder]  - builds the QC+ Export Object (standard JSON)
    |                          - contains ALL quote data (customer, site,
    |                            measurements, components, costs, margins,
    |                            totals, files, notes, acceptance)
    |
    v
[Connector Layer]  - each connector is an isolated, self-contained module
    |
    +---> [Zapier Connector]
    |       - auth: webhook URL
    |       - mapping: passthrough (Zapier handles mapping on its side)
    |       - delivery: POST to webhook URL
    |
    +---> [JobNimbus Connector]
    |       - auth: API key token
    |       - mapping: QC+ Export -> JobNimbus contact + job + activities
    |       - delivery: POST to JobNimbus REST API
    |
    +---> [Fergus Connector]
    |       - auth: Personal Access Token (Bearer)
    |       - mapping: QC+ Export -> Fergus customer + job + quote + lines
    |       - delivery: POST to Fergus API
    |
    +---> [Future Connector: Xero, Tradify, SimPRO, ...]
            - same pattern, new adapter
```

### 2.3 What the Standard Export Object Contains

The export object is the single source of truth for all connectors. It must contain everything any connector might need:

- Customer and contact details (name, email, phone, address)
- Site and project details (job name, site address, trade, measurement system)
- Roof measurements and takeoff results (roof areas, pitches, computed quantities)
- Smart Component line items (name, measurement type, quantities, pricing strategy, pack sizes)
- Quantities, costs, margins and selling prices (material cost, labour cost, material margin, labour margin, waste, final selling price)
- Quote totals and status (subtotal, tax breakdown, grand total, quote status)
- Files, plans, photos and PDFs (signed URLs with TTL)
- Notes, assumptions and acceptance details (internal notes, customer-facing notes, acceptance status/date)

### 2.4 Connector Isolation Rules

Each connector is a self-contained module that owns:

| Concern | Description |
|---------|-------------|
| **Authentication** | Connector manages its own auth (API key, OAuth token, webhook URL). Stored in `integrations.config` JSONB, never hardcoded. |
| **Field mapping** | Connector maps QC+ Export Object fields to destination fields. No other connector knows about this mapping. |
| **Validation** | Connector validates that required destination fields are present in the export object before sending. |
| **Export triggers** | Connector defines what events it supports (e.g. Zapier supports all events, JobNimbus only supports `quote_confirmed`). |
| **Status tracking** | Connector tracks sync status (pending/success/failed) in `integration_logs`. |
| **Error handling** | Connector handles API errors, rate limits, and network failures with its own retry logic. |
| **Retries** | Connector implements retry with exponential backoff for transient failures. Max 3 retries. |
| **Audit history** | Connector logs every attempt to `integration_logs` with response status, error messages, and external record IDs. |
| **External record links** | Connector stores the external system's record ID (e.g. JobNimbus job ID, Fergus job ID) in `integration_logs` for tracing and dedup. |

### 2.5 What Connectors Never Do

- Never read from or write to QuoteCore+ database tables directly
- Never duplicate pricing calculations, margin logic, or measurement computations
- Never import QuoteCore+ internal types beyond the standard `QcPlusExportObject` interface
- Never modify quote data in the database
- Never call other connectors

The only input to a connector is the `QcPlusExportObject` + the integration config (credentials, settings).

---

## 3. Current Data Model (What We Have)

A fully built quote in QuoteCore+ contains:

### 3.1 Quote Header (`quotes` table)
- `quote_number`, `status` (draft/confirmed/sent/accepted/declined/expired/archived)
- `customer_name`, `customer_email`, `customer_phone`
- `job_name`, `site_address`
- `currency` (GBP, NZD, USD, EUR, AUD, CAD)
- `tax_rate` (legacy single rate)
- `material_margin_percent`, `labor_margin_percent` (+ enabled flags)
- `measurement_system` (metric, imperial_ft, imperial_rs)
- `trade` (roofing, generic, cladding, etc.)
- `notes_internal`
- Branding snapshot: `cq_company_name`, `cq_company_address`, `cq_company_phone`, `cq_company_email`, `cq_company_logo_url`, `cq_footer_text`
- `created_at`, `updated_at`, `accepted_at`

### 3.2 Roof Areas (`quote_roof_areas`)
- `label`, `input_mode` (final vs calculated)
- `calc_width_m`, `calc_length_m`, `calc_plan_sqm`, `calc_pitch_degrees`, `computed_sqm`
- `final_value_sqm` (for direct-entry mode)

### 3.3 Components (`quote_components`)
The pricing layer - each component is a line item with full calculation context:
- `name`, `component_type` (main/extra), `measurement_type` (area, lineal, quantity, volume, etc.)
- `input_mode` (final vs calculated)
- `final_value`, `final_quantity`, `priced_quantity`, `pricing_unit`
- `material_rate`, `material_cost`, `labour_rate`, `labour_cost`
- `waste_type` (percent/fixed/fixed_per_segment/none), `waste_percent`, `waste_fixed`
- `pitch_type` (none/rafter/valley_hip), `calc_pitch_degrees`, `calc_pitch_factor`, `calc_raw_value`
- `pricing_strategy` (per_unit, per_pack_length, per_pack_area, per_pack_coverage, per_pack_volume)
- `pack_size_snapshot`
- `is_customer_visible`
- `sort_order`
- `component_library_id` (links to saved component)
- Override flags: `is_rate_overridden`, `is_quantity_overridden`, `is_waste_overridden`, `is_pitch_overridden`

### 3.4 Component Entries (`quote_component_entries`)
Individual measurements that roll up into components:
- `raw_value`, `pitch_degrees`, `value_after_waste`
- `entry_inputs` (JSON - the raw measurement inputs)
- `is_combined`, `combined_from` (for merged entries)

### 3.5 Customer Quote Lines (`customer_quote_lines`)
The presentation layer - what the customer sees:
- `line_type` (component/custom/roof_area_header)
- `custom_text`, `custom_amount`
- `quantity`, `quantity_text`, `unit_price`
- `show_price`, `show_units`, `show_dimensions`, `is_visible`, `include_in_total`
- `sort_order`
- Per-line margin overrides: `line_margin_percent`, `line_labor_margin_percent`

### 3.6 Labour Sheet Lines (`labor_sheet_lines`)
Internal labour breakdown:
- `custom_text`, `custom_amount`
- `line_type`, `quote_component_id` (links back to component)
- `is_visible`, `show_price`, `show_units`, `include_in_total`

### 3.7 Quote Taxes (`quote_taxes`)
Multi-tax support:
- `name`, `rate_percent`
- `include_in_quote`, `include_in_labor`

### 3.8 Files (`quote_files`)
- `file_type` (plan, supporting, canvas)
- `file_name`, storage path/URL

### 3.9 Material Orders (`material_orders` + `material_order_lines`)
Generated from accepted quotes:
- Order header: `order_number`, `supplier_name`, `from_company`, `delivery_address`, `delivery_date`, `status`
- Lines: `item_name`, `quantity`, `unit`, `priced_quantity`, `component_id`

### 3.10 Invoices (`invoices` + `invoice_lines`)
- Invoice header: `invoice_number`, `customer_name`, `customer_email`, `currency`, `subtotal`, `tax_total`, `total`, `status`, `source_id`, `source_type`
- `customer_snapshot` (JSON), `business_snapshot` (JSON), `payment_details` (JSON)
- Lines: `title`, `description`, `quantity`, `unit`, `unit_price`, `line_total`, `line_source_type`

---

## 4. Gaps to Fill

### 4.1 No normalised export shape
The `QuoteBundleData` interface in `actions-bulk.ts` is the closest thing, but it's shaped for internal ZIP downloads (PDF + JSON). We need a clean, platform-agnostic JSON format.

**Action:** Build a `buildQuotePayload(quoteId)` function that returns the QC+ Quote Payload (defined in section 5).

### 4.2 Customer data is flat fields, not a customer record
`quotes.customer_name`, `quotes.customer_email`, `quotes.customer_phone` - there's no `customers` table. Most integrations require a customer/contact object.

**Action:** The export builder constructs a `customer` object from the flat fields. No database change needed - this is a presentation transform. (A `customers` table is a future enhancement, not a blocker.)

### 4.3 No integration settings infrastructure
No `integrations` table, no API key management, no OAuth token storage, no integration settings page.

**Action:** Add database tables and a settings UI (section 7).

### 4.4 No outbound webhook/API dispatch system
We have inbound webhooks (Stripe) but no outbound webhook sender.

**Action:** Build a `dispatchIntegration()` server action that calls the right adapter and delivers the payload (section 8).

### 4.5 Line items: presentation vs pricing
External systems want different things:
- **Xero** wants invoice line items (description, quantity, unit_price, line_total, tax_type)
- **JobNimbus** wants job tasks/materials (name, description, amount)
- **Fergus** wants job line items (description, quantity, rate, total)

We have two layers: `customer_quote_lines` (presentation) and `quote_components` (pricing). The export payload includes both so each adapter picks the right one.

**No code change needed** - the export builder returns both layers and adapters choose.

---

## 5. The QC+ Export Object (Standard Export Format)

This is the single JSON shape that all connectors consume. It contains everything any connector might need. Connectors pick the fields relevant to their destination and ignore the rest.

```typescript
interface QcPlusExportObject {
  // Metadata
  meta: {
    source: "quote-core-plus";
    export_version: "1.0";
    exported_at: string;        // ISO 8601
    quote_id: string;           // QC+ internal ID (for dedup/tracing)
    event: "quote_sent" | "quote_accepted" | "quote_confirmed" | "manual_export";
  };

  // Customer (constructed from quote fields)
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
    // Future: when we have a customers table, this becomes richer
    address: string | null;     // from site_address
  };

  // Job info
  job: {
    name: string | null;        // job_name
    site_address: string | null;
    trade: string;              // roofing, generic, etc.
    status: string;             // current QC+ status
    measurement_system: string; // metric, imperial_ft, imperial_rs
  };

  // Quote summary
  quote: {
    number: number | null;      // quote_number
    currency: string;           // NZD, GBP, etc.
    created_at: string;
    accepted_at: string | null;
    notes: string | null;       // notes_internal
  };

  // Company branding (snapshot from the quote)
  company: {
    name: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    logo_url: string | null;
    footer_text: string | null;
  };

  // Customer-facing lines (presentation layer)
  // Use this for: Xero invoices, Fergus quotes, any customer-facing document
  customer_lines: Array<{
    id: string;
    line_type: "component" | "custom" | "roof_area_header";
    description: string;        // from custom_text or component name
    quantity: number;
    quantity_text: string | null;
    unit_price: number | null;
    line_total: number;         // custom_amount or quantity * unit_price
    is_visible: boolean;
    include_in_total: boolean;
    sort_order: number;
  }>;

  // Component breakdown (pricing layer)
  // Use this for: JobNimbus job tasks, Fergus job lines, detailed cost tracking
  components: Array<{
    id: string;
    name: string;
    component_type: "main" | "extra";
    measurement_type: string;   // area, lineal, quantity, etc.
    pricing_strategy: string;   // per_unit, per_pack_*, etc.
    quantity: number;           // final_quantity
    pricing_unit: string | null;
    material_rate: number;
    material_cost: number;
    labour_rate: number;
    labour_cost: number;
    waste_percent: number;
    waste_type: string;
    pitch_type: string;
    pitch_degrees: number | null;
    is_customer_visible: boolean;
    sort_order: number;
    // Optional: link back to component library entry
    component_library_id: string | null;
    sku: string | null;         // from component_library if linked
  }>;

  // Roof areas (for roofing-specific integrations)
  roof_areas: Array<{
    id: string;
    label: string;
    input_mode: string;
    computed_sqm: number | null;
    pitch_degrees: number | null;
    plan_sqm: number | null;
  }>;

  // Totals
  totals: {
    material_subtotal: number;   // sum of component.material_cost
    labour_subtotal: number;     // sum of component.labour_cost
    subtotal: number;            // material + labour
    material_margin: number;     // material_subtotal * margin%
    labour_margin: number;       // labour_subtotal * margin%
    subtotal_with_margins: number;
    tax_breakdown: Array<{
      name: string;
      rate_percent: number;
      amount: number;
    }>;
    tax_total: number;
    grand_total: number;
  };

  // Files (signed URLs, 30-min TTL)
  files: Array<{
    id: string;
    file_type: "plan" | "supporting" | "canvas";
    file_name: string;
    url: string;
  }>;

  // Labour sheet (internal breakdown)
  // Only populated if the user has created a labour sheet for this quote
  labour_lines: Array<{
    id: string;
    description: string;
    amount: number;
    is_visible: boolean;
    include_in_total: boolean;
    sort_order: number;
  }> | null;

  // Notes and assumptions
  notes: {
    internal: string | null;          // notes_internal from quote
    customer_facing: string | null;   // any customer-facing notes attached to the quote
    assumptions: string | null;       // assumptions stated during quoting
  };

  // Acceptance details
  acceptance: {
    status: string;                   // current quote status
    accepted_at: string | null;       // when customer accepted (if accepted)
    accepted_by: string | null;       // who accepted (name/email if tracked)
    valid_until: string | null;       // quote validity date if set
  };

  // PDF documents (generated PDFs, not raw files)
  documents: Array<{
    type: "customer_quote" | "labor_sheet" | "material_order" | "summary";
    url: string;                      // signed URL with TTL
    generated_at: string;
  }>;
}
```

---

## 6. Connectors

### 6.1 Zapier Connector (Phase 1A - first to build)

Zapier is the simplest integration. We send the QC+ Quote Payload to a Zapier Catch Hook URL. The user configures the Zapier side to map fields to their destination.

**What we build:**
- `POST /api/integrations/zapier/webhook` - server action that sends the payload to the user's configured Zapier webhook URL
- The payload is the full QC+ Quote Payload (section 5)
- Zapier automatically flattens nested JSON (double-underscore notation for nested fields)
- Users configure their own Zapier Zaps to route data to Xero, JobNimbus, Fergus, or any of Zapier's 7,000+ apps

**What the user does:**
1. Creates a Zapier account (free tier works)
2. Creates a new Zap with "Webhooks by Zapier" as the trigger (Catch Hook)
3. Gets a webhook URL like `https://hooks.zapier.com/hooks/catch/1234567/f8f22dgg/`
4. Pastes that URL into QuoteCore+ integration settings
5. Configures the Zap's action step (e.g. "Create Xero Invoice", "Create JobNimbus Job", "Create Fergus Job")
6. Maps fields from the webhook payload to the destination app

**What we DON'T build:**
- No OAuth flows
- No per-app API integration
- No field mapping UI (Zapier handles this)

**Why Zapier first:**
- Validates the payload format with real users before we invest in native integrations
- Covers all three target platforms (Xero, JobNimbus, Fergus all have Zapier apps)
- Zero API key management on our end (just store the webhook URL)
- Fastest path to value - can be built in days, not weeks

### 6.2 JobNimbus Connector (Phase 1B - native)

JobNimbus has a public REST API at `https://app.jobnimbus.com/api1/`.

**Authentication:** API key token (user generates in JobNimbus Settings > API)

**Key endpoints for our integration:**
- `POST /api1/contacts` - create a contact (customer)
- `POST /api1/jobs` - create a job linked to a contact
- `POST /api1/activities` - add notes/activities to a job
- `POST /api1/attachments` - attach files to a job

**Required fields for job creation:**
- `name` (job name) - maps from `job.name` or `customer.name`
- `record_type_name` (workflow name, e.g. "Job") - user configures during setup
- `status_name` (status within workflow, e.g. "Lead") - user configures during setup

**Optional fields:**
- `primary.id` - contact ID (created first, then linked)
- `geo.lat` / `geo.lon` - geolocation from site address
- Custom fields - JobNimbus supports custom fields that vary per account

**Connector mapping:**
```
QC+ Export Object -> JobNimbus

1. Create contact:
   customer.name     -> contact.name (first+last if possible)
   customer.email    -> contact.email
   customer.phone    -> contact.phone
   customer.address  -> contact.address

2. Create job:
   job.name          -> job.name (fallback: customer.name + " - " + quote.number)
   job.site_address  -> job.address
   quote.number      -> job.custom_fields["QC+ Quote Number"]
   quote.currency    -> job.custom_fields["Currency"]
   totals.grand_total -> job.custom_fields["Quote Total"]
   "Job"             -> job.record_type_name (user-configured)
   "Lead"            -> job.status_name (user-configured)
   contact.id        -> job.primary.id

3. Add quote details as activity/notes:
   All customer_lines -> activity description (formatted)
   Link to QC+ quote   -> activity note

4. Attach files (optional):
   files[].url       -> attachment endpoints
```

**Limitations:**
- JobNimbus doesn't have a native "line items" concept on jobs the way Xero does
- Line items go into the job description or custom fields
- The adapter packs customer_lines into a formatted description block

### 6.3 Fergus Connector (Phase 1C - native)

Fergus has a public API at `https://api.fergus.com`.

**Authentication:** Personal Access Token (PAT) - Bearer token. User generates in Fergus API settings. Tokens expire after 365 days.

**Rate limit:** 100 requests per minute per company.

**Key endpoints (based on Fergus OpenAPI spec):**
- Jobs endpoints - create jobs, manage job phases
- Quotes endpoints - create quotes/estimates
- Customers/Sites/Contacts - manage customer records
- Invoices - create invoices

**Fergus job/quote structure:**
- A job is created against a customer and site
- A quote/estimate is created against a job
- Quotes have line items (description, quantity, rate, total)
- Jobs have phases for organising work

**Connector mapping:**
```
QC+ Export Object -> Fergus

1. Create/find customer:
   customer.name     -> customer.name
   customer.email    -> customer.email
   customer.phone    -> customer.phone
   customer.address  -> site.address

2. Create job:
   job.name          -> job.reference (or auto-generated)
   job.site_address  -> job.site
   quote.number      -> job.external_reference

3. Create quote against job:
   customer_lines    -> quote.line_items[]
     .description    -> line_item.description
     .quantity       -> line_item.quantity
     .unit_price     -> line_item.rate
     .line_total     -> line_item.total
   totals.grand_total -> quote.total
   totals.tax_breakdown -> quote.tax

4. Attach files (if supported):
   files[].url       -> job/quote attachments
```

**Fergus advantages:**
- Has a proper quote/estimate object (closer to our model)
- Line items map more naturally than JobNimbus
- AU/NZ focused (good for our market)

**Limitations:**
- API access requires admin/full user permissions
- One PAT per user (no service accounts)
- Token expiry needs handling

### 6.4 Future Connectors (Phase 2+)

The connector pattern means adding new integrations is a contained task:
- **Xero** - OAuth2, create invoices (contact + line items + tax type). Xero has a well-documented API.
- **Tradify** - API for job creation
- **SimPRO** - API for job/service creation
- **Buildertrend** - API for project/proposal creation
- **ServiceM8** - API for job creation

Each connector follows the same pattern: receive QC+ Export Object, validate, map to destination format, call API, log result.

---

## 7. Database Changes Required

### 7.1 New table: `integrations`

```sql
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,  -- 'zapier' | 'jobnimbus' | 'fergus' | 'xero' | etc.
  enabled BOOLEAN NOT NULL DEFAULT false,
  -- Provider-specific config stored as JSON
  -- Zapier: { webhook_url: string }
  -- JobNimbus: { api_key: string, record_type_name: string, status_name: string }
  -- Fergus: { pat: string, default_job_type: string }
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, provider)
);
```

### 7.2 New table: `integration_logs`

```sql
CREATE TABLE integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  event TEXT NOT NULL,         -- 'export_sent', 'export_success', 'export_failed'
  payload_summary JSONB,       -- what was sent (without sensitive data)
  response_status INTEGER,     -- HTTP status from provider
  response_body TEXT,          -- error message or success reference
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 7.3 No changes to existing tables

The export builder reads from existing tables. No schema changes to `quotes`, `quote_components`, `customer_quote_lines`, etc.

---

## 8. Code Changes Required

### 8.1 Export Builder (new)

**Location:** `app/lib/integrations/export-builder.ts`

Builds the QC+ Quote Payload from a quote ID. This is a server-side function that:
1. Loads the quote + all related data (roof areas, components, customer lines, labour lines, taxes, files)
2. Constructs the `QcPlusQuotePayload` object
3. Returns it for the adapter to dispatch

This is essentially a refactored version of the existing `loadQuoteBundleData()` in `actions-bulk.ts`, but outputting the clean standard format instead of the internal bundle shape.

### 8.2 Connector Layer (new)

**Location:** `app/lib/integrations/connectors/`

```
app/lib/integrations/
  export-builder.ts        - builds QC+ Export Object from quote ID
  types.ts                 - QcPlusExportObject type definition
  connector-base.ts        - shared connector interface + retry/error logic
  dispatch.ts              - routes to the right connector based on provider
  connectors/
    zapier/
      index.ts             - Zapier connector (auth, mapping, delivery)
      mapping.ts           - field mapping config (passthrough for Zapier)
    jobnimbus/
      index.ts             - JobNimbus connector (auth, mapping, delivery)
      mapping.ts           - QC+ Export -> JobNimbus field mapping
      validation.ts        - required field validation for JobNimbus
    fergus/
      index.ts             - Fergus connector (auth, mapping, delivery)
      mapping.ts           - QC+ Export -> Fergus field mapping
      validation.ts        - required field validation for Fergus
```

Each connector is a self-contained module that:
- Implements the standard `Connector` interface (defined in `connector-base.ts`)
- Receives the `QcPlusExportObject` + the integration config (credentials, settings)
- Validates required fields for its destination
- Transforms the export object to destination format (via its mapping.ts)
- Makes the API call(s) with retry + exponential backoff (max 3 retries)
- Returns a `ConnectorResult` (success/failure + external record IDs)
- Logs every attempt to `integration_logs`

**Connector interface:**
```typescript
interface Connector {
  provider: string;                                    // 'zapier' | 'jobnimbus' | 'fergus' | ...
  supportedEvents: ExportEvent[];                      // which events this connector handles
  validateConfig(config: IntegrationConfig): ValidationResult;
  validatePayload(payload: QcPlusExportObject): ValidationResult;
  send(payload: QcPlusExportObject, config: IntegrationConfig): Promise<ConnectorResult>;
}

interface ConnectorResult {
  success: boolean;
  external_record_ids: Record<string, string>;         // e.g. { contact: "abc123", job: "def456" }
  error_message: string | null;
  retry_count: number;
  response_status: number | null;
}
```

### 8.3 API Route (new)

**Location:** `app/api/integrations/[provider]/route.ts`

- `POST /api/integrations/zapier/export` - trigger Zapier export for a quote
- `POST /api/integrations/jobnimbus/export` - trigger JobNimbus export
- `POST /api/integrations/fergus/export` - trigger Fergus export

These are authenticated server actions (not public endpoints). They:
1. Verify the user's company owns the quote
2. Load the integration config for the company
3. Build the payload
4. Call the adapter
5. Log the result
6. Return success/failure to the client

### 8.4 Integration Settings UI (new)

**Location:** `app/(auth)/[workspaceSlug]/settings/integrations/`

A new settings page where users:
1. See available integrations (Zapier, JobNimbus, Fergus)
2. Enable/disable each integration
3. Configure provider-specific settings (webhook URL, API key, etc.)
4. View export history (from `integration_logs`)
5. Test the integration (send a test payload)

### 8.5 "Send to Integration" Button (new)

**Location:** Quote summary page (`quotes/[id]/summary/`)

A button next to "Download ZIP" and "Send Quote" that:
1. Shows a dropdown of enabled integrations
2. On click, triggers the export via the API route
3. Shows success/failure feedback
4. Logs the export to the quote's activity feed

---

## 9. Phase 1A: Zapier Build Plan (First Sprint)

This is the first thing we build. Goal: get Zapier working end-to-end so users can route quotes to any platform.

### 9.1 Tasks

| # | Task | Owner | Files |
|---|------|-------|-------|
| 1 | Create migration: `integrations` + `integration_logs` tables | Gavin | `supabase/migrations/` |
| 2 | Refresh `database.types.ts` after migration | Gavin | `app/lib/supabase/database.types.ts` |
| 3 | Define `QcPlusQuotePayload` type | Ron | `app/lib/integrations/types.ts` |
| 4 | Build `buildExportObject(quoteId)` function | Ron | `app/lib/integrations/export-builder.ts` |
| 5 | Build Zapier connector | Ron | `app/lib/integrations/connectors/zapier/` |
| 6 | Build dispatch function + connector base interface | Ron | `app/lib/integrations/dispatch.ts` + `connector-base.ts` |
| 7 | Build API route for Zapier export | Ron | `app/api/integrations/zapier/route.ts` |
| 8 | Build integration settings page | Ron | `app/(auth)/[workspaceSlug]/settings/integrations/` |
| 9 | Add "Send to Zapier" button on quote summary | Ron | `quotes/[id]/summary/` |
| 10 | Test end-to-end with a test Zap | Ron + Shaun | - |

### 9.2 What Shaun needs to do (accounts side)

1. Create a free Zapier account (if not already have one)
2. Create a test Zap with "Webhooks by Zapier" trigger (Catch Hook)
3. Copy the webhook URL
4. We'll use this for testing before the settings UI is built

### 9.3 Test plan

**Test 1: Payload structure**
- Create a test quote with known data
- Call `buildQuotePayload()` and verify the JSON structure matches the spec
- Verify all fields are populated correctly

**Test 2: Zapier webhook delivery**
- Send the payload to a Zapier Catch Hook URL
- Verify Zapier receives the data (check Zapier's "Load Samples")
- Verify nested fields are accessible (e.g. `customer__name`, `totals__grand_total`)

**Test 3: End-to-end with Xero via Zapier**
- Configure Zap: Webhook trigger -> Xero "Create Invoice" action
- Map fields: customer.name -> Contact, customer_lines -> LineItems, totals -> totals
- Trigger export from QuoteCore+ quote summary page
- Verify invoice appears in Xero

**Test 4: End-to-end with JobNimbus via Zapier**
- Configure Zap: Webhook trigger -> JobNimbus "Create Job" action (or custom webhook to JobNimbus API)
- Map fields: customer.name -> name, job.name -> name, etc.
- Trigger export from QuoteCore+
- Verify job appears in JobNimbus

---

## 10. Phase 1B: JobNimbus Native Build Plan

After Zapier is validated, build the native JobNimbus adapter.

### 10.1 Tasks

| # | Task | Owner |
|---|------|-------|
| 1 | Build JobNimbus connector (contacts + jobs API) | Ron |
| 2 | Add JobNimbus config fields to settings UI (API key, record_type_name, status_name) | Ron |
| 3 | Add JobNimbus option to "Send to Integration" dropdown | Ron |
| 4 | Handle multi-step: create contact first, then job, then attach files | Ron |
| 5 | Test with Shaun's JobNimbus account | Ron + Shaun |

### 10.2 What Shaun needs

1. JobNimbus account (trial is fine)
2. Generate API key in JobNimbus Settings > API
3. Note the workflow name (`record_type_name`) and initial status (`status_name`) from JobNimbus settings

---

## 11. Phase 1C: Fergus Native Build Plan

After JobNimbus, build the native Fergus adapter.

### 11.1 Tasks

| # | Task | Owner |
|---|------|-------|
| 1 | Research Fergus API endpoints for job/quote creation (read full OpenAPI spec) | Ron |
| 2 | Build Fergus connector (customer + job + quote creation) | Ron |
| 3 | Add Fergus config fields to settings UI (PAT, default job type) | Ron |
| 4 | Add Fergus option to "Send to Integration" dropdown | Ron |
| 5 | Handle PAT expiry (warn user before 365-day expiry) | Ron |
| 6 | Test with Shaun's Fergus account | Ron + Shaun |

### 11.2 What Shaun needs

1. Fergus account (trial is fine)
2. Generate a Personal Access Token in Fergus API settings
3. Note the default job type for quote imports

---

## 12. Security Considerations

- **API keys/tokens** are stored in the `integrations.config` JSONB column. These are sensitive - the settings page must mask them in the UI and never expose them to the client after save.
- **Webhook URLs** (Zapier) are less sensitive but should still be treated as secrets.
- **Integration logs** must NOT store full payloads (may contain customer PII). Store only a summary (quote number, customer name, line count, total).
- **Rate limiting** - Fergus has 100 req/min. Our adapter must handle 429 responses with retry. JobNimbus doesn't document rate limits but we should be conservative.
- **File URLs** in the payload are signed Supabase URLs with 30-min TTL. They expire quickly, which is good for security. Adapters that need persistent access should download and re-upload files.
- **Row Level Security** - the `integrations` table must have RLS policies so companies can only see their own integrations.

---

## 13. What Does NOT Change

- No changes to how quotes are built, calculated, or stored
- No changes to the pricing engine
- No changes to the takeoff pipeline
- No changes to the customer quote preview
- No changes to invoices or material orders (they're separate from the export)
- No changes to the existing `QuoteBundleData` / ZIP download feature
- No changes to the send-document (email) pipeline
- No QuoteCore+ business logic inside connectors - connectors only transform and dispatch

The integration layer is purely additive - it reads from existing data, builds a standard export object, and pushes it out via isolated connectors. It does not modify any existing data flows.

---

## 14. Decisions (confirmed by Shaun, 2026-08-01)

1. **Export available from:** `confirmed` stage (customer reaches the quote summary page/stage). ✅

2. **Re-export after edits:** Yes. Log as re-export, warn that destination may create a duplicate. ✅

3. **Labour sheet in payload:** Include it, but only if the user has created one. Each adapter decides whether to use it. ✅

4. **Customer dedup:** Phase 1 always creates new (no dedup). Add dedup in Phase 2 when we have a customers table. ✅

5. **DB migration owner:** Gavin builds the `integrations` + `integration_logs` migration. He owns the database schema. ✅

---

## 15. Summary

| Phase | What | Effort | Dependency |
|-------|------|--------|------------|
| 1A | Zapier (webhook out + settings UI) | ~3-5 days | DB migration from Gavin |
| 1B | JobNimbus native (API adapter) | ~2-3 days | Phase 1A complete |
| 1C | Fergus native (API adapter) | ~2-3 days | Phase 1A complete |
| 2 | Xero, Tradify, others | ~2-3 days each | Phase 1A complete |

**Total Phase 1 (Zapier + JobNimbus + Fergus): ~7-11 days of dev work.**

The export object is built once in Phase 1A. Phase 1B and 1C are just new connectors on top. Phase 2 integrations follow the same pattern - each is a new connector module, not a new implementation.
