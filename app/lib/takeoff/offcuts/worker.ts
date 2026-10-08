import { runWorkerCalculation } from './reliability/workerCalculation';
import type { WorkerRequest } from './reliability/protocol';
/** One run per worker; the main-thread controller owns termination and deadlines. */
self.addEventListener('message',(event:MessageEvent<WorkerRequest>)=>runWorkerCalculation(event.data,message=>self.postMessage(message)));
