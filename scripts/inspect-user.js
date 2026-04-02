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

const userId = '2efd9a23-db92-439f-81af-93386ea2cd21';

(async () => {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (profileError || !profile) {
    console.error('Profile error:', profileError || 'not found');
    process.exit(1);
  }

  console.log('Profile:', profile);

  const { data: templates, error: templatesError } = await supabaseAdmin
    .from('templates')
    .select('id, name, company_id, created_at')
    .eq('company_id', profile.company_id);

  if (templatesError) {
    console.error('Templates error:', templatesError);
    process.exit(1);
  }

  console.log('Templates:', templates);

  process.exit(0);
})();
