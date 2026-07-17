#!/usr/bin/env node
/**
 * Test script for the AI Takeoff scan endpoint.
 *
 * Usage:
 *   node --env-file=.env.local scripts/test-ai-scan.mjs <path-to-plan-image> [quoteId] [pageId]
 *
 * Prerequisites:
 *   - .env.local with OPENAI_API_KEY, SUPABASE env vars, AI_TAKEOFF_ENABLED=true
 *   - A valid quoteId for a roofing-trade company
 *   - The image file must be PNG, JPEG, or WebP
 *
 * Output:
 *   Dumps the validated JSON result + summary to stdout.
 *   Exit code 0 on success, 1 on failure.
 */

import { readFileSync } from 'fs';
import { extname, resolve } from 'path';

const imagePath = process.argv[2];
const quoteId = process.argv[3] || 'test-quote-id';
const pageId = process.argv[4] || undefined;

if (!imagePath) {
  console.error('Usage: node scripts/test-ai-scan.mjs <path-to-plan-image> [quoteId] [pageId]');
  process.exit(1);
}

const fullPath = resolve(imagePath);
const ext = extname(fullPath).toLowerCase();

const mimeMap = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

const mime = mimeMap[ext];
if (!mime) {
  console.error(`Unsupported file type: ${ext}. Use PNG, JPEG, or WebP.`);
  process.exit(1);
}

// .env.local is loaded via Node's --env-file flag in the shebang or run command:
//   node --env-file=.env.local scripts/test-ai-scan.mjs <image> [quoteId] [pageId]
// Fall back to process.env (already set if run with --env-file).

const baseUrl = 'http://localhost:3000';

console.log(`[test-ai-scan] Image: ${fullPath}`);
console.log(`[test-ai-scan] MIME: ${mime}`);
console.log(`[test-ai-scan] Quote ID: ${quoteId}`);
console.log(`[test-ai-scan] Page ID: ${pageId || '(none)'}`);
console.log(`[test-ai-scan] Endpoint: ${baseUrl}/api/takeoff/ai-scan`);
console.log('');

// Read and encode image
const imageBuffer = readFileSync(fullPath);
const base64 = imageBuffer.toString('base64');
console.log(`[test-ai-scan] Image size: ${(imageBuffer.length / 1024).toFixed(1)}KB`);

// We need a valid session to call the endpoint.
// For local testing, we'll call the endpoint directly with fetch.
// The user must be logged in (cookie in browser) OR we provide a test bypass.
//
// For now, this script makes the HTTP call to the local dev server.
// Run `npm run dev` first, then run this script.

const payload = JSON.stringify({
  image: `data:${mime};base64,${base64}`,
  imageMime: mime,
  quoteId,
  pageId,
});

console.log('[test-ai-scan] Sending request...');
const startTime = Date.now();

try {
  const response = await fetch(`${baseUrl}/api/takeoff/ai-scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Cookie must be provided by the user's browser session.
      // For headless testing, you can extract the session cookie from your browser.
      Cookie: process.env.TEST_SESSION_COOKIE || '',
    },
    body: payload,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[test-ai-scan] Response received in ${elapsed}s (status ${response.status})`);

  const result = await response.json();

  if (!response.ok || !result.success) {
    console.error('[test-ai-scan] FAILED:', result.error || `HTTP ${response.status}`);
    if (result.error?.includes('not enabled')) {
      console.error('[test-ai-scan] Set AI_TAKEOFF_ENABLED=true in .env.local');
    }
    process.exit(1);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  AI SCAN RESULTS');
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  const { summary, data } = result;

  if (summary.unreadable) {
    console.log('  ⚠️  Image was UNREADABLE by the AI.');
    console.log('  Notes:', data.notes);
    process.exit(0);
  }

  console.log(`  Roof Areas: ${summary.areas}`);
  console.log(`  Ridges:     ${summary.ridges}`);
  console.log(`  Hips:       ${summary.hips}`);
  console.log(`  Valleys:    ${summary.valleys}`);
  console.log(`  Barges:     ${summary.barges}`);
  console.log(`  Spouting:   ${summary.spouting}`);
  console.log(`  Total:      ${summary.components} component lines`);
  console.log('');

  if (data.scale.detected) {
    console.log(`  Scale: ${data.scale.ratio || '(detected, no ratio)'}`);
    if (data.scale.dimension_line) {
      const dl = data.scale.dimension_line;
      console.log(`  Dimension line: (${dl.p1.x},${dl.p1.y}) → (${dl.p2.x},${dl.p2.y}) = ${dl.real_length}${dl.unit}`);
    }
  } else {
    console.log('  Scale: not detected');
  }

  if (data.pitch.detected) {
    console.log(`  Pitch: ${data.pitch.global_degrees}° (global)`);
  } else {
    console.log('  Pitch: not detected');
  }

  if (data.roof_areas.length > 0) {
    console.log('');
    console.log('  Roof Areas:');
    for (const area of data.roof_areas) {
      const pitchStr = area.pitch_degrees != null ? ` @ ${area.pitch_degrees}°` : '';
      console.log(`    ${area.name}: ${area.points.length} vertices${pitchStr}`);
    }
  }

  if (data.notes.length > 0) {
    console.log('');
    console.log('  Notes:');
    for (const note of data.notes) {
      console.log(`    • ${note}`);
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════');

  // Dump full JSON for debugging
  console.log('');
  console.log('Full JSON (for debugging):');
  console.log(JSON.stringify(data, null, 2));

} catch (err) {
  console.error('[test-ai-scan] Request failed:', err.message);
  console.error('');
  console.error('Make sure the dev server is running: npm run dev');
  process.exit(1);
}
