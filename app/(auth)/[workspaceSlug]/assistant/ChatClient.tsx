'use client';
import {useEffect, useRef, useState} from 'react';
import {isSafeReturnDestination} from '@/app/lib/smart-assistant/v2/navigation';
import {useRouter} from 'next/navigation';
import {LegacyChatClient} from './LegacyChatClient';
import type {ConversationRow} from './actions';
import {V2ChatClient} from '@/app/components/smart-assistant/v2/V2ChatClient';
import {useCapability} from '@/app/components/smart-assistant/v2/useCapability';
import s from '@/app/components/smart-assistant/v2/assistant.module.css';
type Props={initialConversations:ConversationRow[];assistantName:string;greeting:string;settingsHref:string;embedded?:boolean};
export function ChatClient(props:Props){
 const state=useCapability();const router=useRouter();
 if(!state.ready)return <p role="status">Opening assistant...</p>;
 if(state.error)return <p role="alert">{state.error}</p>;
 if(!state.access)return <LegacyChatClient {...props}/>;
 const hostRef = useRef<HTMLDivElement>(null);
 const [hostH, setHostH] = useState(0);
 useEffect(() => { const el = hostRef.current; if (!el) return; const ro = new ResizeObserver(() => setHostH(Math.round(el.getBoundingClientRect().height))); ro.observe(el); return () => ro.disconnect(); }, []);
 return <div ref={hostRef} className={props.embedded?undefined:s.standalone}><V2ChatClient {...props} access={state.access} onHide={()=>{
   const access=state.access!;
   if(window.location.pathname!==`/${access.workspaceSlug}/assistant`)return;
   let destination=`/${access.workspaceSlug}`;
   try{const previous=sessionStorage.getItem(`sa-last-page:${access.userId}:${access.companyId}`);if(isSafeReturnDestination(previous,access.workspaceSlug))destination=previous;}catch{/* safe workspace fallback */}
   router.push(destination);
 }}/><div aria-hidden="true" style={{ position: 'absolute', left: 6, bottom: 3, zIndex: 99, fontSize: 9, fontFamily: 'ui-monospace,monospace', color: '#7dd3fc', opacity: 0.9, pointerEvents: 'none' }}>host:{hostH}</div></div>;
}
