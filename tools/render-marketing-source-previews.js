const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Module = require('module');
const ts = require('typescript');

const root = process.argv[2];
const entry = process.argv[3];
const outFile = process.argv[4];
const mode = process.argv[5] || 'page';
if (!root || !entry || !outFile) {
  console.error('usage: node render_qc_source.js ROOT ENTRY OUT [mode]'); process.exit(2);
}

const cssChunks = [];
const cssSeen = new Set();
const cssMaps = new Map();
let componentStack = [];
let hookIndex = 0;
let idCounter = 0;
const FRAGMENT = Symbol.for('qc.fragment');

function hashName(file) { return crypto.createHash('sha1').update(path.relative(root,file)).digest('hex').slice(0,7); }
function moduleCss(filename) {
  if (cssMaps.has(filename)) return cssMaps.get(filename);
  let css = fs.readFileSync(filename,'utf8');
  const prefix = `qc_${hashName(filename)}_`;
  const names = new Set();
  const re = /\.([A-Za-z_][A-Za-z0-9_-]*)/g;
  let m;
  while ((m = re.exec(css))) names.add(m[1]);
  const mapping = {};
  [...names].sort((a,b)=>b.length-a.length).forEach(name => { mapping[name] = prefix + name; });
  // Rewrite every class token in a single pass. Doing sequential replacements
  // breaks chained selectors such as `.dark.header` after the first token is renamed.
  css = css.replace(/\.([A-Za-z_][A-Za-z0-9_-]*)/g, (full, name) =>
    mapping[name] ? `.${mapping[name]}` : full
  );
  cssMaps.set(filename,mapping);
  if (!cssSeen.has(filename)) { cssSeen.add(filename); cssChunks.push(`/* ${path.relative(root,filename)} */\n${css}`); }
  return mapping;
}

require.extensions['.css'] = function(mod, filename) {
  if (filename.endsWith('.module.css')) mod.exports = moduleCss(filename);
  else { if (!cssSeen.has(filename)) { cssSeen.add(filename); cssChunks.push(fs.readFileSync(filename,'utf8')); } mod.exports = {}; }
};
for (const ext of ['.png','.jpg','.jpeg','.webp','.svg','.ico']) {
  require.extensions[ext] = function(mod, filename) { mod.exports = { src: '/' + path.relative(path.join(root,'public'),filename).replace(/\\/g,'/'), width: 0, height: 0 }; };
}

function transpile(mod, filename) {
  let source = fs.readFileSync(filename,'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
    }, fileName: filename
  });
  mod._compile(output.outputText, filename);
}
require.extensions['.ts'] = transpile;
require.extensions['.tsx'] = transpile;

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    const target = path.join(root, request.slice(2));
    return originalResolve.call(this,target,parent,isMain,options);
  }
  return originalResolve.call(this,request,parent,isMain,options);
};

function jsx(type, props, key) { return { $$typeof: Symbol.for('qc.element'), type, key, props: props || {} }; }
function jsxs(type, props, key) { return jsx(type,props,key); }
function jsxDEV(type, props, key) { return jsx(type,props,key); }

function useState(initial) {
  const comp = componentStack[componentStack.length-1] || '';
  const idx = hookIndex++;
  let value = typeof initial === 'function' ? initial() : initial;
  if ((mode === 'dfy-modal' || mode.startsWith('dfy-step-') || mode === 'dfy-success') && comp === 'DoneForYouInquiryModal') {
    if (idx === 0) value = true;
    if (idx === 1 && mode.startsWith('dfy-step-')) value = 'form';
    if (idx === 1 && mode === 'dfy-success') value = 'success';
    if (idx === 2 && mode.startsWith('dfy-step-')) value = Number(mode.slice('dfy-step-'.length)) || 0;
    if (idx === 3 && mode === 'dfy-success') value = { ...value, name: 'Jamie Roofer', email: 'jamie@example.com' };
  }
  if ((mode === 'free-modal' || mode === 'free-success') && comp === 'FreeWorkspaceModal') {
    if (idx === 0) value = true;
    if (idx === 2 && mode === 'free-success') value = 'jamie@example.com';
  }
  return [value, ()=>{}];
}
function useRef(initial){ hookIndex++; return {current: initial}; }
function useMemo(fn){ hookIndex++; return fn(); }
function useCallback(fn){ hookIndex++; return fn; }
function useEffect(){ hookIndex++; }
function useLayoutEffect(){ hookIndex++; }
function useInsertionEffect(){ hookIndex++; }
function useId(){ hookIndex++; return `qc-id-${++idCounter}`; }
function useReducer(reducer, initialArg, init){ hookIndex++; const v=init?init(initialArg):initialArg; return [v,()=>{}]; }
function useTransition(){ hookIndex++; return [false,(fn)=>fn()]; }
function useContext(ctx){ hookIndex++; return ctx && ctx._currentValue; }
function createContext(defaultValue){ return {_currentValue:defaultValue, Provider:({value,children})=>{return children;}, Consumer:({children})=>children(defaultValue)}; }
const reactStub = { Fragment:FRAGMENT, useState,useRef,useMemo,useCallback,useEffect,useLayoutEffect,useInsertionEffect,useId,useReducer,useTransition,useContext,createContext, startTransition:(fn)=>fn(), memo:(c)=>c, forwardRef:(fn)=>(p)=>fn(p,null) };

function Link(props){ const {href,children,...rest}=props; return jsx('a',{href: typeof href==='string'?href:(href?.pathname||'#'),...rest,children}); }
function Image(props){ let {src,alt='',width,height,fill,priority,fetchPriority,...rest}=props; if (src && typeof src==='object') src=src.src||''; if (fill) { delete rest.fill; } return jsx('img',{src,alt,width,height,...rest}); }
function headers(){ return Promise.resolve({get:()=>''}); }

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'react') return reactStub;
  if (request === 'react/jsx-runtime' || request === 'react/jsx-dev-runtime') return {jsx,jsxs,jsxDEV,Fragment:FRAGMENT};
  if (request === 'next/link') return {__esModule:true, default:Link};
  if (request === 'next/image') return {__esModule:true, default:Image};
  if (request === 'next/headers') return {headers};
  if (request === 'next/navigation') return {usePathname:()=> '/', useSearchParams:()=>new URLSearchParams(), useRouter:()=>({push(){},replace(){},back(){},refresh(){}}), redirect:()=>null, notFound:()=>null};
  if (request === 'server-only') return {};
  if (request === '@supabase/ssr') return { createBrowserClient:()=>({auth:{signInWithOAuth:async()=>({error:null}),signInWithOtp:async()=>({error:null})}}), createServerClient:()=>({}) };
  if (request === '@supabase/supabase-js') return { createClient:()=>({}) };
  return originalLoad.apply(this,arguments);
};

const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const attrMap = {className:'class',htmlFor:'for',charSet:'charset',httpEquiv:'http-equiv',crossOrigin:'crossorigin',fetchPriority:'fetchpriority',srcSet:'srcset',allowFullScreen:'allowfullscreen',autoComplete:'autocomplete',inputMode:'inputmode',tabIndex:'tabindex',itemScope:'itemscope',itemType:'itemtype',itemProp:'itemprop'};
function esc(v){return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function styleToString(obj){return Object.entries(obj||{}).map(([k,v])=>{if(v==null)return ''; const prop=k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase()); return `${prop}:${v}`;}).filter(Boolean).join(';');}
function render(node){
  if (node == null || node === false || node === true) return '';
  if (typeof node === 'string' || typeof node === 'number') return esc(node);
  if (Array.isArray(node)) return node.map(render).join('');
  if (node && typeof node.then === 'function') throw new Error('Async component not supported in static renderer');
  if (!node || node.$$typeof !== Symbol.for('qc.element')) return '';
  const {type,props={}}=node;
  if (type === FRAGMENT) return render(props.children);
  if (typeof type === 'function') {
    const prevHook=hookIndex; hookIndex=0; componentStack.push(type.name || 'Anonymous');
    try { return render(type(props)); }
    catch(e){ console.error('Error rendering component',type.name,e.stack||e); throw e; }
    finally { componentStack.pop(); hookIndex=prevHook; }
  }
  if (typeof type !== 'string') return '';
  let attrs='';
  let inner='';
  if (props.dangerouslySetInnerHTML && props.dangerouslySetInnerHTML.__html != null) inner=String(props.dangerouslySetInnerHTML.__html);
  else inner=render(props.children);
  for (const [key,val] of Object.entries(props)) {
    if (key==='children'||key==='dangerouslySetInnerHTML'||key==='key'||key==='ref'||key.startsWith('on')) continue;
    if (val==null||val===false) continue;
    let name=attrMap[key]||key;
    if (key==='style' && typeof val==='object') { const s=styleToString(val); if(s) attrs+=` style="${esc(s)}"`; continue; }
    if (val===true) { attrs+=` ${name}`; continue; }
    if (typeof val==='function'||typeof val==='object') continue;
    attrs+=` ${name}="${esc(val)}"`;
  }
  return voidTags.has(type) ? `<${type}${attrs}>` : `<${type}${attrs}>${inner}</${type}>`;
}

function inlineAssets(html, css) {
  const mime = ext => ({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.gif':'image/gif','.ico':'image/x-icon'}[ext.toLowerCase()]||'application/octet-stream');
  const cache=new Map();
  function dataFor(url){
    const clean=url.split('?')[0].split('#')[0];
    if (!clean.startsWith('/')) return url;
    const f=path.join(root,'public',clean.slice(1));
    if (!fs.existsSync(f)||!fs.statSync(f).isFile()) return url;
    if(cache.has(f))return cache.get(f);
    const data=`data:${mime(path.extname(f))};base64,${fs.readFileSync(f).toString('base64')}`; cache.set(f,data); return data;
  }
  html=html.replace(/\b(src|poster)="(\/[^"\s]+)"/g,(m,a,u)=>`${a}="${dataFor(u)}"`);
  html=html.replace(/\bsrcset="([^"]+)"/g,(m,v)=>{
    const nv=v.split(',').map(part=>{const bits=part.trim().split(/\s+/); if(bits[0].startsWith('/'))bits[0]=dataFor(bits[0]); return bits.join(' ');}).join(', '); return `srcset="${nv}"`;
  });
  css=css.replace(/url\((['"]?)(\/[^)'"\s]+)\1\)/g,(m,q,u)=>`url(${q}${dataFor(u)}${q})`);
  return [html,css];
}

const entryPath = path.isAbsolute(entry) ? entry : path.join(root,entry);
const mod = require(entryPath);
let Component = mod.default || mod;
if (mode === 'dfy-modal' || mode.startsWith('dfy-step-') || mode === 'dfy-success') Component = require(path.join(root,'components/marketing/DoneForYouInquiryModal.tsx')).DoneForYouInquiryModal;
if (mode === 'free-modal' || mode === 'free-success') Component = require(path.join(root,'components/marketing/FreeWorkspaceModal.tsx')).FreeWorkspaceModal;
let body = render(jsx(Component,{}));

const globalsPath = path.join(root,'app/globals.css');
let globalCss = fs.existsSync(globalsPath) ? fs.readFileSync(globalsPath,'utf8') : '';
// Raw acceptance HTML cannot execute Tailwind's build-time @import/@plugin directives.
// The locked surfaces use CSS modules rather than Tailwind utilities, so retain the
// real runtime global rules while dropping only those two build directives.
globalCss = globalCss.replace(/^@import\s+["']tailwindcss["'];?\s*$/gm,'').replace(/^@plugin\s+["']@tailwindcss\/typography["'];?\s*$/gm,'');
let preflightCss = '';
try { preflightCss = fs.readFileSync(require.resolve('tailwindcss/preflight.css', { paths:[root] }), 'utf8'); } catch {}
// RootLayout adds h-full/min-h-full/flex/flex-col/antialiased through Tailwind.
// Mirror those layout effects explicitly so the standalone acceptance DOM has the
// same page-shell behavior without needing the full Next build pipeline.
let css = preflightCss + `\nhtml{height:100%;scroll-behavior:smooth}body{min-height:100%;display:flex;flex-direction:column;-webkit-font-smoothing:antialiased}\n` + globalCss + '\n' + cssChunks.join('\n');
[body,css] = inlineAssets(body,css);
const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QuoteCore+ source-rendered preview</title><style>${css}</style></head><body>${body}</body></html>`;
fs.mkdirSync(path.dirname(outFile),{recursive:true}); fs.writeFileSync(outFile,doc);
console.log(JSON.stringify({outFile,cssModules:cssSeen.size,bytes:Buffer.byteLength(doc),component:Component.name},null,2));
