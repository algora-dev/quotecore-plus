/** Pure AI-output boundary. No SDK, quota or billing coupling. */
export function normalizeExtractedDocument(value:unknown,kind:'quote'|'invoice'|'order') {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('AI returned an invalid document.');
  const source=value as Record<string,unknown>;
  if(!Array.isArray(source.lines)||source.lines.length>500)throw new Error('AI returned an invalid item list.');
  const output:Record<string,unknown>={};
  const shared=['companyName','clientName','clientEmail','clientAddress','quoteDate','validDays','notes'];
  const specific=kind==='invoice'?['invoiceNumber','invoiceDate','dueDate','paymentDetails','paymentReference']:kind==='order'?['poNumber','poDate','supplierName','supplierEmail','supplierAddress','deliveryDate','deliveryAddress','jobReference']:['quoteNumber'];
  for(const key of [...shared,...specific])if(typeof source[key]==='string')output[key]=(source[key] as string).slice(0,['notes','paymentDetails'].includes(key)?12000:2000);
  const normalizationWarnings:string[]=[];
  output.lines=source.lines.map((item:unknown,i:number)=>{
    if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('AI returned an invalid item.');
    const line=item as Record<string,unknown>;
    const number=(n:unknown,fallback:number,label:string)=>{
      if(n===undefined||n===null||n===''){normalizationWarnings.push(`Line ${i+1}: no ${label} supplied; ${fallback} is used. Check this before generating.`);return fallback;}
      const parsed=typeof n==='number'?n:typeof n==='string'&&/^-?\d+(\.\d+)?$/.test(n.trim())?Number(n):NaN;
      if(!Number.isFinite(parsed)||Math.abs(parsed)>1e12)throw new Error(`AI returned an unreadable ${label} on line ${i+1}. No changes have been applied.`);
      return parsed;
    };
    return {description:typeof line.description==='string'?line.description.slice(0,8000):`Line ${i+1}`,
      qty:number(line.qty,1,'quantity'),rate:number(line.rate,0,'unit price'),unit:typeof line.unit==='string'?line.unit.slice(0,40):''};
  });
  output.confidence=['high','medium','low'].includes(String(source.confidence))?source.confidence:'low';
  output.warnings=Array.isArray(source.warnings)?source.warnings.filter((w):w is string=>typeof w==='string').slice(0,30).map(w=>w.slice(0,1000)):[];
  output.warnings=[...(output.warnings as string[]),...normalizationWarnings.slice(0,20)];
  return output;
}
