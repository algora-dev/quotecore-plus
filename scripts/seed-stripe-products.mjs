/**
 * Seed Stripe products + prices for QuoteCore+ phase 1 plans.
 *
 * Run:
 *   node scripts/seed-stripe-products.mjs
 *
 * Reads STRIPE_SECRET_KEY from .env.local (or the process env). Mode is
 * inferred from the key prefix: sk_test_ -> test mode, sk_live_ -> live.
 *
 * IDEMPOTENCY:
 *   - Each product is keyed by `metadata.quotecore_plan_code`. The script
 *     first searches Stripe for a product with that metadata; if found,
 *     reuses it instead of creating a duplicate.
 *   - Each recurring price is keyed by `lookup_key` = `qc_<plan>_monthly_<mode>`.
 *     If a price with that lookup_key already exists, the script reuses
 *     it. Stripe forbids editing an existing price (immutable by design),
 *     so re-running with a different amount creates a NEW price + marks
 *     the old one inactive.
 *
 * OUTPUT:
 *   The script prints a SQL block ready to paste into the Supabase SQL
 *   editor that updates subscription_plans.stripe_price_id_test (or
 *   stripe_price_id_live) for the four phase-1 plans.
 *
 * SCOPE:
 *   Phase 1 ships starter / growth / pro. Trial is free and not represented
 *   in Stripe (Stripe trials are configured at subscription time, not as a
 *   product). Higher tiers (scaling / business / enterprise) exist in our
 *   subscription_plans table but are not yet user-pickable; they'll be
 *   seeded when phase 2 enables them.
 */

import Stripe from 'stripe';
import { readFileSync } from 'node:fs';

// ---- Load .env.local (best-effort) ----
try {
  const raw = readFileSync('.env.local', 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
} catch {
  // .env.local missing or unreadable: rely on process env only.
}

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error('STRIPE_SECRET_KEY is not set. Add it to .env.local or export it before running.');
  process.exit(1);
}

const MODE = KEY.startsWith('sk_live_') ? 'live' : KEY.startsWith('sk_test_') ? 'test' : 'unknown';
if (MODE === 'unknown') {
  console.error(`Cannot determine Stripe mode from key prefix. Expected sk_live_ or sk_test_; got ${KEY.slice(0, 8)}...`);
  process.exit(1);
}

const stripe = new Stripe(KEY, { apiVersion: '2026-04-22.dahlia' });

// ---- Phase 1 plan spec (source of truth for product names + prices) ----
// Amounts in USD cents. Display order is the order we list them here.
const PLANS = [
  {
    code: 'starter',
    name: 'QuoteCore+ Starter',
    description:
      '50 quotes per month + 1 GB storage. Core quoting tools for small contractors.',
    amountCents: 1900,
  },
  {
    code: 'growth',
    name: 'QuoteCore+ Growth',
    description:
      '100 quotes per month + 3 GB storage. Adds digital takeoff and email sending.',
    amountCents: 2900,
  },
  {
    code: 'pro',
    name: 'QuoteCore+ Professional',
    description:
      '100 quotes per month + 5 GB storage. Full feature set including flashings, material orders, and customer follow-ups.',
    amountCents: 3900,
  },
];

const CURRENCY = 'usd';

console.log(`\n[seed-stripe-products] Mode: ${MODE}`);
console.log(`[seed-stripe-products] Seeding ${PLANS.length} plan(s)...\n`);

const results = [];

for (const plan of PLANS) {
  // -------- Resolve or create the product --------
  let product;
  const productSearch = await stripe.products.search({
    query: `metadata['quotecore_plan_code']:'${plan.code}'`,
    limit: 2,
  });
  if (productSearch.data.length > 1) {
    console.warn(
      `  [${plan.code}] WARNING: ${productSearch.data.length} products tagged with this plan_code. Using the first; consider archiving duplicates in the Stripe dashboard.`,
    );
  }
  if (productSearch.data.length >= 1) {
    product = productSearch.data[0];
    console.log(`  [${plan.code}] reusing product ${product.id} ("${product.name}")`);
    // Update name/description in case the spec changed.
    if (product.name !== plan.name || product.description !== plan.description) {
      product = await stripe.products.update(product.id, {
        name: plan.name,
        description: plan.description,
      });
      console.log(`  [${plan.code}] updated product name/description`);
    }
  } else {
    product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: { quotecore_plan_code: plan.code },
    });
    console.log(`  [${plan.code}] created product ${product.id}`);
  }

  // -------- Resolve or create the recurring price --------
  const lookupKey = `qc_${plan.code}_monthly_${MODE}`;
  let price;
  const priceSearch = await stripe.prices.list({
    lookup_keys: [lookupKey],
    limit: 1,
    active: true,
  });
  if (priceSearch.data.length >= 1) {
    price = priceSearch.data[0];
    // Check the amount matches. Prices are immutable in Stripe; if the
    // amount has changed, we deactivate the old one and create a new one.
    if (price.unit_amount !== plan.amountCents || price.currency !== CURRENCY) {
      console.log(
        `  [${plan.code}] existing price ${price.id} has ${price.unit_amount}${price.currency} but spec is ${plan.amountCents}${CURRENCY}; rotating.`,
      );
      await stripe.prices.update(price.id, {
        active: false,
        lookup_key: null,
      });
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.amountCents,
        currency: CURRENCY,
        recurring: { interval: 'month' },
        lookup_key: lookupKey,
        metadata: { quotecore_plan_code: plan.code },
      });
      console.log(`  [${plan.code}] created new price ${price.id}`);
    } else {
      console.log(`  [${plan.code}] reusing price ${price.id} (${price.unit_amount}${price.currency}/${price.recurring?.interval})`);
    }
  } else {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.amountCents,
      currency: CURRENCY,
      recurring: { interval: 'month' },
      lookup_key: lookupKey,
      metadata: { quotecore_plan_code: plan.code },
    });
    console.log(`  [${plan.code}] created price ${price.id}`);
  }

  results.push({ code: plan.code, productId: product.id, priceId: price.id });
}

// ---- Emit SQL to paste into Supabase ----
const column = MODE === 'live' ? 'stripe_price_id_live' : 'stripe_price_id_test';

console.log('\n----------------------------------------------------------------');
console.log(`SQL to apply (paste into Supabase SQL editor):`);
console.log('----------------------------------------------------------------\n');
for (const r of results) {
  console.log(`UPDATE public.subscription_plans SET ${column} = '${r.priceId}' WHERE code = '${r.code}';`);
}
console.log('\n----------------------------------------------------------------');
console.log('Summary:');
for (const r of results) {
  console.log(`  ${r.code.padEnd(10)} product=${r.productId}  price=${r.priceId}`);
}
console.log('----------------------------------------------------------------\n');
console.log('Done.\n');
