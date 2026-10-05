'use client';
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
 return <div className={props.embedded?undefined:s.standalone}><V2ChatClient {...props} access={state.access} onHide={()=>{
   const access=state.access!;
   if(window.location.pathname!==`/${access.workspaceSlug}/assistant`)return;
   let destination=`/${access.workspaceSlug}`;
   try{const previous=sessionStorage.getItem(`sa-last-page:${access.userId}:${access.companyId}`);if(isSafeReturnDestination(previous,access.workspaceSlug))destination=previous;}catch{/* safe workspace fallback */}
   router.push(destination);
 }}/></div>;
}
