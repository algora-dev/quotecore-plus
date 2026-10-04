'use client';
import { useState } from 'react';
import { QcButton } from '@/app/components/ui/v2/QcButton';
export function DemoCustomerResponse({token,initialStatus}:{token:string;initialStatus:string}){
 const [status,setStatus]=useState(initialStatus);const [error,setError]=useState('');const [pending,setPending]=useState(false);
 async function respond(choice:'accepted'|'declined'){setPending(true);setError('');try{const response=await fetch('/api/demo/quote-response',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,choice})});const result=await response.json();if(!response.ok)throw new Error(result.error);setStatus(result.status);}catch(cause){setError(cause instanceof Error?cause.message:'Could not record the demo response.');}finally{setPending(false);}}
 return <section className="mt-5 rounded-xl border bg-white p-5"><h2 className="font-semibold">Try the customer response</h2>{status==='accepted'||status==='declined'?<p role="status" className="mt-3 text-sm">Demo response recorded: <strong>{status}</strong>. Nothing has been ordered or emailed.</p>:<div className="mt-4 flex flex-wrap gap-3"><QcButton variant="primary" disabled={pending} onClick={()=>void respond('accepted')}>Accept demo quote</QcButton><QcButton variant="secondary" disabled={pending} onClick={()=>void respond('declined')}>Decline demo quote</QcButton></div>}{error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}</section>;
}
