'use client';

import { useState } from 'react';
import { FollowUpBuilder } from './FollowUpBuilder';

/**
 * "Schedule follow-up" pill for the order / invoice Activity card header.
 * Opens a modal hosting the SHARED FollowUpBuilder — the same rule-builder
 * UI the user met at send time — so scheduling from the Activity area
 * feels familiar/identical. Replaces the earlier one-rule-at-a-time
 * EntityScheduleFollowUpButton.
 */

interface Props {
  kind: 'quote' | 'order' | 'invoice';
  entityId: string;
  emailTemplates: { id: string; name: string; subject: string; is_default?: boolean | null }[];
  defaultRecipientEmail: string | null;
  defaultRecipientName: string | null;
}

export function FollowUpBuilderButton({
  kind,
  entityId,
  emailTemplates,
  defaultRecipientEmail,
  defaultRecipientName,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Schedule follow-up
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Schedule follow-ups</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4">
              <FollowUpBuilder
                kind={kind}
                entityId={entityId}
                emailTemplates={emailTemplates}
                defaultRecipientEmail={defaultRecipientEmail}
                defaultRecipientName={defaultRecipientName}
                onDone={() => setOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
