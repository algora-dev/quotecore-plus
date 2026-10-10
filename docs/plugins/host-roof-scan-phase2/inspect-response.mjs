/** Pure raw-response checks. An intact image block is NOT proof of host/model visibility. */
import {createHash} from 'node:crypto';
export const MAX_RPC_BYTES=8*1024*1024;
export function decodeRpc(text,expectedId){
 if(Buffer.byteLength(text)>MAX_RPC_BYTES)throw Error('RPC response exceeds the diagnostic budget');
 let messages=[];
 try{messages=[JSON.parse(text)];}catch{
   for(const event of text.split(/\r?\n\r?\n/)){
     const data=event.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');
     if(data&&data!=='[DONE]'){try{messages.push(JSON.parse(data));}catch{throw Error('Malformed MCP SSE data');}}
   }
 }
 const message=messages.find(m=>m.jsonrpc==='2.0'&&m.id===expectedId);
 if(!message)throw Error('No matching JSON-RPC response; possible deployment login page, truncated body or transport mismatch');
 if(message.error)throw Error('JSON-RPC returned error code '+message.error.code);
 if(!message.result)throw Error('JSON-RPC response is missing result');return message.result;
}
export function findReferences(result){
 if(result.structuredContent?.plan)return result.structuredContent;
 for(const item of result.content||[]){if(item.type!=='text')continue;try{const x=JSON.parse(item.text);if(x?.version==='qc-host-outline-v1'&&x.plan)return x;}catch{}}
 return null;
}
function dimensions(bytes,mime){
 if(mime==='image/png'){
   if(bytes.length<24||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.toString('ascii',12,16)!=='IHDR')throw Error('Image is not a PNG with an IHDR');
   return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
 }
 if(mime!=='image/jpeg'||bytes[0]!==255||bytes[1]!==216)throw Error('Image MIME/signature mismatch');
 let i=2;while(i+3<bytes.length){if(bytes[i++]!==255)throw Error('Invalid JPEG marker');while(bytes[i]===255)i++;const marker=bytes[i++];
   if(marker===0xda||marker===0xd9)break;if(marker===1||(marker>=0xd0&&marker<=0xd7))continue;
   const len=bytes.readUInt16BE(i);if(len<2||i+len>bytes.length)throw Error('Truncated JPEG');
   if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){if(len<8)throw Error('Invalid JPEG SOF');return {height:bytes.readUInt16BE(i+3),width:bytes.readUInt16BE(i+5)};}i+=len;
 }
 throw Error('JPEG dimensions not found');
}
export function inspectResult(result){
 const refs=findReferences(result),frame=refs?.plan;const images=(result.content||[]).filter(x=>x.type==='image');
 if(result.isError)throw Error('Tool returned isError; inspect safe server diagnostics in staging');
 if(!frame)throw Error('Tool did not return canonical image references');if(images.length!==1)throw Error('Expected exactly one image content block');
 const image=images[0];if(typeof image.data!=='string'||image.data.length>2800000||!image.data.length||image.data.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(image.data))throw Error('Invalid or oversized image base64');
 const bytes=Buffer.from(image.data,'base64');if(bytes.toString('base64')!==image.data)throw Error('Noncanonical base64');
 const sha256=createHash('sha256').update(bytes).digest('hex');if(sha256!==frame.sha256)throw Error('Image hash does not match returned coordinate frame');
 if(image.mimeType!==frame.mimeType)throw Error('Image MIME differs from frame');
 const size=dimensions(bytes,image.mimeType);if(size.width!==frame.width||size.height!==frame.height)throw Error('Image dimensions differ from coordinate frame');
 return {status:refs.status,imageId:frame.imageId,sha256,width:frame.width,height:frame.height,mimeType:image.mimeType,byteLength:bytes.length,
   serializedResultBytes:Buffer.byteLength(JSON.stringify(result)),hasStructuredContent:!!result.structuredContent,contentTypes:result.content.map(x=>x.type),
   serverRequestId:result._meta?.['quotecore/imageDelivery']?.requestId||null,hostVisibility:'NOT_TESTED'};
}
