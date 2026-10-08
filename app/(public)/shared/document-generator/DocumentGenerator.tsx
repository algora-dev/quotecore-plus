'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildConvertUrl } from '../convertLines';
import { applyParsed, blankDraft, blankLine, calculate, documentWarnings, hasWork, money, newId, sampleDraft, unitFor, validateDraft, visibleLines, type DocumentConfig, type DocumentDraft, type DocumentLine, type ParsedDocument, type ValidationIssue } from './document-model';
import { DocumentServiceError, type DocumentServices } from './document-services';
import { useDocumentDraft } from './useDocumentDraft';
import { DetailsEditor, type ChangeField } from './DetailsEditor';
import { ItemsEditor } from './ItemsEditor';
import { DocumentAssist, type AssistInput } from './DocumentAssist';
import { DOCUMENT_CSS, DocumentPaper, ScaledPaper } from './DocumentPaper';
import { printDocument } from './print-document';
import { Button, Dialog, Disclosure, IconButton } from './ui';
import { Icon } from './Icon';
import s from './DocumentGenerator.module.css';
import { AccountDialog } from './AccountDialog';
import { AllowanceBar, AllowanceDialog } from './AllowanceBar';
import { PaidAppDiscovery } from './PaidAppDiscovery';
import { authReturnUrl, clearAuthResume, saveAuthResume } from './auth-resume';
import { type AuthIntent, type DocumentAccount, type DocumentAuthServices } from './document-account';
export interface DocumentGeneratorProps {
  config:DocumentConfig; search:string; services:DocumentServices; account:DocumentAccount;
  auth:DocumentAuthServices;
  onAuthComplete?:(resumeId:string)=>Promise<void>;
  onGenerated?:()=>void;
}
const STAGES=['Details','Items & pricing','Review & download'];
export function DocumentGenerator({config,search,services,account,auth,onAuthComplete,onGenerated}:DocumentGeneratorProps) {
  const {draft:d,update,ready,status,notice,setNotice,authResume}=useDocumentDraft(config.sessionKey,search,services);
  const [step,setStep]=useState<0|1|2>(0),[dialog,setDialog]=useState<'assist'|'preview'|'help'|'reset'|'example'|'account'|'allowances'|null>(null);
  const [authIntent,setAuthIntent]=useState<AuthIntent>('signup');
  const [assistInput,setAssistInput]=useState<AssistInput>({mode:'text',text:'',image:'',filename:''});
  const returnToAssist=useRef(false),authId=useRef<string|null>(null),handledAuth=useRef(new Set<string>()),resumed=useRef(false);
  const [errors,setErrors]=useState<ValidationIssue[]>([]),[requestError,setRequestError]=useState(''),[limitError,setLimitError]=useState(false);
  const [generating,setGenerating]=useState(false),[generatedKey,setGeneratedKey]=useState(''),[printing,setPrinting]=useState(false);
  const [undo,setUndo]=useState<{draft:DocumentDraft;label:string}|null>(null),[handoffConfirmed,setHandoffConfirmed]=useState(false);
  const main=useRef<HTMLElement>(null),heading=useRef<HTMLHeadingElement>(null),paper=useRef<HTMLDivElement>(null),request=useRef<AbortController|null>(null);
  const generationLock=useRef(false),current=useRef(d),mounted=useRef(true);current.current=d;
  const fingerprint=useMemo(()=>JSON.stringify(d),[d]),generated=generatedKey===fingerprint;
  const totals=calculate(d),warnings=documentWarnings(d),rows=visibleLines(d);
  const hiddenCount=d.lines.filter(l=>l.lineHidden).length;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;request.current?.abort();};},[]);
  useEffect(()=>{setHandoffConfirmed(false);},[fingerprint]);
  useEffect(()=>{
    if(!ready||resumed.current)return;
    const q=new URLSearchParams(search);authId.current=q.get('qc_resume');resumed.current=true;
    if(authResume){if(authResume.assist)setAssistInput(authResume.assist);returnToAssist.current=authResume.reopenAssist===true;setStep(authResume.step);if(authResume.generated)setGeneratedKey(JSON.stringify(current.current));setNotice('Your quote has been restored after sign-in. Checking your account…');}
    if(q.get('qc_auth_error'))setNotice('That sign-in link could not be verified. Your quote has been kept. Sign in to request a fresh link.');
  },[ready,authResume,search,setNotice]);
  useEffect(()=>{
    const id=authId.current;
    if(!account.canRemoveBranding||!id||handledAuth.current.has(id))return;
    handledAuth.current.add(id);
    setDialog(returnToAssist.current?'assist':null);returnToAssist.current=false;
    setNotice('Account confirmed. QuoteCore+ branding is removed — no need to generate this quote again.');
    if(onAuthComplete)void onAuthComplete(id).catch(e=>setNotice(e instanceof Error?e.message:'Your account is ready. The optional email preference could not be saved.'));
    else clearAuthResume(id);
  },[account.canRemoveBranding,account.userId,dialog,onAuthComplete,setNotice]);
  function openAccount(intent:AuthIntent,backToAssist=false){setAuthIntent(intent);returnToAssist.current=backToAssist;setDialog('account');}
  function prepareAuth(marketingConsent:boolean,email:string|null){
    try{sessionStorage.setItem(config.sessionKey,JSON.stringify(current.current));}catch{/* fallback notice appears in dialog */}
    clearAuthResume(authId.current);
    const result=saveAuthResume(current.current,step,generated,marketingConsent,email,assistInput,returnToAssist.current);authId.current=result.id;
    return {redirectTo:authReturnUrl(result.id),backupAvailable:result.available};
  }
  function startAssist(mode:'text'|'image'){setAssistInput(p=>({...p,mode}));setDialog('assist');}
  function leaveAccount(){setDialog(returnToAssist.current?'assist':null);returnToAssist.current=false;}
  async function signOut(){try{await account.signOut();setNotice('Signed out. Guest limits and QuoteCore+ branding now apply.');}catch(e){setNotice(e instanceof Error?e.message:'Could not sign out. Please try again.');}}
  function navigate(next:0|1|2,field?:string){
    setStep(next);setRequestError('');setLimitError(false);
    window.requestAnimationFrame(()=>{
      if(field){const node=document.getElementById(field);node?.scrollIntoView({block:'center',behavior:'auto'});node?.focus({preventScroll:true});}
      else{main.current?.scrollIntoView({block:'start',behavior:'auto'});heading.current?.focus({preventScroll:true});}
    });
  }
  function edit(action:(p:DocumentDraft)=>DocumentDraft){setUndo(null);setErrors([]);setRequestError('');update(action);}
  const change:ChangeField=(key,value)=>edit(previous=>({...previous,[key]:value}));
  function editLine(id:string,patch:Partial<DocumentLine>){edit(previous=>({...previous,lines:previous.lines.map(l=>l.id===id?{...l,...patch}:l)}));}
  function focusLine(id:string){requestAnimationFrame(()=>document.getElementById(`description-${id}`)?.focus());}
  function addLine(){const line=blankLine(unitFor(d.measurementSystem,d.measurementType));edit(p=>({...p,lines:[...p.lines,line]}));setNotice('Item added. Enter a description, quantity and unit price.');focusLine(line.id);}
  function duplicateLine(id:string){const i=d.lines.findIndex(l=>l.id===id);if(i<0)return;const copy={...d.lines[i],id:newId()};edit(p=>({...p,lines:[...p.lines.slice(0,i+1),copy,...p.lines.slice(i+1)]}));setNotice('Item duplicated. Adjust its quantity or description as needed.');focusLine(copy.id);}
  function removeLine(id:string){setUndo({draft:d,label:'Item removed'});setErrors([]);update(p=>{const lines=p.lines.filter(l=>l.id!==id);return {...p,lines:lines.length?lines:[blankLine(unitFor(p.measurementSystem,p.measurementType))]};});setNotice('Item removed.');requestAnimationFrame(()=>document.getElementById('undo-change')?.focus());}
  function fresh(example:boolean){const previous=d;update(example?{...sampleDraft(window.location.hostname),currencyCode:d.currencyCode}:blankDraft(window.location.hostname));setStep(0);setErrors([]);setRequestError('');setGeneratedKey('');setDialog(null);setUndo(hasWork(previous)?{draft:previous,label:example?'Example loaded':'New quote started'}:null);setNotice(example?'Example loaded. These are sample figures, not suggested prices.':'New quote started.');requestAnimationFrame(()=>heading.current?.focus({preventScroll:true}));}
  function requestExample(){if(hasWork(d))setDialog('example');else fresh(true);}
  function applyAI(result:ParsedDocument,mode:'replace'|'append',example=false){
    setUndo({draft:d,label:'Import applied'});update({...applyParsed(d,result,mode),sample:example||(mode==='append'&&!!d.sample)});setDialog(null);setErrors([]);setGeneratedKey('');setNotice('Imported details added. Check quantities, units, prices and tax before generating.');navigate(1);
  }
  function checkThen(next:0|1|2){const all=validateDraft(d),relevant=step===0?all.filter(e=>e.step===0):all;
    if(relevant.length){setErrors(relevant);navigate(relevant[0].step,relevant[0].field);return;}setErrors([]);navigate(next);}
  async function generate(){
    if(generationLock.current||generated)return;
    const issues=validateDraft(d);if(issues.length){setErrors(issues);navigate(issues[0].step,issues[0].field);return;}
    generationLock.current=true;setGenerating(true);setRequestError('');setLimitError(false);request.current=new AbortController();
    const atStart=JSON.stringify(d),timeout=setTimeout(()=>request.current?.abort(),20000);
    try{await services.generation(config.kind,request.current.signal);
      if(!mounted.current)return;
      if(JSON.stringify(current.current)!==atStart){setRequestError('Your quote changed while it was being checked. Review the latest version before generating again.');return;}
      setGeneratedKey(atStart);setNotice('Your quote is ready. Print it or save it as a PDF.');try{onGenerated?.();}catch{/* analytics never blocks generation */}
    }catch(e){if(mounted.current){setLimitError(e instanceof DocumentServiceError&&e.status===429);setRequestError(e instanceof Error&&e.name==='AbortError'?'The allowance check timed out. Your quote is still here. Retry when your connection is ready.':e instanceof Error?e.message:'We could not generate the quote. Please try again.');}}
    finally{clearTimeout(timeout);generationLock.current=false;if(mounted.current)setGenerating(false);}
  }
  async function print(){
    const document=paper.current?.querySelector<HTMLElement>('article');if(!document||printing||!generated)return;setPrinting(true);setRequestError('');
    try{await printDocument(document,`${d.quoteNumber} - ${d.clientName||'Quote'}`);setNotice('Print dialog opened. Select Save as PDF to keep a copy.');}
    catch(e){setRequestError(e instanceof Error?e.message:'Printing is unavailable.');}finally{setPrinting(false);}
  }
  function converted(target:string){
    const url=buildConvertUrl({targetPath:target,amount:totals.total,clientName:d.clientName,lines:rows,ref:'free-quote-generator'});
    return `${url}&currency=${encodeURIComponent(d.currencyCode)}`;
  }
  const saveStatus=status==='saving'?'Saving in this tab…':status==='saved'?'Draft saved in this tab':status==='unavailable'?'Tab storage unavailable — keep this page open':'Opening your draft…';
  return <div className={s.root} data-qc-ui="v2" data-qc-free-document>
    <style>{DOCUMENT_CSS}</style>
    <div className={s.screen}>
      <a className={s.skip} href="#quote-workspace">Skip to quote editor</a>
      <header className={s.header}><div className={s.headerInner}>
        <a href="/" aria-label="QuoteCore+ home" className={s.brand}><img src="/marketing/brand/quotecore-logo-transparent.png" alt="QuoteCore+"/></a><span className={s.toolBadge}>Free tools</span>
        <div className={s.headerActions}><a href="/free-tools" className={s.backTools} aria-label="All free tools"><Icon name="back"/><span>All free tools</span></a>
          {account.signedIn?<><span className={s.accountEmail}>{account.email}</span><Button onClick={()=>void signOut()}>Sign out</Button></>:<Button onClick={()=>openAccount('signin')} disabled={!account.ready}>Sign in</Button>}
        </div>
      </div></header>
      <section className={s.intro} aria-labelledby="generator-title"><div className={s.introInner}>
        <div><p className={s.eyebrow}><span/> GENERATE A DOCUMENT</p><h1 id="generator-title">{config.title}</h1><p className={s.introCopy}>Your details. Your prices. A quote you’re proud to send.</p><div className={s.assurances}><span><Icon name="check"/>No signup needed</span><span><Icon name="file"/>Print or save as PDF</span></div></div>
        <div className={s.introActions}><Button icon="file" onClick={requestExample} disabled={!ready||generating}>Try an example</Button><button className={s.darkHelp} type="button" onClick={()=>setDialog('help')}><Icon name="help"/>How it works</button></div>
      </div></section>
      <div className={s.allowanceWrap}><AllowanceBar account={account} onDetails={()=>setDialog('allowances')} onUpgrade={()=>openAccount('allowance')}/></div>
      <main ref={main} id="quote-workspace" className={s.workspace}>
        <div className={s.workspaceToolbar}><div className={s.draftStatus}><Icon name={status==='unavailable'?'alert':'save'}/><span>{saveStatus}</span>{d.sample&&<span className={s.sampleTag}>Example</span>}</div><button type="button" className={s.textButton} onClick={()=>setDialog('reset')} disabled={!ready||generating}><Icon name="refresh"/>Start new</button></div>
        {notice&&<div className={s.statusMessage} role="status"><span>{notice}</span>{undo?<button id="undo-change" type="button" onClick={()=>{update(undo.draft);setNotice(`${undo.label} — undone.`);setUndo(null);}}>Undo</button>:<button type="button" aria-label="Dismiss update" onClick={()=>setNotice('')}><Icon name="close"/></button>}</div>}
        {!ready?<div className={s.loading}>Opening your quote editor…</div>:<>
          <div className={s.workspaceGrid}>
            <section className={s.editor} aria-label="Quote editor">
              <nav className={s.stepper} aria-label="Quote stages"><ol>{STAGES.map((name,i)=><li key={name}><button type="button" aria-current={step===i?'step':undefined} disabled={generating} onClick={()=>navigate(i as 0|1|2)}><span className={s.stepNumber}>{(i===0&&d.companyName&&d.clientName&&step>0)||(i===1&&rows.length&&step>1)?<Icon name="check"/>:`0${i+1}`}</span><span>{name}</span></button></li>)}</ol></nav>
              <div className={s.editorBody}>
                {step===0&&<div className={s.assistStarter}>
                  <div className={s.assistStarterHeading}><span className={s.assistIcon}><Icon name="message"/></span><div><h3>Start faster with Quote Assist.</h3><p>Describe the job or upload a quote photo. We’ll draft the details for you.</p></div><span className={s.optionalDark}>Optional</span></div>
                  <div className={s.assistStarterActions}><Button icon="message" onClick={()=>startAssist('text')}>Describe the job</Button><Button icon="upload" onClick={()=>startAssist('image')}>Upload a quote photo</Button></div>
                  <p className={s.assistReassurance}><Icon name="shield"/>You check everything before it’s added.</p>
                </div>}
                {step===0&&<div className={s.manualDivider}><span/>Or enter the details below<span/></div>}
                <div className={s.stepHeading}><p className={s.stepEyebrow}>STEP 0{step+1} / 03</p><h2 ref={heading} tabIndex={-1}>{step===0?'Who’s the quote for?':step===1?'What’s included in the job?':generated?'Your quote is ready.':'One last look. Then it’s ready.'}</h2><p>{step===0?'Start with the names. Add the extra details when you need them.':step===1?'Add each part of the job. We’ll calculate the totals as you go.':generated?'Print or save your PDF. Nothing is sent to your customer automatically.':'Check the document preview before you generate your quote.'}</p></div>
                {errors.length>0&&<div className={s.errorSummary} role="alert"><Icon name="alert"/><div><strong>Let’s check a couple of details.</strong><ul>{errors.map((e,i)=><li key={`${e.field}-${i}`}><button type="button" onClick={()=>navigate(e.step,e.field)}>{e.message}</button></li>)}</ul></div></div>}
                {step===0&&<DetailsEditor draft={d} change={change} errors={errors}/>}
                {step===1&&<button type="button" className={s.assistRecall} onClick={()=>startAssist('text')}><Icon name="message"/>Bring in more items with Quote Assist<Icon name="arrow"/></button>}
                {step===1&&<ItemsEditor draft={d} change={change} errors={errors} onAdd={addLine} onLine={editLine} onDuplicate={duplicateLine} onRemove={removeLine}/>}
                {step===2&&<>
                  <div className={s.reviewSummary}>
                    <div><span className={s.reviewIcon}><Icon name="user"/></span><div><small>PREPARED FOR</small><strong>{d.clientName||'Customer not specified'}</strong><p>From {d.companyName||d.fromName||'your business'}</p></div><IconButton name="edit" label="Edit quote details" onClick={()=>navigate(0)} disabled={generating}/></div>
                    <div><span className={s.reviewIcon}><Icon name="file"/></span><div><small>ITEMS & PRICING</small><strong>{rows.length} visible item{rows.length!==1?'s':''}{hiddenCount?` · ${hiddenCount} hidden`:''}</strong><p>{d.taxEnabled?`${d.taxName} at ${d.taxRate}%`:'No tax added'} · {d.currencyCode}</p></div><IconButton name="edit" label="Edit items and pricing" onClick={()=>navigate(1)} disabled={generating}/></div>
                    <div className={s.reviewTotal}><span>Quote total</span><strong data-testid="review-total">{money(totals.total,d.currencyCode)}</strong></div>
                  </div>
                  {!generated&&<Disclosure title="Document display options" subtitle="Control what your customer sees" icon="eye"><label className={s.checkbox}><input type="checkbox" checked={d.hideAllPrices} onChange={e=>change('hideAllPrices',e.target.checked)} disabled={generating}/><span><strong>Hide item prices</strong><small>Quantities and descriptions stay visible. Totals stay visible unless hidden below.</small></span></label><label className={s.checkbox}><input type="checkbox" checked={d.hideTotals} onChange={e=>change('hideTotals',e.target.checked)} disabled={generating}/><span><strong>Hide totals</strong><small>Your underlying calculation is unchanged.</small></span></label></Disclosure>}
                  {warnings.length>0&&!generated&&<div className={s.reviewWarnings}><strong><Icon name="eye"/>Before you send</strong><ul>{warnings.map(w=><li key={w}>{w}</li>)}</ul></div>}
                  {generated?<>
                    <div className={s.readyCard}><span className={s.readyCheck}><Icon name="check"/></span><h3>Ready for your customer.</h3><p>Choose “Save as PDF” in the print dialog, or send it straight to your printer.</p><Button variant="primary" icon="download" pending={printing} onClick={()=>void print()}>Print / Save PDF</Button>
                      {account.canRemoveBranding?<p className={s.brandingRemoved}><Icon name="check"/>No QuoteCore+ branding. Just your business.</p>:<><Button className={s.removeBranding} icon="spark" onClick={()=>openAccount('branding')}>Remove branding — free</Button><p className={s.readyHint}>Free verified account · 10 documents + 3 AI drafts / day</p></>}
                    </div>
                    <PaidAppDiscovery/>
                    <Disclosure title="Use these items in another free tool" subtitle="Invoice, purchase order or margin calculator" icon="external">
                      <p className={s.hint}>These actions transfer visible items using the existing tools. Recheck tax, totals and document settings in the destination. Your PDF keeps the options chosen here.</p>
                      {hiddenCount>0&&<label className={s.checkbox}><input type="checkbox" checked={handoffConfirmed} onChange={e=>setHandoffConfirmed(e.target.checked)}/><span>I understand that hidden items will not be transferred.</span></label>}
                      {!hiddenCount||handoffConfirmed?<div className={s.transferActions}><a className={s.transferLink} href={converted('/free-invoice-generator')}><Icon name="file"/>Convert to invoice<Icon name="arrow"/></a><a className={s.transferLink} href={converted('/free-purchase-order-generator')}><Icon name="file"/>Convert to purchase order<Icon name="arrow"/></a><a className={s.transferLink} href={converted('/free-margin-calculator')}><Icon name="settings"/>Check / add margin<Icon name="arrow"/></a></div>:null}
                    </Disclosure>
                  </>:<>
                    <div className={s.generateArea}><Button variant="primary" icon="check" pending={generating} onClick={()=>void generate()}>{generating?'Checking your allowance…':'Generate quote'}</Button><p>Nothing is sent to your customer.</p></div>
                    <p className={s.generateAllowance}><Icon name="file"/>{account.limits.docPerDay===null?'Included with your paid app account.':`Uses 1 of your ${account.limits.docPerDay} document generations per day.`}<button type="button" onClick={()=>setDialog('allowances')}>How limits work</button></p>
                  </>}
                  {requestError&&<div className={s.errorBox} role="alert"><p>{requestError}</p>{limitError&&!account.canRemoveBranding&&<Button onClick={()=>openAccount('allowance')}>Get 10 documents a day — free</Button>}{limitError&&account.canRemoveBranding&&<a className={s.transferLink} href="/takeoff-demo" target="_blank" rel="noopener noreferrer">Explore the paid app demo<Icon name="arrow"/></a>}</div>}
                </>}
              </div>
              <div className={s.editorFooter}><div>{step===0?<span className={s.footerHint}><Icon name="shield"/>You’re in control of every detail.</span>:<Button icon="back" variant="ghost" onClick={()=>navigate((step-1) as 0|1)} disabled={generating||printing}>Back</Button>}</div>
                {step<2?<Button variant="primary" onClick={()=>checkThen((step+1) as 1|2)}>{step===0?'Continue to items':'Review quote'}<Icon name="arrow"/></Button>:<Button icon="expand" onClick={()=>setDialog('preview')}>Full preview</Button>}
              </div>
            </section>
            <aside className={s.preview} aria-label="Live quote preview"><div className={s.previewTop}><div><span className={s.liveDot}/><strong>Live preview</strong><span className={s.previewTag}>{generated?'Generated':'Draft'}</span></div><IconButton name="expand" label="Open full document preview" onClick={()=>setDialog('preview')}/></div>
              <div className={s.paperStage}><ScaledPaper draft={d} guest={!account.canRemoveBranding} placeholders/></div><div className={s.previewBottom}><span><Icon name="lock"/>Only your document is exported.</span><button type="button" onClick={()=>setDialog('preview')}>Expand<Icon name="expand"/></button></div>
              <div className={s.previewTip}><Icon name={step===0?'edit':step===1?'settings':'check'}/><p>{step===0?'Watch your quote take shape as you add the details.':step===1?'The preview shows exactly which items and prices your customer will see.':'Check names, quantities and prices before sharing your PDF.'}</p></div>
            </aside>
          </div>
          <button type="button" className={s.mobilePreview} onClick={()=>setDialog('preview')}><Icon name="eye"/>Preview quote<span>{money(totals.total,d.currencyCode)}</span><Icon name="expand"/></button>
          <div className={s.localNote}><Icon name="lock"/><p>{status==='unavailable'?'Your browser is not saving this draft. Keep the tab open until you export.':'Your draft is saved in this browser tab, not in your account. Export your PDF before closing the tab. Signing up does not save the quote into the paid app.'}</p></div>
        </>}
      </main>
      {dialog==='assist'&&<DocumentAssist config={config} services={services} onClose={()=>setDialog(null)} onApply={applyAI} hasExisting={hasWork(d)} initial={assistInput} onInputState={setAssistInput} aiPerDay={account.limits.aiPerDay} onIncrease={!account.canRemoveBranding?()=>openAccount('allowance',true):undefined}/>}
      {dialog==='allowances'&&<AllowanceDialog account={account} onClose={()=>setDialog(null)} onUpgrade={()=>openAccount('allowance')}/>}
      {dialog==='account'&&<AccountDialog intent={authIntent} account={account} auth={auth} onClose={leaveAccount} prepare={prepareAuth} onVerified={()=>setNotice('Your confirmed account is ready. Updating your quote…')}/>}
      {dialog==='preview'&&<Dialog title="Your customer’s view." eyebrow={generated?'GENERATED QUOTE':'LIVE DOCUMENT PREVIEW'} onClose={()=>setDialog(null)} wide><p className={s.dialogIntro}>{generated?'Only this document is printed or saved as a PDF.':'This is a preview. Generate the quote when you’re ready to export.'}</p><ScaledPaper draft={d} guest={!account.canRemoveBranding}/></Dialog>}
      {dialog==='help'&&<Dialog title="From details to download." onClose={()=>setDialog(null)}><div className={s.helpSteps}><div><span>01</span><div><h3>Add the details</h3><p>Start with your business and customer names. Logos, contact details and extra information are optional.</p></div></div><div><span>02</span><div><h3>Price the work</h3><p>Add a description, quantity, unit and price for each item. Check tax and add terms where needed.</p></div></div><div><span>03</span><div><h3>Check and export</h3><p>Review your document, generate it, then print or save it as a PDF. Nothing is sent to your customer automatically.</p></div></div></div><Button variant="primary" onClick={()=>setDialog(null)}>Let’s make a quote<Icon name="arrow"/></Button></Dialog>}
      {(dialog==='reset'||dialog==='example')&&<Dialog title={dialog==='example'?'Try an example quote?':'Start a new quote?'} onClose={()=>setDialog(null)}><p className={s.dialogIntro}>{dialog==='example'?'This replaces the current form with clearly labelled sample details and prices. You can undo it until your next edit.':'This clears the current quote in this tab. You can undo it until your next edit. Export anything you need to keep first.'}</p><div className={s.dialogActions}><Button onClick={()=>setDialog(null)}>Keep editing</Button><Button variant="primary" onClick={()=>fresh(dialog==='example')}>{dialog==='example'?'Load example':'Start new quote'}</Button></div></Dialog>}
    </div>
    <div ref={paper} className={s.documentSource}><DocumentPaper draft={d} guest={!account.canRemoveBranding}/></div>
  </div>;
}
