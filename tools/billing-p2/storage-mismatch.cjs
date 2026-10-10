// Inventory the 2 mismatched storage counters (read-only, sanitized: ids/deltas only).
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) { console.error('SUPABASE_ACCESS_TOKEN missing'); process.exit(1); }
const uri = 'https://api.supabase.com/v1/projects/aaavvfttkesdzblttmby/database/query';
const q = `SELECT c.id, c.billing_model, c.storage_used_bytes AS stored,
  COALESCE(f.n,0) AS files_sum, c.storage_used_bytes - COALESCE(f.n,0) AS drift,
  (SELECT count(*) FROM public.quote_files qf WHERE qf.company_id=c.id AND qf.file_type='logo') AS logo_rows,
  (SELECT count(*) FROM public.quote_files qf WHERE qf.company_id=c.id) AS file_rows
FROM public.companies c LEFT JOIN(SELECT company_id,sum(file_size)::bigint n FROM public.quote_files GROUP BY company_id) f ON f.company_id=c.id
WHERE c.storage_used_bytes IS DISTINCT FROM COALESCE(f.n,0);`;
(async () => {
  const res = await fetch(uri, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) });
  console.log(res.status, await res.text());
})();
