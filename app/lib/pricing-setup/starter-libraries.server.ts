import 'server-only';
import { z } from 'zod';
import { scopedContext, insertPricingSession } from './storage.server';
import { draftFromExtraction } from './roofing-rules';
import { pricingDraftSchema, type PricingDraft } from './domain';

const slugSchema = z.string().regex(/^[a-z0-9-]{3,64}$/);
const measurementSchema = z.enum(['area', 'lineal', 'quantity', 'fixed', 'quantity_by_spacing']);
const pitchSchema = z.enum(['none', 'rafter', 'valley_hip']);
const publishedLibrarySchema = z.object({
  slug: slugSchema,
  name: z.string().min(3).max(120),
  description: z.string(),
  version: z.number().int().positive(),
  sort_order: z.number().int(),
});
const starterItemSchema = z.object({
  library_slug: slugSchema,
  code: z.string().regex(/^[A-Z0-9_]{4,96}$/),
  name: z.string().min(2).max(180),
  notes: z.string().max(3000),
  measurement_type: measurementSchema,
  pitch_type: pitchSchema,
  takeoff_slot: z.string().max(48),
  source_unit: z.string().max(60),
  sort_order: z.number().int(),
});

export type StarterLibrarySummary = z.infer<typeof publishedLibrarySchema> & {
 count: number; items: { code:string; name:string; measurementType:string; pitchType:string; sourceUnit:string; notes:string; materialRate:number|null; labourRate:number|null; wasteKind:string; wasteValue:number|null }[]
};

/** Returns only published templates. The admin/editor can manage them in Supabase Table Editor. */
const practicePriceSchema = z.object({
 price_set_id:z.string().uuid(), library_slug:slugSchema, item_code:z.string(),
 material_cost:z.coerce.number().nonnegative(), labour_cost:z.coerce.number().nonnegative(),
 waste_kind:z.enum(['percent','fixed','none']), waste_value:z.coerce.number().nonnegative().nullable(),
 reference_unit:z.string().max(60),provenance:z.string().default(''),
});
async function publishedUsdPriceSet(admin: Awaited<ReturnType<typeof scopedContext>>['admin']) {
 const {data,error}=await admin.from('pricing_starter_price_sets')
  .select('id,currency_code,benchmark_market,template_version')
  .eq('published',true).eq('illustrative_only',true).eq('demo_only',true).eq('currency_code','USD')
  .order('template_version',{ascending:false}).limit(1).maybeSingle();
 if(error||!data)throw new Error('The USD example price set has not been published. Apply the v3 migration.');
 return z.object({id:z.string().uuid(),currency_code:z.literal('USD'),benchmark_market:z.string(),template_version:z.number().int().positive()}).parse(data);
}
async function publishedPrices(admin: Awaited<ReturnType<typeof scopedContext>>['admin'], setId:string, slugs:string[]) {
 const {data,error}=await admin.from('pricing_starter_price_values')
  .select('price_set_id,library_slug,item_code,material_cost,labour_cost,waste_kind,waste_value,reference_unit,provenance')
  .eq('price_set_id',setId).in('library_slug',slugs);
 if(error)throw new Error('Example prices could not be loaded. Apply the v3 migration.');
 return new Map(z.array(practicePriceSchema).parse(data??[]).map(x=>[`${x.library_slug}:${x.item_code}`,x]));
}
/** Read-only public preview of the reference-USD practice examples. */
export async function listStarterLibrarySummaries(): Promise<StarterLibrarySummary[]> {
  const { admin } = await scopedContext();
  const { data: rawLibraries, error } = await admin.from('pricing_starter_libraries')
    .select('slug,name,description,version,sort_order').eq('published', true).order('sort_order', { ascending: true });
  if (error) throw new Error('Test libraries are not configured. Apply the starter-library migration.');
  const libs = z.array(publishedLibrarySchema).parse(rawLibraries ?? []);
  if (!libs.length) return [];
  const { data: rawItems, error: itemError } = await admin.from('pricing_starter_items')
    .select('library_slug,code,name,measurement_type,pitch_type,source_unit,notes').in('library_slug', libs.map(lib => lib.slug))
    .eq('included_by_default', true).order('sort_order', { ascending: true });
  if (itemError) throw new Error('Test library items are not available.');
  const set = await publishedUsdPriceSet(admin);
  const costs = await publishedPrices(admin,set.id,libs.map(x=>x.slug));
  const groups = new Map<string, StarterLibrarySummary['items']>();
  for (const item of rawItems ?? []) {
   const cost=costs.get(`${item.library_slug}:${item.code}`);
   const entry={ code:String(item.code), name:String(item.name), measurementType:String(item.measurement_type),
    pitchType:String(item.pitch_type), sourceUnit:String(item.source_unit), notes:String(item.notes),
    materialRate:cost?.material_cost??null,labourRate:cost?.labour_cost??null,
    wasteKind:cost?.waste_kind??'unknown',wasteValue:cost?.waste_value??null };
   groups.set(item.library_slug, [...(groups.get(item.library_slug)??[]), entry]);
  }
  return libs.map(lib => ({ ...lib, items:groups.get(lib.slug)??[], count:groups.get(lib.slug)?.length??0 }));
}

/** Starter generation is deterministic and costs no model tokens. Nothing is written to component_library. */
export async function createStarterLibraryDraftSession(slugs: string[], allowForeignCurrencyExamples = false) {
  if (!Array.isArray(slugs) || !slugs.length || slugs.length > 5 || new Set(slugs).size !== slugs.length || slugs.some(slug => !slugSchema.safeParse(slug).success)) {
    throw new Error('Choose between one and five different test libraries.');
  }
  const { admin, profile } = await scopedContext();
  const {data:company,error:companyError}=await admin.from('companies').select('default_currency').eq('id',profile.company_id).maybeSingle();
  if(companyError||!company)throw new Error('Unable to check your workspace currency.');
  const currency=String(company.default_currency??'NZD').toUpperCase();
  if(currency!=='USD'&&!allowForeignCurrencyExamples){
   throw new Error(`The example prices were authored in USD, but your workspace uses ${currency}. Explicitly accept that practice numbers are displayed in ${currency} without currency conversion before importing.`);
  }
  const priceSet=await publishedUsdPriceSet(admin);
  // Limit draft-session spam independently of the AI usage limits.
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count, error: usageError } = await admin.from('pricing_setup_sessions')
    .select('id', { count: 'exact', head: true }).eq('user_id', profile.id)
    .eq('company_id', profile.company_id).like('source_name', 'Ready-made:%')
    .gte('created_at', since.toISOString());
  if (usageError) throw new Error('Unable to verify starter-library usage.');
  if ((count ?? 0) >= 10) throw new Error('You have reached today\'s test library setup limit. Resume an existing draft instead.');

  const { data: rawLibraries, error } = await admin.from('pricing_starter_libraries')
    .select('slug,name,description,version,sort_order').eq('published', true).in('slug', slugs);
  if (error) throw new Error('Test libraries are not configured. Apply the starter-library migration.');
  const libs = z.array(publishedLibrarySchema).parse(rawLibraries ?? []);
  if (libs.length !== slugs.length) throw new Error('One of the selected roofing libraries is no longer available.');
  const { data: rawItems, error: itemsError } = await admin.from('pricing_starter_items')
    .select('library_slug,code,name,notes,measurement_type,pitch_type,takeoff_slot,source_unit,sort_order')
    .in('library_slug', slugs).eq('included_by_default', true)
    .order('sort_order', { ascending: true });
  if (itemsError) throw new Error('Test library items are unavailable.');
  const items = z.array(starterItemSchema).parse(rawItems ?? []);
  const bySlug = new Map(libs.map(lib => [lib.slug, lib]));
  const priceMap=await publishedPrices(admin,priceSet.id,slugs);
  if (items.length > 100 || items.length === 0 || libs.some(lib => !items.some(it => it.library_slug === lib.slug))) {
    throw new Error('The selected library templates have no usable items or exceed the 100-item limit.');
  }
  const orderedItems = items.sort((a, b) => slugs.indexOf(a.library_slug) - slugs.indexOf(b.library_slug) || a.sort_order - b.sort_order);
  const drafts = orderedItems.map((item, i) => {
    const lib = bySlug.get(item.library_slug)!;
    const example=priceMap.get(`${item.library_slug}:${item.code}`);
    if(!example)throw new Error(`Example pricing is missing for ${item.name}. Correct the master price set before importing.`);
    if(example.reference_unit!==item.source_unit)throw new Error(`Unit mismatch in example pricing for ${item.name}.`);
    const currencyMessage=currency==='USD'?'':` Practice amounts will display as ${currency} with no FX conversion and are NOT ${currency} market estimates.`;
    const draft: PricingDraft = pricingDraftSchema.parse({
      ...draftFromExtraction({
        sku: item.code, name: item.name, notes: item.notes, sourceUnit: item.source_unit,
        sourceIndex: i + 1, excerpt: `Test library: ${lib.name}. ${item.name}.`,
      }, 'unknown'),
      // Master template fields, not probabilistic name matching, are authoritative.
      measurementType: item.measurement_type,
      pitchType: item.pitch_type,
      takeoffSlot: item.takeoff_slot,
      starterLibrarySlug: lib.slug,
      starterLibraryName: lib.name,
      starterTemplateVersion:lib.version,
      practicePricing:true,
      practiceReferenceCurrency:'USD',
      practiceReferenceMarket:priceSet.benchmark_market,
      practicePriceSetId:priceSet.id,
      materialRate:example.material_cost,labourRate:example.labour_cost,
      wasteKind:example.waste_kind,wasteValue:example.waste_value,
      notes:`${item.notes} | PRACTICE ONLY – Illustrative USD 2026 direct-cost allocation, not a supplier quote. No tax, margin, overhead or logistics included.${currencyMessage}`.slice(0,3000),
      priceBasis:'unknown',
      origins: {
        sku: 'rule', name: 'rule', notes: 'rule', measurementType: 'rule', pitchType: 'rule',
        materialRate: 'rule', labourRate: 'rule', wasteKind: 'rule', wasteValue: 'rule',
      },
      warnings: [
        'PRACTICE PRICES ONLY: these numeric rates are research-informed example allocations, not supplier quotes.',
        'Practice-priced components may be used to learn quoting but cannot be sent to customers.',
        'Before customer quoting, verify material, labour, pitch, allowances, tax and margin against your business costs.',
        'Important: the existing calculation engine applies example waste to labour quantities as well as material quantities.',
        currencyMessage.trim() || 'USD-only practice reference amounts.',
      ],
      confidence: 'high',
    });
    return {
      draft,
      excerpt: `Test library ${lib.name} (template v${lib.version}) · ${item.code}: ${item.notes}. Example cost basis: USD, US benchmark 2026.`,
    };
  });
  return insertPricingSession({
    name: `Ready-made: ${slugs.map(slug => bySlug.get(slug)!.name).join(' + ')}`.slice(0, 180),
    kind: 'text', basis: 'unknown', draftItems: drafts,
  });
}

/** Capacity is informational; createComponent remains the server-side quota enforcement. */
export async function getPricingComponentCapacity() {
  const { admin, profile } = await scopedContext();
  const [billing, existing] = await Promise.all([
    admin.from('company_custom_billing').select('purchased_entitlements').eq('company_id', profile.company_id).maybeSingle(),
    admin.from('component_library').select('id', { count: 'exact', head: true }).eq('company_id', profile.company_id),
  ]);
  if (billing.error || existing.error) return { limit: null, used: null, available: null, reliable: false }; 
  const entitlements = billing.data?.purchased_entitlements as Record<string, unknown> | null | undefined;
  const rawLimit = entitlements?.componentLimit;
  const limit = typeof rawLimit === 'number' && Number.isInteger(rawLimit) && rawLimit > 0 ? rawLimit : null;
  const used = existing.count ?? 0;
  return { limit, used, available: limit == null ? null : Math.max(0, limit - used), reliable: true }; 
}
