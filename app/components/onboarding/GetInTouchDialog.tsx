'use client';

import { QcDialog } from '@/app/components/ui/v2/QcDialog';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { dfyHref, dfyBookHref, contactHref } from '@/app/lib/onboarding/constants';
import { trackEvent } from '@/lib/analytics';

/** Heroicons outline 24x24 (design rule: fill none, stroke currentColor, 2). */
const CHAT_ICON = (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} width={24} height={24} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
  </svg>
);
const CALENDAR_ICON = (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} width={24} height={24} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
  </svg>
);
const WRENCH_ICON = (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} width={24} height={24} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
  </svg>
);

type Option = {
  id: 'message' | 'book_call' | 'dfy';
  title: string;
  sub: string;
  href: string;
  icon: typeof CHAT_ICON;
};

function optionsFor(source: string): Option[] {
  return [
    {
      id: 'message',
      title: 'Send us a message',
      sub: 'A quick question or something not working — we reply fast.',
      href: contactHref(`${source}_message`),
      icon: CHAT_ICON,
    },
    {
      id: 'book_call',
      title: 'Book a call with Shaun',
      sub: '25 minutes, no obligation. We work out what you need.',
      href: dfyBookHref(`${source}_book_call`),
      icon: CALENDAR_ICON,
    },
    {
      id: 'dfy',
      title: 'Done For You setup',
      sub: 'Send us how you work; we set your pricing and quoting up for you.',
      href: dfyHref(`${source}_dfy`),
      icon: WRENCH_ICON,
    },
  ];
}

/**
 * The one get-in-touch surface for the onboarding flow (owner 2026-11-13):
 * three ways to reach a human. Links open in a new tab so whatever the user
 * was doing in the app survives.
 */
export function GetInTouchDialog({
  open,
  source,
  onRequestClose,
}: {
  open: boolean;
  source: string;
  onRequestClose: () => void;
}) {
  const options = optionsFor(source);
  return (
    <QcDialog
      open={open}
      size="md"
      title="Get in touch"
      description="However suits you:"
      onRequestClose={onRequestClose}
      footer={<QcButton onClick={onRequestClose}>Close</QcButton>}
    >
      <div className="space-y-2.5">
        {options.map((option) => (
          <a
            key={option.id}
            href={option.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent('onboarding_get_in_touch', { option: option.id, source })}
            className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 no-underline transition hover:border-orange-300 hover:bg-orange-50/40"
          >
            <span className="mt-0.5 shrink-0 text-slate-700">{option.icon}</span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">{option.title}</span>
              <span className="block text-xs text-slate-600">{option.sub}</span>
            </span>
          </a>
        ))}
      </div>
    </QcDialog>
  );
}
