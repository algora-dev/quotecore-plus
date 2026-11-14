import { test } from 'node:test';
import assert from 'node:assert/strict';
import {classifyRoofing,draftFromExtraction,canonicalRateFactor} from './roofing-rules';

test('roofing pitch rulebook uses the appropriate geometry only for recognized terms',()=>{
 const cases:[string,string,string,string][]=[
  ['Valley tray','m','lineal','valley_hip'],['Hip capping','m','lineal','valley_hip'],
  ['Barge flashing','m','lineal','rafter'],['Rake flashing','m','lineal','rafter'],
  ['Long run roofing sheeting','m²','area','rafter'],['Roof underlay','m²','area','rafter'],
  ['Roofing shingles','ft²','area','rafter'],['Horizontal ridge capping','m','lineal','none'],
  ['Gutter','m','lineal','none'],['Roofing screws','ea','quantity','none'],
 ];
 for(const [name,unit,measurement,pitch] of cases){const c=classifyRoofing(name,unit);
  assert.equal(c.measurementType,measurement,`${name}: measurement`);assert.equal(c.pitchType,pitch,`${name}: pitch`);}
});
test('ambiguous measurement basis suppresses automatic pitch',()=>{
 const d=classifyRoofing('Barge flashing','m²');assert.equal(d.confidence,'low');assert.equal(d.pitchType,'none');
});
test('never invent missing prices, labour or waste',()=>{
 const d=draftFromExtraction({name:'Valley flashing',sourceUnit:'m',sourcePrice:21},'unknown');
 assert.equal(d.materialRate,null);assert.equal(d.labourRate,null);assert.equal(d.wasteKind,'unknown');
 assert.equal(d.pitchType,'valley_hip');assert.equal(d.origins.pitchType,'rule');
});
test('selling quotes do not become material costs',()=>{
 const d=draftFromExtraction({name:'Roof sheeting',sourceUnit:'m²',sourcePrice:65},'selling');
 assert.equal(d.sourcePrice,65);assert.equal(d.materialRate,null);
});
test('imperial prices convert to canonical metric rate only when units are explicit',()=>{
 assert.ok(Math.abs(canonicalRateFactor('ft²','area')!-10.7639104167097)<1e-8);
 assert.ok(Math.abs(canonicalRateFactor('ft','lineal')!-3.28083989501312)<1e-8);
 assert.ok(Math.abs(canonicalRateFactor('RS','area')!-0.107639104167097)<1e-8);
 const d=draftFromExtraction({name:'Roof sheeting',sourceUnit:'ft²',sourcePrice:3},'purchase');
 assert.ok(Math.abs(d.materialRate!-32.2917)<0.0001);
});
test('pack price is never directly treated as a per-unit cost',()=>{
 const d=draftFromExtraction({name:'Underlay roll',sourceUnit:'roll',sourcePrice:120},'purchase');
 assert.equal(d.materialRate,null);assert.equal(d.sourcePrice,120);
});
