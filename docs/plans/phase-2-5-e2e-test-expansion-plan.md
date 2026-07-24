# QuoteCore+ E2E Test Expansion Plan — Phases 2-5

**Author:** Gavin  
**Date:** 2026-07-24  
**Purpose:** Expand E2E coverage from 30 smoke tests to ~80 tests across 4 phases, prioritised by break-risk and customer impact. Each phase is 12-15 tests, built and verified one at a time.

**Goal:** Users rarely encounter bugs. Pre-pressure-test the app so problems are found before customers hit them. Every test covers something that **could break in production** and **would cost us a customer if it did**.

---

## Phase 2: Quote Builder & Calculations (12 tests)

**Why first:** The quote builder is the core product. If calculations are wrong or the builder crashes, users lose trust instantly. This is the highest-risk area.

| # | Test | What it catches | Risk if broken |
|---|------|-----------------|----------------|
| 2.1 | Create quote → add standard line item → verify subtotal/tax/total | Calculation engine returns wrong numbers | Customer quotes have wrong prices — legal/financial risk |
| 2.2 | Create quote → add component-based line item (from catalogue) → verify component quantities + waste factor | Waste factor misapplied or component quantities wrong | Material orders based on wrong quantities — cost blowouts |
| 2.3 | Quote with multiple line items → reorder via drag → verify totals unchanged on reorder | Reorder corrupts line item data or totals | Quotes look correct but internal data is scrambled |
| 2.4 | Quote → edit existing line item quantity → verify totals recalculate | Edit doesn't trigger recalc | Stale totals shown to customer |
| 2.5 | Quote → delete line item → verify totals recalculate and item is gone | Delete leaves ghost item or doesn't recalc | Customer sees deleted items in their quote |
| 2.6 | Quote → apply discount (percentage) → verify discounted total | Discount math wrong or not applied | Wrong pricing sent to customer |
| 2.7 | Quote → apply discount (fixed amount) → verify discounted total | Fixed discount off by cents or applied to wrong base | Pricing errors compound across many quotes |
| 2.8 | Quote → change tax rate → verify all line items reflect new rate | Tax only applies to some items or rounds incorrectly | Tax compliance issues |
| 2.9 | Quote → save → reload → verify ALL line items, quantities, rates, totals persist | Partial save — some fields lost on reload | User reopens quote and half their work is gone |
| 2.10 | Quote → duplicate/clone → verify clone has identical structure | Clone misses items or duplicates IDs | Duplicated quotes are corrupted |
| 2.11 | Quote builder → add custom (non-catalogue) line item with manual price → verify totals | Custom items bypass calculation pipeline | Manual items not included in totals |
| 2.12 | Quote → exceed Starter plan quote limit (25) → verify paywall/block | Quota not enforced | Users create unlimited quotes on cheap plans |

---

## Phase 3: Takeoff & Measurement Flow (13 tests)

**Why second:** Takeoff is the most complex UI in the app (Fabric.js canvas, scale calibration, area drawing, component assignment). It has the most moving parts and the highest chance of subtle breakage.

| # | Test | What it catches | Risk if broken |
|---|------|-----------------|----------------|
| 3.1 | Open takeoff → upload plan image → verify image renders on canvas | Upload fails or image doesn't render | User can't start takeoff at all |
| 3.2 | Calibrate scale (draw known distance → enter real measurement) → verify scale stored | Calibration doesn't persist or uses wrong units | All subsequent measurements are wrong |
| 3.3 | Draw rectangular roof area → verify area calculation (m²) correct | Area math wrong | Wrong material quantities |
| 3.4 | Draw polygon roof area → verify area calculation correct | Polygon area formula wrong | Irregular roofs get wrong quantities |
| 3.5 | Draw multiple areas on same plan → verify each area has independent measurements | Areas bleed into each other or share state | Cross-contamination between roof areas |
| 3.6 | Assign component to area → verify component quantity = area × waste factor | Component-to-area link broken | Components quantified against wrong area |
| 3.7 | Save takeoff → reload → verify all areas, measurements, components persist | Takeoff save is partial (the known re-save bug) | User loses all takeoff work on reload |
| 3.8 | Switch between multiple pages (multi-plan) → verify each page keeps its own areas | Page switching corrupts or loses areas | Multi-plan takeoffs lose data |
| 3.9 | Delete a roof area → verify its components are also removed | Orphaned components left behind | Ghost components inflate material orders |
| 3.10 | Edit existing area measurement (resize) → verify component quantities update | Resize doesn't propagate to components | Stale component quantities after area edit |
| 3.11 | Add pitch to area → verify pitched area calculation (slope-adjusted) correct | Pitch math wrong or not applied | Underestimates materials on pitched roofs |
| 3.12 | Takeoff → close browser tab mid-edit → reopen → verify auto-save recovered state | Auto-save not working or recovers stale state | User loses unsaved takeoff work |
| 3.13 | Takeoff → two browser tabs open same quote → edit in tab A → switch to tab B → verify tab B doesn't overwrite | Optimistic concurrency — tab B clobbers tab A's changes | Silent data loss from concurrent edits |

---

## Phase 4: Document Lifecycle & Customer-Facing Surfaces (14 tests)

**Why third:** Quotes and invoices are what customers actually see. Broken send flows, wrong public links, or corrupted PDFs directly damage credibility.

| # | Test | What it catches | Risk if broken |
|---|------|-----------------|----------------|
| 4.1 | Create quote → send to customer via email → verify email received (mock SMTP or check sent status) | Send flow silently fails | Customer never receives quote |
| 4.2 | Open public quote link (acceptance URL) → verify quote renders correctly for unauthenticated user | Public link broken or shows wrong data | Customer can't view their quote |
| 4.3 | Public quote link → customer accepts quote → verify status changes to "accepted" in app | Acceptance doesn't register | Accepted quotes stay in "sent" forever |
| 4.4 | Public quote link → verify customer CANNOT edit prices or line items | Public view is editable | Customer can tamper with their own quote |
| 4.5 | Create invoice from accepted quote → verify invoice inherits correct line items + totals | Invoice creation drops items or changes totals | Invoice doesn't match what customer agreed to |
| 4.6 | Send invoice → verify invoice public link works | Invoice link broken | Customer can't pay their invoice |
| 4.7 | Create material order from quote → verify order has correct component quantities | Order creation misquotes component counts | Wrong materials ordered → job delays |
| 4.8 | Quote → withdraw (unsend) → verify public link no longer works | Withdrawn quotes still accessible | Customer sees quote after it was withdrawn |
| 4.9 | Quote → reissue after withdrawal → verify new public link works and old stays dead | Reissue reactivates old link or creates duplicate | Confusion from multiple active links |
| 4.10 | Generate PDF of quote → verify PDF has correct content (customer name, line items, totals) | PDF generation drops data or uses wrong template | Unprofessional PDF sent to customer |
| 4.11 | Invoice → mark as paid → verify status + paid date recorded | Payment status doesn't persist | Paid invoices show as outstanding |
| 4.12 | Quote follow-up scheduled → verify follow-up fires at correct time (mock time advance) | Follow-up scheduler doesn't fire or fires too early | Customers spammed or never chased |
| 4.13 | Customer receives quote → visits link on mobile → verify responsive layout works | Public page broken on mobile | 60%+ of customers view on phone |
| 4.14 | Expired quote link (past expiry date) → verify link shows "expired" not crash | Expired links 500 instead of graceful message | Customer sees error page instead of expired notice |

---

## Phase 5: Edge Cases, Destructive Inputs & Real-World Chaos (13 tests)

**Why last:** These are the weird things real users do that developers never anticipate. This phase catches the "how did they even manage to break it that way?" bugs.

| # | Test | What it catches | Risk if broken |
|---|------|-----------------|----------------|
| 5.1 | Quote customer name with special characters (emojis, <script>, unicode) → verify saves and renders safely | XSS or encoding corruption | Security vulnerability or garbled data |
| 5.2 | Quote with 100+ line items → verify page doesn't crash and totals are correct | Performance degradation or render failure with large datasets | Power users with big quotes locked out |
| 5.3 | Line item with 0 quantity → verify handled gracefully (not NaN, not infinity) | Division by zero or null propagation | Corrupted totals spread to other items |
| 5.4 | Line item with negative price → verify blocked or handled | Negative values create "negative total" quotes | Exploit: quotes that subtract money |
| 5.5 | Upload 50MB plan image → verify takeoff handles it without crash | Large image OOM or canvas failure | Users with high-res plans can't use takeoff |
| 5.6 | Rapid-fire: create quote, immediately delete, immediately recreate same name → verify no conflict | Race condition in create/delete | Database constraint errors shown to user |
| 5.7 | Browser back button during quote creation → verify no data corruption | Back button triggers stale form submit | Duplicate quotes or lost work |
| 5.8 | Paste rich text into quote notes → verify stripped to plain text | Rich text breaks PDF generation or HTML rendering | Garbled PDFs sent to customers |
| 5.9 | Two users in same company editing same quote simultaneously → verify last-save-wins doesn't corrupt | Concurrent edit race condition | Silent data loss — one user's work vanishes |
| 5.10 | Company slug with special characters → verify URL routing works | URL encoding breaks workspace routing | User locked out of their own workspace |
| 5.11 | User logs in → session expires mid-edit → verify graceful redirect, not data loss | Expired session destroys unsaved work | User loses 20 minutes of quote building |
| 5.12 | Offline → online transition during quote save → verify save retries or warns | Network flakiness causes silent save failure | User thinks work is saved but it isn't |
| 5.13 | Change company trade type (roofing → general) → verify takeoff UI adapts (roofing features hidden) | Trade-specific UI doesn't toggle correctly | Non-roofing users see irrelevant roofing tools |

---

## Summary

| Phase | Focus | Tests | Cumulative | Key Risk Mitigated |
|-------|-------|-------|------------|-------------------|
| 2 | Quote Builder & Calculations | 12 | 42 | Wrong pricing, lost quote data |
| 3 | Takeoff & Measurement Flow | 13 | 55 | Wrong measurements, lost takeoff work |
| 4 | Document Lifecycle & Customer-Facing | 14 | 69 | Broken customer experience, send failures |
| 5 | Edge Cases & Real-World Chaos | 13 | 82 | Weird user behaviour, security, data corruption |

## Build Approach

- Build one phase at a time, verify all pass before moving to next
- Each new batch runs locally first, then CI
- If a test reveals a real bug, fix the bug before adding more tests
- Update this plan with actual results (pass/fail/bug-found) as we go

## What This Plan Does NOT Cover (Intentional)

- **Stripe billing flows** — requires test cards and webhook mocking, separate effort
- **Real AI takeoff scans** — costs money per run, needs dedicated canary suite
- **Google OAuth login** — requires real Google session, manual testing only
- **Mobile device testing** — Chromium desktop only for now; mobile emulation is a future phase
- **Performance/load testing** — different toolset (k6/Locust), not Playwright's strength
- **Cross-browser testing** — Firefox/Safari support is a future consideration

---

**Reviewing for Gerald:** Look for gaps in coverage, test scenarios that don't match real user behaviour, missing edge cases within each phase, and any ordering issues (should a later phase be prioritised earlier). Also check whether the "what this doesn't cover" list is missing anything critical.
