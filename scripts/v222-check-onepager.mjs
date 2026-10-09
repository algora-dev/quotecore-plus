import { readFileSync } from 'node:fs';
const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
for (const m of env.matchAll(/^([A-Z_][A-Z_0-9]*)=(.*)$/gm)) {
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (process.env[m[1]] === undefined) process.env[m[1]] = v;
}
const H = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` };
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const quoteId = process.argv[2];
const r = await fetch(`${url}/rest/v1/quote_files?quote_id=eq.${quoteId}&select=id,file_type,file_name,created_at&order=created_at.desc&limit=8`, { headers: H });
const rows = await r.json();
console.log(JSON.stringify(rows, null, 1));
