import { componentPayload, type RoofState } from './roofing-model';
/** Injected fetch makes the existing endpoint contract independently testable.
 * A local-only draft ID is never treated as a successful cross-origin save. */
export async function persistRoofingComponent(state:RoofState,options:{signedIn:boolean;appOrigin:string;fetcher?:typeof fetch;storage?:Pick<Storage,'setItem'>}):Promise<string> {
  const payload=componentPayload(state),controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),12000);
  try {
    const response=await (options.fetcher??fetch)('/api/free-tools/drafts',{
      method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',
      signal:controller.signal,body:JSON.stringify({draftType:'smart_component',payload}),
    });
    if(!response.ok)throw new Error(response.status===429?'The draft-saving limit has been reached. Download your draft or try again later.':'Your draft could not be saved. Your calculation is still here; try again or download it.');
    const body:unknown=await response.json();
    const id=body&&typeof body==='object'&&'id'in body?(body as {id:unknown}).id:null;
    if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new Error('The server did not confirm a valid saved draft. No navigation has occurred.');
    try{options.storage?.setItem(`qcp:calc-draft:${id}`,JSON.stringify(payload));}catch{/* Server copy is authoritative; local storage is optional. */}
    const origin=options.appOrigin;
    if(origin!==''&&!/^https:\/\/app\.quote-core\.com$/.test(origin))throw new Error('Unrecognised application origin. The draft was saved, but navigation was stopped.');
    return options.signedIn?`${origin}/api/app/restore-calc-draft?draft=${encodeURIComponent(id)}`:`${origin}/signup?ref=free-roofing-calculator&draft=${encodeURIComponent(id)}`;
  }catch(error){if(error instanceof Error&&error.name==='AbortError')throw new Error('Saving took too long. Your calculation is still here. Try again or download the draft.');throw error;}
  finally{clearTimeout(timeout);}
}
