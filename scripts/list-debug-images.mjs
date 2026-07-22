import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envRaw = readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envRaw.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const quoteId = process.argv[2];
const { data, error } = await supabase.storage
  .from('QUOTE-DOCUMENTS')
  .list(`scan-debug/${quoteId}`, { sortBy: { column: 'created_at', order: 'desc' }, limit: 20 });

if (error) {
  console.error(error);
  process.exit(1);
}

for (const f of data) {
  const { data: urlData } = await supabase.storage
    .from('QUOTE-DOCUMENTS')
    .createSignedUrl(`scan-debug/${quoteId}/${f.name}`, 86400);
  console.log(`${f.name} -> ${urlData?.signedUrl || 'no url'}`);
}
