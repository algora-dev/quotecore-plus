#!/usr/bin/env node
/**
 * Submit ALL URLs from the live sitemap to IndexNow (Bing + partners).
 * Usage: node scripts/submit-indexnow.mjs [sitemapUrl]
 * Default: https://quote-core.com/sitemap.xml
 * Key file must be deployed at https://quote-core.com/<KEY>.txt
 */

import fs from 'node:fs';
import path from 'node:path';

const INDEXNOW_KEY = '22ffbce37a69481c9841bddef9028097';
const INDEXNOW_URL = 'https://api.indexnow.org/IndexNow';
const SITEMAP_URL = process.argv[2] || 'https://quote-core.com/sitemap.xml';
const HOST = new URL(SITEMAP_URL).host;

async function getSitemapUrls() {
  const res = await fetch(SITEMAP_URL);
  if (!res.ok) throw new Error(`Sitemap fetch failed: ${res.status}`);
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  return locs.filter((u) => new URL(u).host === HOST);
}

async function submit(urlList) {
  const body = {
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
    urlList,
  };
  const res = await fetch(INDEXNOW_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
}

async function main() {
  const urls = await getSitemapUrls();
  console.log(`Sitemap ${SITEMAP_URL}: ${urls.length} URLs`);
  // IndexNow allows up to 10k URLs per request; batch at 1000 to be safe.
  for (let i = 0; i < urls.length; i += 1000) {
    const batch = urls.slice(i, i + 1000);
    const { status, text } = await submit(batch);
    console.log(`Batch ${Math.floor(i / 1000) + 1}: ${batch.length} URLs -> ${status} ${text || 'OK'}`);
    if (status >= 400) process.exitCode = 1;
  }
  // Log submission for tracking
  const logFile = path.join(process.cwd(), '.indexnow-log.json');
  let log = [];
  try { log = JSON.parse(fs.readFileSync(logFile, 'utf8')); } catch {}
  log.push({ date: new Date().toISOString(), sitemap: SITEMAP_URL, count: urls.length });
  fs.writeFileSync(logFile, JSON.stringify(log, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
