# Calculator Conversion Popups — Spec

> Created: 2026-07-11
> Status: PLANNING (not yet built)
> Goal: Every calculator interaction leads to a potential new user in the app.

## Design Principles

1. **Popups show the calculation result** — they're useful, not just ads. The user sees their number AND a CTA.
2. **One popup per calculation** — don't spam. If they dismiss, don't re-show on the same tab.
3. **Progressive disclosure** — each stage promotes the NEXT stage only, not all stages at once.
4. **Non-registered users** see the full funnel. **Registered users** see in-app CTAs instead (e.g. "Save to quote").

## Conversion Funnel

```
Calculator (free, no signup)
  ↓ on calculation result
  Popup: "Your result: X. Want to add this to a free quote?"
  → /free-quote-generator (pre-filled with calculation)
  
Quote Generator (free, no signup)
  ↓ on quote creation
  Popup: "Your quote is ready. Want to turn it into an order or invoice?"
  → /free-purchase-order-generator or /free-invoice-generator

Smart Component (free, no signup)
  ↓ on component creation
  Popup: "Your component is ready. Create a free account to save and reuse it."
  → /signup?ref=<calculator-slug>

Order/Invoice Generators (free, no signup)
  ↓ on completion
  Popup: "Want to manage all your quotes, orders, and invoices in one place?"
  → /signup?ref=<tool-slug>
```

## Popup Component

### `CalcResultPopup.tsx` (to be built)

A reusable modal that:
- Renders as a centered overlay with `backdrop-blur-sm bg-black/40` (matches app modal pattern)
- Shows the calculation result in a highlighted box (the useful part)
- Has a primary CTA button (the funnel action)
- Has a secondary "Maybe later" dismiss button
- Has a small "No thanks, just show me the result" link
- Tracks dismissal in `sessionStorage` so it doesn't re-appear on every calculate

### Props

```ts
interface CalcResultPopupProps {
  /** The calculation result to display (the useful part) */
  resultLabel: string;        // e.g. "122.1 m² roof area"
  resultDetails?: string;     // e.g. "Plan: 100 m² × 1.221 pitch factor"
  /** Primary CTA */
  ctaText: string;            // e.g. "Add to a free quote"
  ctaHref: string;            // e.g. "/free-quote-generator?area=122.1&ref=free-roofing-calculator"
  /** Secondary text */
  secondaryText?: string;     // e.g. "Takes 2 minutes, no signup needed"
  /** Which stage this popup is for */
  stage: 'calc-to-quote' | 'quote-to-order' | 'smart-to-signup' | 'order-to-signup';
  /** Storage key for dismissal tracking */
  storageKey: string;
}
```

## Trigger Points

### 1. Calculator → Quote (on calculation result)

**When:** User clicks "Calculate" on any calculator tab (Area, Rafter, Batten, Volume, etc.)
**Show:** After result renders, 1.5s delay (let them read the result first)
**Content:**
- Result: "Your result: 122.1 m² roof area"
- CTA: "Add this to a free quote →"
- Secondary: "Turn measurements into a professional quote in 2 minutes"
- Link: `/free-quote-generator?area=122.1&pitch=35&ref=free-roofing-calculator`

**Dismissal:** sessionStorage key `popup-calc-quote-<slug>`, shows once per session per calculator.

### 2. Quote → Order/Invoice (on quote creation)

**When:** User generates a quote on `/free-quote-generator`
**Show:** After quote renders, 1s delay
**Content:**
- Result: "Your quote: £4,250.00 for [customer name]"
- CTA: "Turn into an order form →" or "Create an invoice →"
- Secondary: "Send a professional invoice and get paid faster"
- Link: `/free-invoice-generator?from=quote&ref=free-quote-generator`

**Dismissal:** sessionStorage key `popup-quote-order`, shows once per session.

### 3. Smart Component → Signup (on component creation)

**When:** User builds a Draft Smart Component and clicks "Calculate"
**Show:** After result renders, 1.5s delay
**Content:**
- Result: "Your component: Concrete tiles — £2,750.00 (122 m² × £22.50/m²)"
- CTA: "Save this component — start free trial →"
- Secondary: "Reuse on every quote, save your pricing rules, manage jobs"
- Link: `/signup?ref=free-roofing-calculator&component=Concrete+tiles`

**Dismissal:** sessionStorage key `popup-smart-signup-<slug>`, shows once per session.

### 4. Order/Invoice → Signup (on completion)

**When:** User creates an order or invoice on the free generators
**Show:** After document renders, 1s delay
**Content:**
- Result: "Your invoice: INV-001 for £4,250.00"
- CTA: "Manage all quotes, orders & invoices →"
- Secondary: "Start free trial — full quoting, takeoff, and job management"
- Link: `/signup?ref=free-invoice-generator`

**Dismissal:** sessionStorage key `popup-order-signup`, shows once per session.

## Implementation Plan

### Phase 1: Build the popup component
1. Create `CalcResultPopup.tsx` — reusable modal component
2. Add to `TradeCalculator.tsx` context — track calculation state
3. Wire into AreaTab, MembersTab, BattenTab, VolumeTab — trigger after calculate

### Phase 2: Wire up the funnel
1. Add URL params to `/free-quote-generator` for pre-fill from calculators
2. Add popup to `/free-quote-generator` for quote → order/invoice
3. Add popup to Smart Component tab for component → signup
4. Add popup to `/free-invoice-generator` and `/free-purchase-order-generator`

### Phase 3: Registered user flow
1. If user is logged in, replace popups with in-app CTAs:
   - "Save to quote" → opens quote editor in app
   - "Save component" → saves to their component library
   - "Create order from quote" → opens order editor
2. Detect auth state via Supabase session

## URL Param Convention

When funneling from calculator → free tool, pass calculation context:

```
/free-quote-generator?area=122.1&pitch=35&ref=free-roofing-calculator
/free-invoice-generator?amount=4250&ref=free-quote-generator
/signup?ref=free-roofing-calculator&component=Concrete+tiles
```

The free tools read these params to pre-fill their forms, making the funnel frictionless.

## UX Notes

- **Never block the result.** The calculation result must be visible before the popup appears. 1-1.5s delay.
- **Mobile-first.** Popups must be full-width on mobile, not tiny centered modals.
- **Dismiss = respected.** Once dismissed, don't re-show in the same session. Don't add "Are you sure?".
- **Value first.** The popup title should be the result, not the CTA. "122.1 m² roof area" not "Sign up now".
- **A/B ready.** Build with configurable delay, CTA text, and trigger conditions so we can test variations later.
