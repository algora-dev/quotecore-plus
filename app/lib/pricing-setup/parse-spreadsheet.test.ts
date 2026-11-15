import {test} from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {parseAmount,parseWasteAllowance,rowsFromMatrix,xlsxToRows} from './parse-spreadsheet';
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
test('matches decorated headers and skips banner/footnote rows',()=>{
 const items=rowsFromMatrix([
  ['Working rate sheet','','','','',''],
  ['Component / service name','Roof section','Unit','Material cost\nUSD per unit','Labour cost\nUSD per unit','Waste\nallowance'],
  ['Field tiles standard','Roof covering','m²','18.9','21','9%'],
  ['GENERAL CONDITIONS project notes','','','','',''],
 ]);
 assert.equal(items.length,1);
 assert.equal(items[0].name,'Field tiles standard');
 assert.equal(items[0].materialRate,18.9);
 assert.equal(items[0].labourRate,21);
 assert.equal(items[0].sourceUnit,'m²');
 assert.equal(items[0].wasteType,'percent');assert.equal(items[0].wasteValue,9);
});
test('reads namespace-prefixed workbooks with percent-formatted waste columns',async()=>{
 const xfs=Array.from({length:41},(_,i)=>`<x:xf numFmtId="${i===40?201:0}"/>`).join('');
 const text=(ref:string,value:string,style=0)=>`<x:c r="${ref}" s="${style}" t="str"><x:v>${value}</x:v></x:c>`;
 const number=(ref:string,value:string,style=0)=>`<x:c r="${ref}" s="${style}"><x:v>${value}</x:v></x:c>`;
 const sheet=`<x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData>`
  +`<x:row r="1">${text('A1','CONCRETE TILE ROOFING | WORKING RATE SHEET')}</x:row>`
  +`<x:row r="5">${text('A5','Component / service name')}${text('C5','Unit')}${text('D5','Material cost\nUSD per unit')}${text('E5','Labour cost\nUSD per unit')}${text('F5','Waste\nallowance')}</x:row>`
  +`<x:row r="6">${text('A6','Concrete field tiles')}${text('C6','m²')}${number('D6','18.9',38)}${number('E6','21',39)}${number('F6','0.09',40)}</x:row>`
  +`<x:row r="7">${text('A7','GENERAL CONDITIONS | Notes only')}</x:row>`
  +`</x:sheetData></x:worksheet>`;
 const zip=new JSZip();
 zip.file('xl/styles.xml',`<x:styleSheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:numFmts count="1"><x:numFmt numFmtId="201" formatCode="0%"/></x:numFmts><x:cellXfs count="41">${xfs}</x:cellXfs></x:styleSheet>`);
 zip.file('xl/worksheets/sheet1.xml',sheet);
 const items=await xlsxToRows(await zip.generateAsync({type:'nodebuffer'}));
 assert.equal(items.length,1);
 assert.equal(items[0].name,'Concrete field tiles');
 assert.equal(items[0].materialRate,18.9);
 assert.equal(items[0].labourRate,21);
 assert.equal(items[0].sourceUnit,'m²');
 assert.deepEqual([items[0].wasteType,items[0].wasteValue],['percent',9]);
});
