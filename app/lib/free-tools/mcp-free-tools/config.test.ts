import assert from 'node:assert/strict';
import test from 'node:test';
import { freeToolsMcpEnabled, freeToolsMcpFileOrigins, freeToolsMcpMode } from './config';

test('preview deployments default to the Free Tools MCP surface even with a stale legacy false flag', () => {
  const env = { VERCEL_ENV: 'preview', QC_FREE_TOOLS_MCP_ENABLED: 'false' };
  assert.equal(freeToolsMcpMode(env), 'free-tools');
  assert.equal(freeToolsMcpEnabled(env), true);
});

test('explicit legacy mode is the preview rollback switch', () => {
  const env = { VERCEL_ENV: 'preview', QC_FREE_TOOLS_MCP_ENABLED: 'true', QC_FREE_TOOLS_MCP_MODE: 'legacy' };
  assert.equal(freeToolsMcpMode(env), 'legacy');
  assert.equal(freeToolsMcpEnabled(env), false);
});

test('production stays legacy unless explicitly enabled', () => {
  assert.equal(freeToolsMcpMode({ VERCEL_ENV: 'production' }), 'legacy');
  assert.equal(freeToolsMcpMode({ VERCEL_ENV: 'production', QC_FREE_TOOLS_MCP_ENABLED: 'true' }), 'free-tools');
  assert.equal(freeToolsMcpMode({ VERCEL_ENV: 'production', QC_FREE_TOOLS_MCP_MODE: 'free-tools' }), 'free-tools');
});

test('invalid explicit mode fails loudly instead of silently selecting a connector surface', () => {
  assert.throws(() => freeToolsMcpMode({ VERCEL_ENV: 'preview', QC_FREE_TOOLS_MCP_MODE: 'maybe' }), /free-tools or legacy/);
});

test('freeToolsMcpFileOrigins accepts an explicit prefix family for rotating OpenAI staging hosts', () => {
  const env = { QC_FREE_TOOLS_MCP_FILE_ORIGINS: 'https://oaisdmntprwestus2.blob.core.windows.net, https://OAISDMNTP*.blob.core.windows.net' };
  assert.deepEqual(freeToolsMcpFileOrigins(env), [
    'https://oaisdmntprwestus2.blob.core.windows.net',
    'https://oaisdmntp*.blob.core.windows.net',
  ]);
  assert.deepEqual(freeToolsMcpFileOrigins({}), []);
});

test('freeToolsMcpFileOrigins rejects broad or malformed wildcard entries', () => {
  for (const bad of [
    'https://*.blob.core.windows.net',
    'https://ab*.blob.core.windows.net',
    'https://oaisdmntp*r.blob.core.windows.net',
    'https://oaisdmntp*.blob.core.windows.net/x',
    'https://oaisdmntp*.blob.core.windows.net?sig=1',
  ]) {
    assert.throws(() => freeToolsMcpFileOrigins({ QC_FREE_TOOLS_MCP_FILE_ORIGINS: bad }), /prefix family/, bad);
  }
});
