'use client';

/**
 * SendDocumentModal — the unified modal shell.
 *
 * Renders the mode chooser, copy-URL, generate-email, and compose-send
 * views. All entity-specific behaviour is driven by ENTITY_CONFIG and
 * the useSendDocument hook.
 */

import type { SendDocumentProps } from './types';
import type { useSendDocument } from './useSendDocument';
import { AttachmentSendPicker } from '@/app/components/attachments/AttachmentSendPicker';

type Hook = ReturnType<typeof useSendDocument>;

export function SendDocumentModal(props: SendDocumentProps & { hook: Hook }) {
  const { hook, libraryFiles, entityFiles, libraryLocked } = props;
  const {
    config,
    open,
    setOpen,
    mode,
    setMode,
    sendStage,
    setSendStage,
    selectedTemplateId,
    emailSubject,
    setEmailSubject,
    emailBody,
    setEmailBody,
    recipientEmail,
    setRecipientEmail,
    handleTemplateChange,
    attachmentSelection,
    setAttachmentSelection,
    publicUrl,
    copied,
    emailCopied,
    handleCopyUrl,
    handleCopyEmail,
    sendError,
    sendSuccess,
    isSending,
    isPlanGated,
    openEmailOrSendMode,
    handleProceedToGate,
    handleSendNow,
    handleOpenFollowUps,
    handleConfirmFollowUpsAndSend,
    draftRules,
    addDraftRule,
    updateDraftRule,
    removeDraftRule,
    followUpSaving,
    followUpError,
    bodyHasExtraUrls,
    goCreateTemplate,
    emailTemplates,
  } = hook;

  if (!open) return null;

  const showAttachments = config.attachments !== 'none';
  const showQuoteFiles = config.attachments === 'library+entity';

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            {mode === 'choose' ? `Send ${config.noun} to ${config.recipientNoun}` :
             mode === 'url' ? `Copy ${config.noun} Link` :
             mode === 'send' ? 'Send from QuoteCore+' :
             'Generate Email'}
          </h3>
          <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>

        {/* ── Choose mode ── */}
        {mode === 'choose' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">How would you like to send this {config.noun.toLowerCase()}?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Send from QuoteCore+ */}
              {config.modes.includes('send') && (
                <button
                  onClick={() => openEmailOrSendMode('send')}
                  className="p-4 rounded-xl border-2 border-orange-300 bg-orange-50/50 hover:border-orange-400 hover:bg-orange-50 transition text-left space-y-2"
                >
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7Z" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900">Send from QuoteCore+</h4>
                  <p className="text-xs text-slate-500">Email the {config.recipientNoun} directly, branded as your company</p>
                </button>
              )}

              {/* Copy URL */}
              {config.modes.includes('url') && (
                <button
                  onClick={() => setMode('url')}
                  className="p-4 rounded-xl border-2 border-slate-200 hover:border-orange-300 hover:bg-orange-50/50 transition text-left space-y-2"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900">Copy URL Link</h4>
                  <p className="text-xs text-slate-500">Copy the {config.noun.toLowerCase()} link to paste anywhere</p>
                </button>
              )}

              {/* Generate Email */}
              {config.modes.includes('email') && (
                <button
                  onClick={() => openEmailOrSendMode('email')}
                  className="p-4 rounded-xl border-2 border-slate-200 hover:border-orange-300 hover:bg-orange-50/50 transition text-left space-y-2"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900">Generate Email</h4>
                  <p className="text-xs text-slate-500">
                    {emailTemplates.length > 0
                      ? 'Use a template, copy to your own email client'
                      : 'Generate email text to paste into your client'}
                  </p>
                </button>
              )}

              {/* Create template */}
              {config.modes.includes('create-template') && (
                <button
                  onClick={goCreateTemplate}
                  className="p-4 rounded-xl border-2 border-slate-200 hover:border-orange-300 hover:bg-orange-50/50 transition text-left space-y-2"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900">Create template</h4>
                  <p className="text-xs text-slate-500">Build a reusable {config.noun.toLowerCase()} email template</p>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── URL mode ── */}
        {mode === 'url' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Paste this link in a message or email. The {config.recipientNoun} can view the {config.noun.toLowerCase()} and respond.
            </p>
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <input
                type="text"
                readOnly
                value={publicUrl ?? ''}
                className="flex-1 text-sm text-slate-700 bg-transparent border-none outline-none truncate"
              />
              <button
                onClick={handleCopyUrl}
                disabled={!publicUrl}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                  copied
                    ? 'bg-emerald-500 text-white'
                    : 'bg-black text-white hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]'
                } disabled:opacity-50`}
              >
                {copied ? '✓ Copied!' : 'Copy URL'}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Note: anyone with this link can view the {config.noun.toLowerCase()}. Share only with the intended {config.recipientNoun}.
            </p>
            <button onClick={() => setMode('choose')} className="text-sm text-slate-500 hover:text-slate-700">
              ← Back to options
            </button>
          </div>
        )}

        {/* ── Email mode ── */}
        {mode === 'email' && (
          <div className="space-y-3">
            {emailTemplates.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Template</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                >
                  <option value="">- Select template -</option>
                  {emailTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' (Default)' : ''}</option>
                  ))}
                </select>
              </div>
            )}
            {emailTemplates.length === 0 && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-500">No message templates yet. A basic email has been generated.</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Body</label>
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={12}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none ${
                  bodyHasExtraUrls ? 'border-amber-400' : 'border-slate-300 focus:border-orange-500'
                }`}
              />
              {bodyHasExtraUrls && (
                <p className="mt-1 text-xs text-amber-700">⚠ Multiple URLs may trigger spam filters. Remove extras.</p>
              )}
            </div>
            <div className="flex items-center justify-between pt-1">
              <button onClick={() => setMode('choose')} className="text-sm text-slate-500 hover:text-slate-700">
                ← Back to options
              </button>
              <button
                onClick={handleCopyEmail}
                className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
                  emailCopied
                    ? 'bg-emerald-500 text-white'
                    : 'bg-black text-white hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]'
                }`}
              >
                {emailCopied ? '✓ Copied!' : 'Copy Email'}
              </button>
            </div>
          </div>
        )}

        {/* ── Send mode ── */}
        {mode === 'send' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              We&apos;ll email the {config.recipientNoun} directly from QuoteCore+, branded as your company.
            </p>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Recipient email</label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder={`${config.recipientNoun}@example.com`}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
              />
            </div>

            {emailTemplates.length > 0 ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Message Template</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                >
                  <option value="">- None (custom message) -</option>
                  {emailTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' (Default)' : ''}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-500">
                  No message templates yet. Type a custom message below or{' '}
                  <button onClick={goCreateTemplate} className="underline text-slate-700 font-medium">create a template</button>.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={10}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none ${
                  bodyHasExtraUrls ? 'border-amber-400' : 'border-slate-300 focus:border-orange-500'
                }`}
              />
              {bodyHasExtraUrls ? (
                <p className="mt-1 text-xs text-amber-700">⚠ Multiple URLs may trigger spam filters.</p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">
                  A &ldquo;View {config.noun}&rdquo; button is included automatically below your message.
                </p>
              )}
            </div>

            {/* Attachments */}
            {showAttachments && (
              <AttachmentSendPicker
                libraryFiles={libraryFiles}
                quoteFiles={showQuoteFiles ? entityFiles : []}
                selection={attachmentSelection}
                onChange={setAttachmentSelection}
                libraryLocked={libraryLocked}
              />
            )}

            {/* Errors / success */}
            {sendError && (
              <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">{sendError}</p>
            )}
            {sendSuccess === 'sent' && (
              <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                {config.noun} sent!
              </p>
            )}
            {sendSuccess === 'suppressed' && (
              <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">
                This recipient is on your suppression list. The send was blocked.
              </p>
            )}

            {/* PRE-SEND GATE */}
            {sendStage === 'gate' && sendSuccess !== 'sent' && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                <p className="text-sm font-medium text-slate-900">Before we send - do you want follow-ups?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleSendNow}
                    disabled={isSending}
                    className="p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-orange-300 hover:bg-orange-50/40 transition text-left space-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900">{isSending ? 'Sending…' : 'Send now'}</h4>
                    <p className="text-xs text-slate-500">No follow-ups needed</p>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenFollowUps}
                    disabled={isSending || !props.canFollowups}
                    title={props.canFollowups ? 'Then send' : 'Automated follow-ups are not included in your current plan'}
                    className="p-4 rounded-xl border-2 border-orange-300 bg-orange-50/50 hover:border-orange-400 hover:bg-orange-50 transition text-left space-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#FF6B35] flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900">Add Follow-ups</h4>
                    <p className="text-xs text-slate-500">{props.canFollowups ? 'Then send' : 'Pro plan feature'}</p>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setSendStage('form')}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  ← Back to message
                </button>
              </div>
            )}

            {/* FOLLOW-UP BUILDER */}
            {sendStage === 'followups' && sendSuccess !== 'sent' && (
              <FollowUpBuilder
                hook={hook}
                props={props}
              />
            )}

            {/* Compose footer */}
            {sendStage === 'form' && (
              <div className="flex items-center justify-between pt-1">
                <button onClick={() => setMode('choose')} className="text-sm text-slate-500 hover:text-slate-700">
                  ← Back to options
                </button>
                {sendSuccess !== 'sent' ? (
                  <button
                    onClick={handleProceedToGate}
                    disabled={isSending || isPlanGated}
                    className="px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    onClick={() => setOpen(false)}
                    className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50"
                  >
                    Close
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {mode !== 'choose' && (
          <div className="flex justify-end">
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Follow-up builder (inline for now, can extract later) ───
function FollowUpBuilder({ hook, props }: { hook: Hook; props: SendDocumentProps }) {
  const {
    config,
    draftRules,
    addDraftRule,
    updateDraftRule,
    removeDraftRule,
    followUpSaving,
    isSending,
    followUpError,
    handleConfirmFollowUpsAndSend,
    setSendStage,
    emailTemplates,
  } = hook;

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-900">Add follow-ups</p>
        <span className="text-xs text-slate-500">{draftRules.length} / 3</span>
      </div>

      {emailTemplates.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">You have no message templates yet - follow-ups need one.</p>
          <button onClick={hook.goCreateTemplate} className="mt-2 text-xs font-medium text-orange-600 hover:text-orange-700 underline">
            Create your first follow-up template
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {config.followUps.supportsTriggered && (
              <button
                type="button"
                onClick={() => addDraftRule('triggered')}
                disabled={draftRules.length >= 3}
                className="px-3 py-1.5 text-xs font-semibold rounded-full bg-black text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + Triggered follow-up
              </button>
            )}
            <button
              type="button"
              onClick={() => addDraftRule('time_based')}
              disabled={draftRules.length >= 3}
              className="px-3 py-1.5 text-xs font-semibold rounded-full bg-black text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + {config.followUps.timeBasedLabel}
            </button>
          </div>

          {draftRules.length === 0 ? (
            <p className="text-[11px] text-slate-500">
              Add a follow-up above. You can add up to 3.
            </p>
          ) : null}

          {draftRules.map((rule) => {
            const isErr = rule.result && !rule.result.ok;
            const isOk = rule.result?.ok === true;
            const triggerOpt = config.followUps.triggerOptions.find((t) => t.value === rule.trigger);
            const description = rule.kind === 'time_based'
              ? config.followUps.timeBasedDescription
              : triggerOpt?.description ?? '';

            return (
              <div
                key={rule.id}
                className={`rounded-xl border p-3 space-y-2 ${
                  isOk ? 'border-emerald-200 bg-emerald-50' : isErr ? 'border-rose-200 bg-rose-50/60' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <select
                    value={rule.trigger}
                    onChange={(e) => updateDraftRule(rule.id, { trigger: e.target.value })}
                    className="text-xs font-semibold text-slate-900 border border-slate-300 rounded-lg px-2 py-1 bg-white"
                  >
                    {rule.kind === 'time_based' ? (
                      <option value={`${props.entityKind}_sent`}>{config.followUps.timeBasedLabel}</option>
                    ) : (
                      config.followUps.triggerOptions.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeDraftRule(rule.id)}
                    className="text-slate-400 hover:text-rose-600 text-sm leading-none p-1"
                    aria-label="Remove follow-up"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] text-slate-500">{description}</p>

                  {(rule.kind === 'time_based' || rule.addDelay) && (
                    <div className="flex items-end gap-2">
                      <div className="w-24">
                        <label className="block text-[10px] font-medium text-slate-500 mb-0.5"># days</label>
                        <input
                          type="number" min={0} max={365}
                          value={rule.delayDays}
                          onChange={(e) => updateDraftRule(rule.id, { delayDays: Math.max(0, Math.min(365, Number(e.target.value) || 0)) })}
                          className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
                        />
                      </div>
                      <div className="w-24">
                        <label className="block text-[10px] font-medium text-slate-500 mb-0.5"># hours</label>
                        <input
                          type="number" min={0} max={23}
                          value={rule.delayHours}
                          onChange={(e) => updateDraftRule(rule.id, { delayHours: Math.max(0, Math.min(23, Number(e.target.value) || 0)) })}
                          className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
                        />
                      </div>
                      <div className="w-24">
                        <label className="block text-[10px] font-medium text-slate-500 mb-0.5"># minutes</label>
                        <input
                          type="number" min={0} max={59}
                          value={rule.delayMinutes}
                          onChange={(e) => updateDraftRule(rule.id, { delayMinutes: Math.max(0, Math.min(59, Number(e.target.value) || 0)) })}
                          className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
                        />
                      </div>
                    </div>
                  )}

                  {rule.kind === 'triggered' && (
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <input
                        type="checkbox"
                        checked={rule.addDelay}
                        onChange={(e) => updateDraftRule(rule.id, { addDelay: e.target.checked })}
                        className="rounded"
                      />
                      Add delay before sending
                    </label>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Template</label>
                  <select
                    value={rule.templateId}
                    onChange={(e) => updateDraftRule(rule.id, { templateId: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
                  >
                    {emailTemplates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' (Default)' : ''}</option>
                    ))}
                  </select>
                </div>

                {isOk ? <p className="text-[10px] text-emerald-700">Scheduled ✓</p> : null}
                {isErr ? <p className="text-[11px] text-rose-700">{(rule.result as { ok: false; error: string }).error}</p> : null}
              </div>
            );
          })}
        </>
      )}

      {followUpError ? (
        <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">{followUpError}</p>
      ) : null}

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => setSendStage('gate')}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleConfirmFollowUpsAndSend}
          disabled={followUpSaving || isSending || emailTemplates.length === 0 || draftRules.length === 0}
          className="px-4 py-2 text-sm font-medium rounded-full bg-[#FF6B35] text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
        >
          {followUpSaving || isSending ? 'Saving & sending…' : 'Save follow-ups & send'}
        </button>
      </div>
    </div>
  );
}
