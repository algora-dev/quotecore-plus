/** Source route inventory + pure parent resolver; not live navigation testing. */
const fs=require('fs'),path=require('path'),ts=require('typescript');
const root=process.env.QC_ROOT||path.resolve(__dirname,'../../../../..'),out=process.env.QC_VALIDATION||path.resolve(__dirname,'..');
const p=path.join(root,'app/components/workspace/workspace-return.ts'),m={exports:{}};
new Function('module','exports',ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(m,m.exports);
const nav=m.exports,walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const reports=walk(path.join(root,'app/(auth)')).filter(f=>/\/page\.tsx$/.test(f)).map(f=>{
 const file=path.relative(root,f),s=fs.readFileSync(f,'utf8'),route=file.replace(/^app\/\(auth\)/,'').replace(/\/page\.tsx$/,'')||'/';
 const sample=route.replace('[workspaceSlug]','demo').replace(/\[\[\.\.\.rest\]\]/g,'').replace(/\[[^\]]+\]/g,'sample-record');
 const isWorkspace=route.includes('[workspaceSlug]'),own=isWorkspace?nav.ownsWorkspaceExit(sample,'demo'):true,target=isWorkspace?nav.workspaceReturn(sample,'demo'):null;
 return {route,source:file,sourceRouteInspected:true,existingRedirect:/\bredirect\(/.test(s),sourceBackMention:/BackButton|back=|Back to|Go back/.test(s),exitOwner:own?'existing page/workspace; no fallback':target?'C65 fallback unless explicit .qc-page-back':'root / no parent',parent:target?.href||'',label:target?.label||'',testLevel:'source route + pure resolver; live routing/dirty guards/keyboard pending Gavin'};
});
const csv=(v)=>'"'+String(v).replaceAll('"','""')+'"',keys=Object.keys(reports[0]);
fs.writeFileSync(out+'/mobile-route-audit.csv',[keys.map(csv).join(','),...reports.map(r=>keys.map(k=>csv(r[k])).join(','))].join('\n')+'\n');
fs.writeFileSync(out+'/mobile-route-audit.json',JSON.stringify({method:'Source route inventory and deterministic parent resolver. Does not claim live navigation, nested components, soft keyboard or safe-area verification.',count:reports.length,routes:reports},null,2));console.log('Audited route entries:',reports.length);
