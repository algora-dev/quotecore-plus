import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertAllowedOrigin } from './config';
import { HostOutlineService } from './service';
import { MemoryImageStore } from './store';

const env = { QC_HOST_SCAN_ORIGIN: 'https://canonical.example', QC_HOST_SCAN_UI_ORIGINS: '' };
test('same-origin preview requests work without wildcard origins', () => {
  assert.doesNotThrow(() => assertAllowedOrigin(new Request('https://preview.example/mcp/host-scan', { headers: { origin: 'https://preview.example' } }), env));
  assert.throws(() => assertAllowedOrigin(new Request('https://preview.example/mcp/host-scan', { headers: { origin: 'https://evil.example' } }), env), /origin is not allowed/);
});

test('prepare accepts valid base64 image and rejects malformed and oversized input', async () => {
  const service = new HostOutlineService({ origin: 'https://canonical.example', secret: 'test-secret-long-enough-for-tickets', store: new MemoryImageStore(), allowedFileOrigins: [] });
  await assert.rejects(async () => service.prepare({ image_data: 'not base64!' }), /base64/);
  await assert.rejects(async () => service.prepare({ image_data: 'AAAA', planToken: 'abc' }), /exactly one/);
  await assert.rejects(async () => service.prepare({ image_data: 'A'.repeat(4 * 1024 * 1024 + 100) }), /at most|too large|no larger|maximum/);
});
