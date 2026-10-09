/** Small RFC-style CSV reader for component import. No evaluation, no network. */
import {EMPTY_SPEC} from '../free-roof-takeoff/tradeConfig';
import {id,type Spec} from './measurement-model';
export interface CsvData {headers:string[];rows:string[][]}
export function readCsv(text:string):CsvData {
 if(text.length>1_000_000)throw Error('Choose a CSV smaller than 1 MB.');
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false;
 const source=text.replace(/^\uFEFF/,'');
 for(let i=0;i<source.length;i++){
  const ch=source[i];
  if(quoted){if(ch==='"'){if(source[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=ch;continue;}
  if(ch==='"'){if(cell.trim()||closed)throw Error('Unexpected quote in CSV. Export a standard comma-separated file.');quoted=true;continue;}
  if(ch===','||ch==='\n'||ch==='\r'){row.push(cell.trim());cell='';closed=false;if(ch!==','){if(row.some(Boolean))rows.push(row);row=[];if(ch==='\r'&&source[i+1]==='\n')i++;}continue;}
  if(closed&&ch.trim())throw Error('Unexpected text after a quoted CSV field.');cell+=ch;
 }
 if(quoted)throw Error('A quoted CSV cell is not closed.');row.push(cell.trim());if(row.some(Boolean))rows.push(row);
 if(rows.length<2)throw Error('Include a header row and at least one component.');if(rows.length>501)throw Error('Import up to 500 price-list rows at a time.');
 const headers=rows.shift()!.map((h,i)=>h||`Column ${i+1}`);return {headers,rows};
}
export interface CsvMapping {name:number;material:number;labour:number;sku:number}
export function guessCsv(headers:string[]):CsvMapping{return {name:headers.findIndex(h=>/name|description|component|item/i.test(h)),material:headers.findIndex(h=>/material|price|cost/i.test(h)),labour:headers.findIndex(h=>/labou?r|wage/i.test(h)),sku:headers.findIndex(h=>/sku|code/i.test(h))};}
export function csvNumber(value:string):number{
 if(!value.trim())return 0;
 const cleaned=value.trim().replace(/^[$£€]/,'').replace(/\s/g,'');
 const normalized=/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)?cleaned.replaceAll(',',''):cleaned;
 if(!/^\d+(\.\d+)?$/.test(normalized))throw Error(`Use a decimal point for prices: “${value}” is not a valid price.`);
 const n=Number(normalized);if(!Number.isFinite(n)||n>1e9)throw Error('A price is out of range.');return n;
}
export function importCsvRow(row:string[],mapping:CsvMapping,type:Spec['measurementType']):Spec{
 const name=(row[mapping.name]||'').trim();if(!name||name.length>120)throw Error('Use a component name between 1 and 120 characters.');
 return {...EMPTY_SPEC,id:id('csv'),name,sku:row[mapping.sku]||undefined,measurementType:type,materialRate:csvNumber(row[mapping.material]||''),labourRate:csvNumber(row[mapping.labour]||''),pricingOrigin:'user'};
}
export function csvCell(value:string|number):string {let s=String(value);if(typeof value==='string'&&/^[\s\uFEFF]*[=+@-]/.test(s))s="'"+s;return `"${s.replaceAll('"','""')}"`;}
