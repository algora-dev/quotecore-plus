# Free Tools Master Plan — Fable 5 Architecture

> Created 2026-07-10 with Fable 5. Authoritative plan for all free tool features.
> Supersedes architecture sections in `docs/free-tools-plan.md` (that doc kept as a summary).

---

## 1. Product Vision

Build 4 free, public, SEO-optimized tools that serve as a top-of-funnel lead generation engine for QuoteCore+:

| # | Tool | URL (SEO-optimal) | Auth | API |
|---|------|-------------------|------|-----|
| 1 | All-in-One Construction Calculator | `/free-construction-calculator` | None | None (pure client math) |
| 2 | AI Quote Generator | `/free-quote-generator` | Optional (mini login) | OpenAI GPT-4o |
| 3 | AI Order Generator | `/free-purchase-order-generator` | Optional (mini login) | OpenAI GPT-4o |
| 4 | AI Invoice Generator | `/free-invoice-generator` | Optional (mini login) | OpenAI GPT-4o |

**Conversion funnel:**
```
Google search "free quote generator"
  → lands on /free-quote-generator (SEO-optimized page)
  → types/pastes job info OR uploads photo of handwritten quote
  → AI parses → populates line-by-line editor
  → user edits freely (add/remove/reorder/toggle lines)
  → downloads PDF (watermarked if anonymous)
  → post-download modal: "Send professionally with acceptance flow — start 14-day trial"
  → or: "Enter email for watermark-free downloads + 5/week"
  → mini login (Google OAuth or email/password, separate Supabase project)
  → usage tracking → "1 left this week" → upgrade CTA
  → signs up for SaaS app (separate auth, same email = we can match)
```

---

## 2. Separate Auth Architecture (Shaun-locked 2026-07-10)

### Why Separate
- **No email clashes** — a free-tool user with `joe@gmail.com` can later sign up for the SaaS app with the same email without conflict
- **Clean user list** — every user in the free-tools project is a lead. Easy to export for email marketing
- **No middleware conflict** — free tool routes stay public in the main app middleware. Auth is handled at the page level
- **Conversion tracking** — match emails across the two Supabase projects to see who converted from free → paid

### Implementation: Second Supabase Project

**New Supabase project:** `quote-core-free-tools` (create via Supabase dashboard)

**Env vars (added to `.env.local` + Vercel):**
```
NEXT_PUBLIC_FREE_SUPABASE_URL=https://<new-project-ref>.supabase.co
NEXT_PUBLIC_FREE_SUPABASE_ANON_KEY=<anon-key>
FREE_SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

**Google OAuth:** Same Google Cloud project. Add a second OAuth redirect URI:
- Existing: `https://quote-core.com/auth/callback` (SaaS app)
- New: `https://quote-core.com/free-tools/auth/callback` (free tools)

**Tables in the free-tools project:**
```sql
-- free_tool_users extends auth.users (created via trigger on signup)
CREATE TABLE public.free_tool_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- usage tracking
  documents_this_week INT DEFAULT 0,
  usage_reset_at TIMESTAMPTZ DEFAULT now() + INTERVAL '7 days',
  -- conversion tracking
  converted_to_saas BOOLEAN DEFAULT FALSE,
  converted_at TIMESTAMPTZ
);

-- Document storage (for re-editing, optional)
CREATE TABLE public.free_tool_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_type TEXT NOT NULL CHECK (tool_type IN ('quote', 'order', 'invoice')),
  document_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Anonymous usage tracking (IP-based, for rate limiting)
CREATE TABLE public.anonymous_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash TEXT NOT NULL,
  tool_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Auth callback for free tools:** `app/(public)/free-tools/auth/callback/route.ts`
- Exchanges code for session using the FREE Supabase client
- Redirects back to the tool the user was on (via `redirect_to` param)
- Creates/updates `free_tool_users` row
- Does NOT trigger any SaaS onboarding, company creation, or workspace setup

**Free-tools Supabase client:** `app/lib/supabase/free-tools-client.ts`
- Server: `createFreeToolsServerClient()` — uses `FREE_SUPABASE_*` env vars
- Browser: `createFreeToolsBrowserClient()` — uses `NEXT_PUBLIC_FREE_SUPABASE_*` env vars
- Completely separate cookie namespace (`sb-free-` prefix) to avoid clashing with the main app's session cookies

**Mini login UI:** `app/(public)/free-tools/components/MiniLoginModal.tsx`
- Google OAuth button (uses free-tools Supabase client, redirects to `/free-tools/auth/callback`)
- Email/password form (signs up via free-tools Supabase client)
- No company name, no full name, no onboarding — just email
- Close button — user can dismiss and continue as anonymous

**Middleware:** Free tool routes added to `PUBLIC_PATHS` in main `middleware.ts`. The main middleware does NOT check for a SaaS session on these routes. Auth is checked at the page/component level using the free-tools client.

---

## 3. Construction Calculator — Detailed Build Plan

### Route
`app/(public)/free-construction-calculator/`

### Files
```
app/(public)/free-construction-calculator/
  layout.tsx              — public layout (header: logo + "Sign up" CTA, no app nav)
  page.tsx                — server component: SEO meta, schema.org JSON-LD, hero section
  ConstructionCalculator.tsx — client component: tab/section state, renders calculator modules
  components/
    PitchConverter.tsx    — degrees ↔ ratio, common pitch quick-select, visual diagram
    RafterCalculator.tsx  — span + pitch → rafter length
    RoofAreaCalculator.tsx — plan dimensions + pitch → actual roof area
    HipValleyCalculator.tsx — span + run + pitch → hip/valley length
    AreaCalculator.tsx    — width × length, multiple shapes, running total
    VolumeCalculator.tsx  — area × depth, material weight estimate
    TrigCalculator.tsx    — right triangle solver
    MaterialEstimator.tsx — area + material type → quantity with waste
    CalculatorCard.tsx    — shared wrapper (title, inputs, result, formula display)
    UnitToggle.tsx        — metric/imperial toggle (shared state via context)
    ResultDisplay.tsx     — large result number with unit, copy button
```

### Math (all reuse existing functions)
- `rafterPitchFactor(degrees)` → `1 / cos(degrees * RAD)` — from `engine.ts`
- `hipValleyPitchFactor(degrees)` → `sqrt(rafter_factor² + 1)` — from `engine.ts`
- `pitchFactor(degrees, pitchType)` — dispatcher — from `engine.ts`
- `applyPitchAndWaste(...)` — full pipeline — from `engine.ts`
- `computeRoofArea(area)` — from `engine.ts`
- `totalRoofArea(areas)` — from `engine.ts`
- New pure functions (add to `engine.ts` or a new `calculator.ts`):
  - `degreesToRatio(degrees)` → `{ x: number, y: number }` (e.g. 25° → 1:2.144)
  - `ratioToDegrees(x, y)` → degrees
  - `rafterLength(span, pitchDegrees)` → `(span / 2) / cos(pitch)`
  - `hipValleyLength(span, run, pitchDegrees)` → compound angle formula
  - `volumeFromAreaDepth(area, depth)` → volume
  - `materialEstimate(area, materialType, wastePercent)` → quantity + unit
  - `solveRightTriangle({ a?, b?, c?, angleA?, angleB? })` → all sides + angles

### UI Design
- Mobile-first, responsive grid
- Desktop: 2-column grid of calculator cards
- Mobile: single column, stacked, touch-friendly inputs (44px min target)
- Each calculator in a `CalculatorCard` with:
  - Title + icon
  - Input fields (large, clear labels)
  - Result display (big number, unit, copy button)
  - "Show formula" expandable section
  - Imperial/metric toggle (shared across all calculators)
- Color-coded result areas (subtle orange accent for outputs)
- No auth, no API calls, no Supabase — 100% client-side
- Static-rendered shell for fast LCP

### SEO
- **URL:** `/free-construction-calculator` (matches "free construction calculator")
- **Title:** "Free Construction Calculator — Roof Pitch, Area, Volume, Rafter Length | QuoteCore+"
- **Meta description:** "Free all-in-one construction calculator. Calculate roof pitch, area, volume, rafter length, hip/valley, and material quantities. No signup required."
- **H1:** "Free Construction Calculator"
- **Schema.org:** WebApplication with `applicationCategory: "CalculatorApplication"`, `offers: { price: 0 }`
- **Internal links:** Link to `/free-quote-generator`, `/free-invoice-generator` from the page
- **Sitemap:** Add to `app/sitemap.ts` static entries
- **robots.txt:** Add `/free-construction-calculator` to allowed paths

### CTA
- Sticky bottom bar: "Turn these calculations into a professional quote →" links to `/free-quote-generator`
- Header: "Sign up" button → `/signup?ref=calculator`

---

## 4. AI Document Generators — Detailed Architecture

### Shared Components

```
app/(public)/free-tools/
  layout.tsx                       — shared layout for all 3 document tools
  components/
    MiniLoginModal.tsx             — Google OAuth or email/password (free-tools Supabase)
    PromptBox.tsx                  — textarea + "Generate" button + example prompts
    ImageUpload.tsx                — file input (camera on mobile) + preview + "Scan" button
    EmailGate.tsx                  — modal: "Enter email for watermark-free downloads"
    UsageBanner.tsx                — "You have X free documents left this week" + upgrade CTA
    WatermarkOverlay.tsx           — renders watermark into PDF canvas
    PostDownloadModal.tsx          — "Send professionally" conversion modal
    FreeToolHeader.tsx             — hero section with SEO H1 + "How it works" steps
    FreeToolFooter.tsx             — links to other free tools + signup CTA
    DocumentEditor.tsx             — generic line editor (see below)
    DocumentPreview.tsx            — generic preview pane (see below)
  lib/
    freeToolTypes.ts               — shared types
    parseDocument.ts               — client wrapper for /api/free-tools/parse-document
    usageTracking.ts               — check/increment usage (anonymous + logged-in)
    pdfExport.ts                   — shared PDF generation with optional watermark
    auth.ts                        — free-tools auth helpers (getSession, signIn, signUp)
```

### Document Editor (Generic)

The three editors (quote, order, invoice) share enough structure that we build ONE generic `DocumentEditor` component parameterised by tool type:

```typescript
interface FreeDocumentLine {
  id: string;
  text: string;              // primary line text (item name/description)
  quantityText: string | null; // secondary description column
  amount: number;            // line total
  unitPrice: number | null;  // per-unit price (null = amount is total)
  quantity: number;          // numeric qty (default 1)
  showPrice: boolean;
  isVisible: boolean;
  includeInTotal: boolean;
  sortOrder: number;
}

interface FreeDocumentConfig {
  toolType: 'quote' | 'order' | 'invoice';
  title: string;             // "Quote", "Purchase Order", "Invoice"
  headerFields: HeaderField[]; // different per tool type
  footerEnabled: boolean;
  taxEnabled: boolean;
  defaultTaxRate: number | null;
}
```

**What it does (same for all 3 tools):**
- Line list: add / edit / remove / reorder (drag or up/down buttons)
- Each line: text, quantity, unit price, amount (auto-calc = qty × unitPrice), show/hide price, show/hide line, include in total
- Header editor: business name, customer name, date, reference number, logo upload (stored in free-tools Supabase storage)
- Footer editor: free text (terms, notes, thank-you message)
- Tax: optional flat rate tax (configurable %)
- Live preview pane (right side on desktop, below on mobile)
- PDF download (with or without watermark)
- Auto-save to localStorage (anonymous) or free-tools Supabase (logged in)

**What we strip from the SaaS editors:**
- No component library / catalog integration
- No quote schema coupling (roof areas, components, margins, preset types)
- No Supabase main-project persistence
- No auto-save to main DB
- No send/follow-up pipeline
- No payment tracking
- No quote acceptance flow

**What we keep (visually identical to SaaS editors):**
- Line-by-line format with toggles
- Live preview that looks like a professional document
- Collapsible editor/preview panels (`CollapsiblePanel.tsx`)
- PDF export via `renderPreviewToPdf.ts` (extended with watermark support)
- Design system compliance (`DESIGN_SYSTEM.md` patterns)

### AI Parsing Pipeline

**API Route:** `app/api/free-tools/parse-document/route.ts`

```typescript
// Request
interface ParseRequest {
  type: 'quote' | 'order' | 'invoice';
  mode: 'text' | 'image';
  content?: string;        // text prompt (mode='text')
  image?: string;          // base64-encoded image (mode='image')
}

// Response
interface ParseResponse {
  header: {
    businessName?: string;
    customerName?: string;
    date?: string;
    referenceNumber?: string;
    businessAddress?: string;
    businessPhone?: string;
    businessEmail?: string;
  };
  lines: FreeDocumentLine[];
  footer?: string;
  notes?: string;
  taxRate?: number | null;
  confidence: 'high' | 'medium' | 'low';
  warnings?: string[];      // e.g. "Couldn't read some items"
}
```

**OpenAI Integration:**
- Model: `gpt-4o` (vision-capable, same API key as assistant chatbot)
- System prompt: structured extraction with document-type context
- Response format: `response_format: { type: "json_object" }` (structured output)
- Rate limited: IP-based for anonymous, user-based for logged-in
- Image mode: pass image as base64 in the message content (GPT-4o vision)

**Prompt engineering strategy:**
```
System: You are a document parser for construction/trades documents.
Given {type} information (either text or a photo of a handwritten document),
extract structured line items and header information.

Return JSON matching this schema:
{ "header": {...}, "lines": [...], "footer": "...", "taxRate": null }

Rules:
- Each line should have: text (item name), quantityText (description/detail),
  amount (line total), unitPrice (per-unit if quantity > 1), quantity
- If a price can't be determined, set amount to 0 and showPrice to false
- Preserve the original item descriptions but clean up formatting
- If the document is a quote, include business and customer info in header
- If it's an order, focus on material names and quantities
- If it's an invoice, include payment-relevant header fields
```

**Example prompts shown to users (prompt hints):**
- Quote: "Paste your job details — include items, quantities, prices, customer name, and any notes"
- Order: "List the materials you need to order — supplier, items, quantities, prices"
- Invoice: "Enter your invoice details — customer, line items, amounts, payment terms"

### Post-Download Conversion Modal

After PDF download, show a modal with tool-specific copy:

| Tool | Modal Title | Body | CTA |
|------|-------------|------|-----|
| Quote | "Want to send this quote professionally?" | "Email it to your customer with a branded template, online acceptance flow, and automatic follow-up reminders. Try QuoteCore+ free for 14 days." | "Start Free Trial" → `/signup?ref=free-quote` |
| Order | "Track this order with suppliers?" | "Send purchase orders directly to suppliers, track deliveries, and link orders to quotes. Try QuoteCore+ free for 14 days." | "Start Free Trial" → `/signup?ref=free-order` |
| Invoice | "Get paid faster?" | "Send invoices with online payment tracking, automated reminders, and branded templates. Try QuoteCore+ free for 14 days." | "Start Free Trial" → `/signup?ref=free-invoice` |

- Only shows once per session (localStorage flag)
- "No thanks, just downloading" dismisses

---

## 5. Usage Limits & Watermark

### Anonymous Users (no login)
- **Limit:** 1 document per tool per day (IP + localStorage tracked)
- **Watermark:** "Created with QuoteCore+ Free Tools — quote-core.com" rendered into PDF canvas
- **Gate:** After first download, show EmailGate modal: "Enter your email for 5 free documents per week + no watermark"

### Logged-in Free Users (mini login)
- **Limit:** 5 documents per tool per week (tracked server-side by user ID)
- **Watermark:** None
- **Banner:** UsageBanner shows remaining uses: "You have 3 free quote downloads left this week"
- **Upsell:** When 1 use left: "Only 1 left — start a free trial for unlimited access"

### Implementation
- Anonymous: `anonymous_usage` table in free-tools Supabase (ip_hash + tool_type + created_at). Count today's entries for this IP.
- Logged-in: `free_tool_users.documents_this_week` counter, reset every 7 days via a cron job or on-read check (if `usage_reset_at < now()`, reset to 0 + set new `usage_reset_at`)
- Watermark: rendered into the PDF canvas as a semi-transparent text overlay before the final jsPDF save

---

## 6. SEO Strategy

### URL Structure (SEO-first)
```
/free-construction-calculator    → "free construction calculator"
/free-quote-generator            → "free quote generator"
/free-purchase-order-generator   → "free purchase order generator"
/free-invoice-generator          → "free invoice generator"
```

### Per-Page SEO
Each page gets:
- **Server component** (`page.tsx`) for SSR/SSG meta tags
- **Title tag:** "Free [Tool Name] — [Key Benefit] | QuoteCore+"
- **Meta description:** Action-oriented, includes primary keyword + "free" + "no signup"
- **OG image:** Auto-generated or static, showing the tool in action
- **Schema.org JSON-LD:** `WebApplication` with `offers: { price: 0 }`, `applicationCategory`
- **Canonical URL**
- **Internal linking:** All 4 tools link to each other + to `/signup`
- **H1:** Primary keyword (e.g. "Free Quote Generator")
- **Content section:** 300-500 words of SEO content below the tool (how it works, use cases, FAQ)

### Sitemap & Robots
- Add all 4 URLs to `app/sitemap.ts` static entries with `priority: 0.9`
- Add all 4 URLs to `robots.ts` allowed paths
- Add `/free-tools/` prefix to allowed paths

### Page Speed
- Calculator: static rendered (no client JS needed for initial paint)
- Document tools: static shell with client-side interactivity (Next.js streaming)
- No heavy dependencies loaded on initial paint
- Images optimized via `next/image`

---

## 7. Mobile-First Design

All tools are designed mobile-first, then enhanced for desktop:

- **Touch targets:** minimum 44×44px
- **Inputs:** large, clear labels, appropriate keyboard types (`inputMode="decimal"`)
- **Layout:** single column on mobile, 2-column on desktop (editor | preview)
- **PDF export:** works on mobile browsers (jsPDF runs client-side)
- **Image upload:** `<input type="file" accept="image/*" capture="environment">` for camera access on mobile
- **Responsive preview:** stacked below editor on mobile, side-by-side on desktop
- **Sticky CTA bar:** bottom of screen on mobile (dismissable)

---

## 8. Phase Plan

### Phase 1: Construction Calculator (1.5 days)
**Dependencies:** None
- [ ] Create `app/(public)/free-construction-calculator/` route
- [ ] Build public layout (header with logo + signup CTA)
- [ ] Add `/free-construction-calculator` to `PUBLIC_PATHS` in middleware
- [ ] Add new math functions to `app/lib/pricing/engine.ts` (or new `calculator.ts`)
- [ ] Build `CalculatorCard` shared component
- [ ] Build all 8 calculator modules
- [ ] Unit toggle (metric/imperial) with shared context
- [ ] SEO: meta tags, schema.org, sitemap, robots
- [ ] Sticky CTA bar linking to `/free-quote-generator`
- [ ] Mobile + desktop responsive QA

### Phase 2: Free-Tools Auth Infrastructure (1.5 days)
**Dependencies:** None (can run parallel to Phase 1)
- [ ] Create second Supabase project (`quote-core-free-tools`)
- [ ] Run schema migrations (free_tool_users, free_tool_documents, anonymous_usage)
- [ ] Configure Google OAuth redirect URI for free-tools project
- [ ] Add env vars to `.env.local` + Vercel
- [ ] Build `app/lib/supabase/free-tools-client.ts` (server + browser clients)
- [ ] Build `app/(public)/free-tools/auth/callback/route.ts`
- [ ] Build `MiniLoginModal.tsx` (Google OAuth + email/password)
- [ ] Build `EmailGate.tsx` modal
- [ ] Build `UsageBanner.tsx` component
- [ ] Build `usageTracking.ts` (check + increment usage)
- [ ] Add `/free-tools` to `PUBLIC_PATHS` in middleware

### Phase 3: AI Quote Generator — Text Prompt (2.5 days)
**Dependencies:** Phase 2
- [ ] Build `app/api/free-tools/parse-document/route.ts` (OpenAI integration)
- [ ] Build `freeToolTypes.ts` shared types
- [ ] Build `parseDocument.ts` client wrapper
- [ ] Build `DocumentEditor.tsx` (generic, parameterised by tool type)
- [ ] Build `DocumentPreview.tsx` (generic preview pane)
- [ ] Build `PromptBox.tsx` (textarea + example prompts + generate button)
- [ ] Build `pdfExport.ts` (extended from `renderPreviewToPdf.ts` with watermark)
- [ ] Build `WatermarkOverlay.tsx`
- [ ] Build `PostDownloadModal.tsx`
- [ ] Build `FreeToolHeader.tsx` + `FreeToolFooter.tsx`
- [ ] Assemble `/free-quote-generator` page
- [ ] Wire up usage tracking + email gate
- [ ] SEO: meta tags, schema.org, sitemap, robots
- [ ] Mobile + desktop responsive QA

### Phase 4: AI Order + Invoice Generators — Text Prompt (2 days)
**Dependencies:** Phase 3 (reuse all shared components)
- [ ] Configure `DocumentEditor` for order type (different header fields, no tax by default)
- [ ] Assemble `/free-purchase-order-generator` page
- [ ] Configure `DocumentEditor` for invoice type (invoice-specific header, payment terms field)
- [ ] Assemble `/free-invoice-generator` page
- [ ] Tool-specific post-download modals
- [ ] SEO for both pages
- [ ] Mobile + desktop responsive QA

### Phase 5: Image Upload (2.5 days)
**Dependencies:** Phase 3
- [ ] Build `ImageUpload.tsx` (file input with camera capture)
- [ ] Add image mode to `/api/free-tools/parse-document` (GPT-4o vision)
- [ ] Image preprocessing: compress, orient, max 10MB
- [ ] Prompt tuning for handwriting recognition
- [ ] Add image upload to all 3 document tool pages
- [ ] QA with various handwriting samples

### Phase 6: In-App Integration (1.5 days)
**Dependencies:** Phase 3
- [ ] Add "AI Generate" button to in-app line-by-line quote editor (`CustomerQuoteEditor.tsx`)
- [ ] Add same to order editor (`OrderLineByLineEditor.tsx`)
- [ ] Add same to invoice editor (`InvoiceEditor.tsx`)
- [ ] Reuse same `/api/free-tools/parse-document` endpoint (behind auth, no rate limit for paid users)
- [ ] Populate editor state from AI response

**Total estimated effort:** ~11.5 days

---

## 9. Reuse Map (What Already Exists)

| Component | Location | Reuse For |
|-----------|----------|-----------|
| Pitch/area math | `app/lib/pricing/engine.ts` | Calculator (all 8 modules) |
| CollapsiblePanel | `app/components/editor/CollapsiblePanel.tsx` | Editor/preview layout |
| PDF pipeline | `app/lib/pdf/renderPreviewToPdf.ts` | PDF export (extend with watermark) |
| OpenAI SDK | `openai` npm package + `OPENAI_API_KEY` | AI parsing (text + vision) |
| Rate limiting | `consume_rate_limit()` RPC (main DB) | Anonymous rate limiting (or new table in free-tools DB) |
| Design system | `docs/DESIGN_SYSTEM.md` | All UI — buttons, cards, inputs, badges |
| GoogleSignInButton | `app/components/auth/GoogleSignInButton.tsx` | Pattern for mini login (adapted for free-tools Supabase) |
| (public) route group | `app/(public)/docs/` | Route structure template |
| Sitemap/robots | `app/sitemap.ts`, `app/robots.ts` | Add free tool URLs |
| QuoteLine model | `CustomerQuoteEditor.tsx` | Basis for `FreeDocumentLine` type |
| LineByLineItem | `material-orders/lineByLine.ts` | Basis for `FreeDocumentLine` type |
| InvoiceLineRow | `InvoiceEditor.tsx` | Basis for `FreeDocumentLine` type |
| Supabase server client pattern | `app/lib/supabase/server.ts` | Pattern for free-tools client |

---

## 10. Key Architectural Decisions

1. **Single generic DocumentEditor** — not 3 separate editors. Parameterised by `toolType`, the editor renders different header fields and default settings. Reduces code duplication, makes bug fixes apply to all 3 at once.

2. **localStorage for anonymous, Supabase for logged-in** — anonymous users get their document auto-saved to localStorage so a refresh doesn't lose work. Logged-in users get server-side persistence in `free_tool_documents`.

3. **Watermark at PDF generation time** — not a DOM overlay. The watermark is drawn into the jsPDF canvas as semi-transparent text before the final save. This means the watermark is in the PDF itself, not just the on-screen preview.

4. **Free-tools Supabase project is separate** — not a second schema in the same project. Complete isolation, no auth.users conflict, clean data for marketing.

5. **Same Google OAuth, two redirect URIs** — the Google Cloud project has two authorized redirect URIs. Each Supabase project handles its own callback independently.

6. **No middleware auth for free tools** — free tool routes are in `PUBLIC_PATHS`. The main app middleware doesn't check for a SaaS session. Free-tool auth is checked at the component level using the free-tools Supabase client.

7. **Phase 1 (calculator) has zero API dependency** — it can be built and shipped immediately while the auth infrastructure (Phase 2) is being set up in parallel.

8. **AI prompt returns structured JSON** — not free text. GPT-4o's `response_format: { type: "json_object" }` ensures we get a predictable schema that maps directly to `FreeDocumentLine[]`.

---

## 11. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| GPT-4o misparses handwritten documents | Medium | Medium | Confidence field in response, warnings array, user can edit all lines manually |
| Free tools cannibalize SaaS signups | Low | Medium | Usage limits + watermarks + aggressive trial CTAs ensure free users hit upgrade prompts |
| Second Supabase project adds operational complexity | Low | Low | Free tier covers early volume, simple schema, minimal tables |
| SEO competition is fierce for "free invoice generator" | High | Low | Differentiate with AI + image upload + mobile-first + professional output. Most competitors are basic templates. |
| Image upload abused for non-document content | Medium | Low | Rate limiting + content moderation via OpenAI's built-in safety + max file size |
| PDF export fails on mobile | Low | High | jsPDF is client-side, works on all modern browsers. QA with real devices. |

---

## 12. Future Enhancements (Post-Launch)

- **Email me these results** — calculator results emailed (email capture)
- **Save calculation history** — free account feature
- **Interactive roof diagram** — SVG that redraws with calculator inputs
- **Multi-page documents** — quotes/orders/invoices with page breaks
- **Template gallery** — pre-made templates for common trades (roofing, plumbing, electrical)
- **Branded PDFs** — upload logo for watermark-free, branded PDFs (email-gated)
- **Mobile app** — React Native or PWA wrapping these tools
- **Bulk AI import** — paste a list of 10 quotes, AI processes all at once
- **API access** — let other apps use our calculator/AI parsing (paid API tier)
