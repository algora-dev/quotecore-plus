/** Deterministic named hook evaluator for selected callbacks, not React rendering.
 * The loaded application source is never edited. All external calls throw unless
 * explicitly substituted by a test. Effects, hydration and timing are not tested.
 */
const fs=require('fs'),path=require('path');
let h=fs.readFileSync(path.join(__dirname,'view-harness.cjs'),'utf8');
h='const states=new Map(),refs=new Map(),injections=new Map();\n'+h;
h=h.replace(/function state\(init\)\{[^\n]+\}/,`function state(init){ const key=current.name+'.'+(current.names[current.index++]||('state'+current.index));if(!states.has(key)) states.set(key,typeof init==='function'?init():init);return [states.get(key),next=>states.set(key,typeof next==='function'?next(states.get(key)):next)]; }`);
h=h.replace('useRef:v=>({current:v})',`useRef:v=>{const k=current.name+'.ref'+(current.refIndex++||0);if(!refs.has(k))refs.set(k,{current:v});return refs.get(k);}`);
h=h.replace('useTransition:()=>[false,noAction]','useTransition:()=>[false,f=>f()]');
h=h.replace('const req=spec=>{',`const req=spec=>{ if(injections.has(spec))return injections.get(spec);`);
h=h.replace("const r=file?path.relative(root,file):spec;", "const r=file?path.relative(root,file):spec; if(injections.has(r))return injections.get(r);");
h=h.replace("new Function('require','module','exports',code)(req,module,module.exports);",`const expose=Object.keys(infos).filter(n=>/^[A-Z]/.test(n)).map(n=>'if(typeof '+n+' !== "undefined") module.exports.__'+n+'='+n+';').join('\\n');new Function('require','module','exports',code+'\\n'+expose)(req,module,module.exports);`);
h=h.replaceAll('current={...m,index:0}', 'current={...m,index:0,refIndex:0}');
h+=`\nfunction expand(n){ if(n==null||typeof n==='boolean')return null;if(Array.isArray(n))return n.map(expand);if(typeof n!=='object')return n;if(n.type===Fragment)return expand(n.props.children);if(n.type?.context){let c=n.type.context,prev=c.value;c.value=n.props.value;const t=expand(n.props.children);c.value=prev;return t;}if(typeof n.type==='function'){const prev=current,m=meta.get(n.type)||{name:n.type.name,names:names.get(n.type.name)||[]};current={...m,index:0,refIndex:0};const t=n.type(n.props);const result=expand(t);current=prev;return result;}return {...n,props:{...n.props,children:expand(n.props.children)}};}
module.exports={load,node,render,expand,states,refs,injections,reset(){states.clear();refs.clear();cache.clear();mocked.clear();id=0;},mocked};`;
const m={exports:{}};new Function('require','module','exports','__dirname',h)(require,m,m.exports,__dirname);module.exports=m.exports;
