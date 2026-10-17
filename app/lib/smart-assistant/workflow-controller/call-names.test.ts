import assert from 'node:assert/strict';
import test from 'node:test';
import type { LibraryCatalogItem } from '../library-workflow/contracts';
import { applyCallNamesToPrepare, applyCallNamesToRevision, resolveComponentCallName, resolveLibraryCallName } from './call-names';

const catalog: LibraryCatalogItem[] = [
  { id:'c1', collectionId:'l1', collectionName:'Residential Roofing Components', collectionCallName:'Roofing 1', name:'0.55 BMT Ridge Flashing 400mm', callName:'Ridge 1', role:'ridge', isDefault:false, conceptKey:'ridge', measurementType:'lineal', takeoffSlot:null, unit:'m', active:true },
  { id:'c2', collectionId:'l1', collectionName:'Residential Roofing Components', collectionCallName:'Roofing 1', name:'Roof Screw 75mm', callName:'1', role:'fixings', isDefault:false, conceptKey:'fixings', measurementType:'quantity', takeoffSlot:null, unit:'each', active:true },
  { id:'c3', collectionId:'l2', collectionName:'Cladding', collectionCallName:'Cladding 1', name:'Cladding Screw', callName:'1', role:'fixings', isDefault:false, conceptKey:'fixings', measurementType:'quantity', takeoffSlot:null, unit:'each', active:true },
];

test('library call name resolves without changing the real name', () => {
  assert.equal(resolveLibraryCallName('roofing-1', catalog)?.id, 'l1');
  assert.equal(resolveLibraryCallName('Residential Roofing Components', catalog)?.id, 'l1');
});

test('component call names are deterministic inside a selected library', () => {
  assert.equal(resolveComponentCallName('1', catalog, 'l1')?.id, 'c2');
  assert.equal(resolveComponentCallName('1', catalog, null), null);
});

test('prepare converts arbitrary call names to structural concepts and exact products', () => {
  const prepared = applyCallNamesToPrepare({ collection_name:'Roofing 1', areas:[], measurements:[{concept:'Ridge 1', entries:[{quantity:4,unit:'m'}], area_index:null}] }, catalog);
  assert.equal(prepared.collection_id, 'l1');
  const measurement = (prepared.measurements as any[])[0];
  assert.equal(measurement.concept, 'ridge');
  assert.equal(measurement.product_name, 'Ridge 1');
});

test('revision promotes a call-name measurement to an exact component addition', () => {
  const revised = applyCallNamesToRevision({ deltas:[{op:'add_measurement',concept:'1',area_id:null,basis:'actual',entries:[{quantity:5,unit:'each'}]}] }, catalog, { collectionId:'l1' } as any);
  const delta = (revised.deltas as any[])[0];
  assert.equal(delta.op, 'add_component');
  assert.equal(delta.concept, 'fixings');
  assert.equal(delta.product_name, '1');
});
