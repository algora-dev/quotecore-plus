'use client';

import Link from 'next/link';
import type { AttachmentRow } from './actions';
import { AttachmentList } from './attachment-list';

interface Props {
  workspaceSlug: string;
  attachments: AttachmentRow[];
  entitlements: {
    attachmentsEnabled: boolean;
    attachmentLimit: number | null;
    attachmentCount: number;
    effectivePlanCode: string;
    isOverStorage?: boolean;
  };
}

export function AttachmentsTab({ workspaceSlug, attachments, entitlements }: Props) {
  const { attachmentsEnabled, attachmentLimit, attachmentCount, isOverStorage } = entitlements;

  if (!attachmentsEnabled) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-slate-500">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
            />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-700 mb-1">Attachment library is available on Pro and above</p>
        <p className="text-xs text-slate-400 mb-4">
          Upload files once and reuse them across your quotes and templates.
        </p>
        <Link
          href={`/${workspaceSlug}/account/billing`}
          className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
        >
          Upgrade plan
        </Link>
      </div>
    );
  }

  const capLabel = attachmentLimit === null ? 'Unlimited' : attachmentLimit;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Reusable files for your quotes and templates.
        <span className="ml-1 text-slate-400">
          {attachmentCount} of {capLabel} used.
        </span>
      </p>
      <AttachmentList attachments={attachments} isOverStorage={isOverStorage} />
    </div>
  );
}
