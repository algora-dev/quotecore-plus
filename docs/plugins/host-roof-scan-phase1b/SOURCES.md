# Sources and implementation basis

Checked 10 October 2026. Public platform information can change; the supplied repository's locked dependencies remain the integration target.

## Owner-provided source

- `quotecore-plus-mcp-handoff-20261010-3228415c-lean.zip`: baseline, existing `app/mcp/route.ts`, deterministic roof engine, middleware routing and deployment conventions.
- `QuoteCore_Host_Powered_Outline_Phase1_Integration_2026-10-10.zip`: selected Phase 1 outline prototype, review UI, tests and pure geometry/image code.
- Do not merge the earlier `QuoteCore_Host_Powered_Scan_Phase1_Return_2026-10-10.zip` into this implementation.

## Official platform references

- OpenAI, MCP server and UI quickstart: https://developers.openai.com/plugins/build/app-quickstart
  - Current custom MCP connection workflow, refresh after metadata changes and MCP Apps resource/bridge architecture.
- OpenAI, Build an MCP server: https://developers.openai.com/plugins/build/mcp-server
  - Existing-server reuse, focused tools, schemas, useful structured results and the distinction between `_meta` and authorization.
- OpenAI, Plugin reference: https://developers.openai.com/plugins/reference
  - Declared file fields, resource metadata and host-specific compatibility metadata.
- MCP TypeScript SDK server documentation: https://ts.sdk.modelcontextprotocol.io/server.html
  - Stateless Streamable HTTP and lifecycle patterns. Actual integration with this repository's SDK still needs its installed-package tests.

The 3/7/4 tool counts, flags, storage limits and operator scripts are properties of this implementation, not promises from OpenAI. Directory discovery, public distribution and host-model measurement accuracy are not verified or guaranteed here.
