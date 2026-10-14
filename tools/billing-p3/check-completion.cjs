#!/usr/bin/env node
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

function testFiles(dir) {
  return fs.readdirSync(path.join(root, dir))
    .filter((name) => name.endsWith('.test.cjs'))
    .sort()
    .map((name) => path.join(dir, name));
}

function run(cmd, args) {
  const r = cp.spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run(process.execPath, [
  '--test',
  ...testFiles('tests/billing-p2'),
  ...testFiles('tests/billing-p3-completion'),
]);
run(process.execPath, ['tools/billing-p2/check-source.cjs']);
