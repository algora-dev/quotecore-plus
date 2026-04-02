const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.resolve(__dirname, '../.env.local');
if (!fs.existsSync(envPath)) {
  console.error('Could not find .env.local');
  process.exit(1);
}

const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
for (const line of lines) {
  if (!line || line.startsWith('#')) continue;
  const [name, value] = line.split('=', 2);
  if (name && value) {
    process.env[name] = value.trim();
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error('Missing Supabase envs');
  process.exit(1);
}

const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

(async () => {
  const { data, error } = await supabaseAdmin
    .from('templates')
    .select('id, name, company_id, created_at, companies ( slug, name )')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Templates error:', error);
    process.exit(1);
  }

  console.log(data);
  process.exit(0);
})();
