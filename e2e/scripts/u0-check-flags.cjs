/* eslint-disable @typescript-eslint/no-require-imports */
// U0 diagnostic: read takeoff_touch_feature_flags from the dev DB (read-only).
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim().replace(/^["']|["']$/g, '');
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim().replace(/^["']|["']$/g, '');
const sb = createClient(url, key, { auth: { persistSession: false } });
(async () => {
  const flags = await sb.from('takeoff_touch_feature_flags').select('company_id,enabled');
  const companies = await sb.from('companies').select('id,name');
  const nameOf = (id) => (companies.data || []).find((c) => c.id === id)?.name ?? id;
  console.log('flag rows:', JSON.stringify((flags.data || []).map((f) => ({ company: nameOf(f.company_id), enabled: f.enabled })), null, 2));
  const missing = (companies.data || []).filter((c) => !(flags.data || []).some((f) => f.company_id === c.id));
  console.log('companies WITHOUT flag row:', JSON.stringify(missing.map((c) => c.name), null, 2));
})();
