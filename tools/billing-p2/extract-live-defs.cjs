// Extract live function definitions from preflight-results.json into an overlay SQL file.
const fs = require('node:fs');
const path = require('node:path');
const results = JSON.parse(fs.readFileSync(path.join(__dirname, 'preflight-results.json'), 'utf8'));
const rows = results[4] || [];
const wanted = ['create_quote_atomic', 'company_has_feature', 'get_ai_assist_points_status', 'sa_check_turn_quota', 'fn_quote_status_usage_delta', 'sa_admit_run', 'update_company_storage_usage'];
const found = new Map();
for (const row of rows) {
  if (wanted.includes(row.proname) && row.definition) found.set(row.proname, row.definition);
}
// Triggers from stmt 5 relevant to quotes/quote_files (skip: fixture keeps its own storage trigger).
const out = ['-- LIVE definitions captured read-only from the shared DB (sanitized: schema only).',
  '-- Used ONLY in the disposable overlay harness to validate P2 migration 4 against actual bodies.'];
for (const name of wanted) {
  const def = found.get(name);
  if (!def) { out.push(`-- MISSING live def: ${name}`); continue; }
  out.push(def.trim().replace(/;?\s*$/, ';'));
}
fs.writeFileSync(path.join(__dirname, 'live-defs-overlay.sql'), out.join('\n\n') + '\n');
console.log('functions captured:', [...found.keys()].join(', '));
console.log('missing:', wanted.filter((w) => !found.has(w)).join(', ') || 'none');
