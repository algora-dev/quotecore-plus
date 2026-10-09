// Apply 20261009200000_component_library_sold_by_cover.sql via Management API (additive, nullable).
import { readFileSync } from 'node:fs';
const sql = readFileSync(new URL('../backend/supabase/migrations/20261009200000_component_library_sold_by_cover.sql', import.meta.url), 'utf8');
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN not set');
const r = await fetch('https://api.supabase.com/v1/projects/aaavvfttkesdzblttmby/database/query', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});
const body = await r.text();
console.log('STATUS', r.status);
console.log(body.slice(0, 600));
if (!r.ok) process.exit(1);
// Verify columns
const v = await fetch('https://api.supabase.com/v1/projects/aaavvfttkesdzblttmby/database/query', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'component_library' AND column_name IN ('sold_by','cover_width_mm') ORDER BY column_name;" }),
});
console.log('VERIFY', v.status, (await v.text()).slice(0, 400));
