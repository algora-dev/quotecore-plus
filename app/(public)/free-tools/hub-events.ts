import {trackEvent} from '@/lib/analytics';
/** No raw question, transcript, customer detail or arbitrary URL in analytics.
 * Uses the existing host analytics adapter. No new pixels; verify the host's consent gating on staging. */
export function hubEvent(name:string,params:Record<string,string|number>={}) {
 try {trackEvent(name,{location:'free_tools_hub',...params});}catch{/* Analytics never block navigation. */}
}
function sessionId():string {
 try {let id=sessionStorage.getItem('qc-finder-session');if(!id){id=crypto.randomUUID();sessionStorage.setItem('qc-finder-session',id);}return id;}catch{return 'anonymous';}
}
export function finderLog(payload:{queryCategory?:string;matchMethod?:'deterministic'|'ai';recommendedToolIds?:string[];noMatch?:boolean;clickedToolId?:string;clickedPosition?:number}):void {
 try {
  // Existing API requires query on query events. Send only the non-sensitive
  // derived category; do not send the user's words to the analytics endpoint.
  void fetch('/api/free-tools/finder-event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:sessionId(),query:payload.queryCategory??'',...payload}),keepalive:true}).catch(()=>{});
 }catch{/* Optional telemetry. */}
}
