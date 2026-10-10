// Applies the five P2 migrations IN ORDER to the shared project DB via the Management API.
// Pre-authorized standing permission (additive migrations only). Transactional files; stop on first error.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) { console.error('SUPABASE_ACCESS_TOKEN missing'); process.exit(1); }
const uri = 'https://api.supabase.com/v1/projects/aaavvfttkesdzblttmby/database/query';
const dir = path.join(__dirname, '..', '..', 'backend', 'supabase', 'migrations');
const files = [
  '20261010160000_custom_usage_p2.sql',
  '20261010161000_custom_scans_p2.sql',
  '20261010162000_custom_storage_p2.sql',
  '20261010163000_custom_usage_wrappers_p2.sql',
  '20261010164000_custom_assistant_budget_p2.sql',
];
(async () => {
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const sha = createHash('sha256').update(sql).digest('hex');
    let done = false;
    for (let attempt = 1; attempt <= 2 && !done; attempt++) {
      try {
        const res = await fetch(uri, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: sql }),
        });
        const text = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 600)}`);
        console.log(`APPLIED ${file} (sha256 ${sha.slice(0, 16)}…) -> ${text.slice(0, 200)}`);
        done = true;
      } catch (error) {
        if (attempt === 2) { console.error(`FAILED ${file}: ${error.message}`); process.exit(1); }
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
  }
  console.log('ALL FIVE P2 MIGRATIONS APPLIED');
})();
