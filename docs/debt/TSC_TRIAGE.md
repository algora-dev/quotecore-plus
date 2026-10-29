# TypeScript debt triage (81 errors, snapshot 2026-10-29)

Source: `npx tsc --noEmit` at commit 2dd2c646 (pre-quarantine). Baseline is
enforced by scripts/debt-ratchet.cjs (scripts/debt-baseline.json). This doc
exists so the paydown can be incremental instead of one scary batch.

## By error code

| Count | Code | Meaning |
| --- | --- | --- |
| 68 | TS2339 | property does not exist on type |
| 9 | TS2322 | type not assignable |
| 1 | TS2352 | conversion may be a mistake |
| 1 | TS7006 | implicit any parameter |
| 1 | TS2353 | object literal may only specify known props |
| 1 | TS1117 | object literal duplicate property |

## By area

- 66 runtime errors, all under `app/` route groups ((auth), (public), (marketing), api).
- 15 test-file errors (cannot affect the running app):

| Count | File |
| --- | --- |
| 5 | app/lib/supplier-pricing/supplierPricingService.test.ts |
| 3 | app/lib/takeoff/precision/pointNavigation.test.ts |
| 3 | app/lib/takeoff/calibrationCommit.test.ts |
| 2 | app/lib/takeoff/calibrationSession.test.ts |
| 1 | docs/plans/phase6/parity.test.ts |
| 1 | app/lib/takeoff/calibrationVision.test.ts |

## Known root causes (see also AGENTS.md + MEMORY)

1. Live DB schema drift vs generated types (e.g. quote_components.cover_width_mm
   is TEXT in the live DB but the generated types disagree; sa_v2_* fns absent).
   Fix path: careful targeted type splices, never wholesale regen.
2. Demo-fork and takeoff test fixtures typed loosely during the demo-pass era.
3. A few genuine loose callback params (TS7006 class).

## Recommended paydown order (each batch: fix, build, ratchet, one push)

1. The 15 test-file errors: zero runtime surface, fastest win.
2. TS7006/TS1117 singles: trivial explicit types.
3. TS2339 cluster in one route group at a time, starting with the one that has
   the most: pay down alongside the generated-type splices it depends on.
4. TS2322 assignability last (may need real type design, not casts).

## Standing rules

- Never fix by widening to `any` where a specific type exists (that trades
  debt for silence).
- Run `node scripts/debt-ratchet.cjs` before every push; re-baseline with
  `--record` ONLY after a batch genuinely reduces the count.
