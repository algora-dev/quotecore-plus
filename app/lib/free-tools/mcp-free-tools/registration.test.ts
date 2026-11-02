import assert from 'node:assert/strict';
import test from 'node:test';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { FREE_TOOLS_LAUNCHER_URI } from './launcher';
import { FREE_TOOLS_MCP_TOOL_NAMES, registerFreeToolsMcpTools } from './registration';

type RegisteredTool = { config: Record<string, unknown>; callback: (...args: never[]) => unknown };
type RegisteredResource = { config: Record<string, unknown>; callback: (uri: URL, extra: unknown) => unknown };

function captureRegistration() {
  const tools = new Map<string, RegisteredTool>();
  const resources = new Map<string, RegisteredResource>();
  const server = {
    registerTool(name: string, config: Record<string, unknown>, callback: (...args: never[]) => unknown) {
      tools.set(name, { config, callback });
      return {};
    },
    registerResource(name: string, _uri: string, config: Record<string, unknown>, callback: (uri: URL, extra: unknown) => unknown) {
      resources.set(name, { config, callback });
      return {};
    },
  } as unknown as McpServer;

  registerFreeToolsMcpTools(server, 'https://example.test', () => {
    throw new Error('service should not be resolved during registration');
  });
  return { tools, resources };
}

test('only render tools advertise the launcher; finder remains a plain data tool', () => {
  const { tools } = captureRegistration();
  assert.deepEqual([...tools.keys()], [...FREE_TOOLS_MCP_TOOL_NAMES]);

  const finder = tools.get('find_quotecore_tool')?.config;
  assert.ok(finder);
  const finderMeta = finder._meta as Record<string, unknown>;
  assert.equal(finderMeta['openai/outputTemplate'], undefined);
  assert.equal(finderMeta.ui, undefined);
  assert.ok(finder.outputSchema);

  for (const name of FREE_TOOLS_MCP_TOOL_NAMES.filter((tool) => tool !== 'find_quotecore_tool')) {
    const config = tools.get(name)?.config;
    assert.ok(config, name);
    assert.ok(config.outputSchema, `${name} output schema`);
    const meta = config._meta as Record<string, unknown>;
    assert.equal(meta['openai/outputTemplate'], FREE_TOOLS_LAUNCHER_URI, name);
    assert.equal(meta['ui/resourceUri'], FREE_TOOLS_LAUNCHER_URI, `${name} legacy MCP Apps alias`);
    assert.equal((meta.ui as { resourceUri?: string })?.resourceUri, FREE_TOOLS_LAUNCHER_URI, name);
  }
});

test('launcher resource advertises MCP Apps MIME and connection-time UI metadata', async () => {
  const { resources } = captureRegistration();
  const resource = resources.get('quotecore-free-tools-launcher');
  assert.ok(resource);
  assert.equal(resource.config.mimeType, RESOURCE_MIME_TYPE);
  const listingMeta = resource.config._meta as { ui?: { domain?: string; prefersBorder?: boolean } };
  assert.equal(listingMeta.ui?.prefersBorder, true);
  assert.equal(listingMeta.ui?.domain, undefined);

  const result = await resource.callback(new URL(FREE_TOOLS_LAUNCHER_URI), {});
  const contents = (result as { contents: Array<{ uri: string; mimeType: string; text: string; _meta?: Record<string, unknown> }> }).contents;
  assert.equal(contents[0]?.uri, FREE_TOOLS_LAUNCHER_URI);
  assert.equal(contents[0]?.mimeType, RESOURCE_MIME_TYPE);
  assert.match(contents[0]?.text ?? '', /QuoteCore\+ MCP Apps launcher v4\.0\.1 boot/);
  const meta = contents[0]?._meta ?? {};
  assert.equal((meta.ui as { domain?: string } | undefined)?.domain, undefined);
  assert.equal(meta['openai/widgetDomain'], undefined);
  assert.deepEqual((meta['openai/ui'] as { availableDisplayModes?: string[] })?.availableDisplayModes, ['inline']);
  assert.equal((meta['openai/widgetCSP'] as { redirect_domains?: string[] })?.redirect_domains?.[0], 'https://example.test');
});


test('temporary-session tools are annotated as stateful writes', () => {
  const { tools } = captureRegistration();
  for (const name of ['start_roof_takeoff', 'start_cladding_takeoff', 'start_flooring_takeoff', 'start_measurements_to_pricing']) {
    const config = tools.get(name)?.config;
    assert.ok(config, name);
    const annotations = config.annotations as { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
    assert.equal(annotations.readOnlyHint, false, `${name} readOnlyHint`);
    assert.equal(annotations.destructiveHint, false, `${name} destructiveHint`);
    assert.equal(annotations.idempotentHint, false, `${name} idempotentHint`);
    assert.equal(annotations.openWorldHint, false, `${name} openWorldHint`);
  }
});
