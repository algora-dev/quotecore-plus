# QuoteCore+ AI Scan Assist - Second Review Brief

**Purpose:** You reviewed our roof-plan scan pipeline previously (your implementation handoff brief). This is a follow-up: what we implemented, what measurably helped, what we deliberately did not do, and what we would like reviewed next.

**What changed since your review** - five production commits on `main`:
- `c030969a` - early stroke-style filtering, pre-Scan-3 collinear healing, explicit uncertain review state, scan-engine parity (GPT-6 reasoning regex fix + model routing), reasoning-token logging
- `1c17edeb` - near-empty stroke demote rule + zero-cost offline stroke classifier test
- `615441a1` - gable barge ray-projection + collinear extension, T-junction-aware island micro-cluster removal, uncertain sidebar review group restored
- `6e6ceb67` - recall-first Scan 2 prompt rules + Scan 3 gable ridge cap classification rule

## 1. What we implemented from your brief (phase 1 scope)

### Early stroke-style classification (your section 4) - implemented
New `app/lib/takeoff/strokeStyle.ts`. Runs immediately after Scan 2 parse, BEFORE angle snap / connectivity / overlays / Scan 3.
- Narrow centre band (+/-2px, was +/-4px min-luminance)
- Binary ink/gap sequence with anti-aliasing denoise
- Run/gap evidence: duty cycle, ink runs, gap runs, longest/median gap, gap CV (regularity)
- `dashed` requires repeated, meaningful, reasonably regular gaps; borderline = `ambiguous` (kept, carried forward); named threshold constants (not tuned on a golden set yet)
- Offline synthetic test: 5/6 exact (classic dashed, diagonal dashed, sparse long-dash all detected; solid/thin solid kept). The miss: ultra-fine dots (2px dot / 6px gap) render too faint for the centre band and land `ambiguous`. We added a near-empty demote rule instead of deleting (see 3 below).

### Classification-independent collinear healing before Scan 3 (your section 5) - implemented
New `app/lib/takeoff/scanPostprocess.ts` `mergeArtificialCollinearSplits`. Same tolerances as the post-merge (12px endpoint, 3 deg, outline-excluded), but the junction degree check uses any retained line, not classifications. Post-Scan-3 merge kept as a second-pass safety net.

### Unconditional dashed deletion (your acceptance criteria) - implemented with a caveat
Scan 3 now drops raster-proven dashed lines regardless of semantic classification, and logs conflicts (model said ridge/hip, raster says dashed) for benchmarking. Reasoning: our earlier uncertain-only intersection existed because the first all-lines version deleted real components when traces drifted off-stroke. The improved run/gap detector plus the early ordering (removal happens before anything downstream depends on the candidate) is what makes unconditional deletion defensible. Not yet proven on a labelled plan set.

### Explicit uncertain/review state (your section 10) - implemented
`buildSystemComponentIds()` returns `Partial<Record<SemanticKey,string>>`, never maps `uncertain`. `AiMeasurement.componentId` is `string | null`. Workstations group review items under an explicit `__review__<key>` key. Pink dashed review UX retained, deletable in the sidebar. (We found and fixed a regression where the review group stopped rendering because the UI looked up `componentId === undefined` - exactly the hidden-undefined-signal failure mode you warned about.)

### Pipeline drift (your section 14) - partially fixed
`scan-engine.ts` (worker path IS active in production via a cron queue): GPT-6 reasoning regex fixed (`^gpt-[56]`, this was a live bug - Astra scans through the worker silently missed `reasoning_effort`), model routing extracted to helpers matching the route (Luna / Astra low / Astra medium), stroke filter + pre-heal + dashed safety net added for parity. NOT done: full extraction of all post-processing into shared modules - angle snap, connectivity validation and the classification-dependent merge still exist as duplicates in both files. This remains the biggest structural debt.

### Instrumentation (your section 15) - partially implemented
Reasoning tokens captured (`completion_tokens_details.reasoning_tokens`) and logged with every scan. Scan 2 persisted stats now include `dashedRemoved`, `ambiguousStrokes`, `preHealedMerges`, plus per-stage durations and token counts in `ai_scan_usage`.

## 2. What we implemented beyond your brief

### Gable barge ray-projection (your section 12, promoted from "later")
Real-world failure: an obvious gable face was labelled spouting. Root cause: `perimeterAccountingPass` only creates barge pairs where a detected ridge ENDPOINT lands within 35px of the outline; the model returned the gable ridge slightly short (or missed it entirely), so the whole gable edge fell to the spouting remainder. Fix in `app/lib/takeoff/applyAiResults.ts`:
- Ray projection: extend the ridge endpoint up to 160px along ridge direction to the nearest perpendicular outline edge and build the barge pair from that intersection (with a sanity bound tying the intersection to the endpoint projection).
- Collinear extension: barge runs now continue across collinear outline vertices (e.g. where a valley lands mid-gable-face and splits the outline into two collinear sub-edges) to the end of the gable face.

### T-junction-aware island micro-cluster removal
Model sometimes returns short SOLID fragments outlining dashed rectangular plan features (annotation boxes, symbols) - these are not dash-detectable because the fragments themselves are solid. New `removeIslandMicroClusters` in `scanPostprocess.ts`: union-find over lines using endpoint-to-SEGMENT proximity (T-junctions, not just endpoint-endpoint - the first version failed its own offline test by eating a legitimate short spur that met a ridge mid-line), then remove clusters where every line is < 6% of the roof diagonal AND the cluster is either a closed cycle (annotation box, removed even if near the outline) or an island with no anchor to the network/outline. Offline test 12/12 including "legitimate short spur kept".

### Recall-first Scan 2 prompt rules + Scan 3 gable ridge cap rule
Same plan previously missed obvious short gable ridge caps. Prompt now states: omission is the worst error; always trace a solid line running from any roof line out to the perimeter (almost always gable ridge caps); sweep each gable end deliberately. Scan 3: a solid internal line connecting another line/junction to the perimeter = ridge (not uncertain merely for being short); added topology check 10.

### Near-empty stroke demote
Ultra-faint dotted styles the raster cannot confirm as dashed (duty <= 0.05) are demoted to uncertain for review rather than deleted - preserves the review UX instead of risking real-component deletion on drifted traces.

## 3. Measured outcome

Same complex plan, same tier (Astra low effort), before vs after:

- **Before:** dashed plan features traced as short solid fragments (pink uncertain clutter), one gable face labelled spouting, missing gable ridge caps, split components.
- **After (2026-09-11 15:42):** PERFECT result verified by the owner - outline exact, every component detected and correctly classified, no uncertain items, no manual corrections. Runtime: 10.5s + 14.1s + 29.6s (~54s model time, ~68s wall). ~20.9k prompt / ~2.9k completion tokens ~= $0.35 per scan.

Single-plan evidence only. No golden set exists yet (your section 16 remains open).

## 4. What we deliberately did NOT do (still open from your brief)

1. **Image-axis angle snap removal (your section 7)** - still enabled, still rotates about midpoint before connectivity. Benchmark-gated on our side; we want rotated + clean plans on a golden set before changing it.
2. **Roof graph construction / maximal-stroke Scan 2 (your sections 6, 9)** - not started. With recall-first prompts now returning the previously-missing lines, we want to re-measure whether the model's own topology is still the bottleneck before rewriting.
3. **Deterministic hip/valley auto-promotion (your section 8)** - still demote-only; the biconditional domain question is still unconfirmed with the owner.
4. **Slimming Scan 3 / removing E-edge classification (your section 9)** - not started.
5. **Golden-set benchmark harness (your section 16)** - not started. We have zero-cost offline tests (scripts/test-stroke-style.mts, scripts/test-micro-clusters.mts, both runnable with `node --experimental-strip-types`) but no labelled plan corpus.
6. **Targeted high-res crops (your section 13)** - not started.

## 5. What we would like reviewed

1. `app/lib/takeoff/strokeStyle.ts` - threshold sanity, especially the ambiguous band and whether the near-empty demote (0.05 duty) is too conservative or too aggressive.
2. `removeIslandMicroClusters` - the closed-cycle rule (annotation boxes removed even when near the outline) and the 6%-of-diagonal shortness bound. What real roof features could this eat? (Short barges are E-edge-derived so unaffected; internal spurs anchored to long lines are kept via T-junction connectivity.)
3. Ray-projection barge generation in `perimeterAccountingPass` - the 160px extension bound and the sanity check tying the gable-centre intersection back to the endpoint projection. False positives here invent barges on eave edges.
4. Whether the recall-first Scan 2 prompt language risks over-generation (more false candidates) now that deterministic filtering is trusted to clean up - is our filter stack strong enough to absorb a noisier Scan 2?
5. Priority ordering for the remaining items given the single-plan perfect result: is the roof graph still worth the rewrite, or is a golden-set benchmark now the highest-value next step?

Model routing is LOCKED for this cycle: low = gpt-5.6-luna, medium = gpt-6-astra (low effort), high = gpt-6-astra (medium effort). Do not propose routing changes; attribute any improvements to pipeline changes only.
