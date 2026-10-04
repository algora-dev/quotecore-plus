'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { DemoGuideChapter } from '@/app/lib/demo/model';
import { QcButton } from '@/app/components/ui/v2/QcButton';
export function DemoChapterButton({chapter}:{chapter:DemoGuideChapter}) {
 const router=useRouter(); const [error,setError]=useState(''); const [pending,setPending]=useState(false);
 async function start(){setPending(true);setError('');try{const response=await fetch('/api/demo/state',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({action:'chapter',chapter})});const result=await response.json();if(!response.ok)throw new Error(result.error);router.push(result.href);router.refresh();window.dispatchEvent(new Event('qc-demo-refresh'));}catch(cause){setError(cause instanceof Error?cause.message:'Could not open chapter.');}finally{setPending(false);}}
 return <><QcButton disabled={pending} onClick={start}>{pending?'Opening…':'Open chapter →'}</QcButton>{error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}</>;
}
