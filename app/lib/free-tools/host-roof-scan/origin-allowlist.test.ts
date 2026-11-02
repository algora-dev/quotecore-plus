import assert from 'node:assert/strict';
import test from 'node:test';
import { originAllowed, parseOriginFamilyPattern, validateDownloadUrl } from './fetch-file';
import { ScanError } from './types';

const FAMILY = 'https://oaisdmntp*.blob.core.windows.net';

test('parseOriginFamilyPattern accepts only explicit single-label prefix families', () => {
  assert.deepEqual(parseOriginFamilyPattern(FAMILY), { prefix: 'oaisdmntp', suffix: '.blob.core.windows.net' });
  assert.equal(parseOriginFamilyPattern('https://OAISDMNTP*.blob.core.windows.net')?.prefix, 'oaisdmntp');
  // Broad, short, mid-label, suffix-free, second-star and path/query forms all stay invalid.
  assert.equal(parseOriginFamilyPattern('https://*.blob.core.windows.net'), null);
  assert.equal(parseOriginFamilyPattern('https://blob*.blob.core.windows.net')?.prefix, 'blob'); // 4 chars is enough
  assert.equal(parseOriginFamilyPattern('https://ab*.blob.core.windows.net'), null);
  assert.equal(parseOriginFamilyPattern('https://oaisdmntp*r.blob.core.windows.net'), null);
  assert.equal(parseOriginFamilyPattern('https://oaisdmntp*'), null);
  assert.equal(parseOriginFamilyPattern('https://oaisdmntp*.blob'), null);
  assert.equal(parseOriginFamilyPattern('https://a*b*c.blob.core.windows.net'), null);
  assert.equal(parseOriginFamilyPattern('https://oaisdmntp*.blob.core.windows.net/'), null);
  assert.equal(parseOriginFamilyPattern('https://oaisdmntp*.blob.core.windows.net?sig=1'), null);
  assert.equal(parseOriginFamilyPattern('http://oaisdmntp*.blob.core.windows.net'), null);
});

test('originAllowed matches every rotating regional staging host in the family', () => {
  const allowed = [FAMILY];
  for (const host of ['oaisdmntprwestus2', 'oaisdmntprcentralus', 'oaisdmntprnortheu', 'oaisdmntpr']) {
    assert.ok(originAllowed(`https://${host}.blob.core.windows.net`, allowed), host);
  }
});

test('originAllowed keeps the wildcard inside a single label', () => {
  const allowed = [FAMILY];
  assert.equal(originAllowed('https://oaisdmntp.evil.blob.core.windows.net', allowed), false);
  assert.equal(originAllowed('https://oaisdmntp.blob.core.windows.net.evil.com', allowed), false);
  assert.equal(originAllowed('https://xoaisdmntp.blob.core.windows.net', allowed), false);
  assert.equal(originAllowed('https://evil.blob.core.windows.net', allowed), false);
  assert.equal(originAllowed('http://oaisdmntprwestus2.blob.core.windows.net', allowed), false);
});

test('exact origins still take precedence alongside family entries', () => {
  const allowed = [FAMILY, 'https://fixed.example.com'];
  assert.ok(originAllowed('https://fixed.example.com', allowed));
  assert.equal(originAllowed('https://other.example.com', allowed), false);
  assert.equal(originAllowed('https://fixed.example.com.evil.com', allowed), false);
});

test('validateDownloadUrl accepts family download URLs and still leaks only the origin on rejection', () => {
  const url = validateDownloadUrl(`https://oaisdmntprwestus2.blob.core.windows.net/container/plan.png?sig=secret`, [FAMILY]);
  assert.equal(url.hostname, 'oaisdmntprwestus2.blob.core.windows.net');
  assert.throws(
    () => validateDownloadUrl(`https://evil.blob.core.windows.net/container/plan.png?sig=secret`, [FAMILY]),
    (error: unknown) => {
      assert.ok(error instanceof ScanError);
      assert.equal(error.code, 'FILE_HOST_NOT_ALLOWED');
      assert.ok(String(error.message).includes('https://evil.blob.core.windows.net'));
      assert.ok(!String(error.message).includes('sig='));
      return true;
    },
  );
});
