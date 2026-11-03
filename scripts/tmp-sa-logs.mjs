import { readFileSync } from 'node:fs';
const env = Object.fromEntries(
  readFileSync('.env.demo-from-testing', 'utf8').split(/\r?\n/)
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || url.length < 10) { console.error('ENV MISSING', { url: !!url, key: !!key }); process.exit(1); }
async function q(path) {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const text = await res.text();
  if (!res.ok) { console.error(`HTTP ${res.status}: ${text.slice(0, 300)}`); process.exit(1); }
  return JSON.parse(text);
}
const args = process.argv.slice(2);
console.log(JSON.stringify(await q(args[0]), null, args[1] === 'raw' ? 0 : 2));
