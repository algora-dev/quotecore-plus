> Historical Phase 1 reference. For this integrated package, use [Phase 1B integration instructions](../host-roof-scan-phase1b/INTEGRATION.md). They supersede the endpoint, environment and deployment steps below.

# QuoteCore+ host-powered roof outline, Phase 1

**Date:** 10 October 2026  
**Source baseline:** owner ZIP `quotecore-plus-mcp-handoff-20261010-3228415c-lean.zip`, commit `3228415c`  
**Release status:** implemented experimental prototype, disabled by default. Not a published plugin or a certified scan service.

## What this build answers

Can the model in an existing AI conversation inspect a roof image and submit an editable exterior polygon through QuoteCore+ MCP, without QuoteCore+ calling a paid inference API?

The integration path is implemented. Software validation passes locally. Live ChatGPT execution and roof-tracing quality remain untested until this endpoint is deployed and connected. A model can call valid tools and still identify the wrong geometry. Polygon validity is not a guarantee that it matches the roof.

## The exact architecture

```text
USER IMAGE
   |
   v
QuoteCore+ prepares ONE canonical image (max 2000px long side)
   |
   | qc_prepare_roof_outline returns actual MCP image content
   v
HOST MODEL sees image and performs its own vision/reasoning
   |
   | qc_submit_roof_outline: image ID + polygon coordinates
   v
QuoteCore+ validates geometry and renders a proposal overlay
   |
   | qc_open_roof_outline_review
   v
USER checks, moves corners, optionally calibrates, confirms
   |
   | UI confirmation endpoint issues reviewed result reference
   v
qc_export_reviewed_roof_outline -> compatible roof_areas JSON
```

The server does not request MCP sampling, call an OpenAI API, select a model, set reasoning effort or transfer subscription credits. The host decides whether and how to continue its conversation. The direct MCP image content makes the prepared raster available to a vision-capable host; it does not force the host to perceive it at a specific internal resolution.

## What is implemented

- Four purpose-specific MCP operations and an MCP Apps HTML resource.
- Optional native attachment ingestion using the declared `plan` file parameter. Its download host must be explicitly allowlisted.
- No-account upload through the review UI as the default fallback.
- PNG, JPEG and WebP validation, EXIF orientation, metadata removal, bounded image preparation and image hashing.
- Host instructions derived from QuoteCore+'s actual Scan 1 prompt.
- Strict outline validation, same-image binding and visible uncertainty notes.
- Human-facing editor with draw, drag, numeric corner edits, insertion/removal, undo/redo, pan, zoom, manual fallback and optional two-point scale.
- Explicit review, reviewed JSON export, local draft download and model-context handoff.
- Standards-based MCP Apps bridge plus limited feature-detected OpenAI compatibility hooks.
- Browser fallback with the same editor, no account writes and no marketing upsell.
- Temporary private storage abstraction, signed short-lived references, public-route quotas, CORS, scoped browser CSP, SSRF defenses and a dry-run retention cleanup utility.
- Unit tests, browser test harness, deployment smoke script and an outline comparison utility.

## Deliberate boundaries

1. **Exterior outline only.** Interior lines, component classification, pitch inference, material quantities and quote generation are not Phase 1.
2. **Raster input only.** Export a relevant PDF page as an image first. This prototype does not contain a PDF renderer.
3. **One roof exterior at a time.** No disjoint buildings, holes or multiple overlaid roof levels are invented or silently merged.
4. **Review is required.** A model cannot complete the review step using one of the four advertised MCP tools. The browser confirmation action uses an additional UI reference. This is a workflow gate, not cryptographic proof of a human identity.
5. **No saved customer/workspace records.** No pricing, quotes, invoices, account permissions or paid-app data are touched.
6. **No production free-scan change.** Existing `aiScan: false` remains false. This prototype has its own name, endpoint and kill switch.
7. **No host accuracy claims.** A plan/subscription label is not a validated proxy for output quality.
8. **Not the complete nine-tool plugin.** This is the highest-risk architectural proof, built before connecting all tools.

## Where the existing implementation is reused

| Existing source | Use in this prototype |
| --- | --- |
| `app/lib/takeoff/ai-prompt-v3.ts` | Scan 1 instruction text and `V3Point` shape |
| `app/lib/takeoff/scanOverlay.ts` | Real plan-overlay raster rendering |
| `app/lib/takeoff/precision/precisionGeometry.ts` | Polygon area, perimeter and core validation |
| `app/lib/takeoff/calibrationCoordinates.ts` | Explicit affine mapping for same-image scene scaling |
| `app/lib/security/rateLimit.ts` | Existing distributed public-route limiting |
| Existing MCP SDK and Sharp dependencies | Transport, resource registration and image processing |

`aiScanShared.ts` initializes a paid OpenAI client, so this adapter deliberately does not import it. The paid execution APIs remain unchanged.

The isolated review shell is new. It is not a copy of `FreeTakeoffApp` or a replacement for `TakeoffWorkstation`. Reusing the entire application shell would bring unrelated routing, account and paid-scan assumptions into an unproven host experiment. Once quality passes, the export adapter is the narrow connection point into the existing takeoff workflow. Automatic import into the shared free canvas is not yet wired.

## New routes

| Route | Purpose |
| --- | --- |
| `/mcp/host-scan` | Experimental stateless Streamable HTTP MCP endpoint |
| `/mcp/host-scan/review` | Noindex browser review fallback |
| `/api/public/host-roof-scan` | Image upload and UI open/confirm/export/delete actions |

The production `/mcp` and all nine existing free tool routes are unchanged. The existing middleware public `/mcp` prefix covers this sibling. Verify the deployed host and headers in staging rather than assuming root hostname behavior is identical.

## Next files to read

- `IMPLEMENTATION_PLAN.md`: phased architecture and quality gates.
- `INTEGRATION.md`: exact installation, storage and testing instructions.
- `SECURITY_AND_LIMITS.md`: privacy, lifecycle, threat model and limitations.
- `API_CONTRACT.md`: tools, states, coordinates and examples.
- `LIVE_HOST_TEST.md`: what to test inside actual ChatGPT before moving on.
- Root `QA.md`: actual test results and tests that could not run.
