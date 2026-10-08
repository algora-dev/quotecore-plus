/** A timed-out network write may still have committed server-side. Callers must
 * reload/reconcile its revision rather than blindly retrying the same write. */
export function withTimeout<T>(operation:PromiseLike<T>,milliseconds:number,message:string,onTimeout?:()=>void):Promise<T>{
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{onTimeout?.();reject(new Error(message));},milliseconds);
    Promise.resolve(operation).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
  });
}
