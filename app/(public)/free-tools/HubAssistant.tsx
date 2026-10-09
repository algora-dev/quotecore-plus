'use client';
import {useEffect,useRef,useState} from 'react';
import {EXAMPLE_QUESTIONS} from './hub-catalog';
import {getAdvice,bucketFor,reasonFor,resolveRemoteTools,requestRecommendations,type Advice,type RemoteFinder} from './finder-advice';
import {hubEvent,finderLog} from './hub-events';
import {useSpeechInput} from './useSpeechInput';
import {Action,ActionLink,Eyebrow,Icon} from './HubUi';
import s from './hub.module.css';
export default function HubAssistant({remoteFinder=requestRecommendations,preview=false}:{remoteFinder?:RemoteFinder;preview?:boolean}) {
 const [query,setQuery]=useState(''),[question,setQuestion]=useState(''),[advice,setAdvice]=useState<Advice|null>(null),[busy,setBusy]=useState(false),[statusNote,setStatusNote]=useState('');
 const input=useRef<HTMLTextAreaElement>(null),seq=useRef(0),controller=useRef<AbortController|null>(null),results=useRef<HTMLDivElement>(null);
 const speech=useSpeechInput(text=>{setQuery(previous=>[previous.trim(),text].filter(Boolean).join(' ').slice(0,300));hubEvent('tool_finder_voice_used');});
 useEffect(()=>()=>{seq.current++;controller.current?.abort();},[]);
 async function ask(raw:string,source='typed'){
  const q=raw.trim().slice(0,300);if(!q){input.current?.focus();return;}
  speech.cancel();const id=++seq.current;controller.current?.abort();const abort=new AbortController();controller.current=abort;
  setQuery(q);setQuestion(q);setStatusNote('');const local=getAdvice(q);setAdvice(local);setBusy(false);
  hubEvent('tool_finder_submit',{query_bucket:bucketFor(local),query_length:q.length,source});
  if(local.kind==='clarify'){hubEvent('tool_finder_clarification',{category:'measure'});reveal(source);return;}
  let chosen:Advice=local,method:'ai'|'deterministic'='deterministic';
  if(local.kind==='none'||!local.confident){
   setBusy(true);const timer=setTimeout(()=>abort.abort(),10000);
   try{
    const payload=preview?{recommendations:[]}:await remoteFinder(q,abort.signal);if(seq.current!==id)return;
    const tools=resolveRemoteTools(payload);
    if(tools.length){chosen={kind:'match',tools,confident:false,message:tools.length===1?reasonFor(tools[0]):'These are the closest suggestions from our library. Choose the description that fits your task.'};method=(payload as {matchMethod?:string}).matchMethod==='ai'?'ai':'deterministic';setAdvice(chosen);}
   }catch{
    if(seq.current!==id)return;
    setStatusNote(local.kind==='match'?'Showing local suggestions. The optional online matcher is unavailable.':'The optional online matcher is unavailable. Try a more specific description or browse the library.');
   }finally{clearTimeout(timer);if(seq.current===id)setBusy(false);}
  }
  if(seq.current!==id)return;
  const ids=chosen.kind==='match'?chosen.tools.map(t=>t.id):[];
  hubEvent(ids.length?method==='ai'?'tool_finder_ai_fallback':'tool_finder_deterministic_match':'tool_finder_no_match',{top_tool:ids[0]??'none',count:ids.length});
  if(!preview)finderLog({queryCategory:bucketFor(chosen),matchMethod:method,recommendedToolIds:ids,noMatch:!ids.length});reveal(source);
 }
 function reveal(source:string){if(source==='typed')return;requestAnimationFrame(()=>{const el=results.current;if(!el)return;el.scrollTop=0;el.focus({preventScroll:true});el.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});}
 function clear(){seq.current++;controller.current?.abort();speech.cancel();setQuery('');setQuestion('');setAdvice(null);setBusy(false);setStatusNote('');input.current?.focus();}
 return <section id="tool-finder" className={`${s.assistantSection} ${s.dark}`} aria-labelledby="assistant-heading">
  <div className={`${s.wrap} ${s.assistantLayout}`}>
   <div className={s.assistantIntro}><Eyebrow>A LITTLE HELP FINDING YOUR WAY</Eyebrow><h2 id="assistant-heading">Find the Right Free Construction Tool</h2><p>Tell us what you are working on and what you need. We will suggest a tool to get you there.</p><p className={s.exampleLabel}>Try asking something like:</p>
    <div className={s.examples}>{EXAMPLE_QUESTIONS.map(e=><Action key={e.id} className={s.example} onClick={()=>void ask(e.query,'example')}><Icon name="message"/><span>{e.label}</span><Icon name="arrow"/></Action>)}</div>
   </div>
   <div className={s.chatPanel}>
    <div className={s.chatHeader}><span className={s.assistantAvatar}><Icon name="message"/></span><div><strong>Free Tools Assistant</strong><span>A useful place to start.</span></div><span className={s.libraryBadge}>TOOL FINDER</span></div>
    <div className={s.conversation} ref={results} tabIndex={-1} role="region" aria-label="Tool suggestions">
     {!advice&&!busy?<div className={s.assistantBubble}><p>Hi. What do you need a hand with?</p><p>You can describe the job, ask a question, or tell me what you want to create. I will find the closest match in our free tools.</p></div>:<>
      <div className={s.userBubble} data-clarity-mask="True"><span>You asked</span><p>{question}</p></div>
      <div className={s.reply} aria-busy={busy}>
       {busy?<p role="status">Checking the tool library…</p>:<>
        <p role="status">{advice?.message}</p>
        {advice?.kind==='clarify'&&<div className={s.clarifications}>{advice.choices.map(c=><Action key={c.label} onClick={()=>void ask(c.query,'clarification')}>{c.label}<Icon name="arrow"/></Action>)}</div>}
        {advice?.kind==='match'&&<div className={s.recommendations}>{advice.tools.map((t,i)=><article key={t.id} className={s.recommendation}><span className={s.kicker}>{i===0?(advice.confident?'START HERE':'SUGGESTED TOOL'):'ALSO WORTH A LOOK'}</span><h3>{t.name}</h3>{advice.tools.length>1&&<p>{t.shortDescription}</p>}<ActionLink href={t.url} variant={i===0?'primary':'glass'} ariaLabel={`Open ${t.name}`} onClick={()=>{hubEvent('tool_finder_recommendation_click',{tool_id:t.id,position:i+1,intent:bucketFor(advice)});if(!preview)finderLog({clickedToolId:t.id,clickedPosition:i+1});}}>Open tool<Icon name="arrow"/></ActionLink></article>)}</div>}
        {advice?.kind==='none'&&<ActionLink href="#browse-all-tools">Browse the full library<Icon name="arrow"/></ActionLink>}
       </>}
       {statusNote&&<p className={s.systemNote}>{statusNote}</p>}
      </div>
     </>}
    </div>
    <form className={s.composer} onSubmit={e=>{e.preventDefault();void ask(query);}}>
     <label htmlFor="tool-question">What would you like to do?</label>
     <textarea data-clarity-mask="True" ref={input} id="tool-question" maxLength={300} rows={3} value={query} readOnly={speech.listening} onChange={e=>setQuery(e.target.value)} placeholder="For example, I have a floor plan and need to work out the carpet for each room…" aria-describedby="finder-privacy finder-voice-status" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();if(!busy&&!speech.listening)void ask(query);}}}/>
     <div className={s.composerActions}><div className={s.voiceGroup}>{speech.supported?<Action className={speech.listening?s.listening:''} aria-pressed={speech.listening} aria-label={speech.listening?'Stop dictation':'Dictate your question'} onClick={speech.listening?speech.stop:speech.start}><Icon name="mic"/>{speech.listening?'Stop':'Dictate'}</Action>:<span className={s.voiceUnavailable}>Voice is unavailable in this browser.</span>}{question&&<button type="button" className={s.textButton} onClick={clear}>Clear</button>}</div><Action type="submit" variant="primary" disabled={!query.trim()||busy||speech.listening}>Find my tool<Icon name="send"/></Action></div>
     <p id="finder-voice-status" className={s.systemNote} role="status">{speech.notice}</p>
    </form>
    <p id="finder-privacy" className={s.chatPrivacy}>Please leave out personal or customer details. {preview?'This preview uses local matching only.':'Unclear requests may use AI to find a match.'}</p>
    <details className={s.voiceHelp}><summary>About suggestions and voice input</summary><p>This assistant recommends tools, not construction advice or verified prices. {speech.supported?'Dictation uses your browser’s speech service, which may process audio online. Review the text before sending.':'Your browser does not offer compatible dictation here. Text entry and the example questions still work.'} Nothing starts listening automatically.</p></details>
   </div>
  </div>
 </section>;
}
