/* Run only after npm ci in the integrated repo. No dependency installation. */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const manifest = process.env.DEMO_CHANGED_MANIFEST || path.join(root, 'FILE_CHANGES.json');
const entries = JSON.parse(fs.readFileSync(manifest, 'utf8'));
const paths = entries.map(e => e.path).filter(p => /\.(tsx?|jsx?|mjs|cjs)$/.test(p) && fs.existsSync(path.join(root,p)));
if (!paths.length) throw new Error('No changed source files found; check the manifest.');
const cli = path.join(path.dirname(require.resolve('eslint/package.json')), 'bin', 'eslint.js');
const result = spawnSync(process.execPath, [cli, ...paths], { cwd: root, stdio: 'inherit' });
process.exitCode = result.status || (result.error ? 1 : 0);
