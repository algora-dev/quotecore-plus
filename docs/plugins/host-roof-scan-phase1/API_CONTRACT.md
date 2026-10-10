> Historical Phase 1 reference. For this integrated package, use [Phase 1B integration instructions](../host-roof-scan-phase1b/INTEGRATION.md). They supersede the endpoint, environment and deployment steps below.

# Protocol, image and review contracts

## Coordinate invariant

The raster in `qc_prepare_roof_outline` image content is the image shown in the review screen. Both use `qc-analysis-raster-v1`, origin top-left, x rightwards and y downwards. Coordinates are bounded to `0..width-1` and `0..height-1` inclusive. EXIF rotation and resizing happen before the host sees this frame.

The frame includes image ID, SHA-256, width, height and MIME type. `observedImageId` must match. The proposal and review references are signed and bound to that image hash. An earlier thumbnail, browser viewport, cropped plan or raw pre-rotation image is not interchangeable.

`toSceneScanData` maps only the same uncropped, unrotated prepared image to a scene with the same aspect ratio. It does not guess a crop/rotation transform. Importers must preserve `frame`, calibration and null pitch; the export is not an instruction to auto-save into an account.

## Tools

| Name | Input | Result |
| --- | --- | --- |
| `qc_prepare_roof_outline` | Either `plan` file reference or `planToken` | Prepared image content, frame, prompt, plan token, browser link |
| `qc_submit_roof_outline` | Plan token, observed image ID, outcome, one roof outline or empty array, notes | Proposed outline plus overlay and review link, or manual fallback |
| `qc_open_roof_outline_review` | Optional plan and proposal tokens | MCP Apps UI, authoritative image/outline, private UI review gate |
| `qc_export_reviewed_roof_outline` | Reviewed token from explicit UI review | Reviewed shape, provenance, optional calibrated plan area and compatible `roof_areas` |

Only the UI-opening tool declares `ui.resourceUri`. Data calls do not repeatedly instantiate editors. Each tool declares input/output schemas, annotations and anonymous security metadata. Only prepare can ingest/store a new file, so its read-only and idempotence annotations are false. It never performs inference.

### Native file parameter

```json
{
  "plan": {
    "download_url": "https://ALLOWLISTED_HOST/temporary-file",
    "file_id": "host-provided-file-id",
    "mime_type": "image/png",
    "file_name": "roof-plan.png"
  }
}
```

The first two fields are required. Optional MIME/name fields are declared for host compatibility, but binary sniffing determines what is accepted. Never invent a file URL. Hosts with unsupported file rewriting can use the UI upload flow and pass the returned plan token.

### Outline submission shape

```json
{
  "planToken": "VALUE_FROM_PREPARE",
  "observedImageId": "IMAGE_ID_FROM_PREPARE",
  "outcome": "proposed",
  "roof_areas": [{
    "name": "Main roof",
    "points": [{"x":100,"y":100},{"x":700,"y":100},{"x":700,"y":300},{"x":500,"y":300},{"x":500,"y":500},{"x":100,"y":500}],
    "pitch_degrees": null
  }],
  "notes": ["Describe any genuine uncertainty here."]
}
```

The above numbers are a synthetic software fixture, not a suggested response for an arbitrary roof. Never use them as model fallback data.

If the image is unreadable, submit `outcome: "unable_to_identify"` with `roof_areas: []`. Do not return an image-border rectangle as a roof estimate.

## Browser actions

`POST /api/public/host-roof-scan` accepts either raw PNG/JPEG/WebP bytes or bounded JSON `{action, args}`. Actions are `open`, `confirm`, `export`, `delete`. Only review confirmation accepts optional known-length calibration. There is no REST auto-scan action or account write.

The confirm action is not advertised as an MCP tool. It requires the extra UI reference and `confirmed: true`. This protects the ordinary model workflow against accidental auto-acceptance, but does not prove that a specific human used a browser. Do not reuse this mechanism for sending documents, changing account data or authorizing payments.

## UI bridge

Wire protocol uses stable MCP Apps `2026-01-26`: `ui/initialize`, `ui/notifications/initialized`, tool-result notifications, `ui/message`, `ui/update-model-context` and optional display-mode requests. Requests have timeouts. Messages must come from the actual parent; a nonopaque parent origin is pinned after handshake.

The Ask button is an explicit user action that asks the host to call prepare. It does not run the model from the server and cannot guarantee the host will start or complete inference. If unsupported, the UI provides a copyable request and browser/manual fallback. Optional `window.openai` compatibility hooks are feature-detected.

Images and the UI gate belong in `_meta` for rendering. The prepared image also appears as real MCP `ImageContent` when the host needs vision. Do not rely solely on an image URL, `imageIds`, hidden metadata or conversation text to deliver pixels.

## State and outcomes

`awaiting_image -> image_ready -> awaiting_review or cannot_identify -> review_open -> reviewed -> exported`

Any local edit invalidates the current reviewed state. A newly arriving host proposal cannot overwrite dirty/reviewed local work without a user choice. References expire after 30 minutes. Local draft download remains available independently of server confirmation.

Unknown fields, invalid bounds, nonfinite coordinates, duplicate points, crossings, self-touch, wrong-image tokens and unreviewed exports are rejected. A geometrically valid wrong roof still requires human detection and correction.
