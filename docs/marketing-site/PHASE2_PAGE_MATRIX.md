# Phase 2 — Page Matrix

## Tier A — substantial rewrite / enhancement

These are the highest-value pages and should receive meaningful structural/copy updates, not token mentions.

### 1. `/roofing-estimating-software`
File: `app/(marketing)/roofing-estimating-software/page.tsx`

**Keep:** roofing estimating search intent, existing measurement -> Smart Components -> quote explanation, realistic “not a fit” sections, related links.

**Add/strengthen:**
- phone/tablet/desktop estimating workflow
- the three input paths: measure / enter existing measurements / ask Assistant
- field-to-office continuity: site measurement can become pricing/quote without re-entry
- Smart Assistant as an optional faster way to retrieve/change supported information
- one realistic conversational example, not a list of gimmicks

**Do not:** make the H1 about AI; imply Assistant performs unsupported takeoff geometry work.

### 2. `/roofing-quoting-software`
File: `app/(marketing)/roofing-quoting-software/page.tsx`

**Keep:** roofing quoting intent and connected quote/order/invoice workflow.

**Add/strengthen:**
- create/review/manage quotes from mobile as well as desktop
- use measurements and saved pricing rules rather than rebuilding a quote
- Assistant can reduce navigation for supported quote/account tasks
- user control/confirmation around consequential actions

### 3. `/roofing-takeoff-software`
File: `app/(marketing)/roofing-takeoff-software/page.tsx`

**Keep:** takeoff intent, PDF/plan measurement, distinction between takeoff and estimating.

**Add/strengthen:**
- full mobile takeoff capability explicitly
- phone/tablet/desktop use cases
- staged AI workflow: scan -> review/correct -> component detection where supported
- downstream connection to pricing and quote

**Assistant should be secondary here.** Do not imply a conversational assistant replaces drawing/verification unless current product capability proves that.

### 4. `/construction-quoting-software`
File: `app/(marketing)/construction-quoting-software/page.tsx`

**Keep:** broader measured-trades/contractor intent and roofing-first credibility.

**Add/strengthen:**
- measurement-driven quoting from site or office
- mobile + desktop workflow
- Assistant as a way to retrieve/work with jobs and documents without navigating every screen
- preserve simplicity/no-CRM-bloat positioning

### 5. `/construction-takeoff-software`
File: `app/(marketing)/construction-takeoff-software/page.tsx`

**Keep:** broad construction takeoff intent; roofing/siding-cladding/flooring examples.

**Add/strengthen:**
- mobile takeoff
- measure directly or use measurements from another source
- transition from quantities to pricing/quote
- only light Assistant treatment

### 6. `/features`
File: `app/(marketing)/features/page.tsx`

This page should become the clearest non-homepage expression of the V2 product model.

**Replace/rework the current “Four ways to quote” hierarchy.** The new primary mental model is:

1. Measure it
2. Enter measurements
3. Ask Smart Assistant

The existing blank/custom/line-by-line quoting path can remain as a supporting capability, but it should not compete with the three core interaction modes.

Add Smart Assistant to the feature story without pretending a dedicated Assistant page exists yet.

Keep measurement -> pricing -> quote as the dominant workflow. Orders/invoices/sending/tracking remain downstream capability.

## Tier B — focused feature-page upgrades

### 7. `/features/digital-roof-takeoff`
File: `app/(marketing)/features/digital-roof-takeoff/page.tsx`

- make phone/tablet/desktop capability explicit
- remove any desktop-centric implication
- explain manual takeoff + AI-assisted path clearly
- keep review/control language
- connect result to Smart Components/pricing/quote

### 8. `/features/ai-scan-assist`
File: `app/(marketing)/features/ai-scan-assist/page.tsx`

- reflect current staged workflow accurately
- make mobile capability explicit
- avoid “magic AI” language
- emphasize scan -> review/correct -> continue
- keep human verification prominent

### 9. `/features/smart-components`
File: `app/(marketing)/features/smart-components/page.tsx`

- retain reusable pricing logic as the core story
- explain that Smart Assistant becomes more useful because it can work with the user’s saved components/rates/rules
- avoid implying Assistant invents pricing logic
- reinforce “your logic, reused”

## Tier C — downstream capability pages, lighter updates

### 10. `/features/sending-and-tracking`
File: `app/(marketing)/features/sending-and-tracking/page.tsx`

- add a short mobile/Assistant section only where verified
- examples may include finding quote status or surfacing items needing attention
- do not overclaim autonomous follow-up behavior beyond existing automation/product truth

### 11. `/features/material-ordering`
File: `app/(marketing)/features/material-ordering/page.tsx`

- reinforce quote -> order continuity
- optionally mention Assistant can work with orders if verified from current code/product truth
- keep ordering intent primary

### 12. `/features/invoicing`
File: `app/(marketing)/features/invoicing/page.tsx`

- reinforce accepted quote -> invoice continuity
- optionally mention Assistant retrieval/status actions if verified
- keep invoicing intent primary

## Tier D — inspect, change only if useful

### `/done-for-you-setup`
File: `app/(marketing)/done-for-you-setup/page.tsx`

This page already aligns with the strategy that users should not have to rebuild their estimating process alone. Only update it if a concise addition about mobile/Assistant setup materially improves the page. Do not turn it into a V2 launch page.

## Demo terminology in this phase

The existing `DemoCTACard` and `/takeoff-demo` represent the **Roofing Takeoff Demo** only.

Do not call it the App Demo in code, metadata, copy, comments or documentation.

Do not rebuild its functionality in this phase. If you discover public copy that misleadingly implies it is a full QuoteCore+ demo rather than a takeoff demo, flag or correct that wording only if doing so will not unintentionally modify the frozen homepage via a shared component.

## Explicitly out of scope

- root homepage redesign/copy migration
- all free-tool functionality/mobile recoding
- future App Demo build
- new Assistant landing page
- new mobile landing page
- broad blog rewrite
- competitor page rewrite
- pricing/tier redesign
- app-side code
