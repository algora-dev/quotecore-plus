const h=React.createElement;
const params=new URLSearchParams(window.fixtureParams||location.search);
let root=ReactDOM.createRoot(document.getElementById('root'));
window.fx={config:{marginFail:params.get('marginFail')==='true',confirmFail:params.get('confirmFail')==='true',navFail:false,delay:40},calls:[],navigations:[],gates:{},wait:async function(type){if(this.config.hold===type)await new Promise(r=>this.gates[type]=r);else await new Promise(r=>setTimeout(r,this.config.delay));},router:{push(path){window.fx.calls.push({type:'navigate',path});if(window.fx.config.navFail)throw Error('fixture navigation rejected');window.fx.navigations.push(path);}},retry(){window.fx.calls.push({type:'retry'});}};
const quote={id:'quote-fixture',company_id:'company-fixture',customer_name:'Example customer',job_name:'Roof replacement',entry_mode:params.get('mode')||'manual',status:params.get('status')||'draft',currency:'GBP',trade:params.get('trade')||'roofing',measurement_system:'metric',tax_rate:20,material_margin_enabled:true,labor_margin_enabled:true,material_margin_percent:20,labor_margin_percent:15};
const areas=params.get('empty')==='true'?[]:[{id:'area1',label:'Main roof',is_locked:true,computed_sqm:120,final_value_sqm:120,input_mode:'final',calc_pitch_degrees:25}];
const comps=params.get('empty')==='true'?[]:[{id:'c1',name:'Roof covering',quote_roof_area_id:'area1',component_type:'main',measurement_type:'area',final_quantity:132,material_cost:3600,labour_cost:1560,is_customer_visible:true},{id:'c2',name:'Roof membrane',quote_roof_area_id:'area1',component_type:'main',measurement_type:'area',final_quantity:132,priced_quantity:3,pack_size_snapshot:50,material_cost:600,labour_cost:396,is_customer_visible:true}];
const Builder=sourceRequire('app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder.tsx').QuoteBuilder;
const RouteState=sourceRequire('app/components/quote-entry/CustomerQuoteRouteState.tsx').CustomerQuoteRouteState;
const Boundary=sourceRequire('app/(auth)/[workspaceSlug]/quotes/[id]/customer-edit/error.tsx').default;
const Confirm=sourceRequire('app/(auth)/[workspaceSlug]/quotes/[id]/ConfirmQuoteButton.tsx').ConfirmQuoteButton;
function App(){const [phase,setPhase]=React.useState('review');window.fx.phase=phase;
return h('main',null,h(Builder,{quote,workspaceSlug:'demo',initialRoofAreas:areas,initialRoofAreaEntries:{area1:[]},initialComponents:comps,initialEntries:{c1:[{}],c2:[{}]},libraryComponents:[],companyDefaultCurrency:'GBP',companyMeasurementSystem:'metric',companyDefaultTrade:quote.trade,collections:[],planUrl:null,planName:null,supportingFiles:[],externalPhase:phase,onPhaseChange:setPhase}));}
window.fx.unmount=()=>root.unmount();
window.fx.mount=()=>{root=ReactDOM.createRoot(document.getElementById('root'));root.render(h(App));};
window.fx.recovery=mode=>root.render(h('main',null,mode==='error'?h(Boundary,{error:Error('fixture provider failure'),unstable_retry:()=>fx.retry()}):mode==='error-fallback'?h(Boundary,{error:Error('fixture provider failure'),reset:()=>fx.calls.push({type:'must-not-reset'})}):h(RouteState)));
if(['error','error-fallback','loading'].includes(params.get('view')))fx.recovery(params.get('view'));
else root.render(h(App));
