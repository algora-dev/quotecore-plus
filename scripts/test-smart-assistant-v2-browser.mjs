/** Genuine hit-tested UI smoke, executed by the integrator only.
 * No force clicks, DOM .click(), overlay hiding, or mocked app saves.
 * Uses the existing @playwright/test dependency. Real iPhone testing is separate.
 */
import {chromium,webkit} from '@playwright/test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
if(!process.env.SA_V2_FIXTURES||!process.env.SA_V2_STORAGE_STATE||process.env.SA_V2_TEST_ACK!=='preview-is-not-isolated')throw new Error('Read the acceptance guide; supply local fixtures and a real browser storage state.');
const f=JSON.parse(readFileSync(process.env.SA_V2_FIXTURES,'utf8'));
if(!f.a.recordCardId||!f.a.conversationId)throw new Error('Supply a normal application-created record card.');
const engine=process.env.SA_V2_BROWSER==='webkit'?webkit:chromium;
const browser=await engine.launch({headless:true});
try{
 const context=await browser.newContext({storageState:process.env.SA_V2_STORAGE_STATE,viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 await context.addInitScript(({userId,companyId,conversationId})=>{sessionStorage.setItem(`sa-conversation:${userId}:${companyId}`,conversationId);localStorage.setItem(`sa-input:${userId}:${companyId}`,'voice');},f.a);
 const page=await context.newPage();await page.goto(new URL(`/${f.workspaceSlug}/quotes`,f.baseUrl).href);
 await page.getByRole('button',{name:`Open ${f.assistantName}`,exact:true}).click();
 const chat=page.locator('[data-sa-v2="true"]');await chat.waitFor({state:'visible'});
 assert.equal(await chat.getByRole('textbox').count(),0,'Voice preference must not render a permanent text composer');
 const header=chat.locator('header');assert.equal(await header.getByRole('button').count(),2,'Header has only Menu and Hide');
 await chat.getByRole('button',{name:'Type',exact:true}).click();await chat.getByRole('textbox',{name:'Message the assistant'}).fill('Unsent fixture text');
 await chat.getByRole('button',{name:'Hide',exact:true}).click();await chat.waitFor({state:'hidden'});
 await page.getByRole('button',{name:`Open ${f.assistantName}`,exact:true}).click();assert.equal(await chat.getByRole('textbox').inputValue(),'Unsent fixture text','Hide must preserve draft text');
 const record=chat.locator(`[data-sa-card="${f.a.recordCardId}"]`);const open=f.expectedRecordButton?record.getByRole('button',{name:f.expectedRecordButton,exact:true}):record.getByRole('button').first();
 const box=await open.boundingBox();assert.ok(box&&box.width>=44&&box.height>=44,'Navigation button touch area');
 await open.click();await page.waitForURL(new URL(f.expectedDestination,f.baseUrl).href);await chat.waitFor({state:'hidden'});
 await page.getByRole('button',{name:`Open ${f.assistantName}`,exact:true}).click();await record.waitFor({state:'visible'});
 assert.equal(new URL(page.url()).pathname,new URL(f.expectedDestination,f.baseUrl).pathname,'Reopening must not replay historical navigation');
 await chat.getByRole('button',{name:'Hide',exact:true}).click();
 if(process.env.SA_V2_SCREENSHOT)await page.screenshot({path:process.env.SA_V2_SCREENSHOT,fullPage:false});
 console.log('PASS real hit-tested shell, typing preference, retained draft and navigate/hide/reopen smoke. This does not test OS microphone/keyboard or write transactions.');
 await context.close();
}finally{await browser.close();}
