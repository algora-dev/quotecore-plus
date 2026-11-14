/** Pricing setup contracts. These are NOT component_library rows until human approval. */
import { z } from 'zod';
export const pricingDraftSchema = z.object({
  starterLibrarySlug: z.string().max(64).optional(),
  starterTemplateVersion: z.number().int().positive().optional(),
  practicePricing: z.boolean().default(false),
  practiceReferenceCurrency: z.string().max(3).optional(),
  practiceReferenceMarket: z.string().max(180).optional(),
  practicePriceSetId: z.string().uuid().optional(),
  starterLibraryName: z.string().max(120).optional(),
  sku: z.string().max(100).default(''),
  name: z.string().trim().min(1).max(180),
  notes: z.string().max(3000).default(''),
  sourceUnit: z.string().max(60).default(''),
  sourcePrice: z.number().finite().nonnegative().nullable().default(null),
  priceBasis: z.enum(['unknown','purchase','selling','mixed']).default('unknown'),
  materialRate: z.number().finite().nonnegative().nullable().default(null),
  labourRate: z.number().finite().nonnegative().nullable().default(null),
  measurementType: z.enum(['area','lineal','quantity','fixed','quantity_by_spacing']).default('quantity'),
  componentType: z.enum(['main','extra']).default('main'),
  soldBy: z.enum(['area','lineal']).nullable().default(null),
  coverWidthMm: z.number().finite().positive().nullable().default(null),
  quantitySpacingM: z.number().finite().positive().nullable().default(null),
  spacingAllowancePercent: z.number().finite().min(0).max(100).default(0),
  spacingRoundUp: z.union([z.literal(1),z.literal(5),z.literal(10)]).default(1),
  unitsPerAreaEnabled: z.boolean().default(false),
  unitsPerArea: z.number().finite().nonnegative().nullable().default(null),
  pitchType: z.enum(['none','rafter','valley_hip']).default('none'),
  wasteKind: z.enum(['unknown','none','percent','fixed','fixed_per_segment']).default('unknown'),
  wasteValue: z.number().finite().nonnegative().nullable().default(null),
  pricingStrategy: z.enum(['per_unit','per_pack_length','per_pack_area']).default('per_unit'),
  packPrice: z.number().finite().nonnegative().nullable().default(null),
  packSize: z.number().finite().positive().nullable().default(null),
  takeoffSlot: z.string().max(48).default('custom'),
  origins: z.record(z.string(),z.enum(['source','rule','inference','missing','user'])).default({}),
  warnings: z.array(z.string().max(280)).max(20).default([]),
  confidence: z.enum(['high','medium','low']).default('low'),
});
export type PricingDraft = z.infer<typeof pricingDraftSchema>;
export const editableDraftSchema = pricingDraftSchema.pick({
 sku:true,name:true,notes:true,sourceUnit:true,sourcePrice:true,priceBasis:true,materialRate:true,labourRate:true,
 measurementType:true,componentType:true,soldBy:true,coverWidthMm:true,quantitySpacingM:true,spacingAllowancePercent:true,spacingRoundUp:true,unitsPerAreaEnabled:true,unitsPerArea:true,pitchType:true,wasteKind:true,wasteValue:true,pricingStrategy:true,packPrice:true,packSize:true,
});
export type EditableDraft = z.infer<typeof editableDraftSchema>;
export type PricingDraftRow = {id:string;source_index:number;source_excerpt:string;status:'candidate'|'selected'|'confirmed'|'saved'|'skipped';draft_data:PricingDraft;confirmed_at:string|null;component_id:string|null};
export type PricingSession = {id:string;source_name:string;source_kind:string;source_basis:string;extracted_count:number;created_at:string};
export type ExtractedLine = {
  sku?:string|null;name:string;notes?:string|null;sourceUnit?:string|null;sourcePrice?:number|null;materialRate?:number|null;
  labourRate?:number|null;wasteType?:'percent'|'fixed'|'fixed_per_segment'|'none'|null;
  wasteValue?:number|null;sourceIndex?:number;excerpt?:string;priceBasis?:'purchase'|'selling'|'mixed'|'unknown'|null;
};
export function validateForConfirmation(draft:PricingDraft):string[] {
 const problems:string[]=[];
 if(draft.materialRate==null)problems.push('Enter and verify the material cost, using zero only if intentional.');
 if(draft.labourRate==null)problems.push('Enter and verify the labour cost, using zero only if intentional.');
 if(draft.wasteKind==='unknown')problems.push('Confirm the waste rule, including whether no waste applies.');
 if(draft.wasteKind!=='none'&&draft.wasteValue==null)problems.push('Enter the waste allowance from your own pricing.');
 if(draft.wasteKind==='percent'&&draft.wasteValue!=null&&draft.wasteValue>100)problems.push('Waste percentage cannot exceed 100%.');
 if(draft.pricingStrategy!=='per_unit'){
  if(draft.packPrice==null||draft.packSize==null)problems.push('Enter a valid pack price and pack size.');
  if(draft.measurementType!==(draft.pricingStrategy==='per_pack_area'?'area':'lineal'))problems.push('Pack pricing does not match this measurement type.');
 }
 if(draft.measurementType==='quantity_by_spacing'&&draft.quantitySpacingM==null)problems.push('Enter the spacing distance in metres to calculate quantities.');
 if(draft.measurementType==='quantity_by_spacing'&&draft.pricingStrategy!=='per_unit')problems.push('Quantity-by-spacing components are priced per calculated unit.');
 if(draft.measurementType==='quantity_by_spacing'&&draft.wasteKind!=='none')problems.push('Spacing components use their spacing allowance. Select No waste here to avoid a separate ignored waste setting.');
 if(['quantity','fixed'].includes(draft.measurementType)&&draft.pitchType!=='none')problems.push('Counted and fixed charges do not use roof pitch conversion.');
 if(draft.measurementType==='quantity_by_spacing'&&draft.pitchType!=='none')problems.push('Spacing quantities should not apply a second pitch factor.');
 if(draft.soldBy==='lineal'&&draft.measurementType==='area'&&draft.coverWidthMm==null)problems.push('Enter cover width for an area component sold by lineal length.');
 if(draft.unitsPerAreaEnabled&&draft.measurementType==='area'&&draft.unitsPerArea==null)problems.push('Enter units per m² or disable supplementary unit counting.');
 if(draft.priceBasis==='selling'&&draft.sourcePrice!=null)problems.push('The source is a selling price. Confirm cost rates and change price basis to purchase or mixed before using it as a material cost.');
 return problems;
}
