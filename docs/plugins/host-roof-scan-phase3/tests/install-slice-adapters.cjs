#!/usr/bin/env node
// OPTIONAL TEST-ONLY STAND-INS for imports absent from the uploaded source slice.
// These do NOT establish correctness of the full-repo precision engine, overlay, or prompt.
// They are emitted ONLY into an external test directory. NEVER apply them to app/ source.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../../..'), out=process.env.QC_TEST_OUT && path.resolve(process.env.QC_TEST_OUT);
if(process.env.QC_ALLOW_SLICE_ADAPTERS!=='true'||!out||out===root||out.startsWith(root+path.sep))
 throw Error('Explicit QC_ALLOW_SLICE_ADAPTERS=true and external QC_TEST_OUT required. Not a production build.');
const source=path.join(root,'app/lib/takeoff/precision/precisionGeometry.ts');
if(fs.existsSync(source))throw Error('Full-repository shared modules exist: use the real build, not test adapters.');
const files={
 'app/lib/takeoff/ai-prompt-v3.js': `exports.buildV3OutlinePrompt=(w,h)=>'TEST-ONLY PROMPT ADAPTER '+w+' x '+h;`,
 'app/lib/takeoff/scanOverlay.js': `exports.renderOutlineOverlay=async(bytes)=>Buffer.from(bytes); // TEST ONLY: does not draw a roof overlay.`,
 'app/lib/takeoff/calibrationCoordinates.js': `exports.applyAffine=([a,b,c,d,e,f],p)=>({x:a*p.x+c*p.y+e,y:b*p.x+d*p.y+f});`,
 'app/lib/takeoff/precision/precisionGeometry.js': `// TEST ONLY: no shared-engine geometry validation. Tests using this adapter cover orchestration, not geometric correctness.
 exports.validateOutline=()=>[];
 exports.polygonArea=v=>Math.abs(v.reduce((s,a,i)=>{const b=v[(i+1)%v.length];return s+a.point.x*b.point.y-b.point.x*a.point.y;},0))/2;
 exports.polygonPerimeter=(v,closed)=>v.reduce((s,a,i)=>{if(!closed&&i===v.length-1)return s;const b=v[(i+1)%v.length];return s+Math.hypot(b.point.x-a.point.x,b.point.y-a.point.y);},0);`,
};
for(const [name,code] of Object.entries(files)){const dest=path.join(out,name);if(fs.existsSync(dest))throw Error('Will not overwrite a compiled shared module: '+name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,code+'\n');}
const sharp=process.env.QC_SHARP||path.dirname(require.resolve('sharp/package.json'));
const link=path.join(out,'node_modules/sharp');fs.mkdirSync(path.dirname(link),{recursive:true});if(!fs.existsSync(link))fs.symlinkSync(sharp,link,'dir');
fs.writeFileSync(path.join(out,'TEST_ADAPTERS_ONLY.json'),JSON.stringify({warning:'Missing shared modules use test-only stand-ins. NOT a full-repo build or geometry/vision validation.',files:Object.keys(files)},null,2));
console.log('TEST ADAPTERS installed into external test output only. Orchestration/UI checks must be reported as adapter-backed.');
