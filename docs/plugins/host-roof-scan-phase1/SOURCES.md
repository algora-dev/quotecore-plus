> Historical Phase 1 reference. For this integrated package, use [Phase 1B integration instructions](../host-roof-scan-phase1b/INTEGRATION.md). They supersede the endpoint, environment and deployment steps below.

# Source basis and current external checks

Checked 10 October 2026. Repository facts and implementation choices are separate from platform claims.

## Provided code

Baseline commit: `3228415c`, owner-supplied lean MCP ZIP.

- `AGENT_HANDOFF.md`: intended nine tools, free-scan restriction, allowed surfaces and return contract.
- `app/lib/takeoff/ai-prompt-v3.ts`: actual outline / line / classification prompts.
- `app/lib/takeoff/aiScanShared.ts`: paid-client import boundary, not used by the experiment.
- `app/lib/takeoff/scanOverlay.ts`: reused overlay renderer.
- `app/lib/takeoff/precision/precisionGeometry.ts` and `calibrationCoordinates.ts`: reused geometry and coordinate helpers.
- `app/mcp/route.ts`: existing production MCP retained unchanged.
- `app/(public)/free-roof-takeoff/tradeConfig.ts`: existing free scan remains disabled.
- `middleware.ts`: public route prefix behavior, checked in source only.

The latest conversation authorizes an isolated host-powered experiment despite the earlier package brief forbidding free paid-API scanning. It does not authorize enabling the existing paid scans in the free tools.

## Official external documentation

1. OpenAI, Add UI to your MCP server: standards-first MCP Apps bridge, UI resources, fullscreen, decoupled data/render tools, state handling and optional OpenAI extensions. https://developers.openai.com/plugins/build/chatgpt-ui
2. OpenAI, Plugin UI reference: tool metadata, file parameters, bridge methods and file handling. https://developers.openai.com/plugins/reference
3. OpenAI, Build an MCP server: server/tool structure and annotations. https://developers.openai.com/plugins/build/mcp-server
4. OpenAI, Images and vision: relevant limits of model image interpretation. https://developers.openai.com/api/docs/guides/images-vision
5. MCP Apps stable specification 2026-01-26: JSON-RPC UI methods, initialization, context, display modes and CSP. https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx
6. MCP Apps overview: host-dependent support and current SDK version compatibility. https://apps.extensions.modelcontextprotocol.io/api/
7. MCP Apps current protocol types: `ui/message` sends `content: ContentBlock[]`, and its result may include `isError`. Implemented from the actual type contract, not the inconsistent single-object example in the older prose specification. https://github.com/modelcontextprotocol/ext-apps/blob/main/src/spec.types.ts
8. Next.js route handlers: Web Request/Response and route conventions. https://nextjs.org/docs/app/getting-started/route-handlers

The repository retains its existing MCP SDK 1.x dependency. The UI implements the stable wire protocol directly rather than upgrading to the newer SDK family. This avoided a cross-project dependency migration. Real host acceptance of the resource/bridge still needs testing.

## Deliberate nonclaims

No proof that a particular user's subscription guarantees a particular model, image resolution or geometry quality. No promise of directory acceptance, automatic citation or recommendations. No assertion that ChatGPT, Claude and Grok have identical UI support. No claim that QuoteCore+'s paid scan is more accurate without a controlled comparison.
