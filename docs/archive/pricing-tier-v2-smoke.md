# Pricing Tier v2 + Billing UI — Smoke Test (stored 2026-06-12)

> Run on dev: **quotecore-plus-dev.vercel.app** (dev = one Supabase DB shared with main).
> Covers commits `52312e1` (gating) + `8a06264` (billing UI). Migration `20260611160000_pricing_tier_v2` already applied to the shared DB.
> Status keys: `[ ]` pending · `[x]` pass · `[!]` fail (note why) · `[~]` partial/retest.
> Tier matrix is the source of truth in `docs/pricing/TIER_SPEC_v2.md` §2.

---

## 1. Plan ladder (billing page)
- [ ] Billing page shows the ladder: **Free Trial / Free / Starter $19 / Pro $39**. **Growth is GONE.** pro_plus/premium still present as higher / coming-soon.
- [ ] Prices render with the strikethrough "was" anchor where set (Starter was $40, Pro was $90), and the charged price is the lower number ($19 / $39).
- [ ] Current-plan pill sits on the account's actual plan.

## 2. View-modal upgrade bug (the small bug Shaun flagged)
- [ ] Click **View** on an upgrade plan → the **Upgrade** button inside the View modal IS clickable and starts the same upgrade flow as the normal (non-View) Upgrade button.
- [ ] Same for **downgrade** — both the normal card action AND the View-modal action let you downgrade.

## 3. Generic (non-roofing) billing copy
- [ ] All user-facing plan/feature copy is trade-neutral. Specifically **"Flashings" now reads "Drawings & Images"** in the plan feature lists and the View modal.
- [ ] (Note: Shaun asked to KEEP "Digital takeoff" and "Material orders" — only Flashings→Drawings was the wanted change. Confirm those two were left/restored as the original wording, not over-genericised.)

## 4. Free tier (`free` plan)
- [ ] **5 quotes/month cap** bites (6th quote create blocked with upgrade prompt).
- [ ] URL-link send works; **QCP email send is BLOCKED** (plan gate).
- [ ] `/inbox` shows the **upgrade splash**, not the inbox.
- [ ] Orders / Invoices / Drawings / Catalogs / Attachments / Follow-ups / Activity are **all locked**.
- [ ] Bell + email alerts **still arrive** (notifications aren't gated off).

## 5. Starter ($19)
- [ ] **Orders**: create works, **caps at 5/mo** (6th → P0016 upgrade error).
- [ ] **Invoices**: create works, **caps at 5/mo** (6th → P0015 upgrade error).
- [ ] **Message Center** opens.
- [ ] **QCP email send** works.
- [ ] **Locked**: Drawings/Flashings, Digital Measuring, Catalogs, Attachments, Follow-ups, Activity.
- [ ] **Components cap = 20**.

## 6. Pro ($39)
- [ ] Everything unlocked.
- [ ] Invoices cap **20/mo**; Orders cap **20/mo**; Drawings/Flashings cap **20** (per-account total); components **30**; catalogs **3**; attachments **10**.

## 7. Drawings = Flashings (one tool, one cap)
- [ ] Resource Library **"Drawings & Images"** card → `/flashings`.
- [ ] Trade label flips roofing ↔ generic correctly.
- [ ] A **single shared cap** is enforced (not two separate Flashings/Drawings caps).

## 8. AI tokens per plan
- [ ] Assistant refuses once the effective plan's `monthly_ai_tokens` is hit:
      Free **600k** / Trial **1M** / Starter **1.5M** / Pro **3M**; premium = unlimited.

## 9. Edit-not-blocked (gate fires on CREATE only)
- [ ] While **at** the monthly order/invoice cap, **editing an EXISTING** order/invoice still works. The cap only blocks new creates.

---

### Notes / failures
_(record fails + commit of any fix here; move passes to the main CHECKLIST "Passed (recent)" on next update)_
