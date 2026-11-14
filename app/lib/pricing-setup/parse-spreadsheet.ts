import JSZip from 'jszip';
import Papa from 'papaparse';
import type {ExtractedLine} from './domain';
const HEADERS:Record<string,string[]>={
 sku:['sku','code','product code','productcode','item code','part number','stock code','product id'],
 name:['name','product','product name','item','item name','description','service','material'],
 notes:['notes','note','details','additional description'],
 unit:['unit','uom','unit of measure','basis','priced per','per','qty unit'],
 material:['material cost','material price','buy price','purchase price','supplier price','cost price'],
 labour:['labour cost','labor cost','labour rate','labor rate','labour price','labor price'],
 price:['price','rate','unit price','cost','unit cost','selling price','charge'],
 waste:['waste','waste %','wastage','waste percent','wastage %','waste (mm)','waste (m)','waste allowance (mm)','waste allowance (m)','waste per segment (mm)','waste per segment (m)'],
};
const norm=(s:string)=>s.toLowerCase().replace(/[_\-]+/g,' ').replace(/\s+/g,' ').trim();
function find(headers:string[],key:keyof typeof HEADERS){return headers.findIndex(h=>HEADERS[key].includes(norm(h)));}
export function parseAmount(source:string):number|null{
 const s=source.trim().replace(/[£$€\s]/g,'');
 if(!s)return null;
 // Do not guess locale-specific separators such as 1.234,56.
 if(/[^\d,.+-]/.test(s)||/[,].*[.]/.test(s)&&/\d\.\d{3},/.test(s))return null;
 const cleaned=/^\d{1,3}(,\d{3})+(\.\d{1,4})?$/.test(s)?s.replace(/,/g,''):s;
 if(cleaned.includes(','))return null;
 if(!/^\+?\d+(?:\.\d{1,4})?$/.test(cleaned))return null;
 const n=Number(cleaned);return Number.isFinite(n)?n:null;
}
/** Recognise only EXPLICIT waste units and values; never infer an unqualified allowance. */
export function parseWasteAllowance(value:string, heading:string):{kind:ExtractedLine['wasteType'];amount:number|null}{
 const v=value.toLowerCase().trim();const h=norm(heading);
 if(!v)return {kind:null,amount:null};
 if(/^(none|no waste|not applicable|n\/?a|nil)$/i.test(v))return {kind:'none',amount:0};
 const percent=v.match(/^([+]?[\d.,]+)\s*(?:%|percent|percentage)$/);
 const percentHeading=/(?:%|percent)/.test(h);
 if(percent||percentHeading){const parsed=parseAmount(percent?percent[1]:v);return parsed!==null&&parsed<=100?{kind:'percent',amount:parsed}:{kind:null,amount:null};}
 const length=v.match(/^([+]?[\d.,]+)\s*(mm|millimet(?:er|re)s?|m|met(?:er|re)s?)\s*(?:per\s*(?:segment|length))?$/);
 const suffix=v.includes('segment')||h.includes('per segment')?'fixed_per_segment':'fixed';
 if(length){const n=parseAmount(length[1]);return n===null?{kind:null,amount:null}:{kind:suffix,amount:length[2].startsWith('m')&&!length[2].startsWith('mm')&&!length[2].startsWith('millimet')?n:n/1000};}
 const plain=parseAmount(v);
 if(plain!==null&&/\(mm\)|\(m\)/.test(h)){return {kind:suffix,amount:h.includes('(mm)')?plain/1000:plain};}
 return {kind:null,amount:null};
}
export function rowsFromMatrix(matrix:string[][]):ExtractedLine[]{
 if(!matrix.length)return [];
 const first=matrix[0].map(String);
 const hasHeaders=first.some(h=>Object.values(HEADERS).some(words=>words.includes(norm(h))));
 const headers=hasHeaders?first:first.map((_,i)=>i===0?'name':i===1?'price':`column ${i}`);
 const col=(row:string[],key:keyof typeof HEADERS)=>{const i=find(headers,key);return i>=0?(row[i]??'').trim():'';};
 const lines:ExtractedLine[]=[];
 for(const [index,row]of matrix.entries()){
  if(hasHeaders&&index===0)continue;
  if(lines.length===100)break;
  if(!row.some(c=>String(c).trim()))continue;
  const name=(col(row,'name')||(!hasHeaders?String(row[0]??''):'')).trim();
  if(!name)continue;
  const price=col(row,'price');const mat=col(row,'material');const labour=col(row,'labour');
  const wasteRaw=col(row,'waste');const parsedWaste=parseWasteAllowance(wasteRaw,headers[find(headers,'waste')]??'');
  const notes=col(row,'notes');
  lines.push({sku:col(row,'sku'),name,notes,sourceUnit:col(row,'unit'),sourcePrice:parseAmount(price),
   materialRate:parseAmount(mat),labourRate:parseAmount(labour),wasteType:parsedWaste.kind,wasteValue:parsedWaste.amount,
   sourceIndex:index+1,excerpt:row.join(' | ').slice(0,1200)});
 }
 return lines;
}
export function csvToRows(text:string){
 const p=Papa.parse<string[]>(text,{skipEmptyLines:'greedy',dynamicTyping:false});
 if(p.errors.length&&p.data.length===0)throw Error('Unable to parse this CSV.');
 return rowsFromMatrix(p.data.map(row=>row.map(String)));
}
const decode=(s:string)=>s.replace(/&#(x[\da-f]+|\d+);|&(?:amp|lt|gt|quot|apos);/gi,m=>{
 const entities:Record<string,string>={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};if(entities[m])return entities[m];const hex=m.startsWith('&#x');const cp=Number.parseInt(m.slice(hex?3:2,-1),hex?16:10);return Number.isInteger(cp)&&cp>0&&cp<0x110000?String.fromCodePoint(cp):m;
});
/** Read up to 12 XLSX worksheets, including shared strings, without executing workbook formulas. */
export async function xlsxToRows(bytes:Buffer):Promise<ExtractedLine[]>{
 const zip=await JSZip.loadAsync(bytes,{checkCRC32:true});
 const files=Object.values(zip.files).filter(f=>!f.dir);
 if(files.length>400)throw Error('Workbook contains too many embedded files.');
 let total=0;for(const f of files){total+=(f as unknown as {_data?:{uncompressedSize?:number}})._data?.uncompressedSize??0;}
 if(total>40*1024*1024)throw Error('Workbook is too large once extracted.');
 const sharedXml=zip.file('xl/sharedStrings.xml')?await zip.file('xl/sharedStrings.xml')!.async('string'):'';
 const shared=[...sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m=>[...m[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(x=>decode(x[1])).join(''));
 const sheets=files.filter(f=>/^xl\/worksheets\/sheet\d+\.xml$/i.test(f.name)).sort((a,b)=>Number(a.name.match(/sheet(\d+)/)?.[1]??0)-Number(b.name.match(/sheet(\d+)/)?.[1]??0));
 if(!sheets.length)throw Error('No worksheet found in this workbook.');
 const results:ExtractedLine[]=[];
 for(const sheet of sheets.slice(0,12)){
 if(results.length>=100)break;
 const xml=await sheet.async('string');
 const matrix:string[][]=[];
 for(const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)){
  if(matrix.length>103)break;
  const values:string[]=[];
  for(const cell of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
   const ref=/\br="([A-Z]+)\d+"/.exec(cell[1]);if(!ref)continue;
   let col=0;for(const char of ref[1])col=col*26+char.charCodeAt(0)-64;
   if(col>100)continue;
   const body=cell[2]??'';const type=/\bt="([^"]+)"/.exec(cell[1])?.[1];
   const value=/<v>([\s\S]*?)<\/v>/.exec(body)?.[1]??'';
   const inline=[...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m=>decode(m[1])).join('');
   values[col-1]=type==='s'?shared[Number(value)]??'':type==='inlineStr'?inline:decode(value);
  }
  matrix.push(values.map(x=>x??''));
 }
 results.push(...rowsFromMatrix(matrix).slice(0,100-results.length).map(item=>({...item,excerpt:`${sheet.name}: ${item.excerpt??item.name}`})));
 }
 return results;
}
