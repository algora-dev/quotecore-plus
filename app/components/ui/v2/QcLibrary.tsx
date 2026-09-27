'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';
import { QcJourney } from './QcJourney';
import { QcIcon } from './QcIcon';
import './qc-library.css';

/** C64. Opt-in library/template presentation; consumers own data and actions.
 * Never put protected canvases or recipient document renderers inside this scope.
 */
export function QcLibrary({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <QcJourney {...props} className={`qc-library ${className}`} data-qc-library="C64">{children}</QcJourney>;
}

export function QcLibraryError({ title = 'Unable to load this section', children, onRetry }: {
  title?: string; children: ReactNode; onRetry?: () => void;
}) {
  return <div className="qc-library-error" role="alert"><strong>{title}</strong><p>{children}</p>
    {onRetry && <button type="button" className="qc-button qc-flow-control" onClick={onRetry}>Try again</button>}
  </div>;
}

export function QcLibraryEmpty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="qc-flow-empty"><h2 className="qc-flow-section-title">{title}</h2>
    {children && <p className="qc-flow-description qc-library-empty-copy">{children}</p>}{action}
  </div>;
}

/** Two destinations, not two stores. Existing type-specific template owners remain separate. */
export function QcTemplateNav({ workspaceSlug, current }: { workspaceSlug: string; current: 'documents' | 'messages' }) {
  return <nav className="qc-library-destinations" aria-label="Template libraries">
    <Link href={`/${workspaceSlug}/resources/document-templates`} aria-current={current === 'documents' ? 'page' : undefined}
      className="qc-library-destination"><QcIcon name="file" /><span>Document templates</span></Link>
    <Link href={`/${workspaceSlug}/resources/message-templates`} aria-current={current === 'messages' ? 'page' : undefined}
      className="qc-library-destination"><QcIcon name="mail" /><span>Message templates</span></Link>
  </nav>;
}
