/* Strict checks against the supplied generated DB types. No schema or network access. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'qcp-demo-types-'));
try {
  const capture = path.join(temp, 'captured.json');
  const seed = spawnSync(process.execPath, [path.join(__dirname, 'check-seed.cjs')], { cwd: root, env: { ...process.env, DEMO_SEED_CAPTURE: capture }, stdio: 'inherit' });
  if (seed.status !== 0) throw new Error('Seed orchestration check failed');
  const { calls } = JSON.parse(fs.readFileSync(capture, 'utf8'));
  const typesPath = path.join(root, 'app/lib/supabase/database.types').replaceAll('\\', '/');
  const shape = path.join(temp, 'seed-shapes.ts');
  fs.writeFileSync(shape, `import type { Database } from ${JSON.stringify(typesPath)};\n` + calls.map((c,i) => `const rows${i}: Database['public']['Tables'][${JSON.stringify(c.table)}]['Insert'][] = ${JSON.stringify(c.rows)};`).join('\n'));
  let typeRoots;
  try { typeRoots = [path.dirname(path.dirname(require.resolve('@types/node/package.json')))]; }
  catch { typeRoots = [path.join(path.dirname(require.resolve('ts-node/package.json')), 'node_modules/@types')]; }
  const files = ['model','guide','commands','routing','counter','seed-data','seed-plan','prepared-scan','tokens'].map(name => path.join(root, `app/lib/demo/${name}.ts`));
  const config = { compilerOptions: { target:'ES2022',lib:['ES2022','DOM'],strict:true,noEmit:true,skipLibCheck:true,module:'preserve',moduleResolution:'bundler',baseUrl:root,paths:{'@/*':['./*']},types:['node'],typeRoots }, files:[shape,...files] };
  const filename=path.join(temp,'tsconfig.json');fs.writeFileSync(filename,JSON.stringify(config));
  const result=spawnSync(process.execPath,[require.resolve('typescript/bin/tsc'),'-p',filename,'--pretty','false'],{cwd:root,stdio:'inherit'});
  if(result.status!==0)throw new Error('Strict seed/domain type check failed');
  console.log(JSON.stringify({passed:true,strictDomainModules:files.length,typedSeedBatches:calls.length,scope:'Actual generated Insert types plus pure domain modules; not a full application typecheck'}));
} catch(error) { console.error(error); process.exitCode=1; }
finally { fs.rmSync(temp,{recursive:true,force:true}); }
