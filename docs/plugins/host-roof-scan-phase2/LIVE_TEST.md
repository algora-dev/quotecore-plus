# Real-host acceptance test

Use a fresh session/token. Default lifetime is short. Use a roof image you may share with the AI provider. PNG/JPEG/WebP only; export a PDF page first. No inferred scale/pitch or fabricated geometry.

## A. Direct MCP image delivery

1. Open the review workspace and upload the image. Copy the generated request. Native ChatGPT attachment input is optional if that connector actually transfers a supported file object.
2. Ask the host to call `qc_prepare_roof_outline` with that planToken.
3. Ask whether it can actually see the canonical image. Have it briefly describe an obvious visual detail that is not contained in the preparation metadata. Do not supply polygon coordinates for this test.
4. If invisible, call `qc_get_roof_outline_image` once with the same token. Do not repeatedly call either tool hoping for a scan.
5. Record which tool result was visible. If neither is visible, that is a connector/model-context result, not a geometry failure. Proceed to B or C.

## B. Embedded panel image sharing

If the review widget appears in ChatGPT, click **Send image and ask AI** once.
- Where supported, the widget uploads the verified prepared raster via the host file API and uses its returned `fileId` in `imageIds` before requesting a new turn.
- Otherwise a standard host gets image context through `ui/update-model-context`, then a text request.
- A sharing or follow-up failure opens the prepared-file fallback. If a call times out it may still complete at the provider, so do not spam the button.
- A confirmation that the host accepted a message is NOT confirmation its model sees pixels. Ask it explicitly.

## C. Exact prepared-file fallback

1. Open **Image not visible to your AI? Share the prepared image**.
2. Click **Download prepared image**. Keep the generated `quotecore-roof-<imageId>.png/jpg` file unchanged.
3. Attach that file directly to the same connected ChatGPT conversation and paste **Copy request**.
4. The host still calls prepare to get instructions and frame identity, but may inspect this exact prepared attachment if tool images are hidden. It must not swap to an older source image, crop, screenshot or guessed resize transform.
5. If it still cannot inspect a matching image, stop. Use manual tracing; report the visibility blocker.

## D. Outline quality and review

Once the host sees the image:
1. Submit one clockwise exterior polygon with the returned image ID, `pitch_degrees: null`, and no guessed measurements.
2. Open the returned proposal in the review panel or browser link.
3. Check alignment on the original prepared raster. Correct real missing/notched corners and misplaced vertices. A syntactically valid polygon is not an accurate roof boundary by definition.
4. To measure, choose a clearly known reference dimension and confirm its unit. Without calibration export only pixel-frame geometry. Do not use printed dimension text without checking what it refers to.
5. Explicitly confirm, export through the actual reviewToken, and inspect output status.
6. An incoming model proposal must not silently replace user edits or a reviewed outline. Check the Keep edits/Load new proposal choice.

## Evidence checklist

Record tool list/version, test date, host/surface/model selection when actually visible, image dimensions, safe image SHA/ID, server request IDs and delivery path. Retain a private side-by-side source/overlay for quality review with appropriate permission. Record correction effort and failures. Do not include tokens, review gates, private URLs or raw upload bytes in ordinary logs.

Software pass: exact image hashes match through transport, editor works, review/export gates hold.
Host-visibility pass: the actual model demonstrably sees the prepared image.
Practical tracing pass: it submits a useful perimeter that saves work after human correction on representative plans.
These are three separate results. Only after all are evaluated should we start interior lines and classifications.
