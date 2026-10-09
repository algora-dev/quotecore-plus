/** Time-sliced JSON writer for recovery/export when workers cannot load.
 * Inputs are detached JSON data, not live Fabric/DOM objects. */
export async function serializeJsonAsync(value: unknown, signal?: AbortSignal): Promise<Blob> {
  type Task = { kind:'value'; value:unknown; depth:number } | { kind:'text'; text:string } | { kind:'leave'; value:object };
  const stack:Task[]=[{kind:'value',value,depth:0}],active=new WeakSet<object>(),parts:string[]=[];
  let length=0, deadline=performance.now()+6, operations=0;
  const append=(s:string)=>{length+=s.length;if(length>32_000_000)throw new Error('Diagnostic export exceeds 32 MB. Export a smaller scope.');parts.push(s);};
  while(stack.length){
    if(signal?.aborted)throw new DOMException('Export cancelled.','AbortError');
    const item=stack.pop()!;
    if(item.kind==='text')append(item.text);
    else if(item.kind==='leave')active.delete(item.value);
    else {
      const v=item.value;
      if(v===null||typeof v!=='object'){append(JSON.stringify(v)??'null');}
      else {
        if(item.depth>256||active.has(v))throw new Error('Diagnostic data is cyclic or too deeply nested.');
        active.add(v);stack.push({kind:'leave',value:v});
        if(Array.isArray(v)){
          append('[');stack.push({kind:'text',text:']'});
          for(let i=v.length-1;i>=0;i--){stack.push({kind:'value',value:v[i],depth:item.depth+1});if(i>0)stack.push({kind:'text',text:','});}
        }else{
          const entries=Object.entries(v).filter(([,x])=>x!==undefined&&typeof x!=='function'&&typeof x!=='symbol');
          append('{');stack.push({kind:'text',text:'}'});
          for(let i=entries.length-1;i>=0;i--){const [key,x]=entries[i];stack.push({kind:'value',value:x,depth:item.depth+1});stack.push({kind:'text',text:JSON.stringify(key)+':'});if(i>0)stack.push({kind:'text',text:','});}
        }
      }
    }
    if(++operations%256===0&&performance.now()>=deadline){await new Promise<void>(r=>setTimeout(r,0));deadline=performance.now()+6;}
  }
  if(signal?.aborted)throw new DOMException('Export cancelled.','AbortError');
  return new Blob(parts,{type:'application/json'});
}
