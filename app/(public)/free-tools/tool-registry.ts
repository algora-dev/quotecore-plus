/**
 * Tool Registry - single source of truth for the free-tools hub.
 *
 * Used by: Smart Tool Finder (deterministic matching), Browse All Tools
 * (search + filters), and the task accordions' link data.
 *
 * Base list derives from tools-data.ts; additions are audited against the supplied marketing snapshot and Digital Takeoffs V1.
 * Rich intent/alias data lives here for the finder.
 */

import { TOOLS, type ToolEntry } from './tools-data';

export interface FreeTool {
  id: string;
  name: string;
  url: string;
  shortDescription: string;
  categories: string[];
  intents: string[];
  keywords: string[];
  aliases?: string[];
  priority?: number;
  /** Visibility flags - registry is the single source of truth (default: true) */
  showInFinder?: boolean;
  showInDirectory?: boolean;
  showInSchema?: boolean;
}

/** Extra tools that exist as routes but aren't in tools-data TOOLS yet. */
const EXTRA_TOOLS: FreeTool[] = [
  {
    id: 'free-digital-takeoff', name: 'Digital Takeoff', url: '/free-digital-takeoff',
    shortDescription: 'Measure a roof, wall or floor from a PDF or image plan. Calibrate the scale, trace areas and lengths, then review quantities and pricing.',
    categories: ['takeoff', 'measurement'], intents: ['digital takeoff', 'measure a plan', 'measure a pdf'],
    keywords: ['plan', 'pdf', 'drawing', 'measure', 'takeoff', 'upload'], priority: 96,
  },
  {
    id: 'free-roof-pricing-calculator', name: 'Roof Pricing Calculator', url: '/free-roof-pricing-calculator',
    shortDescription: 'Estimate roofing costs from your quantities, material rates and labour.',
    categories: ['roofing', 'calculators', 'pricing'], intents: ['roof pricing'],
    keywords: ['roof', 'pricing', 'cost', 'labour', 'material'], priority: 55,
  },
  {
    id: 'free-roofing-material-calculator', name: 'Roofing Material Calculator', url: '/free-roofing-material-calculator',
    shortDescription: 'Calculate roofing material quantities from your measurements and allowances.',
    categories: ['roofing', 'calculators'], intents: ['roofing material quantities'],
    keywords: ['roofing', 'material', 'quantity', 'allowance'], priority: 55,
  },
  {
    id: 'free-roof-takeoff',
    name: 'Free Roof Takeoff',
    url: '/free-roof-takeoff',
    shortDescription: 'Upload your own roof plan (PDF/image), calibrate the scale and measure roof areas and linear components directly on screen.',
    categories: ['roofing', 'takeoff', 'measurement'],
    intents: ['measure roof from plan', 'measure pdf', 'digital roof takeoff', 'measure a plan', 'measure from drawing'],
    keywords: ['roof', 'measure', 'plan', 'pdf', 'drawing', 'takeoff', 'area', 'ridge', 'valley', 'calibrate', 'upload', 'image'],
    aliases: ['roof measurement tool', 'plan measure', 'digital takeoff', 'measure my plan'],
    priority: 100,
  },
  {
    id: 'free-cladding-takeoff',
    name: 'Free Wall & Cladding Takeoff',
    url: '/free-cladding-takeoff',
    shortDescription: 'Upload a wall or elevation plan, calibrate the scale and measure wall areas, cladding, trims, battens and openings directly on screen.',
    categories: ['walls', 'cladding', 'takeoff', 'measurement'],
    intents: ['measure walls from plan', 'measure cladding from elevation', 'wall takeoff', 'cladding takeoff', 'measure elevation', 'siding takeoff', 'measure facade'],
    keywords: ['wall', 'cladding', 'siding', 'facade', 'elevation', 'measure', 'plan', 'drawing', 'takeoff', 'area', 'trim', 'batten', 'opening', 'calibrate'],
    aliases: ['cladding takeoff tool', 'wall measurement tool', 'elevation measurer', 'siding takeoff'],
    priority: 100,
  },
  {
    id: 'free-flooring-takeoff',
    name: 'Free Flooring Takeoff',
    url: '/free-flooring-takeoff',
    shortDescription: 'Upload a floor plan, calibrate the scale and measure floor areas, plank, carpet, tile, underlay, skirting and scotia directly on screen.',
    categories: ['flooring', 'takeoff', 'measurement'],
    intents: ['measure floors from plan', 'flooring takeoff', 'measure rooms from plan', 'measure floor area', 'carpet takeoff', 'tile takeoff'],
    keywords: ['floor', 'flooring', 'carpet', 'tile', 'plank', 'skirting', 'scotia', 'underlay', 'measure', 'plan', 'drawing', 'takeoff', 'area', 'room', 'calibrate', 'upload'],
    aliases: ['flooring takeoff tool', 'floor measurement tool', 'carpet measurer', 'floor plan measurer'],
    priority: 100,
  },
];

/** Finder/search enrichment for key tools (matched by slug). */
const RICH: Record<string, Partial<FreeTool>> = {
  'free-roofing-takeoff-builder': {
    intents: ['already have measurements', 'have measurements', 'enter measurements manually', 'manual takeoff', 'build takeoff from measurements'],
    aliases: ['takeoff builder', 'manual takeoff'],
    priority: 95,
    categories: ['roofing', 'takeoff', 'measurement'],
    // Legacy route stays live but is not presented in the new hub or hub schema
    showInFinder: false,
    showInDirectory: false,
    showInSchema: false,
  },
  'measurement-to-quote-tool': {
    name: 'Measurements to Pricing',
    shortDescription: 'Already have measurements? Enter areas, lengths or room dimensions, apply your component rates, and turn the results into a quote.',
    intents: ['already have measurements', 'know the sizes', 'price a job', 'price my measurements', 'turn measurements into a price', 'measurement to quote'],
    aliases: ['measure to quote'],
    priority: 90,
    categories: ['takeoff', 'pricing', 'documents'],
  },
  'free-quote-generator': {
    shortDescription: 'Create a customer quote with your items, prices, business details and tax. Use Quote Assist or enter it yourself, then print or save a PDF.',
    intents: ['create a quote', 'make a quote', 'send a quote', 'price a job', 'quote for customer'],
    aliases: ['quote maker', 'quotation generator', 'estimate generator'],
    priority: 100,
    categories: ['documents', 'pricing'],
  },
  'free-invoice-generator': {
    shortDescription: 'Create an invoice with itemised charges, tax, a due date and payment details. Print or save your customer document as a PDF.',
    intents: ['create an invoice', 'make an invoice', 'send an invoice', 'bill a customer'],
    aliases: ['invoice maker', 'billing tool'],
    priority: 100,
    categories: ['documents'],
  },
  'free-purchase-order-generator': {
    shortDescription: 'Create a purchase order with supplier details, quantities, prices and delivery instructions. Print or save a PDF for your supplier.',
    intents: ['create a purchase order', 'make a po', 'order materials', 'send a po to supplier'],
    aliases: ['po generator', 'purchase order maker'],
    priority: 100,
    categories: ['documents'],
  },
  'free-roof-pitch-calculator': {
    intents: ['work out roof pitch', 'calculate roof pitch', 'roof angle', 'pitch from rise and run'],
    priority: 90,
  },
  'free-roof-pricing-calculator': {
    intents: ['price a roof', 'roof cost', 'how much for a roof'],
    priority: 90,
    categories: ['pricing', 'roofing'],
  },
  'free-concrete-calculator': {
    intents: ['calculate concrete', 'how much concrete'],
    priority: 90,
  },
  'free-margin-calculator': {
    intents: ['calculate margin', 'margin vs markup', 'work out profit'],
    priority: 85,
    categories: ['pricing'],
  },
  'free-birds-mouth-calculator': {
    name: 'Birdsmouth & Roof Angle Calculator',
    keywords: ['birdsmouth', 'seat cut', 'plumb cut', 'notch', 'rafter', 'heel', 'roof angle', 'junction'],
    shortDescription: 'Work out birdsmouth cut geometry, rafter lengths and roof-junction angles. Check dimensions and the applicable building requirements before cutting.',
    intents: ['birdsmouth cut', 'birds mouth', 'birds beak', 'seat cut', 'plumb cut', 'notch depth'],
    aliases: ["bird's mouth", 'birdsmouth', 'bird mouth', 'birds beak'], priority: 95,
  },
  'free-construction-calculator': {
    shortDescription: 'Calculate wall and floor areas, deduct openings, work out timber and batten quantities, and price materials.', priority: 90,
  },
  'free-roofing-calculator': {
    shortDescription: 'Calculate roof surface areas, rafters and hips, batten quantities, material prices and flashing angles.',
    intents: ['calculate roofing materials', 'roof material quantities'],
    priority: 85,
  },
  'free-smart-component-creator': {
    intents: ['build a priced component', 'create smart component', 'component with materials and waste'],
    priority: 70,
  },
};

function toFreeTool(t: ToolEntry): FreeTool {
  const base: FreeTool = {
    id: t.slug,
    name: t.name,
    url: `/${t.slug}`,
    shortDescription: t.description,
    categories: [t.industry.toLowerCase(), t.category === 'calculator' ? 'calculators' : t.category],
    intents: [],
    keywords: t.keywords,
    priority: t.isCore ? 50 : 10,
  };
  return { ...base, ...RICH[t.slug] };
}

export const TOOL_REGISTRY: FreeTool[] = [
  ...EXTRA_TOOLS,
  ...TOOLS.map(toFreeTool),
];

export const TOOL_COUNT = TOOL_REGISTRY.length;

export function getTool(id: string): FreeTool | undefined {
  return TOOL_REGISTRY.find((t) => t.id === id);
}


/** Finder scoring is shared by the browser and existing recommendation API.
 * Exact phrase/token matching avoids substring errors such as "po" in "support".
 * A specialist intent outranks generic high-priority tools. No base score can
 * create a match without a relevant term. User text never becomes a URL.
 */
export interface MatchResult { tool: FreeTool; score: number; reason?: string }
export function normaliseQuery(q: string): string {
  return q.normalize('NFKD').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
const STOP = new Set('i a an the to for from with my me we our your can could would should please need want have how what which is are do does it this that use using help tool tools free online calculate calculator create make get work out as and or of on in some something find job'.split(' '));
function phrase(q: string, s: string): boolean { return (' '+q+' ').includes(' '+normaliseQuery(s)+' '); }
function preferred(q: string): string | null {
  const has = (s: string) => new RegExp('(?:^| )('+s+')(?: |$)').test(q);
  if (has('invoice|invoices|invoicing|bill|billing')) return 'free-invoice-generator';
  if (has('purchase order|purchase orders|po|supplier order') || (has('supplier') && has('order|ordering'))) return 'free-purchase-order-generator';
  if (has('birdsmouth|birds mouth|bird mouth|birds beak|seat cut|plumb cut|notch depth|heel height')) return 'free-birds-mouth-calculator';
  if (has('margin|markup|profit|mark up')) return 'free-margin-calculator';
  if (has('roof pitch|pitch|rise and run|rise over run') && !has('rafter|rafters|birdsmouth|roof area')) return has('convert|converter|conversion') ? 'free-roof-pitch-converter' : 'free-roof-pitch-calculator';
  if (has('concrete|slab|footing|footings|rebar|trench|premix')) {
    if (has('bags|bag|premix')) return 'free-concrete-bag-calculator';
    if (has('rebar')) return 'free-rebar-calculator';
    if (has('trench')) return 'free-trench-calculator';
    if (has('footing|footings')) return 'free-footing-calculator';
    return 'free-concrete-calculator';
  }
  const plan = has('plan|plans|pdf|drawing|drawings|image|photo|satellite|elevation') && !has('no plan|without a plan|dont have a plan');
  const manual = has('already measured|already have measurements|have measurements|know the sizes|know the measurements|measured rooms|site measurements|manual measurements|enter measurements|type measurements|no plan|without a plan|price my measurements');
  const price = has('price|pricing|cost|costs|labour|labor|rates|rate|estimate');
  const floor = has('floor|floors|flooring|room|rooms|carpet|underlay|laminate|vinyl');
  const wall = has('wall|walls|cladding|siding|facade|elevation|elevations|weatherboard');
  const roof = has('roof|roofs|roofing');
  const measure = has('measure|measurement|measurements|takeoff|take off|trace|measuring');
  if (manual || (price && (floor || wall || roof) && !plan && !has('replacement'))) return 'measurement-to-quote-tool';
  if (plan && (measure || floor || wall || roof)) return floor ? 'free-flooring-takeoff' : wall ? 'free-cladding-takeoff' : roof ? 'free-roof-takeoff' : 'free-digital-takeoff';
  if (has('quote|quotes|quotation|customer estimate')) return 'free-quote-generator';
  if (has('rafter|rafters|hip length|valley length')) return 'free-rafter-length-calculator';
  if (has('roof angle|roof junction|flashing angle')) return 'free-birds-mouth-calculator';
  if (has('paint|painting|coats')) return 'free-paint-calculator';
  if (has('gutter|guttering|downpipe')) return 'free-guttering-calculator';
  if (has('shingle|shingles')) return 'free-shingle-calculator';
  if (has('roof tile|roof tiles') || (roof && has('tile|tiles'))) return 'free-roof-tile-calculator';
  if (has('metal roofing|corrugated|roof sheet|roof sheets')) return 'free-metal-roofing-calculator';
  if (has('tile|tiles')) return 'free-tile-calculator';
  if (has('turf|topsoil|mulch|garden|landscaping')) return 'free-landscaping-calculator';
  if (has('pipe slope|drainage fall') || (has('pipe|drainage') && has('slope|fall'))) return 'free-pipe-slope-calculator';
  if (has('slope|gradient|fall')) return 'free-slope-calculator';
  if (has('roof area|roof surface|roofing materials|battens') && roof) return 'free-roofing-calculator';
  if (floor && has('how much|how many') && !price) return 'free-flooring-calculator';
  if ((floor || wall) && has('area|size|length|width|square|metres|meters|feet|quantity|materials|dimensions')) return 'free-construction-calculator';
  if (has('price a job|job pricing|price my job|cost a job')) return 'measurement-to-quote-tool';
  if (has('takeoff|take off|measure a plan')) return 'free-digital-takeoff';
  return null;
}
export function findTools(rawQuery: string, limit = 3): MatchResult[] {
  const q=normaliseQuery(rawQuery.trim().slice(0,300));
  if (!q) return [];
  const words=[...new Set(q.split(' ').filter(w => w.length>2 && !STOP.has(w)))];
  const preferredId=preferred(q);
  return TOOL_REGISTRY.filter(t=>t.showInFinder!==false).map(tool=>{
    let score=0;
    const names=normaliseQuery(tool.name).split(' ');
    for (const w of words) {
      if (names.includes(w)) score+=3;
      if (tool.keywords.some(k=>normaliseQuery(k)===w)) score+=2;
    }
    for (const s of [...tool.intents,...(tool.aliases??[])]) if (phrase(q,s)) score+=8;
    for (const k of tool.keywords) if(k.includes(' ') && phrase(q,k)) score+=4;
    if(tool.id===preferredId) score+=40;
    if(score>0) score+=Math.min((tool.priority??0)/500,0.2);
    return {tool,score,reason: tool.shortDescription};
  }).filter(m=>m.score>=4).sort((a,b)=>b.score-a.score||a.tool.id.localeCompare(b.tool.id)).slice(0,Math.max(0,Math.min(10,limit)));
}
