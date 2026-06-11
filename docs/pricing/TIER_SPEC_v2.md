# QuoteCore+ Tier Spec v2 (DRAFT — pending Shaun sign-off)

> Status: **DRAFT for review.** No billing code changes until Shaun approves.
> Locked rules: per `MEMORY.md ## PRICING`, the Stripe Price IS the price; any price change = new Stripe Price + matching `price_cents_monthly` + drift-check. This doc is the *plan/feature* spec; the price-change mechanics are unchanged.
>
> Scope: Free Trial · Free · Starter · Pro. (`growth` tier to be **removed/deactivated** per Shaun 2026-06-11. `pro_plus` and above unchanged / out of scope here.)

---

## 1. Headline ladder (the story)

| Tier | Price | One-line | What unlocks vs the tier below |
|------|-------|----------|--------------------------------|
| **Free Trial** | $0 / 14 days | "Try the whole app" | Everything on, modest caps |
| **Free** | $0 / forever | "Make & send quotes, keep your data" | (downgrade from trial) quote-only core + URL-link sending |
| **Starter** | $19/mo (was $40) | "Run the business" | Orders, Invoices, QCP email send, Message Center, higher caps |
| **Pro** | $39/mo (was $90) | "Automate & go pro" | Drawings/Images, Digital Measuring, Catalogs, Attachments, Follow-ups, Activity |

End-goal funnel: Trial → (most stay) Free → upgrade to **Starter or Pro**, with **Pro the natural home** for anyone running QCP as their primary app. Next-tier-after-Pro (job manager / full system) becomes the no-brainer once built.

---

## 2. Full feature & quota matrix

Legend: ✅ included · ❌ not available · number = monthly cap or hard cap.

| Capability | Free Trial | Free | Starter | Pro |
|---|---|---|---|---|
| **Price / period** | $0 · 14 days | $0 · forever | $19/mo | $39/mo |
| **Quotes** (per month) | 10 | **5** | 25 | 100 |
| **Components** (total) | 10 | 10 | **20** | 30 |
| **Send quote via QCP email** | ✅ | ❌ | ✅ | ✅ |
| **Send quote via URL link** | ✅ | ✅ | ✅ | ✅ |
| **Quote accept/decline/change alerts** | ✅ bell + email | ✅ **bell + email only** | ✅ | ✅ |
| **Message Center** (`/inbox`) | ✅ | ❌ | ✅ | ✅ |
| **Orders** (per month) | 5 | ❌ | 5 | 20 |
| **Invoices** (per month) | 5 | ❌ | 5 | 20 |
| **Drawings / Images** (canvas tool) — *cap = per account total* | 10 | ❌ | ❌ | 20 |
| **Digital Measuring / Takeoff** (canvas tool) | ✅ | ❌ | ❌ | ✅ |
| **Flashings** | 5 | ❌ | ❌ | 10 |
| **Catalogs** | 2 | ❌ | ❌ | 3 |
| **Attachments** | 3 | ❌ | ❌ | 10 |
| **Follow-up system** | ✅ | ❌ | ❌ | ✅ |
| **Activity system** | ✅ | ❌ | ❌ | ✅ |
| **AI chat tokens** (per month) | 1M | 600k | 1.5M | 3M |
| **Storage** | 100 MB | 50 MB | 500 MB | 3 GB |
| **Seats** | 1 | 1 | 1 | 1 |

### Notes on specific cells
- **Free "Drawings/Images" and "Digital Measuring" are BOTH off.** Confirmed they are two separate canvas tools, both **Pro-only** (Starter does NOT get either).
- **`digital_takeoff` (existing column) = Digital Measuring.** No column split needed — it's already one tool. "Drawings/Images" is a **separate, currently-ungated tool** → needs a new gate.
- **Free sends quotes by URL link only** and still gets accept/decline/change alerts to **bell + email** (no Message Center, no QCP email send).
- **AI tokens:** anchored on REAL usage — **773,879 tokens** used to date (1 company, 1 user, Jun 2026) ≈ **$0.25**. Free **600k/mo** ≈ "a little less than all usage so far" (your words); Trial 1M (~1.3×); Starter 1.5M (~2×); Pro 3M (~4×). At scale these are <$1/user/mo in AI cost even at Pro — safe against the $39 price. All tunable via the per-plan `monthly_ai_tokens` column.

---

## 3. What this changes vs the LIVE plan rows (reality check)

Pulled from `subscription_plans` on 2026-06-11.

| Field | Today | New |
|---|---|---|
| `free` plan row | **does not exist** | **CREATE** new row, sort between trial and starter |
| `growth` plan | active, $29 | **deactivate** (`active=false`) |
| `trial` quote limit | 10 | 10 (unchanged) |
| `trial` catalog/attachment | 0 / 0 (off) | **2 / 3 (on)** |
| `starter` price | $19 (was $40) | $19 (unchanged) |
| `starter` quotes / components | 25 / 10 | 25 / **20** |
| `starter` orders / email_send / activity | 0 / off / off | **5 / on / on** (+ invoices 5, message center on) |
| `starter` digital_takeoff | off | off (unchanged — Pro only) |
| `pro` components / orders / attachments | 25 / 10 / 3 | **30 / 20 / 10** |
| `pro` invoices / drawings | (ungated) | **20 / 20** |
| `pro` quotes | 100 | 100 (unchanged) |

---

## 4. Build scope — column-flip vs net-new (honest effort map)

### A. Pure data changes (migration only — low risk)
- Create `free` plan row; deactivate `growth`.
- Re-point existing numeric caps + boolean `feat_*` per the matrix.
- Turn trial catalogs/attachments on.

### B. Schema additions (migration: new columns + `company_has_feature()` arm + `features.ts` registry)
- `feat_invoices` (bool) + `monthly_invoice_limit` (int) — **invoices are UNGATED today.**
- `feat_drawings` (bool) + `drawings_limit` (int) — **drawings/images UNGATED today.**
- `feat_message_center` (bool) — **message center UNGATED today.**
- `monthly_ai_tokens` (int) — wire `costGuard` to read per-plan instead of the flat 3M env default.

### C. Net-new ENFORCEMENT to build (the real work — these have NO gate today)
1. **Invoices** — add `requireFeature('invoices')` + monthly-cap check on invoice create/send paths.
2. **Drawings/Images** — add `requireFeature('drawings')` + cap on the drawings canvas entry.
3. **Message Center** — gate `/[ws]/inbox` + its surfaces behind `feat_message_center`.
4. **AI tokens per-plan** — `costGuard` reads `monthly_ai_tokens` from the company's effective plan (mechanism already exists; just swap the flat limit for the plan value).
5. **Digital Measuring vs Drawings split on the canvas** — confirm the two tools have separate entry points so they can be gated independently (digital_takeoff already gated; drawings new).

### D. UI
- Pricing/comparison table (this matrix) rendered for users — see §5.
- `BillingPanel` caps grid + upgrade prompts updated for the new tiers/labels.

---

## 5. Open confirmations before build
All resolved with Shaun 2026-06-11:
1. **AI token caps** — re-anchored on real 774k usage: Free 600k / Trial 1M / Starter 1.5M / Pro 3M. ✅
2. **Storage** — 50 / 100 / 500 MB / 3 GB. ✅
3. **Free Message Center = OFF** (bell+email alerts only). ✅
4. **Drawings/Images cap = PER ACCOUNT total** (not per month). ✅
5. **Growth** — no real subscribers; just flip `active=false`. ✅
