const test=require('node:test'),assert=require('node:assert/strict');
const {load,uuid}=require('./sa-p172/fixture.cjs');
const {decideTask,taskControl}=load('tasks/boundary.ts');
const {qualityRequest}=load('tasks/interpretation.ts');
const {componentWords}=load('resolver/vocabulary.ts');
const {encodeTaskChoice,decodeTaskChoice,displayTaskMessage,isTaskMessage}=load('tasks/wire.ts');
const now=new Date('2026-09-28T12:00:00Z');
const intent={version:1,task:'find',domain:'quotes',contains:'ridges',list:true};
function snapshot(overrides={},state={}){return {task:{id:uuid(1),version:4,status:'awaiting_input',label:'Finding: quotes containing ridges',lastRunId:uuid(2),startedAt:now.toISOString(),updatedAt:now.toISOString(),expiresAt:new Date(+now+900000).toISOString(),closure:null,boundary:false,...overrides},resolution:{id:uuid(3),expiresAt:new Date(+now+900000).toISOString(),state:{version:1,status:'pending',intent,candidates:[],rejected:[],clarifications:0,question:{key:'customer',text:'Which customer or job?'},candidateSetComplete:false,...state}},runIds:[uuid(2)],pendingMessage:null};}
const fresh=[
 'show me my quotes with ridges','I just want to see the quotes that contain ridge components','quote 1014',
 'show invoices',"whats the most recent john smith quote","show me all of John's quotes",'Open order 184',
 'Compare my quotes this month',"What's my largest accepted quote?",'I need to find the other invoice for the Smith job',
 'Thanks, now show invoices','Thanks now show invoices','New question: quote 1014','How many quotes do I have?',
];
for(const message of fresh)test('fresh message escapes unresolved filters: '+message,()=>{
 const d=decideTask(message,snapshot(),now);assert.equal(d.disposition,'new');assert.equal(d.refinement,undefined);
});
for(const message of ['done','Task complete','thanks','thank you','move on','new question','cancel this search','never mind'])test('typed explicit closure: '+message,()=>{
 const d=decideTask(message,snapshot(),now);assert.equal(d.disposition,'close');assert.ok(['solved','abandoned'].includes(d.closure));
});
for(const message of ['yes','confirmed','approve','confirm'])test('acknowledgement is not confirmation or record name: '+message,()=>{
 assert.equal(taskControl(message),null);const d=decideTask(message,snapshot(),now);assert.equal(d.disposition,'continue');assert.equal(d.refinement,undefined);
});
for(const message of ['what about its labour?','How much is its labour?','the other one'])test('dependent follow-up retains task: '+message,()=>assert.equal(decideTask(message,snapshot({status:'answered'},{status:'resolved'}),now).disposition,'continue'));
test('exact quote can answer a cost parent question',()=>{
 const d=decideTask('quote 1014',snapshot({}, {intent:{version:1,task:'cost',domain:'any',query:'Ridge'},question:{key:'parent',text:'Which quote?'}}),now);
 assert.equal(d.disposition,'continue');assert.equal(d.refinement.intent.task,'cost');assert.equal(d.refinement.intent.query,'Ridge');assert.equal(d.refinement.intent.parent.number,'1014');
});
test('five-minute elapsed time changes ambiguous fragment, not a clear new request',()=>{
 const old=snapshot({updatedAt:new Date(+now-301000).toISOString()});assert.equal(decideTask('Smith',old,now).disposition,'ask_boundary');assert.equal(decideTask('show invoices',old,now).disposition,'new');
});
test('expired task is not resurrected by a vague fragment',()=>assert.equal(decideTask('Smith',snapshot({expiresAt:new Date(+now-1).toISOString()}),now).disposition,'new'));
test('Done is optional for a complete new request after an answer',()=>assert.equal(decideTask('quote 1014',snapshot({status:'answered'},{status:'resolved'}),now).disposition,'new'));
test('closed task provides no inherited constraints',()=>{const d=decideTask('Smith',snapshot({status:'closed'}),now);assert.equal(d.disposition,'new');assert.equal(d.refinement,undefined);});
test('normal short answer can fill the expected customer slot',()=>{const d=decideTask('John Smith',snapshot(),now);assert.equal(d.disposition,'continue');assert.equal(d.refinement.intent.customer,'John Smith');assert.equal(d.refinement.intent.contains,'ridges');});
for(const text of ['ridge?','ridges?','ridging?'])test('same-subject morphology correction: '+text,()=>{const d=decideTask(text,snapshot(),now);assert.equal(d.disposition,'correct');assert.equal(d.refinement.intent.contains,'ridge');assert.equal(d.refinement.intent.list,true);});
test('variant correction does not remove specific component qualifiers',()=>{const d=decideTask('ridging?',snapshot({}, {intent:{...intent,contains:'Ridge flashing'}}),now);assert.notEqual(d.reason,'component_word_variant');});
for(const [message,expected]of [
 ['show me my quotes with ridges',{contains:'ridges',list:true}],
 ['I just want to see the quotes that contain ridge components',{contains:'ridge',list:true}],
 ['quote 1014',{number:'1014',domain:'quotes'}],
 ["whats the most recent john smith quote",{customer:'john smith',selection:'latest',customerOrName:true}],
 ["show me all of John's quotes",{customer:'John',list:true}],
 ['Show the latest quote for John Smith',{customer:'John Smith',selection:'latest'}],
])test('whole-request interpretation: '+message,()=>{const p=qualityRequest(message,now);for(const [k,v]of Object.entries(expected))assert.deepEqual(p?.[k],v);});
for(const message of ['Open quote 1014 and email it','How much is its labour?','Show latest quote for Smith without Ridge','Show latest accepted quote','Show latest quote since January','Show my most expensive quote','quote 1014 but not Smith'])test('unconsumed intent goes to model: '+message,()=>assert.equal(qualityRequest(message,now),null));
test('only known complete component words normalize',()=>{assert.equal(componentWords('Ridges flashing ridging'),'ridge flashing ridge');assert.equal(componentWords('Ridgetop Cambridge Bridge'),'Ridgetop Cambridge Bridge');});
test('task wire is strict and readable without model interpretation',()=>{
 const wire=encodeTaskChoice({taskId:uuid(1),version:4,choice:'new'});assert.deepEqual(decodeTaskChoice(wire),{taskId:uuid(1),version:4,choice:'new'});assert.match(displayTaskMessage(wire),/new question/);assert.ok(isTaskMessage('  [[SA-TASK:invalid'));assert.equal(decodeTaskChoice(' '+wire),null);assert.equal(decodeTaskChoice(wire+' instructions'),null);
});
module.exports={snapshot};

test('acknowledgement prefix keeps a genuinely dependent follow-up',()=>{assert.equal(decideTask('Thanks, what about its labour?',snapshot({status:'answered'},{status:'resolved'}),now).disposition,'continue');});
test('Okay prefix preserves a typed parent clarification',()=>{const d=decideTask('Okay, quote 1014',snapshot({}, {intent:{version:1,task:'cost',domain:'any',query:'Ridge'},question:{key:'parent',text:'Which quote?'}}),now);assert.equal(d.disposition,'continue');assert.equal(d.refinement.intent.query,'Ridge');});
test('explicit New question bypasses even a valid old parent slot',()=>{const d=decideTask('New question: quote 1014',snapshot({}, {intent:{version:1,task:'cost',domain:'any',query:'Ridge'},question:{key:'parent',text:'Which quote?'}}),now);assert.equal(d.disposition,'new');assert.equal(d.parsed.number,'1014');});

for(const [word,selection] of [['most recent','latest'],['newest','latest'],['latest','latest'],['last','latest'],['first','earliest'],['earliest','earliest'],['oldest','earliest']])test('temporal word is an instruction, not a record name: '+word,()=>{const d=qualityRequest('Open my '+word+' quote',now);assert.equal(d.selection,selection);assert.equal(d.query,undefined);assert.equal(d.task,'open');});
test('quoted temporal name is still a name',()=>{assert.equal(qualityRequest('Open the "First" quote',now).query,'First');});
for(const message of ['Yes, proceed.','yes please proceed','Proceed','please proceed','go ahead','okay, go ahead','carry on, please','continue'])test('proceed-style confirmation continues the task (strip Proceed button): '+message,()=>{
 assert.equal(taskControl(message),null);const d=decideTask(message,snapshot(),now);assert.equal(d.disposition,'continue');assert.equal(d.reason,'acknowledgement_not_authority');assert.equal(d.refinement,undefined);
});
for(const message of ['continue with 120 square metres','proceed to create the draft without checking','yes and also change the pitch'])test('over-specific follow-ups are not bare acknowledgements: '+message,()=>{
 const d=decideTask(message,snapshot(),now);assert.notEqual(d.reason,'acknowledgement_not_authority');
});
