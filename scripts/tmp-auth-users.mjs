const sr = process.env.SUPABASE_SERVICE_ROLE_KEY;
(async () => {
  const r = await fetch('https://bcqrrrvbzlfmfgvotzqw.supabase.co/auth/v1/admin/users?email=davydonothing@gmail.com', {
    headers: { apikey: sr, Authorization: 'Bearer ' + sr },
  });
  const j = await r.json();
  for (const u of j.users || []) {
    console.log('id=' + u.id + ' confirmed=' + (u.email_confirmed_at || 'NULL') + ' created=' + u.created_at + ' last=' + u.last_sign_in_at + ' identities=' + JSON.stringify((u.identities || []).map(i => i.provider)));
  }
  console.log('count=' + (j.users || []).length);
})();
