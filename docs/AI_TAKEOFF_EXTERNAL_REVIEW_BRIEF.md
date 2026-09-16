# QuoteCore+ AI Takeoff (Scan Assist) - External Review Brief

**From:** Gavin (lead dev, QuoteCore+), 2026-09-11
**Purpose:** Second opinion. We want this system to be faster, cheaper, and more reliable. You have the full codebase - find a better solution than our current approach where one exists.

## 1. What we are building

QuoteCore+ is construction/roofing quoting SaaS. "AI Takeoff" (user-facing name: AI Scan Assist) lets a user upload a roof plan image (typically an architectural PDF export / screenshot, white background, dark linework) and get:

1. The roof outline polygon (one closed polygon, vertices in image pixels)
2. Internal roof component lines, each classified as: ridge, hip, valley, barge, spouting (gutter edge), broken_hip, broken_barge, or uncertain
3. Real-world measurements via user calibration (px -> m/ft)

Output feeds a measurement canvas (Fabric.js) where the user reviews, corrects, attaches real product components, and quotes.

## 2. Current architecture (V3, 3-scan pipeline)

File: `app/api/takeoff/ai-scan-v3/route.ts` (~1200 lines) + `app/lib/takeoff/*.ts`

- **Scan 1 - Outline:** vision model traces the external roof perimeter as a clockwise polygon. Prompts in `ai-prompt-v3.ts`.
- **Scan 2 - Internal lines:** model traces every visible SOLID internal line as segments, split at every junction. Post-processing: angle snap (within 5 deg of 0/45/90/135 image axes -> snapped, others kept as-is), connectivity filter (endpoints must touch the outline or another line endpoint, tol 10px; failures = "floating").
- **Scan 3 - Classification:** model labels each line ID (L ids) plus each outline edge (E ids: barge/spouting). Server then applies deterministic passes (below).
- All model calls: OpenAI Chat Completions, `response_format: json_schema`, strict schema, image detail high.

### Deterministic post-processing passes (in order, scan 3)

1. **Vertex classification** (`outlineGeometry.ts`): convex/concave/collinear per outline vertex from winding math. Authoritative - the model is told never to re-derive it.
2. **Hip/valley vertex rule:** line ending on convex vertex must be hip, concave must be valley; mismatches corrected; no vertex match -> uncertain.
3. **Hip/valley 45-degree angle gate** (new 2026-09-11): hip/valley must run within 12 deg of 45 relative to BOTH edges meeting at the corner (rotation-invariant, covers both X diagonals). Outside -> demoted to uncertain.
4. **Dotted-line raster filter** (new 2026-09-11): sample pixels along each line (band +-4px, luminance <135 = ink). Ink duty-cycle < 0.65 with >= 2 ink runs = dotted stroke -> deleted, but ONLY if the model classified it uncertain (safety: real components are never deleted).
5. **Collinear split merge** (new 2026-09-11): two collinear segments continuing each other (dot < -0.9985, angle < 3 deg) meeting at a point where no other non-uncertain line terminates = artificial junction -> merged, one classification.
6. **Floating lines:** endpoints touching nothing -> forced uncertain (kept, pink, user-deletable).
7. **Perimeter accounting pass** (`applyAiResults.ts`): barges regenerated deterministically from ridge-endpoint-to-gable geometry; spouting rebuilt as perimeter remainder. (Predates this week; known imperfect - barge detection misses at some gable ends.)
8. **Frontend** (`TakeoffWorkstation.tsx`, `applyAiResults.ts`): snap/cluster endpoints, point-in-polygon area stamping, values via calibration, uncertain entries render pink dashed + a deletable "Uncertain (AI)" sidebar group + results-modal callout.

### Model routing (updated 2026-09-11)

Quality selector (user chooses Low/Medium/High):
- Low: gpt-5.6-luna, reasoning low (~$0.005/scan)
- Medium: gpt-6-astra, reasoning low (~$0.15-0.40/scan)
- High (complex): gpt-6-astra, reasoning medium, bumped token limits (~$0.5-0.9/scan)

Measured on one complex plan (2026-09-11): Astra low 63s/$0.39; Astra high 289s/$0.94; Astra medium (untested vs low at time of writing). Point quota per plan deducts 2/6/12 per scan tier (trial 20, growth/pro 50, pro+ 100 pts/month).

## 3. The rules that MUST hold (domain truth)

- Hips terminate at CONVEX outline corners and run diagonally (~45 deg to the corner's edges).
- Valleys terminate at CONCAVE outline corners and run diagonally (~45 deg). Both X diagonals are valid.
- A horizontal/vertical line (relative to the roof) is never a hip or valley.
- Ridges connect hips/valleys/broken_hips and may terminate on gable-end edges at any orientation.
- Barge = perpendicular gable-end edge at a ridge endpoint; spouting = every other perimeter edge.
- Dotted/dashed plan lines are NEVER components and NEVER junctions/breakpoints. A dotted line crossing a solid line must not split or terminate the solid line.
- Uncertain is a valid, honest output: flag for human review rather than guess. The user can see and delete each uncertain entry.
- Plans may be rotated/skewed: angle logic must be relative to the roof, not image axes.

## 4. Current problems (why we are asking for a second opinion)

1. **Dotted lines keep appearing as "uncertain" components.** Both GPT-5.6-luna and GPT-6-astra (low AND high effort) trace dotted plan lines in scan 2. Prompt instructions to ignore them are insufficient. Our raster duty-cycle detector is new and only applies to uncertain-classified lines; it may miss dotted lines with dense dash patterns or light strokes. The whole dotted-line handling feels like whack-a-mole - is there a fundamentally better approach?
2. **Dotted lines splitting real components.** A dotted line crossing a valley created a phantom junction; the valley came back split into valley+hip. We added the collinear merge pass for this, but it is reactive, not principled.
3. **Inconsistent completeness across runs/effort levels.** Same plan: Astra low missed components, Astra high found all, then Astra medium missed different ones. Our layered post-processing may be adding complexity without reliability. Are 3 sequential vision calls the right shape at all? Would structured pre-processing (e.g. raster line thinning, Hough-style candidate generation, or a single richer call) be more reliable?
4. **Outline incompleteness on complex roofs** (long-standing): scan 1 sometimes simplifies notches/steps.
5. **Barge detection misses** at some gable ends (perimeter accounting pass).
6. **Cost/latency:** Astra high = ~5 min and ~$0.94/scan. We want complex-roof accuracy near Astra-high at closer to Astra-low cost/time.

## 5. Desired outcome

- Same or better accuracy on medium+complex roofs, at lower cost and time
- Dotted lines never become components or junctions
- Fewer misclassifications reaching the user; honest uncertain flags with easy manual fix
- Simpler, more principled pipeline if possible - we suspect our rules have grown patchy and would value a redesign proposal
- Keep the data-driven UI contract (AiScanData shape) or propose a migration

## 6. Key files

- `app/api/takeoff/ai-scan-v3/route.ts` - pipeline, model calls, all post-processing
- `app/lib/takeoff/ai-prompt-v3.ts` - prompts + JSON schemas
- `app/lib/takeoff/outlineGeometry.ts` - vertex classification, hip/valley rules, angle gate
- `app/lib/takeoff/applyAiResults.ts` - perimeter accounting, snap/cluster, value computation
- `app/lib/takeoff/aiComponentRegistry.ts` - semantic keys, colours, line options
- `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/TakeoffWorkstation.tsx` - canvas UI, apply flow, uncertain sidebar group
- `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/modals/AiResultsModal.tsx` - results modal
- `docs/AI_SCAN_V3_ACCURACY_BRIEF.md` - our internal audit + improvement log (2026-09-11)

## 7. Constraints

- Next.js 16 App Router, TypeScript strict, Supabase, deployed on Vercel (maxDuration 300s per scan stage)
- OpenAI models only for vision (we have gpt-5.6-luna/sol/terra and gpt-6-astra on the account)
- The model must never compute prices; geometry classification only
- No em dashes in UI text/comments
- Return: assessment + concrete proposed changes (patch or detailed design), we review and merge

## 8. Deliverable back to us

A prioritised findings list: what to change, why, expected impact on accuracy/time/cost, and rough implementation effort. If you propose a pipeline restructure, sketch it end to end.
