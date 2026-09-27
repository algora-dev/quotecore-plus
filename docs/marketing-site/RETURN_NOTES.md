# RETURN NOTES — Marketing V2 Phase 1A

**Date:** 2026-09-27  
**Baseline:** supplied marketing handoff tree at commit `6dc0eea7` / branch `ux/phase-4`  
**Scope:** public `quote-core.com` marketing surface only. No product/app code changed.

## Status

**Implemented, source-reviewed, SEO-check verified, not build-certified.**

This is the deliberately narrow Phase 1A factual-offer cleanup. It does **not** add V2 mobile, Smart Assistant or future App Demo availability claims, and it does not redesign the homepage.

## Terminology locked for future work

- **Roofing Takeoff Demo** = the existing public takeoff demo. It is not the future full application demo and was not changed in this batch.
- **App Demo** = the future full QuoteCore+ demo account/experience. It is not yet built and no marketing claim in this batch implies that it is live.
- **Free tools** = existing public tools. They remain unchanged in this batch; future mobile recoding is a separate project.
- **Paid QuoteCore+ app** = the connected product experience on the app hostname.

## Source changes

1. `app/(marketing)/layout.tsx`
   - Corrected shared marketing description from “Plans from free to $59/month” to “Paid plans from $19 to $59/month”.

2. `app/(marketing)/roofing-estimating-software/page.tsx`
   - Corrected the same stale paid-app offer in metadata, Open Graph description and visible hero copy.

3. `app/(marketing)/roofing-quoting-software/page.tsx`
   - Corrected the same stale offer in metadata and Open Graph description.

4. `app/(marketing)/roofing-takeoff-software/page.tsx`
   - Corrected the same stale offer in visible hero copy.

5. `app/(marketing)/pricing/page.tsx`
   - Changed the PlanSwift comparison teaser from “plans from free” to “paid QuoteCore+ plans”.
   - No price number was changed.

6. `components/competitor-pages/competitor-page.tsx`
   - Replaced the false paid-app helper “No card required. Cancel anytime.” with “Paid plans for the connected app. Free tools are available without signup.”

## Explicitly unchanged

- Root homepage source and homepage redesign.
- Existing Roofing Takeoff Demo.
- All public/free-tool logic and mobile behaviour.
- `/free-trial` route and its redirect/retirement decision.
- Pricing values and `lib/pricing.ts`.
- Smart Assistant code, permissions, API behavior or microphone configuration.
- Future App Demo implementation.
- Product/app-host routes.

## Verification actually performed

### SEO checker

Baseline:

`node scripts/seo-check.mjs` → **passed with 66 warnings**.

Post-change:

`node scripts/seo-check.mjs` → **passed with the same 66 warnings**.

No new SEO-check warning was introduced.

### Source-scope comparison

Before adding return documentation, exactly six repository source files differed from the supplied baseline, matching the Phase 1A allowlist. The root homepage `app/page.tsx` SHA-256 remained identical:

`de7c1796db3757fa94ae97d1243438a24fc00baf06c7b9df5fd3fbf04bed585f`

The targeted stale strings are absent from the six edited contexts.

### TypeScript / production build

A locked dependency install was attempted in a fresh baseline copy with `npm ci`, but the environment could not resolve npm registry packages (`EAI_AGAIN`). The install did not complete, so `npx tsc --noEmit` and `npm run build` could not be validly executed against the locked dependency set here.

**No successful typecheck or production build is claimed.** Integration should run both required commands with the repository's normal installed dependencies before merge.

## Remaining owner / integration decisions

1. **`/free-trial`** — retire/redirect/rework remains an owner decision. This batch intentionally leaves it unchanged.
2. **Homepage contradictions** — known stale structured/FAQ offer language remains because the homepage is frozen for this batch. It should be corrected in its own controlled release before or with the V2 homepage work.
3. **Upcoming subscription changes** — no future tier or price changes were inferred. Current owner-locked numbers were preserved.
4. **Mobile V2 launch wording** — do not publish broad availability language until the final shipping capability is confirmed.
5. **Smart Assistant wording** — future marketing should describe supported actions and control/confirmation accurately; this batch adds none.
6. **App Demo routing** — final public path, guest-session behavior, limits and deep links remain to be defined when the App Demo is built.
7. **PlanSwift teaser figure** — the existing `US$2,000/seat/yr` number was preserved under the no-price-change rule, but this batch does not independently reverify that competitor figure.

## Recommended next batch

Proceed to the first substantive V2 commercial-page group, while continuing to leave the homepage, Roofing Takeoff Demo and free-tool implementations alone:

- `/features`
- `/roofing-estimating-software`
- `/roofing-quoting-software`
- `/roofing-takeoff-software`
- then the broader construction equivalents

The goal of that batch should be to strengthen the core **Measure → Price → Quote** story and prepare accurate mobile/Assistant positioning behind release gates, not to turn every page into an AI page.

---

## Phase 2 handoff note

This Phase 1A source tree is the baseline for `START_HERE_PHASE2_AGENT.md`. Phase 2 is instructed to perform substantive core-commercial-page repositioning while keeping the homepage, free tools, Roofing Takeoff Demo functionality and future App Demo out of scope.
