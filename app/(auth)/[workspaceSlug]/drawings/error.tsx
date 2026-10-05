'use client';

import { BackButton } from '@/app/components/BackButton';
import { QcLibrary, QcLibraryError } from '@/app/components/ui/v2/QcLibrary';

/** Route recovery only. A failed load must not look like an empty library. */
export default function DrawingsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <QcLibrary className="space-y-5">
    <BackButton />
    <h1 className="qc-library-title">Drawings / Images</h1>
    <QcLibraryError title="This drawing workspace could not be loaded" onRetry={reset}>
      Try loading it again. If you were editing, check the last saved drawing before continuing.
    </QcLibraryError>
  </QcLibrary>;
}
