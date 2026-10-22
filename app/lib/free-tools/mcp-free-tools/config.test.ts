import assert from 'node:assert/strict';
import test from 'node:test';
import { freeToolsMcpEnabled, freeToolsMcpMode } from './config';

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
