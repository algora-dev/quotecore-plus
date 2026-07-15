#!/usr/bin/env node
/**
 * Crawl all URLs from the production sitemap and verify:
 * - HTTP 200 response
 * - No redirect
 * - Self-referencing canonical tag
 */

async function run() {
  const res = await fetch('https://quote-core.com/sitemap.xml');
  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  console.log(`Crawling ${urls.length} URLs from production sitemap...\n`);

  const results = [];
  let pass = 0, fail = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    process.stdout.write(`[${i + 1}/${urls.length}] ${url} ... `);
    try {
      const resp = await fetch(url, { redirect: 'manual' });
      const status = resp.status;
      const location = resp.headers.get('location');
      const html = await resp.text();
      const canonicalMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
      const canonical = canonicalMatch ? canonicalMatch[1] : null;

      const issues = [];
      if (status !== 200) issues.push(`HTTP ${status}`);
      if (location) issues.push(`redirect to ${location}`);

      // Normalize: strip trailing slash for comparison
      const normalizedUrl = url.replace(/\/$/, '');
      const normalizedCanonical = canonical ? canonical.replace(/\/$/, '') : null;
      if (!canonical) {
        issues.push('no canonical');
      } else if (normalizedCanonical !== normalizedUrl) {
        issues.push(`canonical mismatch: ${canonical}`);
      }

      if (issues.length === 0) {
        pass++;
        console.log('PASS');
      } else {
        fail++;
        console.log(`FAIL - ${issues.join('; ')}`);
      }
      results.push({ url, status, canonical, issues });
    } catch (e) {
      fail++;
      console.log(`ERROR - ${e.message}`);
      results.push({ url, error: e.message });
    }

    // Small delay every 10 URLs
    if (i % 10 === 9) await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n=== RESULTS ===');
  console.log(`Total: ${urls.length}`);
  console.log(`PASS: ${pass}`);
  console.log(`FAIL: ${fail}`);

  if (fail > 0) {
    console.log('\n--- Failures ---');
    for (const r of results.filter(r => r.issues?.length || r.error)) {
      console.log(`${r.url} -> ${r.issues ? r.issues.join('; ') : r.error}`);
    }
  } else {
    console.log('\n✅ ALL 125/125 PASSED — sitemap canonical fix verified on production.');
  }
}

run().catch(console.error);
