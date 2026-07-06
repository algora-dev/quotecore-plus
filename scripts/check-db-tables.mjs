const token = process.env.SUPABASE_ACCESS_TOKEN;

const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
};

async function runQuery(query) {
  const body = JSON.stringify({ query });
  const res = await fetch('https://api.supabase.com/v1/projects/aaavvfttkesdzblttmby/database/query', {
    method: 'POST',
    headers,
    body,
  });
  return res.json();
}

// Check quote_taxes table
const taxes = await runQuery(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quote_taxes'`);
console.log('quote_taxes table:', JSON.stringify(taxes, null, 2));

// Check the accept page query - does it reference columns that might not exist?
const acceptCols = await runQuery(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name LIKE '%footer%' OR table_name = 'quotes' AND column_name LIKE '%cq_%'`);
console.log('quote footer/cq columns:', JSON.stringify(acceptCols, null, 2));

// Check if pg_cron dispatch function exists
const cron = await runQuery(`SELECT jobname FROM cron.job WHERE jobname LIKE '%dispatch%' OR jobname LIKE '%scheduled%'`);
console.log('pg_cron jobs:', JSON.stringify(cron, null, 2));
