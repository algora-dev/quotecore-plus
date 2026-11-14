import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseAmount,parseWasteAllowance,rowsFromMatrix} from './parse-spreadsheet';
test('parses money strictly, rejects ambiguous formats',()=>{
 assert.equal(parseAmount('$1,234.50'),1234.5);assert.equal(parseAmount('21.25'),21.25);
 assert.equal(parseAmount('1.234,50'),null);assert.equal(parseAmount('not priced'),null);
});
test('source rows preserve SKU, material and labour without fabricating waste',()=>{
 const items=rowsFromMatrix([['SKU','Product Name','Material Cost','Labour Rate','Unit','Notes'],
  ['FL-1','Valley flashing','19.00','8.50','m','Aluminium'],['FL-2','Barge','22','','m','']]);
 assert.equal(items.length,2);assert.equal(items[0].sku,'FL-1');assert.equal(items[0].materialRate,19);
 assert.equal(items[0].labourRate,8.5);assert.equal(items[0].wasteType,null);
 assert.equal(items[1].labourRate,null);
});
test('extracts at most 100 rows with stable source order',()=>{
 const rows=[['Name','Price'],...Array.from({length:120},(_,i)=>[`Item ${i+1}`,`${i+1}`])];
 const items=rowsFromMatrix(rows);assert.equal(items.length,100);assert.equal(items[99].name,'Item 100');
});

test('extracts explicit percent and fixed metric waste, but does not invent unqualified waste',()=>{
 assert.deepEqual(parseWasteAllowance('10%','Waste'),{kind:'percent',amount:10});
 assert.deepEqual(parseWasteAllowance('150 mm','Waste'),{kind:'fixed',amount:0.15});
 assert.deepEqual(parseWasteAllowance('0.25m per segment','Waste'),{kind:'fixed_per_segment',amount:0.25});
 assert.deepEqual(parseWasteAllowance('150','Waste (mm)'),{kind:'fixed',amount:0.15});
 assert.deepEqual(parseWasteAllowance('10','Waste'),{kind:null,amount:null});
});
