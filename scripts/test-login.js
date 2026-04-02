const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const [name, value] = line.split('=', 2);
    if (name && value) {
      process.env[name] = value.trim();
    }
  }
} else {
  console.error('Could not find .env.local');
  process.exit(1);
}

(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('Missing Supabase envs');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'test@gmail.com',
    password: 'roofertest',
  });

  console.log('error:', error);
  console.log('user id:', data?.user?.id || null);

  process.exit(0);
})();
