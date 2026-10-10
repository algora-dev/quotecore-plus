# QuoteCore+ host roof-outline Phase 2

Date: 10 October 2026. Baseline: agent handoff commit `86eb8e97`.

This is an image-delivery and review integration update, not Scan 2/component recognition. The goal remains one exterior roof outline, proposed by the connected host model without a separate paid inference call from QuoteCore+.

## What the baseline showed

The agent's handoff reports that image upload, private storage, token preparation and the synthetic backend outline/review/export flow worked in staging. Real ChatGPT tests saw only metadata, not the prepared raster. The source already included a valid-looking MCP image content block. That observation alone does not identify whether serialization, connector projection or the model's media context dropped the image.

We do not call an untested alternative a confirmed fix. This patch provides explicit delivery alternatives and evidence to distinguish those layers.

## The implemented routes

1. `qc_prepare_roof_outline`: keeps its structured result and canonical MCP image block. Also returns useful structured references in text for text-only projections.
2. `qc_get_roof_outline_image`: new compatibility tool returning the exact same text/image content WITHOUT `structuredContent` or an output schema. The model tries it once if prepare's image is invisible. This is a controlled A/B path, not a guarantee of connector support.
3. Review panel, explicit **Send image and ask AI**: where `window.openai.uploadFile` and `setWidgetState` are available, upload the exact prepared raster and share its genuine host file ID through `imageIds`, then send the request. No invented file IDs or caller API keys. Otherwise a connected standard MCP Apps host receives image content through `ui/update-model-context` before the text message.
4. Browser fallback: download the byte-identical prepared image, attach that file to the connected AI conversation, and paste the generated request. This works independently of whether the connector can expose returned MCP image blocks. It still needs the host to see a direct attachment, invoke tools and produce useful coordinates.
5. If no matching image is visible, do not trace. The user can draw manually in the same review workspace.

A host acknowledgement is NOT evidence that its model saw the image. The UI and diagnostics say so. No automatic repeat-upload loop exists. A timed-out extension falls back rather than keeping the editor busy indefinitely.

## Image and geometry identity

All routes use one canonical stored raster, one SHA-256, one image ID and one coordinate frame. The browser verifies the bytes before sharing or downloading. We do not introduce a separate downscaled model image or ask the model to guess transforms from a different original attachment. That deliberately narrows the prior handoff's suggested original-image fallback to an exact prepared-file fallback.

Current bounds remain 3 MiB source upload, 2 MiB canonical image, 2000-pixel maximum side. `image_ready` means server preparation, not visual recognition or measurement validation. Host-side image processing can still affect tracing accuracy; human correction and known-length calibration remain essential.

## Compatibility and scope

The existing combined `/mcp` endpoint remains. With both existing flags enabled there are 8 tools: 3 legacy calculation tools and 5 outline tools. With flags off there are still 3 legacy tools. The isolated `/mcp/host-scan` exposes the same 5 outline tools when enabled.

Review resource cache key is now `ui://quotecore/host-roof-outline-v2-image-delivery.html`. Refresh the connector and use a fresh conversation after deployment. Signed token version stays `qc-host-outline-v1`; unexpired existing references remain compatible.

No dependencies, database policies, rate-limit rules, geometry algorithms, paid AI Scan, Smart Assistant, pricing, original calculation handlers or marketing pages were changed. Native file input remains the documented object with `download_url` and `file_id`; a local sandbox path is not a valid remote file. No allowlist wildcards or new arbitrary URL fetchers were added.

The new browser fallback is intentionally functional even when no embedded UI appears. Open-review responses include an explicit actionable URL in text.

## Relevant files

- `app/lib/free-tools/host-roof-scan/image-delivery.ts`: image identity, safe diagnostics and wire format compatibility.
- `service.ts`: canonical delivery, text references, reader operation and visible recovery links.
- `registration.ts`, `contract.ts`, `schemas.ts`: new reader registration and metadata.
- `types.ts`: review resource version.
- `fetch-file.ts`: distinct rejection for local/special URL schemes.
- `widget.ts`: host image sharing, metadata-envelope compatibility, exact download, diagnostics, bounded host actions and edit protection.

See `AGENT_INTEGRATION.md`, `LIVE_TEST.md` and the package QA record for installation and limits.
