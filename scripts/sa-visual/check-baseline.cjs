/* Exact byte comparison against the supplied pre-convergence UX archive.
   Usage: node scripts/sa-visual/check-baseline.cjs /path/to/extracted-baseline [report.json]
   Both extracted roots include the quotecore-plus/ wrapper. This is NOT a live-branch merge tool. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const baseline=path.resolve(process.argv[2]||'');
if(!process.argv[2]||!fs.existsSync(path.join(baseline,'quotecore-plus/package.json')))throw Error('Provide the original extracted UX-shell baseline root.');
const build=path.resolve(__dirname,'../../..');
const allow=new Set(['START_HERE_RETURN.md','quotecore-plus/RETURN_NOTES.md',...[ 'V2ChatClient.tsx','ConversationCards.tsx','assistant.module.css','useVoiceNote.ts','useSpeechPlayback.ts' ].map(p=>'quotecore-plus/app/components/smart-assistant/v2/'+p)]);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function walk(root,rel=''){return fs.readdirSync(path.join(root,rel),{withFileTypes:true}).flatMap(e=>{const p=rel?rel+'/'+e.name:e.name;return e.isDirectory()?walk(root,p):e.isFile()?[p]:[];});}
const rows=walk(baseline).map(file=>{const before=fs.readFileSync(path.join(baseline,file)),dest=path.join(build,file),after=fs.existsSync(dest)?fs.readFileSync(dest):null;return {path:file,before:hash(before),after:after?hash(after):null,unchanged:!!after&&before.equals(after),allowedModification:allow.has(file)};});
const unexpected=rows.filter(r=>!r.unchanged&&!r.allowedModification);
const migrations=rows.filter(r=>/^quotecore-plus\/backend\/supabase\/migrations\/.*\.sql$/.test(r.path));
const report={baselineRoot:baseline,buildRoot:build,baselineFiles:rows.length,unchanged:rows.filter(r=>r.unchanged).length,allowedModified:rows.filter(r=>!r.unchanged&&r.allowedModification).map(r=>r.path),unexpectedChanges:unexpected,migrations:{count:migrations.length,allUnchanged:migrations.every(r=>r.unchanged)},protected:{applicationAPIsUnchanged:rows.filter(r=>r.path.startsWith('quotecore-plus/app/api/')).every(r=>r.unchanged),applicationLibrariesUnchanged:rows.filter(r=>r.path.startsWith('quotecore-plus/app/lib/')).every(r=>r.unchanged),dependencyManifestsUnchanged:rows.filter(r=>['quotecore-plus/package.json','quotecore-plus/package-lock.json'].includes(r.path)).every(r=>r.unchanged),sharedUIUnchanged:rows.filter(r=>r.path.startsWith('quotecore-plus/app/components/ui/')).every(r=>r.unchanged)},files:rows};
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,files:undefined},null,2));if(unexpected.length||!migrations.every(r=>r.unchanged))process.exit(1);
