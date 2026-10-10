#!/usr/bin/env node
/* Compile the isolated prototype and reused pure modules, not a substitute for next build.
   QC_TYPESCRIPT / QC_SHARP may point at local installed packages for offline testing. */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const repo = path.resolve(__dirname, '../../../..');
const tsPackage = process.env.QC_TYPESCRIPT || path.join(repo, 'node_modules/typescript');
const sharpPackage = process.env.QC_SHARP || path.join(repo, 'node_modules/sharp');
const typesRoot = process.env.QC_NODE_TYPES || path.join(repo, 'node_modules/@types');
const out = path.resolve(process.env.QC_TEST_OUT || path.join(repo, '.host-outline-test'));
fs.mkdirSync(out, { recursive: true });
const files = fs.readdirSync(path.join(repo, 'app/lib/free-tools/host-roof-scan'))
  .filter(f => f.endsWith('.ts') && !['runtime.ts', 'server.ts', 'registration.ts', 'schemas.ts'].includes(f))
  .map(f => path.join(repo, 'app/lib/free-tools/host-roof-scan', f));
const config = { compilerOptions: { strict: true, target: 'ES2017', lib: ['ESNext', 'DOM', 'DOM.Iterable'], module: 'CommonJS', moduleResolution: 'Node', esModuleInterop: true, skipLibCheck: true, rootDir: repo, outDir: out, baseUrl: repo, types: ['node'], typeRoots: [typesRoot], paths: { '@/*': ['./*'], sharp: [sharpPackage] } }, files };
const configPath = path.join(out, 'tsconfig.json');
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
execFileSync(process.execPath, [path.join(tsPackage, 'bin/tsc'), '-p', configPath], { stdio: 'inherit' });
fs.mkdirSync(path.join(out, 'node_modules'), { recursive: true });
if (!fs.existsSync(path.join(out, 'node_modules/sharp'))) fs.symlinkSync(sharpPackage, path.join(out, 'node_modules/sharp'), 'dir');
const ts = require(tsPackage);
for (const f of ['server.ts', 'runtime.ts', 'registration.ts', 'schemas.ts']) {
  const code = fs.readFileSync(path.join(repo, 'app/lib/free-tools/host-roof-scan', f), 'utf8');
  const result = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true });
  if ((result.diagnostics || []).some(d => d.category === ts.DiagnosticCategory.Error)) throw new Error('Syntax failure: ' + f);
}
const { WIDGET_SCRIPT } = require(path.join(out, 'app/lib/free-tools/host-roof-scan/widget'));
new (require('node:vm').Script)('const QC_API_ORIGIN="https://example.test";\n' + WIDGET_SCRIPT);
console.log('PASS: isolated strict TypeScript compilation; route support syntax and browser script parse.');
console.log('TypeScript:', ts.version, '| Sharp:', require(path.join(sharpPackage, 'package.json')).version);
console.log('Not a whole-repository, SDK integration or Next build check.');
