'use client';
import { useState } from 'react';
import { RoofingCalculator } from './RoofingCalculator';
import { persistRoofingComponent } from './roofing-service';
import { useFreeToolsAuth } from '../../_components/FreeToolsAuthProvider';
import { getAppOrigin } from '../../shared/appOrigin';
import { trackEvent } from '@/lib/analytics';
export function RoofingClient(){
  const {user}=useFreeToolsAuth();
  return <RoofingCalculator services={{track:trackEvent,saveComponent:state=>{
    let storage:Storage|undefined;try{storage=window.localStorage;}catch{/* Optional browser cache. */}
    return persistRoofingComponent(state,{signedIn:!!user,appOrigin:getAppOrigin(),storage});
  }}}/>;
}
/** Reuse host auth state and modal; do not duplicate registration or entitlement logic. */
export function RoofingAccountControl(){
  const {user,loading,openAuthModal,signOut}=useFreeToolsAuth(),[error,setError]=useState('');
  async function logout(){try{setError('');await signOut();}catch{setError('Sign out failed. Please try again.');}}
  return <div className="qcr-account">{user?.email&&<small>{user.email}</small>}<button type="button" className="qcr-button qcr-glass" disabled={loading} onClick={()=>user?void logout():openAuthModal('signin')}>{loading?'Checking…':user?'Sign out':'Sign in'}</button>{error&&<small role="alert">{error}</small>}</div>;
}
