# Phase P7 — Live fixture smoke results

Run date: 2026-09-19
Script: `scripts/smoke-ai-calibration.mjs` (run with `node --import tsx scripts/smoke-ai-calibration.mjs`)
Detector: `calibration-p5:cal-discovery-v1/cal-refinement-v1`
Cost bound: max 3 fixture searches (well inside the 6-vision-round budget).

## Result: BLOCKED by provider credits — pipeline mechanics validated

All three fixtures failed at the first provider call with:

```
CalibrationVisionError PROVIDER_ERROR:
429 You have no credits remaining. Add credits to continue using the API
at https://platform.openai.com/settings/organization/billing/.
```

**0 model tokens consumed, 0 AI Assist points involved** (the script calls
`runCalibrationSearch` directly, bypassing auth/quota exactly as designed).

## What the run DID validate (honest data, not filler)

- Fixture generation works: 3 sharp-rendered synthetic plan PNGs
  (2200x1600, 24-30 KB each) — dimension line with arrows + "6.42 m" SVG text,
  scale bar "0 1 2 4 m", and a dimension-free negative image.
- The internal-function import path (no deployed app, no auth bypass surface)
  loads and executes the real pipeline.
- Provider failure handling behaves correctly end-to-end: the OpenAI 429 is
  classified as `PROVIDER_ERROR` (not a crash, not a fabricated success), each
  fixture fails independently in 1.2-1.9 s, and the script reports structured
  results. In the live route this class of failure triggers the automatic point
  refund path.

## Per-fixture observations

| Fixture | Status | Candidates | Observation |
|---|---|---|---|
| dim-line-6.42m (positive) | PROVIDER_ERROR (429 no credits) | n/a | Not measurable this run |
| scale-bar-0-1-2-4m (positive) | PROVIDER_ERROR (429 no credits) | n/a | Not measurable this run |
| blank-negative | PROVIDER_ERROR (429 no credits) | n/a | Not measurable this run |

No accuracy claim is made. OCR accuracy, endpoint localisation and negative-
fixture honesty remain unmeasured until a funded key is available.

## Re-run instructions (when OpenAI credits are added)

1. Ensure `.env.local` `OPENAI_API_KEY` belongs to an org with credits
   (optionally set `AI_CALIBRATION_MODEL`).
2. `node --import tsx scripts/smoke-ai-calibration.mjs`
3. Paste the JSON output into this file, replacing the table above, and record
   `total model tokens` (the script prints it).
