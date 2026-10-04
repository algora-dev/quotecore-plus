/* Uses only this repository's existing TypeScript dependency. No new package. */
const fs=require('node:fs');const path=require('node:path');const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');const hook=path.join(__dirname,'ts-hook.cjs');
const precision=fs.readdirSync(path.join(root,'app/lib/takeoff/precision')).filter(f=>f.endsWith('.test.ts')).map(f=>`app/lib/takeoff/precision/${f}`);
const commands=[
 ['scripts/check-server-deps.mjs'],
 ['scripts/demo/check-source.cjs'],
 ['--test','scripts/demo/demo-domain.test.cjs'],
 ['scripts/demo/check-seed-types.cjs'],
 ['--require',hook,'--test',...precision,'app/lib/takeoff/calibrationCodec.test.ts','app/lib/takeoff/calibrationCoordinates.test.ts','app/lib/takeoff/topologyCompletion.test.ts'],
];
for(const args of commands){console.log('\n> node '+args.join(' '));const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',env:process.env});if(result.status!==0){process.exitCode=result.status||1;break;}}
