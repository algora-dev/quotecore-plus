# Free Tools + AI Document Builder — Master Plan

## Vision

Build a suite of free, SEO-optimized, mobile-first tools at public URLs that:
1. Solve real problems for tradespeople who still hand-write quotes/orders/invoices
2. Capture leads via email gate + usage limits
3. Convert free users into paying QuoteCore+ subscribers
4. Eventually feed back into the full app as AI-assisted features

---

## Tool 1: Construction Calculator (`/free-construction-calculator`)

**Status:** Plan exists at `docs/pitch-calculator-plan.md` (expand to all-in-one).

**What:** All-in-one construction calculator — pitch/angle, area², volume, rafter length, hip/valley, material estimator. Best-in-class, mobile-first, no auth.

**Reuse:** `rafterPitchFactor()`, `hipValleyPitchFactor()`, `pitchFactor()`, `applyPitchAndWaste()`, `computeRoofArea()`, `totalRoofArea()` — all pure functions in `app/lib/pricing/engine.ts`.

**Effort:** ~1.5 days (math is done, UI + SEO is the work).

---

## Tool 2: AI Quote Generator (`/free-quote-generator`)

**What:** Free tool where a user either:
- **(a) Text prompt:** Pastes/types job info into a prompt box → AI parses → populates a line-by-line quote editor → user edits freely → downloads PDF
- **(b) Image upload:** Photographs their handwritten quote → AI reads via vision → populates same editor → user edits → downloads PDF

**Editor reuse:** The `CustomerQuoteEditor.tsx` line model (QuoteLine interface) is the exact shape we need. The line-by-line format with add/edit/reorder/toggle/preview is already built. For the free version, we strip:
- Quote schema coupling (roof areas, components, margins, taxes — or keep taxes simple)
- Auto-save to Supabase (use localStorage instead)
- Component library / catalog (free tool = custom lines only)
- Auth requirement

**Keep:**
- Line add/edit/remove/reorder
- Show/price/total toggles
- Live preview pane
- Header/footer editing (business name, customer name, date, logo upload)
- PDF download (existing jsPDF + html2canvas pipeline)
- Tax support (simple flat rate)

---

## Tool 3: AI Order Generator (`/free-order-generator`)

**What:** Same concept as Tool 2 but for purchase orders / material orders.

**Editor reuse:** `OrderLineByLineEditor.tsx` + `lineByLine.ts` types (`LineByLineItem`). This is the cleanest editor — already fully decoupled from quote schema, stores as self-contained JSON. Perfect for a free tool.

**Strip:** Workspace/catalog coupling, Supabase persistence.
**Keep:** Line editor, footer text, simple taxes, preview, PDF.

---

## Tool 4: AI Invoice Generator (`/free-invoice-generator`)

**What:** Same concept for invoices.

**Editor reuse:** `InvoiceEditor.tsx` + `InvoiceLineRow`/`EditableLine` types. Has header modal, line modal, preview, PDF — all the building blocks.

**Strip:** Supabase persistence, quote import, payment tracking, send pipeline.
**Keep:** Line editor, header/footer editing, preview, PDF download.

---

## Shared Architecture

### AI Parsing Pipeline (all 3 document tools)

```
User input (text prompt OR image upload)
  ↓
POST /api/free-tools/parse-document
  ↓
OpenAI GPT-4o (vision-capable) with structured output
  ↓
Returns: { header: {...}, lines: [...], footer: "...", notes: "..." }
  ↓
Populates editor state (same shape as existing editors)
  ↓
User edits freely → downloads PDF
```

**API route:** `app/api/free-tools/parse-document/route.ts`
- Accepts: `{ type: 'quote'|'order'|'invoice', mode: 'text'|'image', content: string, image?: base64 }`
- Uses OpenAI (already a dependency — `openai` npm package installed, key configured for assistant)
- Returns structured JSON matching the line shape of the target editor
- Rate limited (IP + email) via existing `consume_rate_limit()` infra

**Prompt engineering:** System prompt with:
- Document type context (quote vs order vs invoice)
- Target schema (line fields: text, quantityText, amount, unitPrice, quantity, showPrice, isVisible, includeInTotal)
- Instruction to map unstructured input → structured lines
- Examples in the prompt for common trades (roofing, plumbing, electrical, general)

### Free Tool Shared Components

```
app/(public)/free-tools/
  layout.tsx                    — shared layout (logo, nav, signup CTA bar)
  components/
    FreeToolHeader.tsx          — hero + SEO + "How it works" 
    PromptBox.tsx               — text input area + "Generate" button
    ImageUpload.tsx             — photo upload + preview + "Scan" button
    EmailGate.tsx               — modal: "Enter email for watermark-free downloads"
    UsageBanner.tsx             — "You have X free uses left" + upgrade CTA
    Watermark.tsx               — overlay on preview/PDF for non-email users
    FreeToolFooter.tsx          — links to other free tools + signup CTA
  lib/
    freeToolTypes.ts            — shared types (FreeQuoteLine, FreeOrderLine, FreeInvoiceLine)
    parseDocument.ts            — client-side wrapper for /api/free-tools/parse-document
    usageTracking.ts            — localStorage + server-side email-based usage
    pdfExport.ts                — shared PDF generation (reuse existing pdf pipeline)
```

### Route Structure

```
app/(public)/
  free-construction-calculator/
    page.tsx                    — SEO meta (server component)
    ConstructionCalculator.tsx  — client component
  free-quote-generator/
    page.tsx                    — SEO meta
    FreeQuoteGenerator.tsx      — client: prompt/upload → editor → PDF
  free-order-generator/
    page.tsx
    FreeOrderGenerator.tsx
  free-invoice-generator/
    page.tsx
    FreeInvoiceGenerator.tsx
```

### Usage Limits & Email Gate

**Anonymous (no email):**
- 1 free document per tool per day (tracked via IP + localStorage)
- Watermark on PDF (rendered into canvas at generation time)
- Popup after download: "Sign up with email for 5 free documents per week"

**Email-registered (mini login, no SaaS account):**
- User authenticates via Supabase Auth (Google OAuth or email/password)
- Auth BYPASSES normal SaaS signup/onboarding — no workspace, no trial, no onboarding flow
- User lands back on the tool page with a session
- 5 free documents per tool per week, no watermark
- Usage tracked server-side by user ID/email
- Upsell: "Only 1 left this week → Start free trial for unlimited access"

**SaaS trial/full account:**
- These tools available inside the app too (Phase 5)
- No limits, no watermark

**Mini login implementation:**
- Reuse existing Supabase Auth (Google OAuth + email/password already configured)
- New `auth/callback` redirect logic: check a `redirect_to` param — if it points to a free-tool URL, skip onboarding and redirect back to the tool
- New `free_tool_profiles` table (lightweight): `user_id`, `email`, `created_at`, `usage_reset_at` — tracks free-tier usage only, separate from `public.users` (which is the SaaS user profile)
- Or simpler: just use `auth.users` email + a `free_tool_usage` table keyed by user_id. No profile needed — if they later sign up for the app, the same auth account upgrades.

**Tracking:** `free_tool_usage` table (user_id NULL for anonymous, ip_address, tool_type, document_data JSONB, created_at). Count by (user_id OR ip) per tool per day/week.

### Post-Download Conversion Modal

After a user downloads their PDF, show a modal:
- **Title:** "Want to send this professionally?"
- **Body:** "Send directly to your customer with a branded email, quote acceptance flow, and automatic follow-ups. Try the full QuoteCore+ experience free for 14 days."
- **CTA:** "Start Free Trial" → links to `/signup?ref=free-tool`
- **Secondary:** "No thanks, just downloading" → dismisses
- Different copy per tool type (quote = acceptance flow, order = supplier tracking, invoice = payment tracking)
- Only shows on first download per session (don't spam)

### SEO Strategy (Shaun-locked: SEO-first URLs)

Each page targets specific keywords:
- `/free-quote-generator` → "free quote generator", "AI quote builder", "online quote maker"
- `/free-order-generator` → "free purchase order generator", "material order template"
- `/free-invoice-generator` → "free invoice generator", "AI invoice maker", "online invoice template"
- `/free-construction-calculator` → "construction calculator", "roofing pitch calculator", "roof area calculator"

Each page gets:
- Meta title/description
- OG image
- Schema.org WebApplication structured data
- Canonical URL
- Internal linking between the 4 tools
- Fast LCP (static rendered shell, client-side interactivity)

---

## Phase Plan

**Phase 1: Construction Calculator (1.5 days)**
- Expand existing `pitch-calculator-plan.md` to include area², volume, rafter, hip/valley
- Build `app/(public)/free-construction-calculator/`
- Desktop + mobile simultaneously (responsive, not mobile-only)
- SEO meta, schema.org structured data
- No auth, no API, pure client-side math
- Add `/free-construction-calculator` to `PUBLIC_PATHS` in `middleware.ts`

### Phase 2: AI Document Generators — Text Prompt (5-6 days)
- Build shared free-tools layout + components
- Build `/api/free-tools/parse-document` API route
- Build quote generator first (most complex editor)
- Port to order generator (easiest — cleanest editor)
- Port to invoice generator
- Email gate + usage tracking + watermark
- SEO for all 3 pages

### Phase 3: Image Upload (2-3 days)
- Add image upload to the prompt box
- Vision API integration (GPT-4o vision — same OpenAI key)
- Image preprocessing (compress, orient)
- Prompt tuning for handwriting recognition

### Phase 4: Mobile Optimization Pass (1-2 days)
- All tools are mobile-first by design, but dedicated QA pass:
  - Touch targets ≥ 44px
  - Responsive preview pane (stacked on mobile)
  - PDF export works on mobile browsers
  - Image upload from camera (mobile `capture` attribute)

### Phase 5: In-App Integration (2-3 days)
- Add "AI Generate" button to the existing in-app line-by-line quote editor
- Add same to order editor and invoice editor
- Reuse the same `/api/free-tools/parse-document` endpoint (now behind auth, no rate limit for paid users)

---

## What Already Exists (Reuse Map)

| Component | Location | Reuse For |
|-----------|----------|-----------|
| Pitch/area math | `app/lib/pricing/engine.ts` | Calculator |
| CustomerQuoteEditor | `quotes/[id]/customer-edit/CustomerQuoteEditor.tsx` | Quote generator line model |
| LineEditForm | `quotes/[id]/customer-edit/LineEditForm.tsx` | Line editing UI |
| AddLineItemModal | `components/AddLineItemModal.tsx` | Add line modal |
| OrderLineByLineEditor | `material-orders/create/OrderLineByLineEditor.tsx` | Order generator |
| lineByLine types | `material-orders/lineByLine.ts` | Order line model |
| InvoiceEditor | `invoices/[id]/InvoiceEditor.tsx` | Invoice generator |
| AddInvoiceLineModal | `invoices/[id]/AddInvoiceLineModal.tsx` | Invoice add line |
| CollapsiblePanel | `components/editor/CollapsiblePanel.tsx` | Layout |
| PDF pipeline | `app/lib/pdf/renderPreviewToPdf.ts` | All PDF downloads |
| OpenAI integration | `api/assistant/chat/route.ts` + `openai` npm pkg | AI parsing API |
| Rate limiting | `consume_rate_limit()` RPC | Usage limits |
| (public) route group | `app/(public)/docs/` | Route structure |

---

## Difficulty Assessment

| Tool | Difficulty | Why |
|------|-----------|-----|
| Construction Calculator | **Easy** | All math exists. UI + SEO only. No API, no auth, no AI. |
| AI Quote Generator (text) | **Medium** | Editor exists but needs decoupling from quote schema. AI prompt parsing is new but straightforward with GPT-4o structured output. |
| AI Order Generator (text) | **Easy-Medium** | Cleanest editor (already decoupled). Easiest to port. |
| AI Invoice Generator (text) | **Medium** | Invoice editor is solid but has more moving parts (payment details, statuses). Need to strip to essentials. |
| Image upload (all 3) | **Medium** | GPT-4o vision is good at handwriting. Main work is image preprocessing + prompt tuning. |
| In-app integration | **Easy** | API route already built. Just wire buttons into existing editors. |
| Usage/email gate | **Easy-Medium** | Rate limit infra exists. Need a new table + email capture UI. |

**Total estimated effort:** 10-14 days for all 4 tools + image upload + in-app integration.

---

## Decisions Locked (Shaun, 2026-07-10)

1. **Build order:** Calculator first. Desktop + mobile at the same time (not mobile-only).
2. **URL structure:** SEO-first — whatever ranks best for "free (x) calculator", "free quote generator", etc. Exact URLs TBD by keyword research, but likely `/free-construction-calculator`, `/free-quote-generator`, `/free-purchase-order-generator`, `/free-invoice-generator`. These go in `PUBLIC_PATHS` in middleware.
3. **Email gate = mini login:** User signs in with Google OAuth or email/password via Supabase Auth (same provider we already use), but it BYPASSES the normal SaaS signup/onboarding flow. They land back on the tool page with a session — email noted as "logged in" — watermark removed + higher weekly allowance. No workspace created, no trial started.
4. **Post-download conversion:** After PDF download, show modal: "Send directly to your customer with a professional email and quote acceptance flow — start free 14-day trial" → links to signup.
5. **OpenAI model:** GPT-4o (same key as assistant chatbot, already configured).
6. **Watermark:** Render into PDF canvas at generation time (not a DOM overlay).
