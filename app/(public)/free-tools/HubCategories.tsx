'use client';
import {useEffect,useRef,useState} from 'react';
import {CATEGORIES,categoryFromHash,toolById,type HubCategory} from './hub-catalog';
import {hubEvent} from './hub-events';
import {Action,ActionLink,Icon} from './HubUi';
import s from './hub.module.css';
export default function HubCategories(){
 const [selected,setSelected]=useState<HubCategory|null>(null);
 const [announcement,setAnnouncement]=useState('');
 const headings=useRef<Partial<Record<HubCategory,HTMLHeadingElement|null>>>({});
 useEffect(()=>{
  const read=()=>{const cat=categoryFromHash(window.location.hash);setSelected(cat);if(cat)requestAnimationFrame(()=>headings.current[cat]?.scrollIntoView({block:'nearest'}));};
  read();window.addEventListener('hashchange',read);window.addEventListener('popstate',read);
  return()=>{window.removeEventListener('hashchange',read);window.removeEventListener('popstate',read);};
 },[]);
 function choose(id:HubCategory){
  const next=selected===id?null:id;setSelected(next);setAnnouncement(next?`${CATEGORIES.find(c=>c.id===next)!.title} tools are shown below.`:'Category closed.');
  try{history.pushState(null,'',next?'#'+next:window.location.href.split('#')[0]);}catch{/* Embedded previews may restrict history. */}
  if(next){hubEvent('free_tools_category_select',{category:next});requestAnimationFrame(()=>{const h=headings.current[next];h?.focus({preventScroll:true});h?.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});}
 }
 return <div className={s.categoryArea}>
  <div className={s.categoryGrid} aria-label="Choose a task">
   {CATEGORIES.map((c,i)=><button key={c.id} type="button" id={`category-${c.id}`} className={`${s.categoryCard} ${selected===c.id?s.selectedCard:''}`} aria-expanded={selected===c.id} aria-controls={`tools-${c.id}`} onClick={()=>choose(c.id)}>
    <span className={s.cardTop}><span className={s.categoryIcon}><img src={`/marketing/free-tools/${c.id}-illustration.webp`} alt="" width="600" height="364" loading="eager" decoding="async" /></span><span className={s.cardNumber}>{selected===c.id?<Icon name="check"/>:`0${i+1}`}</span></span>
    <span className={s.categoryTitle}>{c.title}</span><span className={s.categoryDescription}>{c.description}</span>
    <span className={s.categoryFoot}><span>{c.detail}</span><Icon name={selected===c.id?'chevron':'arrow'}/></span>
   </button>)}
  </div>
  <p className={s.srOnly} role="status">{announcement}</p>
  {CATEGORIES.map(c=><section key={c.id} id={`tools-${c.id}`} hidden={selected!==c.id} className={s.toolShelf} aria-labelledby={`heading-${c.id}`}>
    <div className={s.shelfHeading}><div><span className={s.kicker}>YOUR NEXT STEP</span><h2 id={`heading-${c.id}`} ref={el=>{headings.current[c.id]=el;}} tabIndex={-1}>{c.id==='measure'?'A plan to measure, or measurements to price?':c.id==='calculate'?'Get the numbers you need.':'What would you like to create?'}</h2></div><Action aria-label={`Close ${c.title} tools`} className={s.iconButton} onClick={()=>{choose(c.id);document.getElementById(`category-${c.id}`)?.focus();}}><Icon name="close"/></Action></div>
    <div className={`${s.featuredGrid} ${c.id==='measure'?s.twoColumns:''}`}>
     {c.featured.map((id,index)=>{const t=toolById(id);return <article className={s.featuredTool} key={id}>
      <span className={s.kicker}>{c.id==='measure'?(index===0?'I HAVE A PLAN':'I HAVE MEASUREMENTS'):c.id==='documents'?(index===0?'WIN THE JOB':index===1?'ORDER SUPPLIES':'GET PAID'):index===0?'ROOFING':index===1?'CONSTRUCTION':'CUTS & ANGLES'}</span>
      <h3>{t.name}</h3><p>{t.shortDescription}</p>
      <ActionLink href={t.url} onClick={()=>hubEvent('tool_directory_click',{tool_id:id,source:'category'})}>Open {c.id==='documents'?index===0?'Quote Generator':index===1?'Order Generator':'Invoice Generator':'tool'}<Icon name="arrow"/></ActionLink>
      {id==='free-digital-takeoff'&&<div className={s.tradeLinks} aria-label="Go straight to your trade">{[['Roofing','/free-roof-takeoff'],['Cladding','/free-cladding-takeoff'],['Flooring','/free-flooring-takeoff']].map(([name,url])=><a key={url} href={url} onClick={()=>hubEvent('tool_directory_click',{tool_id:url.slice(1),source:'trade-shortcut'})}>{name}<Icon name="arrow"/></a>)}</div>}
     </article>;})}
    </div>
    {c.id==='calculate'&&<p className={s.shelfNote}>Need concrete, paint, tiles, guttering or a specific conversion? <a href="#directory-calculate" onClick={()=>hubEvent('free_tools_directory_jump',{source:'category'})}>Browse all calculators <Icon name="arrow"/></a></p>}
    {c.id==='documents'&&<p className={s.shelfNote}>Start without an account. Daily document and AI limits are shown inside each generator.</p>}
  </section>)}
  <div className={s.heroFoot}><span><Icon name="check"/> Start without signing up</span><a href="#browse-all-tools" onClick={()=>hubEvent('free_tools_directory_jump',{source:'hero'})}>See the full tool library <Icon name="arrow"/></a></div>
  <noscript><p>Choose a tool from the full library below. The category shortcuts and assistant use JavaScript.</p></noscript>
 </div>;
}
