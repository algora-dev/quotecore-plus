# Live host acceptance: Phase 1B

**Purpose:** establish real model-to-tool behavior. Local tests use supplied coordinates and cannot answer this.

## Gate A: protocol and hosted UI

1. With flags off, the combined `/mcp` returns the three original tools and original calculations still match their result URLs.
2. With both flags on in staging, the same endpoint returns seven tools and one versioned UI resource. The isolated endpoint returns the same four experimental definitions.
3. A custom ChatGPT connection refreshes successfully. Opening the review tool shows the actual review panel, or its browser fallback if the host cannot embed it.
4. Uploads, editing, calibration, confirm, export and deletion work on desktop and a real phone. Test deployed CSP/CORS and preview protection, not just local UI injection.
5. No expired or unreviewed proposal can be passed as a reviewed export token. A new proposal does not silently replace locally edited corners.

## Gate B: first host-generated outline

Start with a de-identified roof-plan raster, not the synthetic fixture. Choose a clear single-roof overhead plan. No perspective photograph or unsupported PDF upload for this first phase.

Example opening prompt:

> Open the QuoteCore+ roof-outline review tool. I want to check the exterior roof boundary in a plan image. Do not assume a scale or pitch.

After uploading through the panel, use its generated request. If the bridge cannot post, copy the request into the conversation. Do not disclose the temporary reference publicly.

Expected sequence:

1. `qc_prepare_roof_outline` returns the prepared pixels, actual dimensions, image identifier and coordinate instructions.
2. The host visibly has access to the image. It traces the exterior boundary using its own model, or reports that it cannot identify it. It must not fabricate unseen geometry.
3. The host calls `qc_submit_roof_outline` using the same image identifier and pixel frame, with pitch null.
4. The proposal is overlaid on the correct image without flipped axes, offset, crop or resize mismatch.
5. The user edits, checks and explicitly confirms. Scale is only added from a known dimension. Then the host can call `qc_export_reviewed_roof_outline` using the reviewed token.
6. With no calibration, no area in square metres/feet is reported. With calibration, any area is explicitly plan-projection area, not pitch-adjusted roofing surface area.

Check network/server telemetry: the new route must not call the paid OpenAI scan API or any external inference provider. The host owns any inference use; QuoteCore+ still pays normal hosting/storage costs.

## Gate C: practical usefulness

After protocol success, test 5 to 10 de-identified plans that cover a simple gable, an L-shaped roof, a hip roof, noisy linework, a rotated plan and partial/ambiguous geometry. Where appropriate include image resolution variations. Known geometry should come from a separately reviewed trace, not the host's own answer.

Record per run:

- Host, visible model selection and date. Do not infer subscription entitlements or reasoning settings that are not exposed.
- Prepared image dimensions and anonymised sample ID.
- Raw polygon, validity, line alignment and missed roof portions.
- Time to first proposal, number of correction actions and whether correcting is faster than manual drawing.
- Failure/abstention, tool-order errors, image visibility failure or token/session expiry.
- Reviewed export and optional known-scale area difference versus the reference.

Use the existing `benchmark-outlines.cjs` helper only with genuine reference/proposal pairs. Geometric validity alone is not an accuracy pass. A high-quality screenshot is not proof of a successful live model call.

## Stop conditions

Do not move to internal lines/classification if the model cannot receive the raster, regularly binds coordinates to a different frame, ignores the staged tool protocol, or produces outlines that require as much work as drawing manually. Identify that failure and return evidence first. Manual editing remains the fallback.

Conversely, if the host reliably proposes usable outlines and review saves time, retain this endpoint and schema foundation for Phase 2. No whole-app rewrite is implied.
