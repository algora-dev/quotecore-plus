import { createAccountRecoveryRepository, createRecoveryBackup, type RecoveryBackup, type RecoveryRepository } from './offcuts/persistence/recoveryStore';
import type { ReviewRpcClient } from './offcuts/persistence/browserReviewStore';
import { withTimeout } from './offcuts/reliability/timeout';
export interface RecoveryServices {repository:RecoveryRepository;backup:RecoveryBackup;accountId:string;}
/** No cached account namespace across sign-out/account changes. Server-side RLS
 * checks ownership independently of this device-local namespace. */
export async function getOffcutRecoveryServices():Promise<RecoveryServices>{
  const {createClient}=await import('@/app/lib/supabase/client');const client=createClient();
  const auth=await withTimeout(client.auth.getSession(),15_000,'Sign-in could not be checked. Your measurements remain in the open page.');
  const accountId=auth.data.session?.user.id;
  if(auth.error||!accountId)throw new Error('Sign in before saving an offcut recovery checkpoint.');
  type Abortable=ReturnType<ReviewRpcClient['rpc']>&{abortSignal:(signal:AbortSignal)=>ReturnType<ReviewRpcClient['rpc']>};
  const call=client.rpc.bind(client) as unknown as (name:string,args:Record<string,unknown>)=>Abortable;
  const rpc:ReviewRpcClient={async rpc(name,args){
    const current=await withTimeout(client.auth.getSession(),5000,'Account identity could not be checked.');
    if(current.error||current.data.session?.user.id!==accountId)throw new Error('The signed-in account changed. Reopen the takeoff before saving recovery data.');
    const abort=new AbortController();return withTimeout(call(name,args).abortSignal(abort.signal),20_000,
    'The account recovery store did not respond. Reload its checkpoint before retrying an uncertain save.',()=>abort.abort());}};
  return{repository:createAccountRecoveryRepository(rpc),backup:createRecoveryBackup(accountId),accountId};
}
