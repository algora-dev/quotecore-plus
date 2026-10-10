# Sources and interpretation

Reviewed 10 October 2026. Source behavior and host claims are kept separate.

## Supplied repository

`HANDOFF_PHASE2_IMAGE_DELIVERY.md`, baseline `86eb8e97`: agent reports successful panel-token ingestion and synthetic backend tests, but model-visible image failure in ChatGPT. Existing `service.ts` already returned base64 MCP image content. These are source/handoff observations, not a new deployed test by the patch author.

## Official platform references

- OpenAI plugin reference: https://developers.openai.com/plugins/reference
  File-parameter object metadata and the `toolResponseMetadata` compatibility envelopes. The patch preserves documented native file input instead of treating a sandbox path as a remote URL.
- OpenAI MCP UI guide: https://developers.openai.com/plugins/build/chatgpt-ui
  `uploadFile`, genuine file IDs, `setWidgetState` imageIds and versioned UI resource caching. The patch feature-detects the extensions; their presence is not assumed on every connector.
- MCP tools specification: https://modelcontextprotocol.io/specification/2026-07-28/server/tools
  Image ContentBlock layout and structured versus unstructured content. A content-only retrieval operation is our compatibility experiment, not an official guarantee that image visibility will improve.
- MCP Apps specification: https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx
  https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/main/specification/2026-01-26/apps.mdx
  `ui/update-model-context` accepts content blocks, including an image. `ui/message` sends the follow-up text. Host implementation and model media support must be tested.

## Deliberate constraints

No use of ChatGPT subscription as an API key, no MCP sampling, no provider inference call, no claim of universal cross-host availability, no automatic calibration or pitch, no original-image coordinate transform guessed by the model. Directly attaching the exact prepared raster is a user-mediated fallback, not a promise of invisible automatic ingestion.
