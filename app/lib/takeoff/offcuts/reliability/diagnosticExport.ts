import { EXPORT_PROTOCOL, buildDiagnosticData, type DiagnosticInput } from './diagnosticData';
import { serializeJsonAsync } from './jsonExport';
export { EXPORT_PROTOCOL } from './diagnosticData';
export interface ExportResult {blob:Blob;mode:'worker'|'cooperative-fallback';workerError?:string;elapsedMs:number;}
export async function diagnosticExport(input:DiagnosticInput,signal?:AbortSignal,createWorker?:()=>Worker,limitMs=15000):Promise<ExportResult>{
  const start=performance.now();
  // Own the state at the click. A later selection/edit cannot alter this export.
  const snapshot=structuredClone(input);
  if(signal?.aborted)throw new DOMException('Export cancelled.','AbortError');
  try{
    const result=await new Promise<Blob>((resolve,reject)=>{
      let worker:Worker|null=null,timer:ReturnType<typeof setTimeout>|undefined,finished=false;
      const end=(error?:Error,blob?:Blob)=>{if(finished)return;finished=true;if(timer)clearTimeout(timer);signal?.removeEventListener('abort',abort);if(worker){worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;worker.terminate();}if(error)reject(error);else resolve(blob!);};
      const abort=()=>end(new DOMException('Export cancelled.','AbortError'));
      signal?.addEventListener('abort',abort,{once:true});
      try{
        worker=createWorker?createWorker():new Worker(new URL('../exportWorker.ts',import.meta.url),{type:'module'});
        timer=setTimeout(()=>end(new Error('Export worker did not finish in time.')),limitMs);
        worker.onmessage=e=>{const m=e.data;if(m?.id!=='diagnostic')return;if(m.protocol!==EXPORT_PROTOCOL)end(new Error('Export worker version mismatch.'));else if(m.error)end(new Error(m.error));else if(m.blob instanceof Blob)end(undefined,m.blob);else end(new Error('Invalid export response.'));};
        worker.onerror=e=>{e.preventDefault();end(new Error(e.message||'Export worker could not load.'));};
        worker.onmessageerror=()=>end(new Error('Export response could not be read.'));
        worker.postMessage({protocol:EXPORT_PROTOCOL,id:'diagnostic',input:snapshot});
      }catch(e){end(e instanceof Error?e:new Error(String(e)));}
    });
    return{blob:result,mode:'worker',elapsedMs:performance.now()-start};
  }catch(error){
    if(signal?.aborted||(error instanceof Error&&error.name==='AbortError'))throw error;
    await new Promise<void>(resolve=>setTimeout(resolve,0));
    if(signal?.aborted)throw new DOMException('Export cancelled.','AbortError');
    // No physical acceptance decision is made here. The fallback reports the
    // same captured data and stays cancellable while serializing large traces.
    const workerError=error instanceof Error?error.message:String(error);
    const blob=await serializeJsonAsync({...buildDiagnosticData(snapshot),exportPerformance:{mode:'cooperative-fallback',workerError}},signal);
    return{blob,mode:'cooperative-fallback',workerError,elapsedMs:performance.now()-start};
  }
}
