/** SOURCE-DERIVED STATIC FIXTURES, not React/Next application tests.
 * Transpiles real view modules. JSX produces a tree; hooks get deterministic
 * sample state. Effects/requests/router/action invocations are NOT executed.
 * Native dialogs are opened only by the local specimen document script.
 */
const fs=require('fs'),path=require('path'),ts=require('typescript');
const root=process.env.QC_ROOT||path.resolve(__dirname,'../../../../..'),out=process.env.QC_FIXTURES||path.resolve(__dirname,'../fixtures');fs.mkdirSync(out,{recursive:true});
const cache=new Map(),meta=new WeakMap(),names=new Map(),used=new Set(),mocked=new Set();let current=null,overrides={},query='',id=0,fixturePath='/demo/resources';
const node=(type,props,key)=>({type,props:props||{},key}),Fragment=Symbol('fragment');
const noAction=()=>{throw Error('Fixture forbids backend/auth/router/upload actions');};
function state(init){const name=current.names[current.index++]||('state'+current.index),o=overrides[current.name]||{};let v=Object.hasOwn(o,name)?o[name]:(typeof init==='function'?init():init);return [v,noAction];}
const React={Fragment,createElement:(t,p,...c)=>node(t,{...p,children:c}),useState:state,useMemo:f=>/void loadMyCatalogs/.test(String(f))?undefined:f(),useCallback:f=>f,useEffect:()=>{},useLayoutEffect:()=>{},useInsertionEffect:()=>{},useRef:v=>({current:v}),useId:()=>`fixture-${++id}`,useTransition:()=>[false,noAction],useDeferredValue:x=>x,useSyncExternalStore:(_s,get)=>get(),memo:f=>f,forwardRef:f=>{function Forward(p){return f(p,null)}meta.set(Forward,{name:f.name||'Forward',names:['visible'],path:'forwardRef'});return Forward},createContext:v=>{let c={value:v};c.Provider={context:c};return c},useContext:c=>c.value,Suspense:({children})=>children};
React.default=React;
const jsx={jsx:node,jsxs:node,jsxDEV:node,Fragment};
const stub=new Proxy({__esModule:true,default:noAction},{get:(o,k)=>k in o?o[k]:noAction});
function getInfo(sf){let infos={};function visit(n){if(ts.isFunctionLike(n)&&n.name){let name=n.name.getText(sf),states=[];function scan(x){if(x!==n&&ts.isFunctionLike(x))return;if(ts.isVariableDeclaration(x)&&ts.isArrayBindingPattern(x.name)&&x.initializer&&ts.isCallExpression(x.initializer)&&/useState$/.test(x.initializer.expression.getText(sf)))states.push(x.name.elements[0].name.getText(sf));ts.forEachChild(x,scan);}scan(n);infos[name]=states;}ts.forEachChild(n,visit);}visit(sf);return infos;}
function load(rel){let p=path.resolve(root,rel);if(cache.has(p))return cache.get(p).exports;
 let s=fs.readFileSync(p,'utf8'),sf=ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true,p.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),infos=getInfo(sf);for(const [n,a]of Object.entries(infos))names.set(n,a);
 const code=ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:p}).outputText;
 let module={exports:{}};cache.set(p,module);used.add(path.relative(root,p));
 const req=spec=>{
  if(spec.includes('PdfPagePicker')) { mocked.add(spec+' (no PDF conversion in static review)'); return {usePdfPagePicker:()=>({modal:null,convertIfNeeded:noAction})}; }
  if(spec.includes('useCanvasHistory')){mocked.add(spec+' (history engine not executed)');return {useCanvasHistory:()=>({canUndo:false,canRedo:false,pushSnapshot:noAction,undo:noAction,redo:noAction,clear:noAction})};}
  if(spec==='react')return React;if(spec==='react/jsx-runtime'||spec==='react/jsx-dev-runtime')return jsx;
  if(spec.includes('FreeToolsWelcomeModal')){mocked.add(spec+' (not shown in no-draft fixture)');return {FreeToolsWelcomeModal:()=>null};}
  if(spec==='react-dom')return {createPortal:c=>c};
  if(spec==='next/link')return {__esModule:true,default:props=>node('a',props)};
  if(spec==='next/image')return {__esModule:true,default:props=>node('img',props)};
  if(spec==='next/navigation')return {useRouter:()=>({push:noAction,replace:noAction,refresh:noAction,back:noAction}),useSearchParams:()=>new URLSearchParams(query),useParams:()=>({workspaceSlug:'demo'}),usePathname:()=>fixturePath,redirect:noAction,notFound:noAction};
  if(/\.(css|svg|png)$/.test(spec))return {};
  if(spec.startsWith('@heroicons')||spec==='lucide-react'){mocked.add(spec);return new Proxy({},{get:(_o,k)=>props=>node('svg',{...props,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','aria-hidden':true,children:node('path',{d:'M5 12h14M12 5v14',strokeWidth:1.7})})});}
  let target=spec.startsWith('@/')?path.join(root,spec.slice(2)):spec.startsWith('.')?path.resolve(path.dirname(p),spec):null;
  if(target){let file=[target,target+'.tsx',target+'.ts',target+'/index.tsx',target+'/index.ts'].find(x=>fs.existsSync(x)&&fs.statSync(x).isFile());
   const r=file?path.relative(root,file):spec;
   const pure=/app\/lib\/(currency\/currencies|security\/questions|types|trades\/labels|pricing\/engine|measurements\/(displayHelpers|conversions)|messages\/mergeVars)\.ts$/.test(r);
   const forbidden=/\/actions(?:[-\.]|$)|-actions\.ts$|\/lib\/|\/api\/|useSendDocument|MeasureJobModal|FreeToolsWelcomeModal|SendTip|useAuth|supabase|server-only/.test(r)&&!pure;
   if(file&&!forbidden)return load(r);
  }
  mocked.add(spec);return stub;
 };
 new Function('require','module','exports',code)(req,module,module.exports);
 for(const [key,value]of Object.entries(module.exports))if(typeof value==='function') {
   meta.set(value,{name:value.name||key,names:infos[value.name]||[],path:path.relative(root,p)});
   if(/^use[A-Z]/.test(key)) module.exports[key]=function(...args) {
     const prev=current;current={name:value.name||key,names:infos[value.name]||[],index:0,refIndex:0};
     try { return value(...args); } finally {current=prev;}
   };
 }

 return module.exports;
}
const esc=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const unitless=new Set(['opacity','zIndex','flex','flexGrow','flexShrink','order','fontWeight','lineHeight','zoom','gridColumn','gridRow']);
function render(n,selected){if(n===null||n===undefined||typeof n==='boolean')return '';if(Array.isArray(n))return n.map(x=>render(x,selected)).join('');if(typeof n==='string'||typeof n==='number')return esc(n);
 if(n.type===Fragment)return render(n.props.children,selected);
 if(n.type?.context){const c=n.type.context,prev=c.value;c.value=n.props.value;const h=render(n.props.children,selected);c.value=prev;return h;}
 if(typeof n.type==='function'){let prev=current,m=meta.get(n.type)||{name:n.type.name,names:names.get(n.type.name)||[]};current={...m,index:0};let tree;try{tree=n.type(n.props);}catch(e){e.message=`${m.path||''}:${m.name}: ${e.message}`;throw e;}let h=render(tree,selected);current=prev;return h;}
 if(typeof n.type!=='string')throw Error('Unknown element '+String(n.type));
 let attrs='',children=n.props.children;for(let[k,v]of Object.entries(n.props)){if(k==='children'||k==='ref'||k==='key'||k==='dangerouslySetInnerHTML'||/^on[A-Z]/.test(k)||v==null||typeof v==='function')continue;if(k==='className')k='class';if(k==='htmlFor')k='for';if(k==='defaultValue')k='value';if(k==='defaultChecked')k='checked';if(k==='autoFocus')k='autofocus';if(k==='tabIndex')k='tabindex';if(k==='readOnly')k='readonly';
 if(k==='style'&&typeof v==='object')v=Object.entries(v).map(([a,b])=>`${a.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())}:${typeof b==='number'&&b!==0&&!unitless.has(a)?b+'px':b}`).join(';');
 if(n.type==='select'&&k==='value'){selected=String(v);continue;}
 if(n.type==='textarea'&&k==='value'){children=v;continue;}
 if(typeof v==='object')continue;
 if(typeof v==='boolean'){if(k.startsWith('aria-')||k.startsWith('data-'))attrs+=` ${k}="${v}"`;else if(v)attrs+=' '+k;}else attrs+=` ${k}="${esc(v)}"`;
 }
 if(n.type==='option'&&String(n.props.value??n.props.children)===selected)attrs+=' selected';
 return `<${n.type}${attrs}>`+(voids.has(n.type)?'':(n.props.dangerouslySetInnerHTML?.__html||render(children,selected))+`</${n.type}>`);
}

module.exports={load,node,render,used,mocked,
setFixture(options={}){overrides=options.states||{};fixturePath=options.path||'/demo/quotes';query=options.query||'';id=0;},
getMeta:f=>meta.get(f)||{name:f.name,names:names.get(f.name)||[]}};
