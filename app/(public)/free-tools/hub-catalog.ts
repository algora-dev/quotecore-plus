import { TOOL_REGISTRY, type FreeTool } from './tool-registry';

/** Route names stay stable while marketing labels can evolve. Never infer URLs
 * from display labels. Shared by the UI, finder and structured data. */
export type HubCategory = 'measure' | 'calculate' | 'documents';
export const SITE_ORIGIN = 'https://quote-core.com';
export const HUB_URL = `${SITE_ORIGIN}/free-tools`;
export const DEMO_HREF = '/takeoff-demo';
export const CATEGORIES: {id:HubCategory; title:string; description:string; detail:string; featured:string[]}[] = [
  {id:'measure',title:'Measure & price',description:'From a plan or measurements you already have.',detail:'Roofing · Cladding · Flooring',featured:['free-digital-takeoff','measurement-to-quote-tool']},
  {id:'calculate',title:'Calculate',description:'Areas, materials, roof pitch, angles and cuts.',detail:'Quantities · Dimensions · Costs',featured:['free-roofing-calculator','free-construction-calculator','free-birds-mouth-calculator']},
  {id:'documents',title:'Create documents',description:'Quotes for customers. Orders for suppliers. Invoices for payment.',detail:'Quote · Purchase order · Invoice',featured:['free-quote-generator','free-purchase-order-generator','free-invoice-generator']},
];
export const EXAMPLE_QUESTIONS = [
  {id:'roof-plan',label:'How do I measure a roof from a PDF?',query:'I have a roof plan as a PDF. How do I measure it?'},
  {id:'floor-price',label:'I have room sizes. Can I price the flooring?',query:'I have measured three rooms. How do I price the flooring and labour?'},
  {id:'roof-pitch',label:'How do I work out roof pitch?',query:'How do I work out roof pitch from rise and run?'},
  {id:'customer-quote',label:'Can I make a quote for my customer?',query:'I need to create a quote for my customer.'},
] as const;
export const DIRECTORY_TOOLS = TOOL_REGISTRY.filter(t=>t.showInDirectory!==false);
export const FAQS = [
  {question:'Can I use these tools without an account?',answer:'Yes. Start measuring, calculating or creating a document without signing up. Document generation and AI assistance have daily limits. The generators show the current limits and the extra allowance available with a free, confirmed account.'},
  {question:'Which tool should I use if I already have measurements?',answer:'Use Measurements to Pricing. Enter areas, lengths, counts or room dimensions, apply your material and labour rates, then turn the results into a free quote. You do not need to upload a plan.',href:'/measurement-to-quote-tool',link:'Open Measurements to Pricing'},
  {question:'Can I measure a roofing, cladding or flooring plan?',answer:'Yes. Digital Takeoff lets you upload a PDF or image, calibrate it against a known dimension, and trace areas and lengths. Choose roofing, cladding or flooring at the start. Check the scale and all measurements before relying on the result.',href:'/free-digital-takeoff',link:'Open Digital Takeoff'},
  {question:'Are the example component prices real market rates?',answer:'No. The example libraries use fictitious prices so you can see how components work. Replace material, labour and waste allowances with your own rates before quoting a customer.'},
  {question:'Can I make a quote, purchase order or invoice as a PDF?',answer:'Yes. Each generator lets you review your document, then print or save it as a PDF. A free, confirmed account removes QuoteCore+ document branding and provides a higher shared daily allowance.',href:'/free-quote-generator',link:'Create a free quote'},
  {question:'What is different about the paid QuoteCore+ app?',answer:'The free tools solve individual tasks. The paid app gives you saved pricing and component libraries, job records and a connected workflow for takeoffs, quotes, orders and invoices. Explore the demo for free before deciding whether the full app fits your business.',href:DEMO_HREF,link:'Try the QuoteCore+ demo'},
];
export function categoryOf(tool: FreeTool): HubCategory {
  if(['free-quote-generator','free-invoice-generator','free-purchase-order-generator'].includes(tool.id)) return 'documents';
  if(tool.id==='measurement-to-quote-tool'||tool.id==='free-digital-takeoff'||['free-roof-takeoff','free-cladding-takeoff','free-flooring-takeoff'].includes(tool.id)) return 'measure';
  return 'calculate';
}
export function toolById(id:string): FreeTool {
  const tool=TOOL_REGISTRY.find(t=>t.id===id);
  if(!tool) throw new Error(`Unknown free tool: ${id}`);
  return tool;
}
export function categoryFromHash(hash:string): HubCategory | null {
  const h=hash.replace(/^#/,'');
  if(['measure','calculate','documents'].includes(h)) return h as HubCategory;
  if(['measure-from-plan','measure-walls-from-plan','measure-floors-from-plan','have-measurements'].includes(h)) return 'measure';
  if(['create-quote','order-materials','create-invoice'].includes(h)) return 'documents';
  return null;
}
export function createHubSchema() {
  const tools = DIRECTORY_TOOLS.filter(t=>t.showInSchema!==false);
  return {'@context':'https://schema.org','@graph':[
    {'@type':'CollectionPage','@id':HUB_URL+'#page',url:HUB_URL,name:'Free Roofing & Construction Tools | QuoteCore+',description:'Free digital takeoffs, measurements to pricing, construction calculators, and quote, invoice and purchase order generators.',inLanguage:'en',mainEntity:{'@id':HUB_URL+'#tools'},breadcrumb:{'@id':HUB_URL+'#breadcrumb'}},
    {'@type':'ItemList','@id':HUB_URL+'#tools',name:'QuoteCore+ free tool library',numberOfItems:tools.length,itemListElement:tools.map((t,i)=>({'@type':'ListItem',position:i+1,name:t.name,description:t.shortDescription,url:SITE_ORIGIN+t.url}))},
    {'@type':'BreadcrumbList','@id':HUB_URL+'#breadcrumb',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:SITE_ORIGIN},{'@type':'ListItem',position:2,name:'Free tools',item:HUB_URL}]}
  ]};
}
export function serialiseSchema(data:unknown):string {return JSON.stringify(data).replace(/</g,'\\u003c');}
