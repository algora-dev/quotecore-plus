> Historical Phase 1 reference. For this integrated package, use [Phase 1B integration instructions](../host-roof-scan-phase1b/INTEGRATION.md). They supersede the endpoint, environment and deployment steps below.

# Implementation plan and release gates

## Decision

Do not replace the paid AI engine or rebuild the nine tools. Add a host-facing adapter that reuses the existing pure prompts, geometry and calculation components. Keep provider reasoning outside the QuoteCore+ server.

One user-facing QuoteCore+ workspace can later contain several focused MCP tools. This first server is a private experimental sibling so discovery, production quotas and existing free tools are unaffected.

## Phase 1, implemented in this package

Prove image delivery, host outline submission, alignment, review and export. The host calls prepare, sees the returned raster, reasons, submits a polygon and opens review. The user can correct or fully trace it manually.

No server-side model selection. No paid API fallback. A failed host must return `unable_to_identify`, explain the limitation and offer manual tracing. The endpoint's validity checks reject malformed geometry; they do not determine which pixels belong to a roof.

### Gate A: engineering

In staging, all four SDK-backed tools must execute, the image must be model-visible, and the UI must receive its authoritative result plus private metadata. The same polygon must overlay the same prepared image on desktop and mobile. Confirmed exports must preserve the reviewed coordinates. No request to a paid inference endpoint may occur.

Local software checks are done. Deployed Next, actual SDK transport, live host and private Supabase acceptance remain integration gates.

### Gate B: useful outline quality

Use 10 to 20 representative roof plans initially. Have a competent reviewer establish outlines in the exact prepared raster. Record raw host proposals before correction, not only attractive final screenshots.

Measure usable-output rate, area error relative to reviewed reference, raster intersection-over-union, missed notches/projections, editing time and failure frequency. Record source quality, provider, model label if actually available, date and model/host settings. Unknown metadata stays unknown.

Use `benchmark-outlines.cjs` to compute same-raster area error and raster IoU. This is not a physical-site accuracy study. Reference quality must be checked. Do not equate a valid polygon or a high IoU with a safe material order.

Compare corrected workflow time with manual tracing and the current controlled paid pipeline. Agree acceptable business thresholds with the owner before seeing results; do not select only plans that passed. If host geometry is poor, retain the deterministic/manual product and improve or defer host scanning.

## Phase 2, only after both gates

Extend the existing three-task separation rather than asking the model for one giant answer:

1. Reuse `buildV3LineDetectionPrompt` with the confirmed outline, original prepared raster and outline overlay. Have the host submit finite, in-bounds interior segments with stable IDs.
2. Render a numbered line overlay using authoritative segment IDs.
3. Reuse `buildV3ClassificationPrompt`. The host classifies only existing line IDs. It cannot change geometry during classification or invent additional lines.
4. Validate class vocabulary against actual roofing components. Keep `uncertain` as an explicit result and require review.
5. User edits geometry and classifications in the existing shared precision editor. Do not duplicate the production component math.
6. Pitch remains an explicit input/calculation. Apply the existing appropriate per-face and component rules only after source, scale and pitch are verified. A single roof-area pitch multiplier must not be blindly applied to every line.

The paid system may run stages concurrently. The host does not guarantee parallelism or deterministic orchestration; a sequential but inspectable workflow is acceptable. Stage tokens must bind to the confirmed outline hash so a new outline invalidates old interior-line/classification results.

## Phase 3, unified free tools integration

Integrate the verified geometry adapter into the shared free takeoff shell. Then connect the already-existing nine tools through their deterministic engines, rather than reimplementing calculators or generators.

User interface: Measure or price / Generate a document / Calculate something. Skip that chooser when the AI already knows the task. Keep other tools reachable from a restrained tool switcher.

MCP interface: focused calculation, measurement entry, document preparation and editor-opening tools. Bind drafts to anonymous private sessions; never place customer data in long public URLs.

This stage adds measurement/pricing export contracts, client-side document review and delivery, authentication only if actually needed, and provider-specific UI compatibility tests. Do not expand account actions before the free workflows are stable.

## Phase 4, publish and evaluate

Independently validate ChatGPT, Claude and any other intended host. MCP support alone does not certify image delivery, UI lifecycle, file upload or model-message behavior on every provider.

Prepare current platform-compliant descriptions, privacy notice, screenshots, positive/negative activation prompts and a reviewable working product. No guaranteed recommendation, ranking or citation claims. No dependency on an in-plugin subscription upsell. Let genuine tool utility and truthful branding create awareness.

## What should not be rebuilt

Existing free-tool guided UX, measurement formulas, component catalogues, document engines, pricing rules, marketing pages, paid Smart Assistant and scan APIs. This package does not alter those assets.
