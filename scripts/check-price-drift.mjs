#!/usr/bin/env node
/**
 * check-price-drift.mjs — guards against the "card shows $19 but Stripe charges $40" bug.
 *
 * Compares each active plan's DB `price_cents_monthly` against the unit_amount
 * of the Stripe Price it points to, for the current Stripe key's mode.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... SUPABASE_ACCESS_TOKEN=... node scripts/check-price-drift.mjs
 *   (or run from projects/quotecore-plus with those in .env.local / shell env)
 *
 * Exit code 0 = all aligned, 1 = drift or error found. Run before any price change ships.
 */
import fs from 'fs';

function fromEnvFile(name) {
  try {
    const env = fs.readFileSync('.env.local', 'utf8');
    const line = env.split('\n').find((l) => l.startsWith(name + '='));
    if (!line) return undefined;
    return line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '').trim();
  } catch {
    return undefined;
  }
}

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || fromEnvFile('STRIPE_SECRET_KEY');
const SUPA_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || fromEnvFile('SUPABASE_ACCESS_TOKEN');
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'aaavvfttkesdzblttmby';

if (!STRIPE_KEY || !STRIPE_KEY.startsWith('sk_')) {
  console.error('No usable STRIPE_SECRET_KEY (need sk_test_ or sk_live_).');
  process.exit(1);
}
if (!SUPA_TOKEN) {
  console.error('No SUPABASE_ACCESS_TOKEN.');
  process.exit(1);
}

const mode = STRIPE_KEY.startsWith('sk_live') ? 'live' : 'test';
const priceCol = mode === 'live' ? 'stripe_price_id_live' : 'stripe_price_id_test';
console.log(`Stripe mode: ${mode} → comparing DB.${priceCol} vs Stripe unit_amount\n`);

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + SUPA_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return r.json();
}

const plans = await sql(
  `select code, price_cents_monthly, price_cents_monthly_original, ${priceCol} as price_id from subscription_plans where active = true and ${priceCol} is not null order by sort_order`,
);
if (plans.message) {
  console.error('DB error:', plans.message);
  process.exit(1);
}

let drift = 0;
for (const p of plans) {
  const r = await fetch(`https://api.stripe.com/v1/prices/${p.price_id}`, {
    headers: { Authorization: 'Bearer ' + STRIPE_KEY },
  });
  const sp = await r.json();
  if (sp.error) {
    console.log(`✗ ${p.code}: Stripe error — ${sp.error.message.slice(0, 60)}`);
    drift++;
    continue;
  }
  const ok = sp.unit_amount === p.price_cents_monthly;
  const orig = p.price_cents_monthly_original
    ? ` (was $${(p.price_cents_monthly_original / 100).toFixed(0)} strikethrough)`
    : '';
  if (ok) {
    console.log(`✓ ${p.code}: $${(sp.unit_amount / 100).toFixed(0)}/mo — DB and Stripe match${orig}`);
  } else {
    console.log(
      `✗ ${p.code}: DRIFT — DB=$${(p.price_cents_monthly / 100).toFixed(0)} but Stripe charges $${(sp.unit_amount / 100).toFixed(0)}`,
    );
    drift++;
  }
}

console.log('');
if (drift > 0) {
  console.error(`❌ ${drift} plan(s) drifted. Fix before shipping — the card price must equal the Stripe charge.`);
  process.exit(1);
}
console.log('✅ All active plans aligned: card price == Stripe charge.');
