import { EXPORT_PROTOCOL, buildDiagnosticData, type DiagnosticInput } from './reliability/diagnosticData';
const scope = globalThis as unknown as {onmessage:((event:MessageEvent)=>void)|null;postMessage:(data:unknown)=>void};
scope.onmessage=event=>{
  const message=event.data as {protocol:string;id:string;input:DiagnosticInput};
  try {
    if(message.protocol!==EXPORT_PROTOCOL)throw new Error('Export worker version mismatch. Reload after saving.');
    const start=performance.now(),data=buildDiagnosticData(message.input),built=performance.now();
    const blob=new Blob([JSON.stringify({...data,exportPerformance:{mode:'worker',workerBuildMs:built-start}},null,2)],{type:'application/json'});
    scope.postMessage({protocol:EXPORT_PROTOCOL,id:message.id,blob,elapsedMs:performance.now()-start});
  }catch(e){scope.postMessage({protocol:EXPORT_PROTOCOL,id:message.id,error:e instanceof Error?e.message:'Diagnostic export failed.'});}
};
