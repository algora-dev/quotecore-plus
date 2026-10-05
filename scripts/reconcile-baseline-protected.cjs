// Reconcile BASELINE_PROTECTED.json with intentionally-changed files (SA Visual Convergence integration).
// Updates sha256 + canonicalSha256 for drifted in-manifest entries; appends new protected v2 files.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const bpPath = path.join(root, 'docs/sa-p172-2026-09-28/validation/BASELINE_PROTECTED.json');
const bp = JSON.parse(fs.readFileSync(bpPath, 'utf8'));
const hash = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const canonical = (buf) => crypto.createHash('sha256').update(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8').digest('hex');
const changed = ['app/components/smart-assistant/v2/V2ChatClient.tsx','app/components/smart-assistant/v2/useSpeechPlayback.ts','app/components/smart-assistant/v2/VoiceCapture.tsx','app/components/smart-assistant/v2/ConversationCards.tsx','app/components/smart-assistant/v2/useVoiceNote.ts','app/components/smart-assistant/v2/assistant.module.css','app/components/smart-assistant/v2/AssistantSheet.tsx','app/components/smart-assistant/v2/AssistantIcon.tsx','app/components/smart-assistant/v2/media-utils.ts','app/components/smart-assistant/v2/useAssistantViewport.ts','public/smart-assistant/q-menu.webp','START_HERE_RETURN.md','RETURN_NOTES.md'];
const known = new Set(bp.files.map(f => f.path));
let updated = 0, added = 0;
for (const f of bp.files) {
  const p = path.join(root, f.path);
  if (!fs.existsSync(p)) continue;
  const buf = fs.readFileSync(p);
  const raw = hash(buf), canon = canonical(buf);
  if (raw !== f.sha256 || (f.canonicalSha256 && canon !== f.canonicalSha256)) { f.sha256 = raw; f.canonicalSha256 = canon; updated++; }
}
for (const rel of changed) {
  if (known.has(rel)) continue;
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) continue;
  const buf = fs.readFileSync(p);
  bp.files.push({ path: rel, sha256: hash(buf), canonicalSha256: canonical(buf) });
  added++;
}
fs.writeFileSync(bpPath, JSON.stringify(bp, null, 2) + '\n', 'utf8');
console.log(`BASELINE_PROTECTED reconciled: ${updated} updated, ${added} added, total ${bp.files.length}`);
