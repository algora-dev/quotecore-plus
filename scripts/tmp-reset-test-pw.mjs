// Temp: set a known password on the quota-hammer TEST account only
// (gavin-demo-toggle@quotecore.test). Never touch real accounts.
const sr = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!sr) { console.error('NO_KEY'); process.exit(1); }
(async () => {
  const r = await fetch('https://bcqrrrvbzlfmfgvotzqw.supabase.co/auth/v1/admin/users/9f1a6762-5916-4ef0-bd8c-b413300d7d48', {
    method: 'PUT',
    headers: { apikey: sr, Authorization: 'Bearer ' + sr, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'QcHammer2026!' }),
  });
  console.log('status=' + r.status);
  const j = await r.json().catch(() => null);
  console.log(j && j.id ? 'updated=' + j.id : JSON.stringify(j).slice(0, 200));
})();
