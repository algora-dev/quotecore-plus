'use client';
import { useState } from 'react';
import { type Trade } from './calculator-profile';
import { TradeCalculator } from './TradeCalculator';
import { persistCalculatorComponent } from './calculator-service';
import { useFreeToolsAuth } from '../FreeToolsAuthProvider';
import { getAppOrigin } from '../../shared/appOrigin';
import { trackEvent } from '@/lib/analytics';
export function CalculatorClient({trade}:{trade:Trade}){
  const {user}=useFreeToolsAuth();
  return <TradeCalculator key={trade} trade={trade} services={{track:trackEvent,saveComponent:state=>{
    let storage:Storage|undefined;try{storage=window.localStorage;}catch{/* Optional browser cache. */}
    return persistCalculatorComponent(state,{signedIn:!!user,appOrigin:getAppOrigin(),storage});
  }}}/>;
}
/** Reuse host auth state and modal; do not duplicate registration or entitlement logic. */
export function CalculatorAccountControl(){
  const {user,loading,openAuthModal,signOut}=useFreeToolsAuth(),[error,setError]=useState('');
  async function logout(){try{setError('');await signOut();}catch{setError('Sign out failed. Please try again.');}}
  return <div className="qck-account">{user?.email&&<small>{user.email}</small>}<button type="button" className="qck-button qck-glass" disabled={loading} onClick={()=>user?void logout():openAuthModal('signin')}>{loading?'Checking…':user?'Sign out':'Sign in'}</button>{error&&<small role="alert">{error}</small>}</div>;
}
