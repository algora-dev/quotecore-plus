#!/usr/bin/env node
/**
 * Debt ratchet gate (zero-risk QA guard, added 2026-10-29).
 *
 * Records and enforces the current TypeScript + ESLint debt baseline.
 * The ratchet FAILS (exit 1) when either count GROWS above the recorded
 * baseline. Lower counts are fine and become the new baseline via --record.
 *
 * Usage:
 *   node scripts/debt-ratchet.cjs            # check mode: fail if debt grew
 *   node scripts/debt-ratchet.cjs --record   # re-baseline after debt was paid down
 *
 * Known baseline origin: 81 tsc errors documented in AGENTS.md (2026-10);
 * lint baseline first recorded 2026-10-29. Counts include test/e2e files,
 * matching the standalone `npx tsc --noEmit` gate semantics.
 *
 * Fail-closed process handling (QC-01, external review 2026-10-29): a
 * crashed, killed, or misconfigured tool MUST fail this gate (exit 2),
 * never read as "zero errors". Tool exit codes: tsc/eslint exit 1 when
 * diagnostics/problems are found; higher exits mean fatal/config errors.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASELINE_PATH = path.join(__dirname, 'debt-baseline.json');

function runCount(cmd, args, countFn, opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    shell: true,
    maxBuffer: 1024 * 1024 * 512,
  });
  const out = (res.stdout || '') + '\n' + (res.stderr || '');
  const count = countFn(out);
  // Some tools exit 1 whenever findings exist (eslint with 8973 problems
  // exits 1 on every run). For those, pass { exitOneMeansProblems: true }:
  // their evidence lives in the parsed output file, and only hard process
  // failures fail the gate here.
  const exitOneIsClean = Boolean(opts.exitOneMeansProblems);
  const processFailure =
    res.error
      ? `spawn error: ${res.error.message}`
      : res.signal
        ? `killed by signal ${res.signal}`
        : res.status === null || res.status === undefined
          ? 'no exit status'
          : res.status >= 2
            ? `exit ${res.status} (fatal or config error)`
            : res.status === 1 && count === 0 && !exitOneIsClean
              ? 'exit 1 but no parsable diagnostics (crash or output-format change)'
              : null;
  return { count, raw: out, processFailure };
}

function countTscErrors(out) {
  return (out.match(/error TS\d+:/g) || []).length;
}

function countLintProblems(eslintJsonPath) {
  // ESLint 9: write JSON to a file (--output-file), then parse the file.
  // stdout can be contaminated by npm/npx chatter on Windows, so file-based
  // is the only robust path.
  try {
    const results = JSON.parse(fs.readFileSync(eslintJsonPath, 'utf8'));
    return results.reduce(
      (n, f) => n + (f.errorCount || 0) + (f.warningCount || 0),
      0
    );
  } catch {
    return -1;
  }
}

function getBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) {
    console.error(
      'No debt baseline found at scripts/debt-baseline.json.\n' +
        'Run `node scripts/debt-ratchet.cjs --record` once to create it.'
    );
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
}

function measure() {
  console.log('Counting tsc errors (npx tsc --noEmit)... this can take a minute.');
  // DEBT_RATCHET_TSC exists solely to simulate tool failure in verification
  // runs (point it at a nonexistent package; the gate must exit 2).
  const tscBin = process.env.DEBT_RATCHET_TSC ?? 'tsc';
  const tsc = runCount('npx', [tscBin, '--noEmit'], countTscErrors);
  if (tsc.processFailure) {
    console.error(`tsc run failed (fail-closed): ${tsc.processFailure}`);
    process.exit(2);
  }
  console.log(`tsc errors: ${tsc.count}`);
  console.log('Counting lint problems (npx eslint . --format json)... this can take minutes.');
  const tmp = path.join(__dirname, '.eslint-count.json');
  const lint = runCount(
    'npx',
    ['eslint', '.', '--format', 'json', '--output-file', tmp],
    () => 0,
    { exitOneMeansProblems: true }
  );
  if (lint.processFailure) {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    console.error(`eslint run failed (fail-closed): ${lint.processFailure}`);
    process.exit(2);
  }
  const lintCount = countLintProblems(tmp);
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  if (lintCount < 0) {
    console.error('eslint run produced no parsable JSON (crashed or misconfigured).');
    process.exit(2);
  }
  console.log(`lint problems: ${lintCount}`);
  return { tscErrors: tsc.count, lintProblems: lintCount };
}

const mode = process.argv.includes('--record') ? 'record' : 'check';
const current = measure();

if (mode === 'record') {
  fs.writeFileSync(
    BASELINE_PATH,
    JSON.stringify({ ...current, recordedAt: new Date().toISOString() }, null, 2) + '\n'
  );
  console.log(`Baseline recorded: tsc ${current.tscErrors}, lint ${current.lintProblems}`);
  process.exit(0);
}

const baseline = getBaseline();
let failed = false;
if (current.tscErrors > baseline.tscErrors) {
  console.error(`RATCHET FAIL: tsc errors grew ${baseline.tscErrors} -> ${current.tscErrors}`);
  failed = true;
}
if (current.lintProblems > baseline.lintProblems) {
  console.error(
    `RATCHET FAIL: lint problems grew ${baseline.lintProblems} -> ${current.lintProblems}`
  );
  failed = true;
}
if (current.tscErrors < baseline.tscErrors || current.lintProblems < baseline.lintProblems) {
  console.log(
    'Debt reduced below baseline. Nice. Re-baseline with `node scripts/debt-ratchet.cjs --record`.'
  );
}
if (!failed) {
  console.log(
    `Ratchet OK: tsc ${current.tscErrors} <= ${baseline.tscErrors}, lint ${current.lintProblems} <= ${baseline.lintProblems}`
  );
}
process.exit(failed ? 1 : 0);
