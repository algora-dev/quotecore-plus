import { createHmac, timingSafeEqual } from 'node:crypto';
import { isRecord, UUID } from './model';
export type DemoQuoteToken = { v:1; purpose:'customer-preview'; sessionId:string; quoteId:string; expires:number };
function key(secret:string):string{if(secret.length<32)throw new Error('Demo token signing key must be at least 32 characters.');return secret;}
export function signDemoToken(payload:Record<string,unknown>,secret:string):string{
 const encoded=Buffer.from(JSON.stringify(payload)).toString('base64url');
 return `${encoded}.${createHmac('sha256',key(secret)).update(`qcp-demo-v1:${encoded}`).digest('base64url')}`;
}
export function verifyDemoToken(token:string,secret:string,now=Date.now()):Record<string,unknown>|null{
 try{if(token.length>4000)return null;const parts=token.split('.');if(parts.length!==2)return null;
 const expected=createHmac('sha256',key(secret)).update(`qcp-demo-v1:${parts[0]}`).digest();const actual=Buffer.from(parts[1],'base64url');
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;
 const data:unknown=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
 if(!isRecord(data)||data.v!==1||typeof data.expires!=='number'||!Number.isSafeInteger(data.expires)||data.expires<=now)return null;return data;
 }catch{return null;}
}
export function parseDemoQuoteToken(token:string,secret:string,now=Date.now()):DemoQuoteToken|null{
 const data=verifyDemoToken(token,secret,now);
 return data?.purpose==='customer-preview'&&typeof data.sessionId==='string'&&UUID.test(data.sessionId)&&typeof data.quoteId==='string'&&UUID.test(data.quoteId)?data as DemoQuoteToken:null;
}
