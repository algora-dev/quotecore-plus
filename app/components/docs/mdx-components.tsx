import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Custom MDX components used inside docs pages.
 *
 * Keeping these tightly scoped: a Callout for tips/warnings/notes, a
 * ComingSoon banner for unfinished features, a Steps wrapper for numbered
 * walkthroughs, and a Field row for form-field reference tables. Plus typography
 * defaults so a plain markdown page still looks like a real doc page.
 */

interface CalloutProps {
  type?: 'tip' | 'warning' | 'note';
  children: ReactNode;
}

export function Callout({ type = 'note', children }: CalloutProps) {
  const styles: Record<string, { wrap: string; label: string; pill: string }> = {
    tip:     { wrap: 'border-emerald-200 bg-emerald-50',   label: 'Tip',     pill: 'bg-emerald-600 text-white' },
    warning: { wrap: 'border-amber-200 bg-amber-50',       label: 'Heads up', pill: 'bg-amber-600 text-white' },
    note:    { wrap: 'border-slate-200 bg-slate-50',       label: 'Note',    pill: 'bg-slate-700 text-white' },
  };
  const s = styles[type] ?? styles.note;
  return (
    <aside className={`my-6 rounded-lg border ${s.wrap} p-4`}>
      <div className={`mb-2 inline-block rounded-full ${s.pill} px-2 py-0.5 text-xs font-semibold`}>{s.label}</div>
      <div className="callout-body">
        {children}
      </div>
    </aside>
  );
}

export function ComingSoon() {
  return (
    <div className="my-6 flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4">
      <span className="inline-block rounded-full bg-orange-600 px-2 py-0.5 text-xs font-semibold text-white">Coming soon</span>
      <span className="text-sm text-orange-900">
        This feature is on the roadmap. The doc is here so you know what's coming and what to expect.
      </span>
    </div>
  );
}

export function Steps({ children }: { children: ReactNode }) {
  // Wrapper used for stylistic grouping; numbered list inside still does the
  // heavy lifting via the standard <ol>.
  return <div className="my-6">{children}</div>;
}

interface FieldProps {
  name: string;
  required?: boolean;
  type?: string;
  children: ReactNode;
}

export function Field({ name, required, type, children }: FieldProps) {
  return (
    <div className="my-3 rounded-md border border-slate-200 bg-white p-3">
      <div className="mb-1 flex items-center gap-2">
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm font-mono text-slate-800">{name}</code>
        {type ? <span className="text-xs text-slate-500">{type}</span> : null}
        {required ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">required</span> : null}
      </div>
      <div className="text-sm text-slate-700">{children}</div>
    </div>
  );
}

/**
 * Map of MDX components. Pass to compileMDX so authors can use these in .mdx
 * without imports. We also override the default heading and link rendering so
 * pages get consistent typography and internal /docs links use Next's router.
 */
export const mdxComponents = {
  Callout,
  ComingSoon,
  Steps,
  Field,
  a: (props: any) => {
    const href = props.href ?? '';
    if (href.startsWith('/') || href.startsWith('#')) {
      return <Link {...props} href={href} />;
    }
    return <a {...props} target="_blank" rel="noreferrer" />;
  },
};
