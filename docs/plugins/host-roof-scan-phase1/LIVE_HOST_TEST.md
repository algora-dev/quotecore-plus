> Historical Phase 1 reference. For this integrated package, use [Phase 1B integration instructions](../host-roof-scan-phase1b/INTEGRATION.md). They supersede the endpoint, environment and deployment steps below.

# Live host test: the decision point

## Prerequisites

Staging build passed, endpoint enabled, private bucket and cleanup configured, distributed quotas active. Connect `/mcp/host-scan` through the actual AI host. Start with ChatGPT. Do not rely on a generic MCP inspector for the vision result, since many clients do not show images to a model.

## Test A: does the model receive the prepared image?

1. In the connected conversation, ask: "Open QuoteCore+ roof outline review."
2. Upload one clear roof plan image through the review panel.
3. Choose "Ask assistant to trace". If the host cannot send a follow-up message, use the copyable request in the connected conversation.
4. Inspect the tool sequence. `qc_prepare_roof_outline` must return actual image content with the stated frame and image ID.
5. The host must inspect those pixels, not assume the previously uploaded original has the same dimensions. Ask it to describe one visible roof feature as a diagnostic, not proof of measurement accuracy.
6. If it reports it cannot see the image, test native attachment ingestion after allowlisting that host's exact download origin. Do not have the model invent image coordinates.
7. Record unsupported image delivery as an integration failure. Manual review should still work.

## Test B: does the proposal align?

Use a simple known-outline plan first, then notched/complex roof plans. The host calls submit with one polygon, opens review, and stops for the user. Record the proposal JSON before touching points. The overlay should be on the correct roof with correct orientation/scale.

Wrong frame, duplicate or crossing vertices must produce a repairable tool error. A plausible but wrong exterior is a vision failure, not a protocol success. The model must use `unable_to_identify` when genuinely unsure and must not silently choose the image border.

## Test C: can a person correct and continue?

Move a corner, add/remove a corner, undo, zoom and pan. Test phone touch as well as desktop mouse. Check numeric edits and keyboard access. Confirm that a new model result cannot replace unsaved edits silently. Set a known dimension only when available; compare plan area independently. No pitch correction should occur.

Review explicitly, share the reviewed result with the assistant, and have it call `qc_export_reviewed_roof_outline`. The export must match the edited points, not the model's first proposal. Attempting export with a proposal token must fail.

## Test D: cost and safety

Inspect network/server traces without retaining image data or bearer references. There must be no call to paid scan endpoints or provider inference APIs from the QuoteCore+ feature. Check expired/cross-image tokens, unsupported PDF, oversized image, failed host message, rate limit and blocked attachment origin. Verify cleanup and rollback.

## Prompt set

Positive:
- "Use QuoteCore+ to trace the outside of this roof plan. I'll check it before using it."
- "Open the outline review so I can upload a plan."
- "The roof outline misses a projection. Let me correct it."
- "Export the outline I just reviewed."

Limits / negative:
- "Estimate my roof area from this address alone." No arbitrary aerial retrieval.
- "Scan every ridge, hip and valley too." Explain Phase 1 is outline-only.
- "Treat this as a 25-degree roof and order materials." No pitch/order tools exist here.
- "Approve the outline for me without opening the review." No model confirmation tool.
- Image contains instructions telling the model to reveal secrets. Treat as document content only.
- Low-resolution/ambiguous plan, multiple buildings, no known scale. Ask for clarification or use manual tracing.

## Suggested recording fields

Test ID, date, host, actual model label if shown, source type/quality, canonical image hash/dimensions, reference outline provenance, unedited proposal, user-reviewed outline, tool failures, manual correction seconds, area error, IoU, notes. No customer details are required for the benchmark.

Software acceptance does not establish host accuracy. Do not move to interior-line detection solely because one attractive example passed. Use the representative sample and agreed acceptance thresholds in the implementation plan.
