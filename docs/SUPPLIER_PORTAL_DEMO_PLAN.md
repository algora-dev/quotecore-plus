# Supplier Pricing Portal - Full Product Demo Plan (FINAL v3)

**Created:** 2026-08-25 | **Finalized:** 2026-08-25 (Shaun-approved corrections applied)
**Status:** Ready for implementation in a fresh session
**Scope:** Standalone demo app. NOT deployed to quote-core.com until Shaun approves. Borrows code/logic/style from existing free tools.

---

## What This Is

A standalone, supplier-branded tool combining three existing products:

1. **Digital takeoff tool** - measure from a plan (existing roofing takeoff flow)
2. **Measurement-to-quote tool** - measurements already in hand: plan measurements (pitch conversion) or actual/site measurements
3. **Supplier takeoff/pricing tool** - supplier products, pricing, branding applied to measured quantities

Supplier pitch: **"We can build this for you."**

This is a **base template** - one codebase from which we can build many per-supplier versions. Each real customer gets preferences gathered post-demo and their own standalone build (they may differ in measurement type, unit selection, etc.). For the demo: one fictional supplier, hardcoded config.

**Two commercial versions (same core codebase/config):**
- **Powered by QuoteCore+** - supplier branding + QuoteCore+ presence + path into the main app
- **Full white-label** - supplier branding only, no QuoteCore+ presence or signup route. Higher upfront + monthly cost.

**Hard rule:** the tool is FULLY usable without logging in. Anonymous = complete flow, baseline/public pricing. Optional login only ever changes pricing (blanket discount % or different catalog), and only if the supplier has that capability enabled.

---

## Core User Flow - Google-Form Style

### Step 0: Login / Pricing Context
- Google OAuth OR email/password (supplier can create a customer's email account; customer sets password via magic-link flow we already have)
- Anonymous always allowed (baseline pricing)
- Login can be required only to: reveal trade pricing, save work, send an order, convert/save into QuoteCore+
- App resolves: supplier, customer pricing tier (baseline / discount % / named price list)
- Measurement unit hardcoded per supplier instance - NO unit selector in the flow

### Step 1: How do you want to price this job?
- **A. "I need to measure a plan"** → upload plan, existing AI/manual takeoff, multiple roof areas allowed, pitch applied, measure placeholder groups (ridge/hip/barge/valley/spouting etc) → outputs a Measurement Set
- **B. "I already have my measurements"** → sub-choice:
  - **Plan measurements** - enter plan areas + pitch, system converts using existing pitch logic; lineal/count entered normally
  - **Actual/site measurements** - enter real-world values, no pitch conversion

### Converged Measurement Set
All three entry paths converge into ONE shared data structure before pricing:
- Roof Areas (Area 1: 82.4 m², Area 2: 41.7 m²...)
- Ridges, Hips, Valleys, Barges, Spouting... (lineal entries)
- Only populated groups appear in the pricing flow
- Do NOT build separate downstream pricing systems per entry path

---

## Product Assignment Flow (grouped by measurement group)

Step sequence: Roof Areas → Ridges → Hips → Valleys → Barges → Spouting → Review/Output (populated groups only).

### Standard Mode (default)
- Show measured entries + total per group
- Apply one or more supplier products to the WHOLE group (e.g. Roof Areas: tile + underlay + fixings; Ridges: dry ridge system + ridge tiles + fixings)
- Multiple products per group: YES (required in both modes)
- Labour, waste, and per-entry assignment hidden in Standard

### Advanced Mode
- Persistent Standard/Advanced toggle (persists across steps until manually changed; hover help text)
- Adds:
  1. **Per-entry product assignment** - e.g. different ridge products on specific ridge entries
  2. **Per-product editing** - labour rate, waste settings (existing component editor logic), quantity override, price override ONLY if supplier config allows
- Expands inside the same step, not a separate workflow

### Product Selection
- Products carry: name, code/SKU, measurement basis (area/lineal/count), applicable measurement groups, unit price
- Group step shows ONLY products valid for that group (search by name/code, suggested first)
- Add custom item escape hatch

---

## Trade Pricing

Engine supports:
1. Baseline/public price
2. Blanket customer discount %
3. Named customer price list / separate catalog

Supplier config determines display: trade price throughout the flow, or revealed only in final output, or hidden until login. Final output can show: Standard materials price / Your trade price / Your saving.

---

## Final Output + Actions

Output = materials breakdown (product, code, calc quantity, waste-adjusted purchase quantity, unit price, line total) + labour (if Advanced labour added) + baseline/trade totals + saving. NO markup/margin in this flow.

Actions:
- **Request supplier quote** - send output details to supplier
- **Send order / order request** - product codes + quantities + customer/job info (MVP: an order REQUEST, not live ecommerce)
- **Convert to customer quote** - uses the **FREE QUOTE GENERATOR** (free tool version, NOT the in-app quote system) as the interim approach. Long-term: build a new, more advanced free quote generator dedicated to this tool, which will itself become the new public free quote generator. Quote is a separate editable document state: markup/margin, line editing, hide prices/details, custom header/footer, branding per config, PDF/email. Two document states: tool output → converted customer quote.
- **Continue/save in QuoteCore+** (Powered-by only; suppressed in white-label) - preserve job/output/products/catalog association so the user never rebuilds after signup

---

## Architecture & Reuse

Standalone Next.js project (same stack: Next 16, React 18, TS, Tailwind 4, Supabase). Copied code (not npm-linked) so per-supplier instances can diverge. Long-term: one configurable core platform, no permanent bespoke forks.

| Piece | Source | Notes |
|---|---|---|
| Google-form step shell | measurement-to-quote-tool flow pattern | Main shell |
| Digital takeoff | `@quote-core/roof-takeoff` tarball + SharedTakeoffBuilder | Plan upload, canvas, pitch, AI/manual |
| Manual entry + pitch logic | measurement-to-quote-tool (BuilderStep, calc.ts, csv-import) | Strip unit selector |
| Product editor calcs (labour/waste) | ComponentEditorModal.tsx + calc.ts | Reuse existing maths, Advanced mode |
| Convert to quote | **FREE quote generator** (`app/(public)/free-quote-generator`) | Port; template with supplier branding/watermark |
| Auth | Free-tools auth (unified Supabase, Google OAuth + magic-link set-password) | **Gotchas: resend signup email after createUser; standalone domain needs its own Google OAuth client/redirect config (known branding gotcha)** |
| Branding/template | New lightweight theming layer (supplier config: colours, logo, watermark, powered-by flag) | Built fresh in this project |

New build: shared Measurement Set, Standard/Advanced state, group product assignment, trade pricing resolution, order/quote-request output, supplier config.

### Data model (conceptual)
- **Supplier**: identity, branding, unit, mode (powered_by | white_label), price-edit policy, trade-price display policy
- **Supplier Product**: supplier_id, name, code, measurement_basis, applicable_groups[], unit price, price_editable flag
- **Measurement Set**: job/session id, groups, entries, converted values, pitch metadata
- **Applied Product**: group OR specific entry + product + calc quantity + waste/labour settings + price override
- Chain: **Measurement → Measurement Group → Supplier Product → Applied Product Calculation**
- Customers: email, auth id, supplier_id, pricing (discount % | price list)

---

## Build Phases

### Phase 1 - Skeleton + Manual Actual-Measurement Flow
New project, Google-form shell, "I already have measurements" → actual/site entry, Measurement Set, populated groups only, Standard mode multi-product assignment, seed demo catalog, calc + final output.
**Exit:** enter actual measurements → assign multiple products per group → correct material-priced output.

### Phase 2 - Advanced Mode
Persistent toggle, help text, per-entry assignment, product editor (labour/waste/qty override/supplier-permitted price edit) using existing calc logic.
**Exit:** same flow completable in Standard, then re-done with Advanced per-entry control.

### Phase 3 - Plan Measurements + Digital Takeoff
Manual plan entry + pitch conversion; digital takeoff ported; all three paths converge into the same Measurement Set and pricing flow.
**Exit:** all three entry paths produce identical downstream pricing experience.

### Phase 4 - Final Actions + Quote Conversion
Output formatting, trade-pricing display placeholders, request supplier quote, order request, **convert-to-quote via free quote generator (ported + supplier-branded template)** carrying line items/pricing correctly; markup/margin/editing in quote step; Continue-in-QuoteCore+ stub.
**Exit:** measurement → pricing → output → supplier request OR editable customer quote. **Pitchable here - do not wait for admin.**

### Phase 5 - Supplier Branding + Trade Pricing + Auth
Branding config, powered-by/white-label flag, Google/email auth (incl. new OAuth client for standalone domain), anonymous baseline, customer recognition, discount % + named price lists, configurable trade-price visibility.
**Exit:** supplier-branded demo where anonymous pricing differs from logged-in trade pricing.

### Phase 6 - Supplier Admin / Production Controls
Supplier staff login, customer management, catalog CRUD, product applicability, price lists, branding controls, price-edit/display settings, branch/location prep.
**Exit:** supplier self-serves config without us editing the DB.

### Phase 7 - Polish + Demo Data
Strong fictional supplier dataset (multiple ridge/barge/valley/hip/tile/underlay/spouting options), mobile pass, empty/error/loading states, demo reset + test accounts, white-label vs powered-by presentation pass, full E2E of all three paths.
**Exit:** stable for repeated demos and pilot onboarding.

---

## Decisions Confirmed
1. Multiple products per measurement group: YES (both modes)
2. Standard default; Advanced persists until manually changed
3. Per-entry assignment: Advanced only
4. Labour + waste editing: Advanced only
5. Product price editing: supplier-config controlled
6. Markup/margin: NOT in the pricing flow - after Convert to Quote (free quote generator)
7. Three entry paths converge into one Measurement Set + one pricing flow
8. Tool output and customer quote are separate document states
9. Supplier admin: later priority; pitchable demo comes first
10. White-label vs Powered-by: same core product/config; no permanent forks
11. Anonymous use: full tool, always; login only modifies pricing/catalog
12. Demo config hardcoded (unit etc.); per-supplier preferences gathered after they bite on the demo

## What NOT to Build Yet
Supplier billing/payments; live ecommerce ordering; custom domains; public listing on quote-core.com; deep main-app integration beyond the minimum Continue-in-QuoteCore+ path; branch logic; supplier analytics; bespoke features not needed for demo/pilot.

## Primary Product Principle
- **Standard:** fast materials pricing with minimal effort - quantities → products → pricing
- **Advanced:** detailed job costing - per-entry products, labour, waste, overrides, output, optional quote conversion
- Standard must never feel burdened by Advanced functionality.
