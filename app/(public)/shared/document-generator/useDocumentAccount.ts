'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFreeToolsAuth } from '../../_components/FreeToolsAuthProvider';
import { createFreeToolsClient } from '@/app/lib/supabase/free-client';
import { TIER_LIMITS, type DocumentAccount, type DocumentAuthServices } from './document-account';
import { readAuthResume, clearAuthResume } from './auth-resume';
type Status={tier:1|2|3;verifiedUserId:string|null;canRemoveBranding:boolean;hasPaidAppAccess:boolean;limits:DocumentAccount['limits']};
/** Route-scoped adapter: existing cookie-backed client and provider remain shared.
 * The legacy stored-email hook is intentionally NOT an authorization input. */
export function useDocumentAccount() {
  const {user,loading,accessToken}=useFreeToolsAuth();
  const [client]=useState(()=>createFreeToolsClient());
  const [state,setState]=useState<{token:string|null;status:Status|null;error:string;pending:boolean}>({token:null,status:null,error:'',pending:true});
  const mounted=useRef(true),sequence=useRef(0),lastFocus=useRef(0);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;sequence.current++;};},[]);
  const refresh=useCallback(async():Promise<boolean>=>{
    const seq=++sequence.current;let token:string|null=null;const controller=new AbortController();
    let timeout:ReturnType<typeof setTimeout>|undefined;
    const deadline=new Promise<never>((_,reject)=>{timeout=setTimeout(()=>{controller.abort();reject(new Error('Your account check timed out. Your document is safe; try again.'));},8000);});
    try {
      const {data,error}=await Promise.race([client.auth.getSession(),deadline]);if(error)throw error;
      token=data.session?.access_token??null;
      if(!token){if(mounted.current&&seq===sequence.current)setState({token:null,status:null,error:'',pending:false});return false;}
      const response=await Promise.race([fetch('/api/free-tools/account-status',{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:controller.signal}),deadline]);
      if(!response.ok)throw new Error('Your account benefits could not be checked. Your document is safe; try again.');
      const status:Status=await response.json();
      const valid=[1,2,3].includes(status.tier)&&status.limits&&typeof status.canRemoveBranding==='boolean';
      if(!valid)throw new Error('Your account benefits could not be checked. Please try again.');
      const confirmed=!!(status.canRemoveBranding&&status.verifiedUserId&&status.verifiedUserId===data.session?.user.id);
      if(mounted.current&&seq===sequence.current)setState({token,status:{...status,canRemoveBranding:confirmed},error:'',pending:false});
      return confirmed;
    }catch(e){if(mounted.current&&seq===sequence.current)setState({token,status:null,error:e instanceof Error?e.message:'Unable to check your account.',pending:false});return false;}finally{if(timeout)clearTimeout(timeout);}
  },[client]);
  useEffect(()=>{setState(prev=>({...prev,status:null,pending:true,error:''}));void refresh();},[accessToken,refresh]);
  useEffect(()=>{const focus=()=>{if(Date.now()-lastFocus.current<15000)return;lastFocus.current=Date.now();void refresh();};window.addEventListener('focus',focus);return()=>window.removeEventListener('focus',focus);},[refresh]);
  const status=state.token===accessToken?state.status:null;
  const account:DocumentAccount={ready:!loading&&!state.pending,signedIn:!!user,email:user?.email,userId:user?.id,
    canRemoveBranding:!!(status?.canRemoveBranding&&status.verifiedUserId===user?.id),hasPaidAppAccess:status?.hasPaidAppAccess===true,
    limits:status?.limits??TIER_LIMITS[1],error:state.error,refresh,
    signOut:async()=>{const {error}=await client.auth.signOut();if(error)throw error;setState({token:null,status:null,error:'',pending:false});},
  };
  const auth=useMemo<DocumentAuthServices>(()=>({preview:false,
    async google(redirectTo){const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo}});if(error)throw error;},
    async email(email,redirectTo){const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:redirectTo,shouldCreateUser:true}});if(error)throw error;},
    async password(email,password){const {error}=await client.auth.signInWithPassword({email,password});if(error)throw error;},
  }),[client]);
  // Consent is separate from the account benefit. A confirmed session is required;
  // saved-email/localStorage values can never remove branding or increase limits.
  const saveMarketingConsent=useCallback(async(id:string)=>{
    const resume=readAuthResume(id);if(!resume)return;
    const {data}=await client.auth.getSession();const session=data.session;if(!session)return;
    if(resume.intendedEmail && resume.intendedEmail!==session.user.email?.toLowerCase()) {clearAuthResume(id);return;}
    try{if(resume.marketingConsent){const r=await fetch('/api/free-tools/marketing-preference',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({subscribed:true})});
      if(!r.ok)throw new Error('Your free account is ready. We could not save your optional email preference; no marketing signup has been confirmed.');}
    }finally{clearAuthResume(id);}
  },[client]);
  return {account,auth,accessToken,saveMarketingConsent};
}
