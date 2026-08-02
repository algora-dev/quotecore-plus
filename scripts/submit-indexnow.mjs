#!/usr/bin/env node
/**
 * Submit URLs to Bing IndexNow for fast indexing.
 * Usage: node scripts/submit-indexnow.mjs
 * 
 * Requires the key file at public/<KEY>.txt to be deployed.
 * Key: 22ffbce37a69481c9841bddef9028097
 */

const INDEXNOW_KEY = '22ffbce37a69481c9841bddef9028097';
const INDEXNOW_URL = 'https://api.indexnow.org/IndexNow';

// URLs to submit - fetch from sitemap or hardcode important ones
const URLS = [
  'https://quote-core.com/',
  'https://quote-core.com/features',
  'https://quote-core.com/features/digital-roof-takeoff',
  'https://quote-core.com/features/smart-components',
  'https://quote-core.com/features/material-ordering',
  'https://quote-core.com/features/invoicing',
  'https://quote-core.com/features/supplier-resources',
  'https://quote-core.com/free-tools',
  'https://quote-core.com/free-roofing-takeoff-builder',
  'https://quote-core.com/free-quote-generator',
  'https://quote-core.com/free-invoice-generator',
  'https://quote-core.com/free-purchase-order-generator',
  'https://quote-core.com/free-roofing-calculator',
  'https://quote-core.com/free-roof-pricing-calculator',
  'https://quote-core.com/free-construction-calculator',
  'https://quote-core.com/free-concrete-calculator',
  'https://quote-core.com/free-landscaping-calculator',
  'https://quote-core.com/free-birdsmouth-calculator',
  'https://quote-core.com/pricing',
  'https://quote-core.com/about',
  'https://quote-core.com/contact',
  'https://quote-core.com/services',
  'https://quote-core.com/suppliers',
  'https://quote-core.com/free-trial',
  'https://quote-core.com/blog',
  'https://quote-core.com/roofing-quoting-software',
  'https://quote-core.com/construction-quoting-software',
];

async function submit() {
  const body = {
    host: 'quote-core.com',
    key: INDEXNOW_KEY,
    keyLocation: `https://quote-core.com/${INDEXNOW_KEY}.txt`,
    urlList: URLS,
  };

  console.log(`Submitting ${URLS.length} URLs to IndexNow...`);
  
  try {
    const res = await fetch(INDEXNOW_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    });

    console.log(`Response: ${res.status} ${res.statusText}`);
    if (res.status === 200) {
      console.log('URLs submitted successfully.');
    } else if (res.status === 202) {
      console.log('Submission accepted. URLs will be indexed soon.');
    } else if (res.status === 422) {
      console.log('Invalid submission. Check key file is accessible.');
    } else {
      const text = await res.text().catch(() => '');
      console.log(`Unexpected response: ${text}`);
    }
  } catch (err) {
    console.error('Error submitting to IndexNow:', err.message);
  }
}

submit();
