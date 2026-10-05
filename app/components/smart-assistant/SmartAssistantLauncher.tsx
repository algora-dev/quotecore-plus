'use client';
import {usePathname} from 'next/navigation';
import {isSafeReturnDestination} from '@/app/lib/smart-assistant/v2/navigation';
import {useEffect,useRef,useState} from 'react';
import {LegacySmartAssistantLauncher} from './LegacySmartAssistantLauncher';
import {V2ChatClient} from './v2/V2ChatClient';
import {useCapability} from './v2/useCapability';
import {QcButton} from '@/app/components/ui/v2/QcButton';
import type {ConversationRow} from '@/app/(auth)/[workspaceSlug]/assistant/actions';
import s from './v2/assistant.module.css';
type Props={workspaceSlug:string;initialConversations:ConversationRow[];assistantName:string;greeting:string};
export function SmartAssistantLauncher(props:Props){
 const pathname=usePathname();
 const standalone=pathname===`/${props.workspaceSlug}/assistant`;
 const state=useCapability();const [accessEpoch,setAccessEpoch]=useState(0);const [open,setOpen]=useState(false);const [started,setStarted]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null);const trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(state.access&&!standalone){const path=pathname+window.location.search;if(isSafeReturnDestination(path,props.workspaceSlug)){try{sessionStorage.setItem(`sa-last-page:${state.access.userId}:${state.access.companyId}`,path);}catch{/* navigation still works without storage */}}}},[pathname,standalone,state.access,props.workspaceSlug]);
 // Demo guide integration (owner 2026-10-05): the guided demo opens the
 // popup from any workspace page instead of navigating to /assistant.
 useEffect(()=>{if(standalone||!state.access)return;const openFromDemo=()=>{setStarted(true);setOpen(true);};window.addEventListener('qc-open-assistant',openFromDemo);return()=>window.removeEventListener('qc-open-assistant',openFromDemo);},[standalone,state.access]);
 useEffect(()=>{const node=dialog.current;if(!node)return;if(open&&!standalone){if(!node.open)node.showModal();const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};}node.close();trigger.current?.focus();},[open,state.access,standalone]);
 if(!state.ready)return null;
 if(state.error)return <div data-qc-ui="v2" className={s.launcher}><QcButton onClick={()=>setOpen(!open)}>Assistant unavailable</QcButton>{open&&<p role="alert">{state.error} Reload this page after setup is checked.</p>}</div>;
 if(!state.access)return <LegacySmartAssistantLauncher {...props}/>;
 return <div data-qc-ui="v2"><div className={s.launcher} hidden={open||standalone}><QcButton ref={trigger} variant="secondary" aria-label={`Open ${props.assistantName}`} onClick={()=>{setStarted(true);setOpen(true);}}>{props.assistantName}</QcButton></div>
   <dialog ref={dialog} className={s.dialog} aria-label={props.assistantName} onCancel={e=>{e.preventDefault();setOpen(false);}}>
     {started&&<V2ChatClient key={`${state.access.userId}:${state.access.companyId}:${accessEpoch}`} {...props} access={state.access} settingsHref={`/${props.workspaceSlug}/account/smart-assistant`} visible={open&&!standalone} onHide={()=>setOpen(false)} onStaleAccess={()=>setAccessEpoch(value=>value+1)}/>}
   </dialog>
 </div>;
}
