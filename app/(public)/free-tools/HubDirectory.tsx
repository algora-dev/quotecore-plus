'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {CATEGORIES,DIRECTORY_TOOLS,categoryOf,type HubCategory} from './hub-catalog';
import {normaliseQuery} from './tool-registry';
import {hubEvent} from './hub-events';
import {Icon,Eyebrow} from './HubUi';
import s from './hub.module.css';
export default function HubDirectory(){
 const [query,setQuery]=useState(''),[open,setOpen]=useState<Partial<Record<HubCategory,boolean>>>({});
 const boxes=useRef<Partial<Record<HubCategory,HTMLDetailsElement|null>>>({});
 const matches=useMemo(()=>{const tokens=normaliseQuery(query).split(' ').filter(Boolean);return DIRECTORY_TOOLS.filter(t=>{
  const hay=normaliseQuery([t.name,t.shortDescription,...t.keywords,...(t.aliases??[])].join(' '));
  return tokens.every(w=>hay.includes(w));
 });},[query]);
 useEffect(()=>{
  if(query.length<2)return;
  const timer=setTimeout(()=>hubEvent('tool_directory_search',{query_length:query.length,matches:matches.length}),500);
  return()=>clearTimeout(timer);
 },[query,matches.length]);
 useEffect(()=>{
  function show(hash:string){const raw=hash.replace('#directory-','');if(['measure','calculate','documents'].includes(raw)&&hash.startsWith('#directory-')){const id=raw as HubCategory;setOpen(v=>({...v,[id]:true}));requestAnimationFrame(()=>boxes.current[id]?.scrollIntoView({block:'start'}));}}
  const read=()=>show(location.hash);
  // A repeated same-hash link does not emit hashchange. Reopen it explicitly.
  function click(event:MouseEvent){const el=event.target instanceof Element?event.target.closest('a[href^="#directory-"]'):null;if(el)show(el.getAttribute('href')||'');}
  read();window.addEventListener('hashchange',read);document.addEventListener('click',click);
  return()=>{window.removeEventListener('hashchange',read);document.removeEventListener('click',click);};
 },[]);
 return <section id="browse-all-tools" className={s.directorySection} aria-labelledby="directory-heading"><div className={s.wrap}>
  <div className={s.directoryTop}><div><Eyebrow>THE FULL TOOLBOX</Eyebrow><h2 id="directory-heading">Browse All Free Roofing &amp; Construction Calculators and Tools</h2><p>Find takeoffs, documents and specialist calculators in one place.</p></div>
   <div className={s.directorySearch}><label htmlFor="directory-query">Find a tool by name or task</label><div><Icon name="search"/><input data-clarity-mask="True" id="directory-query" type="search" maxLength={100} placeholder="Try concrete, roof pitch or invoice" value={query} onChange={e=>setQuery(e.target.value)}/></div></div>
  </div>
  <p className={s.directoryCount} role="status">{query?`${matches.length} ${matches.length===1?'tool matches':'tools match'} your search`:`${DIRECTORY_TOOLS.length} tools in the library`}</p>
  <div className={s.directoryGroups}>
   {CATEGORIES.map(c=>{const tools=DIRECTORY_TOOLS.filter(t=>categoryOf(t)===c.id);const visible=matches.filter(t=>categoryOf(t)===c.id);return <details key={c.id} id={`directory-${c.id}`} ref={el=>{boxes.current[c.id]=el;}} open={!!query||!!open[c.id]} hidden={!!query&&!visible.length} onToggle={e=>{if(!query){const isOpen=e.currentTarget.open;setOpen(v=>v[c.id]===isOpen?v:{...v,[c.id]:isOpen});}}} className={s.directoryGroup}>
    <summary onClick={()=>hubEvent('tool_directory_filter',{filter:c.id})}><span className={s.directoryGroupLabel}><Icon name={c.id}/><strong>{c.title}</strong><span>{query?visible.length:tools.length}</span></span><Icon name="chevron"/></summary>
    <ul>{tools.map(t=><li key={t.id} hidden={!matches.some(m=>m.id===t.id)}><a href={t.url} onClick={()=>hubEvent('tool_directory_click',{tool_id:t.id,source:'directory'})}><span className={s.directoryToolTitle}>{t.name}<Icon name="arrow"/></span><span>{t.shortDescription}</span></a></li>)}</ul>
   </details>;})}
  </div>
  {query&&!matches.length&&<div className={s.noResults}><p>No tools match that search. Try a simpler term or describe the task to the assistant.</p><button type="button" className={s.textButton} onClick={()=>setQuery('')}>Clear search</button><a href="#tool-finder">Ask the assistant <Icon name="arrow"/></a></div>}
  <p className={s.directoryTip}>Also in the library: concrete, landscaping, paint, tiles, guttering and margin calculators. <a href="/free-calculators" onClick={()=>hubEvent('free_tools_directory_jump',{source:'all-calculators'})}>Browse calculators <Icon name="arrow"/></a></p>
 </div></section>;
}
