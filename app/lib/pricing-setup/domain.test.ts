import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pricingDraftSchema,validateForConfirmation} from './domain';
test('unknown cost and waste are not converted into approved zeros',()=>{
 const d=pricingDraftSchema.parse({name:'Roof sheeting'});
 assert.ok(validateForConfirmation(d).length>=3);
});
test('an explicitly entered zero can be reviewed and accepted',()=>{
 const d=pricingDraftSchema.parse({name:'Install service',materialRate:0,labourRate:30,wasteKind:'none',priceBasis:'purchase'});
 assert.deepEqual(validateForConfirmation(d),[]);
});
test('pack pricing needs both price and size',()=>{
 const d=pricingDraftSchema.parse({name:'Underlay',measurementType:'area',materialRate:0,labourRate:0,wasteKind:'none',pricingStrategy:'per_pack_area',packPrice:100});
 assert.ok(validateForConfirmation(d).some(p=>p.includes('pack price and pack size')));
});
test('a customer selling price cannot be silently treated as purchase cost',()=>{
 const d=pricingDraftSchema.parse({name:'Roof installed',measurementType:'area',materialRate:0,labourRate:0,wasteKind:'none',sourcePrice:100,priceBasis:'selling'});
 assert.ok(validateForConfirmation(d).some(p=>p.includes('selling price')));
});
