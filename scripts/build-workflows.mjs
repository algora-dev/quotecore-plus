/**
 * build-workflows.mjs — Flow authoring compiler (Phase 0B)
 * ========================================================
 * Compiles human-authored content/workflows/*.flow.md into a single validated
 * JSON workflow definition file the headless workflowService reads.
 *
 * Authoring grammar (plan §6a; Gerald M-03 — strict, schema-bound):
 *   Frontmatter: workflow, screen, trade (any|roofing|generic), title, description
 *   Each step is a block:
 *     step: <human title>
 *     ui:   <registry elementId>            (must exist in the UI registry)
 *     until:<validator>                     (one of the allowed validators)
 *     say:  <human guidance copy>           (model hint; never executable)
 *
 * Allowed `until:` validators:
 *   clicked:<id> | input_non_empty:<id> | exists:<id> | selected:<id>
 *   | route:<screenKey> | event:<eventName>
 *
 * The compiler FAILS (non-zero exit) on: unknown ui id, malformed/unknown
 * validator, duplicate workflow id, missing required fields. Emits a readable
 * error report.
 *
 *   node scripts/build-workflows.mjs            # compile
 *   node scripts/build-workflows.mjs --check    # validate only, no write
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FLOW_DIR = path.join(ROOT, 'content', 'workflows');
const OUT = path.join(ROOT, 'app', 'lib', 'assistant', 'workflows.generated.json');
const CHECK_ONLY = process.argv.includes('--check');

// --- load registry ids from the generated seed (no TS import needed) -------
function loadRegistryIds() {
  const p = path.join(ROOT, 'app', 'lib', 'assistant', 'uiRegistry.generated.ts');
  const text = fs.readFileSync(p, 'utf8');
  const ids = new Set();
  for (const m of text.matchAll(/id:\s*"([^"]+)"/g)) ids.add(m[1]);
  // Curated-only ids may exist in uiRegistry.ts; include those too.
  const cur = path.join(ROOT, 'app', 'lib', 'assistant', 'uiRegistry.ts');
  if (fs.existsSync(cur)) {
    const ct = fs.readFileSync(cur, 'utf8');
    const block = ct.slice(ct.indexOf('const CURATED'), ct.indexOf('function humanise'));
    for (const m of block.matchAll(/^\s*'([^']+)':\s*\{/gm)) ids.add(m[1]);
  }
  return ids;
}

const VALIDATOR_RE =
  /^(clicked|input_non_empty|exists|selected):[a-z0-9-]+$|^route:[a-z0-9.\-]+$|^event:[a-zA-Z0-9_.-]+$/;

function parseFlow(file, registryIds, errors) {
  const raw = fs.readFileSync(file, 'utf8');
  const fm = raw.match(/^---\n([\s\S]*?)\n---/);
  const meta = {};
  if (fm) {
    for (const line of fm[1].split(/\r?\n/)) {
      const m = line.match(/^(\w+):\s*(.*)$/);
      if (m) meta[m[1]] = m[2].trim();
    }
  }
  const rel = path.relative(ROOT, file);
  if (!meta.workflow) errors.push(`${rel}: missing frontmatter 'workflow'`);
  if (!meta.screen) errors.push(`${rel}: missing frontmatter 'screen'`);
  const trade = meta.trade || 'any';
  if (!['any', 'roofing', 'generic'].includes(trade))
    errors.push(`${rel}: invalid trade '${trade}' (any|roofing|generic)`);

  // Parse step blocks.
  const body = fm ? raw.slice(fm[0].length) : raw;
  const stepChunks = body.split(/\n(?=step:)/).filter((c) => /^step:/m.test(c));
  const steps = [];
  stepChunks.forEach((chunk, idx) => {
    const get = (k) => {
      const m = chunk.match(new RegExp(`^${k}:\\s*(.*)$`, 'm'));
      return m ? m[1].trim() : '';
    };
    const title = get('step');
    const ui = get('ui');
    const until = get('until');
    const say = get('say');
    const where = `${rel} step ${idx + 1} ("${title || '?'}")`;

    if (!ui) errors.push(`${where}: missing 'ui'`);
    else if (!registryIds.has(ui))
      errors.push(`${where}: ui '${ui}' is not in the UI Element Registry`);
    if (!until) errors.push(`${where}: missing 'until'`);
    else if (!VALIDATOR_RE.test(until))
      errors.push(`${where}: invalid until validator '${until}'`);

    steps.push({
      id: `${meta.workflow}-${idx + 1}`,
      title,
      elementId: ui,
      until,
      say,
    });
  });

  if (steps.length === 0) errors.push(`${rel}: no steps found`);

  return {
    workflowId: meta.workflow,
    screenKey: meta.screen,
    trade,
    title: meta.title || meta.workflow,
    description: meta.description || '',
    steps,
  };
}

function main() {
  if (!fs.existsSync(FLOW_DIR)) {
    console.error(`No flow dir: ${path.relative(ROOT, FLOW_DIR)}`);
    process.exit(1);
  }
  const registryIds = loadRegistryIds();
  const files = fs
    .readdirSync(FLOW_DIR)
    .filter((f) => f.endsWith('.flow.md'))
    .map((f) => path.join(FLOW_DIR, f));

  const errors = [];
  const seenIds = new Set();
  const workflows = [];

  for (const file of files) {
    const wf = parseFlow(file, registryIds, errors);
    if (wf.workflowId) {
      if (seenIds.has(wf.workflowId))
        errors.push(`Duplicate workflow id '${wf.workflowId}'`);
      seenIds.add(wf.workflowId);
    }
    workflows.push(wf);
  }

  if (errors.length) {
    console.error(`\n✗ Flow compile failed (${errors.length} error(s)):\n`);
    for (const e of errors) console.error('  - ' + e);
    process.exit(1);
  }

  console.log(
    `✓ ${workflows.length} workflow(s), ${workflows.reduce(
      (n, w) => n + w.steps.length,
      0
    )} step(s) validated against ${registryIds.size} registry ids.`
  );

  if (CHECK_ONLY) return;

  fs.writeFileSync(
    OUT,
    JSON.stringify({ generatedAt: new Date().toISOString(), workflows }, null, 2) + '\n'
  );
  console.log(`Wrote ${path.relative(ROOT, OUT)}`);
}

main();
