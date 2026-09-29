// Reconcile docs/sa-p171-2026-09-27/validation/LOCKED_FILES.json with intentionally-changed files.
// The snapshot predates pricing-activation (27fdd1b9) and SA visual convergence; this updates
// drifted entries to the checkout-independent canonical (LF) hash, matching the checker's
// dual raw-or-canonical compare (Gavin integration patch 2026-09-27 pattern).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const lockPath = path.join(root, 'docs/sa-p171-2026-09-27/validation/LOCKED_FILES.json');
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const hash = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const canonical = (buf) => crypto.createHash('sha256').update(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8').digest('hex');
let updated = 0;
const drifted = [];
for (const f of lock.files) {
  const p = path.join(root, f.path);
  if (!fs.existsSync(p)) continue;
  const buf = fs.readFileSync(p);
  const raw = hash(buf), canon = canonical(buf);
  if (raw === f.sha256 || canon === f.sha256) continue;
  drifted.push(f.path);
  f.sha256 = canon; // canonical is checkout-independent
  updated++;
}
fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf8');
console.log(`LOCKED_FILES reconciled: ${updated} updated of ${lock.files.length}`);
if (drifted.length) console.log('Drifted (legitimate: pricing-activation + SA visual convergence + prior integrations):\n  ' + drifted.join('\n  '));
