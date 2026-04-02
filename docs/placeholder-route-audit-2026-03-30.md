# QuoteCore+ Placeholder Route Audit - 2026-03-30

## Scope

Review obvious placeholder or scaffold routes before implementation begins.

## Routes Reviewed

- `app/page.tsx`
- `app/quotes/page.tsx`
- `app/settings/page.tsx`

## Classification Framework

- **Keep temporarily** — acceptable placeholder that does not mislead too badly
- **Replace soon** — should be replaced as part of near-term implementation
- **Quarantine / rework** — actively misleading or structurally unhelpful

## Findings

### 1. `app/page.tsx`
**Classification:** Quarantine / rework

This is still the create-next-app style placeholder landing page. It is not aligned with the product, the PRD, or the architecture. It should not survive as the meaningful root experience for much longer because it communicates nothing about QuoteCore+.

**Recommendation:** Replace with a real QuoteCore+ landing/entry experience or route users intentionally into auth/dashboard flows.

### 2. `app/quotes/page.tsx`
**Classification:** Replace soon

This route represents a core product area but currently behaves as a placeholder shell. Because quotes are central to the system, leaving this route vague for too long is risky.

**Recommendation:** Replace as part of early quote-lifecycle implementation work (Epic 3).

### 3. `app/settings/page.tsx`
**Classification:** Keep temporarily / replace later

This route is not as central as the quotes route and can remain shallow for longer, provided it does not block more important implementation. It is still not a real product surface yet.

**Recommendation:** Keep temporarily, then replace once company/user/settings scope becomes implementation-relevant.

## Recommended Next Action

1. Treat `app/page.tsx` as the highest-priority placeholder problem.
2. Treat `app/quotes/page.tsx` as an early implementation target.
3. Leave `app/settings/page.tsx` alone for now unless it causes confusion.

## Cleanup Safety Note

No route deletions recommended yet. Replace through implementation work rather than deleting blind.
