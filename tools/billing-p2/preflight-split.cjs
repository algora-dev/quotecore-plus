// Runs each preflight.sql statement separately (Management API returns one result per call).
// Sanitized output: counts/config/definitions only. No secrets.
const fs = require('node:fs');
const path = require('node:path');
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) { console.error('SUPABASE_ACCESS_TOKEN missing'); process.exit(1); }
const uri = 'https://api.supabase.com/v1/projects/aaavvfttkesdzblttmby/database/query';
const sql = fs.readFileSync(path.join(__dirname, 'preflight.sql'), 'utf8');
// Statement text contains no embedded semicolons (results may; we only split the file).
const statements = sql.split(/;\s*(?:\n|$)/).map((s) => s.replace(/^--.*$/gm, '').trim()).filter((s) => s.length > 0);
async function run(i, statement) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(uri, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: statement }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return await res.json();
    } catch (error) {
      if (attempt === 3) return { error: String(error.message || error) };
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
}
(async () => {
  const out = [];
  for (let i = 0; i < statements.length; i++) {
    const result = await run(i, statements[i]);
    out.push(result);
    const brief = JSON.stringify(result);
    console.log(`--- stmt ${i} (${brief.length} chars): ${brief.slice(0, 500)}`);
  }
  fs.writeFileSync(path.join(__dirname, 'preflight-results.json'), JSON.stringify(out, null, 1));
  console.log('saved preflight-results.json');
})();
