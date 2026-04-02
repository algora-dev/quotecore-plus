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

const email = 'test@gmail.com';
const newPassword = 'roofertest';

(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error('Missing Supabase envs');
    process.exit(1);
  }

  const supabaseAdmin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    console.error('listUsers error:', error);
    process.exit(1);
  }

  const user = data.users.find((u) => u.email?.toLowerCase() === email);
  if (!user) {
    console.error('User not found for email:', email);
    process.exit(1);
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });

  if (updateError) {
    console.error('update error:', updateError);
    process.exit(1);
  }

  console.log('Password reset for', email, 'user id:', user.id);
  process.exit(0);
})();
