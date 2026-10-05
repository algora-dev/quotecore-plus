/** Dev-only component preview. No app route, credentials, live data or provider calls.
 * Uses the actual TSX components/CSS and real React; only navigation/server transport is mocked.
 * Run with project deps installed: node scripts/sa-visual/build-preview.cjs /tmp/sa-preview
 * Optional SA_REACT_BROWSER/SA_REACT_DOM_BROWSER are explicit alternate UMD runtime paths.
 */
const fs=require('node:fs'),path=require('node:path');
let ts;try{ts=require('typescript');}catch{ts=require(path.join(require('node:child_process').execSync('npm root -g').toString().trim(),'typescript'));}
const root=process.env.SA_PREVIEW_SOURCE_ROOT||path.resolve(__dirname,'../..');
const out=path.resolve(process.argv[2]||'/tmp/sa-preview');fs.mkdirSync(out,{recursive:true});
const modules=new Map(),css=[],seenCss=new Set(),diagnostics=[];
const nav=`const React=require('react');exports.usePathname=()=>{const [p,set]=React.useState(window.__previewPath||location.pathname);React.useEffect(()=>{const f=()=>set(window.__previewPath||location.pathname);window.addEventListener('popstate',f);return()=>window.removeEventListener('popstate',f);},[]);return p;};const router={push(p){window.__fixture.navigation.push(p);window.__previewPath=p;if(location.protocol!=='about:')history.pushState({},'',p);window.dispatchEvent(new PopStateEvent('popstate'));},refresh(){window.__fixture.refreshes++;}};exports.useRouter=()=>router;`;
modules.set('next/navigation',nav);
modules.set('react',`module.exports=window.React;`);
modules.set('react/jsx-runtime',`const React=window.React;exports.Fragment=React.Fragment;exports.jsx=exports.jsxs=(type,props,key)=>React.createElement(type,key===undefined?props:{...props,key});`);
const actionId='app/(auth)/[workspaceSlug]/assistant/actions.ts';
modules.set(actionId,`exports.createConversation=async()=>{const f=window.__fixture; f.newChats++;f.reset('empty');return {ok:true,id:f.conversationId};};`);
function style(p){
 if(seenCss.has(p))return {};seenCss.add(p);
 let content=fs.readFileSync(p,'utf8').replace(/@import\s+['"](.+?)['"];?/g,(_,f)=>{style(path.resolve(path.dirname(p),f));return '';});
 const names={};
 if(p.endsWith('.module.css')){
  content=content.replace(/\.([a-zA-Z_][\w-]*)/g,(_,n)=>{names[n]=`sa_preview_${n}`;return '.'+names[n];});
 }
 css.push(content);return names;
}
function resolve(spec,from){
 if(spec==='react'||spec==='react/jsx-runtime'||spec==='next/navigation')return spec;
 const p=spec.startsWith('@/')?path.join(root,spec.slice(2)):path.resolve(path.dirname(from),spec);
 const file=['','.ts','.tsx','.js','/index.ts','/index.tsx'].map(e=>p+e).find(x=>fs.existsSync(x)&&fs.statSync(x).isFile());
 if(!file)throw Error(`Unresolved preview import ${spec} from ${from}`);
 return load(file);
}
function load(file){
 const id=path.relative(root,file).replaceAll(path.sep,'/');
 if(modules.has(id))return id;
 modules.set(id,'');
 if(file.endsWith('.css')){modules.set(id,'module.exports='+JSON.stringify(style(file)));return id;}
 let result=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}});
 diagnostics.push(...(result.diagnostics||[]).map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')));
 const code=result.outputText.replace(/require\("([^"]+)"\)/g,(_,spec)=>`require(${JSON.stringify(resolve(spec,file))})`);
 modules.set(id,code);return id;
}
const entry=load(path.join(root,'app/components/smart-assistant/v2/V2ChatClient.tsx'));
const sheet=load(path.join(root,'app/components/smart-assistant/v2/assistant.module.css'));
const fixture=fs.readFileSync(path.join(__dirname,'fixture.js'),'utf8');
const run=`const {V2ChatClient}=require(${JSON.stringify(entry)});const s=require(${JSON.stringify(sheet)});const React=window.React;function Preview(){const [visible,setVisible]=React.useState(true);const modal=query.get('host')==='dialog';window.__fixture.setVisible=setVisible;return React.createElement(React.Fragment,null,!visible&&React.createElement('button',{id:'reopen',onClick:()=>setVisible(true)},'Reopen assistant'),React.createElement(modal?'dialog':'div',{open:modal&&visible?true:undefined,className:modal?s.dialog:s.standalone,style:{display:visible?'':'none'}},React.createElement(V2ChatClient,{access:window.__fixture.access,initialConversations:[{id:window.__fixture.conversationId,title:'Smith roof',last_active_at:new Date().toISOString()}],assistantName:'Smart Assistant',greeting:'',settingsHref:'/preview/account/smart-assistant',visible,onHide:()=>{window.__fixture.hides++;setVisible(false);}})));}window.ReactDOM.createRoot(document.getElementById('app')).render(React.createElement(Preview));`;
fs.writeFileSync(path.join(out,'bundle.js'),`(function(){const modules={${[...modules].map(([id,code])=>JSON.stringify(id)+':function(module,exports,require){\n'+code+'\n}').join(',\n')}};const cache={};function require(id){if(cache[id])return cache[id].exports;const m={exports:{}};cache[id]=m;if(!modules[id])throw Error('Missing module '+id);modules[id](m,m.exports,require);return m.exports;}\n${fixture}\n${run}\n})();`);
fs.writeFileSync(path.join(out,'style.css'),`html,body{margin:0;padding:0;height:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#e5e7ec}button{cursor:pointer}h1,h2,h3,p{margin:0}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}#reopen{margin:20px;padding:12px}a{color:inherit}\n`+css.join('\n'));
const react=process.env.SA_REACT_BROWSER||path.join(path.dirname(require.resolve('react/package.json')),'umd/react.development.js');
const dom=process.env.SA_REACT_DOM_BROWSER||path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.development.js');
fs.copyFileSync(react,path.join(out,'react.js'));fs.copyFileSync(dom,path.join(out,'react-dom.js'));
fs.cpSync(path.join(root,'public/smart-assistant'),path.join(out,'smart-assistant'),{recursive:true});
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta charset="utf-8"><title>QuoteCore+ assistant · isolated component preview</title><link rel="stylesheet" href="/style.css"></head><body><main id="app"></main><script src="/react.js"></script><script src="/react-dom.js"></script><script src="/bundle.js"></script></body></html>`);
fs.writeFileSync(path.join(out,'build.json'),JSON.stringify({modules:modules.size,diagnostics,sourceRoot:root,reactRuntime:react,domRuntime:dom,transport:'explicit in-memory fixture; not production or RLS verification'},null,2));
if(diagnostics.length)throw Error(diagnostics.join('\n'));console.log(`Compiled ${modules.size} actual modules. Preview at ${out}. No live service used.`);
