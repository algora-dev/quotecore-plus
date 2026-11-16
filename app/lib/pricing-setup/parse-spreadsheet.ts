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
type ColumnKey=keyof typeof HEADERS;
/** When one title matches several keys with equally specific keywords, prefer the more specific key. */
const KEY_PRIORITY:ColumnKey[]=['material','labour','price','waste','unit','sku','notes','name'];
const norm=(s:string)=>s.toLowerCase().replace(/[_\-]+/g,' ').replace(/\s+/g,' ').trim();
/** True when the normalised header contains the keyword as a whole phrase (not inside a longer word). */
function containsPhrase(header:string,keyword:string):boolean{
 const escaped=keyword.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`).test(header);
}
/**
 * Map header titles to column indexes, tolerating decorated titles such as
 * "Material cost (USD per unit)" or "Component / service name". Each column is
 * claimed by the key whose keyword phrase is the most specific (longest) match;
 * when a key matches several columns the leftmost wins.
 */
function buildColumnMap(titles:string[]):Partial<Record<ColumnKey,number>>{
 const claimed:Partial<Record<ColumnKey,number>>={};
 titles.forEach((title,index)=>{
  const header=norm(String(title??''));if(!header)return;
  let best:{key:ColumnKey;len:number}|null=null;
  for(const key of KEY_PRIORITY){
   for(const raw of HEADERS[key]){
    const keyword=norm(raw);
    if(!keyword||!containsPhrase(header,keyword))continue;
    const more=!best||keyword.length>best.len||(keyword.length===best.len&&KEY_PRIORITY.indexOf(key)<KEY_PRIORITY.indexOf(best.key));
    if(more)best={key,len:keyword.length};
   }
  }
  if(best&&claimed[best.key]===undefined)claimed[best.key]=index;
 });
 return claimed;
}
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
 // Real sheets often carry title banners above the table, so look for the header
 // row anywhere in the first ten rows and keep the row that matches the most columns.
 let headerIndex=-1;let columns:Partial<Record<ColumnKey,number>>={};let bestScore=0;
 matrix.slice(0,10).forEach((row,index)=>{
  const map=buildColumnMap(row.map(String));
  const score=Object.keys(map).length;
  if(score>bestScore){bestScore=score;headerIndex=index;columns=map;}
 });
 const hasHeaders=bestScore>=2;
 const dataRows=hasHeaders?matrix.slice(headerIndex+1):matrix;
 const heading=(key:ColumnKey)=>{const i=columns[key];return i===undefined?'':String(matrix[headerIndex][i]??'');};
 const col=(row:string[],key:ColumnKey)=>{const i=columns[key];return i===undefined?'':(row[i]??'').trim();};
 const lines:ExtractedLine[]=[];
 for(const [index,row] of dataRows.entries()){
  if(lines.length===100)break;
  if(!row.some(c=>String(c).trim()))continue;
  const name=(hasHeaders?col(row,'name'):String(row[0]??'')).trim();
  if(!name)continue;
  if(hasHeaders){
   // Skip banner and footnote rows: prose in the name column with no recognised pricing data.
   const hasData=(['sku','unit','price','material','labour','waste'] as ColumnKey[]).some(key=>col(row,key)!=='')||col(row,'notes')!=='';
   if(!hasData)continue;
  }
  const price=col(row,'price');const mat=col(row,'material');const labour=col(row,'labour');
  const wasteRaw=col(row,'waste');const parsedWaste=parseWasteAllowance(wasteRaw,heading('waste'));
  const notes=col(row,'notes');
  lines.push({sku:col(row,'sku'),name,notes,sourceUnit:col(row,'unit'),sourcePrice:parseAmount(price),
   materialRate:parseAmount(mat),labourRate:parseAmount(labour),wasteType:parsedWaste.kind,wasteValue:parsedWaste.amount,
   sourceIndex:hasHeaders?headerIndex+index+2:index+1,excerpt:row.join(' | ').slice(0,1200)});
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
const BUILT_IN_PERCENT:Record<number,string>={9:'0%',10:'0.00%'};
/** Column style indexes whose number format renders values as percentages. */
async function readPercentStyles(zip:JSZip):Promise<Set<number>>{
 const entry=zip.file('xl/styles.xml');const styles=new Set<number>();
 if(!entry)return styles;
 const xml=await entry.async('string');
 const custom=new Map<number,string>();
 for(const m of xml.matchAll(/<(?:\w+:)?numFmt\b[^>]*>/g)){
  const id=Number(/numFmtId="(\d+)"/.exec(m[0])?.[1]??NaN);
  const code=/formatCode="([^"]*)"/.exec(m[0])?.[1]??'';
  if(Number.isInteger(id)&&code)custom.set(id,code);
 }
 const block=/<(?:\w+:)?cellXfs\b[^>]*>([\s\S]*?)<\/(?:\w+:)?cellXfs>/.exec(xml)?.[1]??'';
 [...block.matchAll(/<(?:\w+:)?xf\b[^>]*>/g)].forEach((m,i)=>{
  const id=Number(/numFmtId="(\d+)"/.exec(m[0])?.[1]??0);
  const code=BUILT_IN_PERCENT[id]??custom.get(id)??'';
  if(code.includes('%'))styles.add(i);
 });
 return styles;
}
/** Render percent-formatted numeric cells (e.g. 0.09 with a 0% format) as explicit "9%" strings. */
function renderPercent(value:string,attrs:string,percentStyles:Set<number>):string{
 if(!percentStyles.size||!value)return value;
 const style=Number(/\bs="(\d+)"/.exec(attrs)?.[1]??-1);
 if(!percentStyles.has(style))return value;
 const n=Number(value);
 if(!Number.isFinite(n))return value;
 return `${Math.round(n*100*10000)/10000}%`;
}
/** Read up to 12 XLSX worksheets as string matrices, including shared
 * strings and percent-style rendering, without executing workbook formulas.
 * Exposed so non-pricing consumers (measurements import) can reuse the exact
 * same battle-tested, namespace-prefix-tolerant sheet walking. */
export async function xlsxToMatrices(bytes:Buffer):Promise<Array<{name:string;matrix:string[][]}>>{
 const zip=await JSZip.loadAsync(bytes,{checkCRC32:true});
 const files=Object.values(zip.files).filter(f=>!f.dir);
 if(files.length>400)throw Error('Workbook contains too many embedded files.');
 let total=0;for(const f of files){total+=(f as unknown as {_data?:{uncompressedSize?:number}})._data?.uncompressedSize??0;}
 if(total>40*1024*1024)throw Error('Workbook is too large once extracted.');
 // Some generators write every tag with an explicit namespace prefix (e.g. <x:row>),
 // so every tag pattern below tolerates an optional prefix.
 const sharedStringsFile=zip.file('xl/sharedStrings.xml');
 const sharedXml=sharedStringsFile?await sharedStringsFile.async('string'):'';
 const shared=[...sharedXml.matchAll(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g)].map(m=>[...m[1].matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)].map(x=>decode(x[1])).join(''));
 const percentStyles=await readPercentStyles(zip);
 const sheets=files.filter(f=>/^xl\/worksheets\/[^\/]+\.xml$/i.test(f.name)&&!/\.rels$/i.test(f.name)).sort((a,b)=>Number(a.name.match(/(\d+)\.xml$/i)?.[1]??1e9)-Number(b.name.match(/(\d+)\.xml$/i)?.[1]??1e9));
 if(!sheets.length)throw Error('No worksheet found in this workbook.');
 const out:Array<{name:string;matrix:string[][]}>=[];
 for(const sheet of sheets.slice(0,12)){
  const xml=await sheet.async('string');
  const matrix:string[][]=[];
  for(const row of xml.matchAll(/<(?:\w+:)?row\b[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/g)){
   if(matrix.length>103)break;
   const values:string[]=[];
   for(const cell of row[1].matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)){
    const ref=/\br="([A-Z]+)\d+"/.exec(cell[1]);if(!ref)continue;
    let col=0;for(const char of ref[1])col=col*26+char.charCodeAt(0)-64;
    if(col>100)continue;
    const body=cell[2]??'';const type=/\bt="([^"]+)"/.exec(cell[1])?.[1];
    const value=/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/.exec(body)?.[1]??'';
    const inline=[...body.matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)].map(m=>decode(m[1])).join('');
    const rendered=type==='s'?shared[Number(value)]??'':type==='inlineStr'?inline:decode(value);
    values[col-1]=renderPercent(rendered,cell[1],percentStyles);
   }
   matrix.push(values.map(x=>x??''));
  }
  out.push({name:sheet.name,matrix});
 }
 return out;
}
/** Read up to 12 XLSX worksheets, including shared strings, without executing workbook formulas. */
export async function xlsxToRows(bytes:Buffer):Promise<ExtractedLine[]>{
 const results:ExtractedLine[]=[];
 for(const {name,matrix} of await xlsxToMatrices(bytes)){
  if(results.length>=100)break;
  results.push(...rowsFromMatrix(matrix).slice(0,100-results.length).map(item=>({...item,excerpt:`${name}: ${item.excerpt??item.name}`})));
 }
 return results;
}
