// Browser-only fixture. This file is NOT in an app route and cannot authorise any operation.
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const query=new URLSearchParams(window.__previewQuery ?? location.search);
// about:blank rendering is supported when a managed browser disallows local HTTP.
try{localStorage.getItem('sa-preview');}catch{for(const name of ['localStorage','sessionStorage']){const store=new Map();Object.defineProperty(window,name,{configurable:true,value:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)}});}}
const access={userId:uuid(1),companyId:uuid(2),workspaceSlug:'preview',phases:{p1:true,p2:true,p3:true,p4:false},permissions:{quotes:'read_only',draft_quotes:'edit',orders:'read_only',invoices:'read_only',components:'edit',customers:'read_only',emails:'hidden',billing:'hidden',settings:'hidden'},permissionRevision:1,historyAfter:null,writePolicy:'propose'};
const time=new Date().toISOString();
const fixture=window.__fixture={access,conversationId:uuid(3),navigation:[],refreshes:0,newChats:0,hides:0,requests:[],posts:[],audio:[],stops:0,recorders:0,transcriptions:0,signal:0.16,permission:'allowed',fail:false,delay:0,denied:false};
function seed(name){
 const state={enabled:true,access:{...access},messages:[],cards:[],actions:[],runs:[],task:null,page:null,activeRunId:null,runStatus:null};
 if(name==='empty')return state;
 const runId=uuid(10);const task={id:uuid(11),version:1,status:'answered',label:'Finding · Ridge on Smith Roof',lastRunId:runId,startedAt:new Date(Date.now()-3000).toISOString(),updatedAt:time,expiresAt:new Date(Date.now()+900000).toISOString(),closure:null,boundary:false};
 state.task=task;state.runs=[{id:runId,requestId:uuid(12),status:'completed'}];
 state.messages=[{id:uuid(20),runId,role:'user',content:'How much is Ridge on the Smith job?',createdAt:time},{id:uuid(21),runId,role:'assistant',content:'I found three likely matches. Which one did you mean?',createdAt:time}];
 state.cards=[{id:uuid(30),runId,createdAt:time,content:{kind:'resolution',title:'Choose the right record',stateId:uuid(31),expiresAt:task.expiresAt,question:'Tell me the job name or whether it was in your component library.',options:[{choiceId:uuid(40),label:'Ridge · Smith Roof',detail:'Draft quote · John Smith · 24 September'},{choiceId:uuid(41),label:'Ridge · Smith Extension',detail:'Quote #1014 · John Smith · 18 September'},{choiceId:uuid(42),label:'Ridge',detail:'Component library · Standard roofing setup'}]}}];
 if(name==='records'){state.cards[0].content={kind:'records',title:'Your quotes',note:'Newest by last update. This is a bounded list, not an aggregate.',autoOpen:false,options:[{kind:'quote',id:uuid(40),label:'Quote #1014 · Smith Roof',detail:'John Smith · 24 September'},{kind:'quote',id:uuid(41),label:'Quote #1013 · Maple Ridge',detail:'Jane Jones · 22 September'}]};}
 if(name==='long'){state.messages[1].content='**Ridge on Smith Roof**\n\n'+('This is a longer answer to exercise conversation scrolling without covering the microphone or the input controls.\n\n').repeat(20);}
 if(name==='proposal'){
 state.task.label='Reviewing · Ridge material rate';state.messages[0].content='Set Ridge material rate to 30 per metre on the Smith draft.';state.messages[1].content='Here’s the change for **Smith Roof**. Nothing has been saved yet.';
 state.cards[0].content={kind:'proposal',title:'Review your change',actionId:uuid(50)};
 state.actions=[{id:uuid(50),actionKind:'component_change',sections:['draft_quotes','components'],status:'proposed',title:'Ridge material rate',changes:[{label:'Material rate · per metre',before:'£25.00',after:'£30.00'}],note:'Ridge on Smith Roof · Draft quote',proofDigest:'a'.repeat(64),version:1,target:{kind:'draft_quote',id:uuid(40)},error:null,createdAt:time}];
 }
 if(name==='failed'){state.messages.pop();state.cards=[];state.runs[0].status='failed';}
 if(name==='stale'){state.task.status='closed';state.task.closure='abandoned';}
 if(name==='hidden'){state.access={...access,permissions:Object.fromEntries(Object.keys(access.permissions).map(k=>[k,'hidden']))};state.messages=[];state.cards=[];state.task=null;}
 return state;
}
fixture.reset=(name)=>{fixture.state=seed(name);};fixture.reset(query.get('scene')||'empty');
localStorage.setItem(`sa-input:${access.userId}:${access.companyId}`,query.get('mode')||'text');
localStorage.setItem(`sa-speech:${access.userId}:${access.companyId}`,'0');sessionStorage.removeItem(`sa-conversation:${access.userId}:${access.companyId}`);
const originalFetch=window.fetch.bind(window);
window.fetch=async(url,options={})=>{
 if(!String(url).startsWith('/api/'))return originalFetch(url,options);
 fixture.requests.push({url:String(url),method:options.method||'GET'});
 if(fixture.denied)return new Response(JSON.stringify({error:'Assistant access changed.'}),{status:403});
 if(String(url).includes('/v2/session'))return new Response(JSON.stringify(fixture.state));
 if(String(url).endsWith('/transcribe')){fixture.transcriptions++;await new Promise(r=>setTimeout(r,fixture.delay||250));return new Response(JSON.stringify({text:'Find the Smith quote and tell me how much Ridge costs.'}));}
 const data=JSON.parse(options.body||'{}');fixture.posts.push({url:String(url),body:data});
 if(String(url).endsWith('/turn')){
   await new Promise(r=>setTimeout(r,fixture.delay||100));
   const id=uuid(100+fixture.posts.length); fixture.state.runs.push({id,requestId:data.clientRequestId,status:fixture.fail?'failed':'completed'});
   fixture.state.messages.push({id:uuid(200+fixture.posts.length*2),runId:id,role:'user',content:data.message,createdAt:new Date().toISOString()});
   if(!fixture.fail)fixture.state.messages.push({id:uuid(201+fixture.posts.length*2),runId:id,role:'assistant',content:'On **Smith Roof**, Ridge is £30 per metre. Your saved quote is ready to open.',createdAt:new Date().toISOString()});
   return new Response(JSON.stringify({run_id:id,status:fixture.fail?'failed':'completed'}));
 }
 if(String(url).endsWith('/task')){fixture.state.task.status='closed';fixture.state.task.closure='solved';return new Response('{}');}
 if(String(url).endsWith('/actions')){fixture.state.actions[0].status=data.command==='confirm'?'committed':'cancelled';return new Response('{}');}
 if(String(url).endsWith('/navigation'))return new Response(JSON.stringify({destination:`/preview/quotes/${data.target.id}/summary`}));
 return new Response('{}');
};
const speechListeners=new Map();
const synthesis={getVoices:()=>[{voiceURI:'test-local',name:'Fixture voice',lang:'en-GB',localService:true}],addEventListener:(n,f)=>speechListeners.set(n,f),removeEventListener:(n)=>speechListeners.delete(n),cancel(){fixture.speechCancelled=(fixture.speechCancelled||0)+1;},speak(u){fixture.currentUtterance=u;fixture.audio.push(u.text);setTimeout(()=>u.onstart?.(),20);},pause(){fixture.speechPaused=true;},resume(){fixture.speechPaused=false;}};
Object.defineProperty(window,'speechSynthesis',{value:synthesis,configurable:true});
window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{
 if(fixture.permission==='denied')throw new DOMException('Permission denied','NotAllowedError');
 if(fixture.permission==='waiting')await new Promise(r=>fixture.resolveMic=r);
 const track={onended:null,stop(){fixture.stops++;}};return{getTracks:()=>[track],getAudioTracks:()=>[track]};
}}});
window.MediaRecorder=class{static isTypeSupported(){return true;}constructor(stream,options){this.state='inactive';this.mimeType=options?.mimeType||'audio/webm';fixture.recorders++;fixture.lastRecorder=this;}start(){this.state='recording';}stop(){if(this.state==='inactive')return;this.state='inactive';setTimeout(()=>{this.ondataavailable?.({data:new Blob(['fixture audio'],{type:this.mimeType})});this.onstop?.();},0);}};
window.AudioContext=class{constructor(){this.state='running';}createMediaStreamSource(){return{connect(){}};}createAnalyser(){return{fftSize:256,getByteTimeDomainData(bytes){for(let i=0;i<bytes.length;i++)bytes[i]=128+Math.round(Math.sin(i*.24)*fixture.signal*127);}};}resume(){return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}};

// A simulated secure context for fake media only. No actual device is requested.
if(location.protocol==='about:')Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});

if(typeof crypto.randomUUID!=="function"){let sequence=3000;Object.defineProperty(crypto,"randomUUID",{configurable:true,value:()=>uuid(sequence++)});}
