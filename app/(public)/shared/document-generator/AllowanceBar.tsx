'use client';
import type { DocumentAccount } from './document-account';
import { TIER_LIMITS, dailyDocumentLabel } from './document-account';
import { Button, Dialog } from './ui';
import { Icon } from './Icon';
import s from './DocumentGenerator.module.css';
export function AllowanceBar({account,onDetails,onUpgrade}:{account:DocumentAccount;onDetails:()=>void;onUpgrade:()=>void}) {
  const {limits}=account;
  return <div className={s.allowanceBar} aria-label="Your daily free-tool limits">
    <div className={s.allowanceSummary}>
      <span className={s.allowanceLabel}>{account.canRemoveBranding?(account.hasPaidAppAccess?'Paid app account':'Free account'):'Free to use'}</span>
      {!account.ready?<span>Checking your account…</span>:account.error?<button type="button" className={s.textButton} onClick={()=>void account.refresh()}>Account check unavailable · Retry</button>:<button type="button" className={s.allowanceNumbers} onClick={onDetails} aria-label="View daily allowances and how they work"><span><Icon name="file"/>{dailyDocumentLabel(limits.docPerDay)}</span><span><Icon name="spark"/>{limits.aiPerDay} AI draft{limits.aiPerDay===1?'':'s'} / day</span><Icon name="help"/></button>}
    </div>
    <button type="button" className={s.allowanceUpgrade} onClick={account.canRemoveBranding?onDetails:onUpgrade}>{account.canRemoveBranding?'No QuoteCore+ branding':'Increase limits & remove branding'}<Icon name={account.canRemoveBranding?'check':'arrow'}/></button>
  </div>;
}
export function AllowanceDialog({account,onClose,onUpgrade}:{account:DocumentAccount;onClose:()=>void;onUpgrade:()=>void}) {
  return <Dialog title="A little more room to work." eyebrow="FREE-TOOL ALLOWANCES" onClose={onClose} tone="focus">
    <p className={s.dialogIntro}>Start without an account. A free account gives you more uses and removes QuoteCore+ branding.</p>
    <div className={s.allowanceComparison}><div><span>WITHOUT AN ACCOUNT</span><strong>{TIER_LIMITS[1].docPerDay} documents</strong><p>{TIER_LIMITS[1].aiPerDay} AI draft per day</p><small>QuoteCore+ branding included</small></div><div><span>FREE VERIFIED ACCOUNT</span><strong>{TIER_LIMITS[2].docPerDay} documents</strong><p>{TIER_LIMITS[2].aiPerDay} AI drafts per day</p><small><Icon name="check"/>No QuoteCore+ branding</small></div></div>
    <div className={s.allowanceFacts}><p><strong>One shared allowance.</strong> Quotes, invoices and purchase orders share the document limit. Typed and photo-based Quote Assist requests share the AI limit.</p><p><strong>Editing is free.</strong> Only generating a document or requesting an AI extraction uses an allowance. Reprinting this generated quote or removing its branding does not use another document allowance.</p><p><strong>24-hour windows.</strong> The server controls resets; they are not necessarily at midnight. Guest use is measured by network/IP, so people on the same network can share a limit. Signed-in use follows your account.</p><p>An AI request can count even if you choose not to apply its result, or the response is lost. Check extracted quantities and prices before using them.</p></div>
    {!account.canRemoveBranding?<Button variant="primary" icon="user" onClick={onUpgrade}>Create a free account</Button>:<p className={s.notice}><Icon name="check"/>{account.hasPaidAppAccess?'Your active paid app account has higher allowances.':'You already have the free-account benefits.'}</p>}
  </Dialog>;
}
