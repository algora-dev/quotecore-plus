'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertModal } from '../../AlertModal';
import { ConfirmModal } from '../../ConfirmModal';

type FeedbackOptions = { title: string; description: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean };
type Request = FeedbackOptions & { kind: 'alert' | 'confirm'; resolve: (accepted: boolean) => void };

/** Awaitable feedback preserves the pause formerly provided by native dialogs.
 * Only UI acknowledgements live here; no mutation, validation or pricing is added.
 */
export function useQcFeedback() {
  const queue = useRef<Request[]>([]);
  const [request, setRequest] = useState<Request | null>(null);
  const enqueue = useCallback((kind: Request['kind'], options: FeedbackOptions) => new Promise<boolean>(resolve => {
    const next = { ...options, kind, resolve };
    queue.current.push(next);
    if (queue.current.length === 1) setRequest(next);
  }), []);
  const notify = useCallback(async (description: string, title = 'Please check this action') => {
    await enqueue('alert', { title, description, confirmLabel: 'OK' });
  }, [enqueue]);
  const ask = useCallback((options: FeedbackOptions) => enqueue('confirm', options), [enqueue]);
  const settle = useCallback((accepted: boolean) => {
    const current = queue.current.shift();
    setRequest(queue.current[0] ?? null);
    current?.resolve(accepted);
  }, []);
  useEffect(() => () => {
    // Do not leave waiting UI tasks behind after the owning page unmounts.
    queue.current.splice(0).forEach(item => item.resolve(false));
  }, []);

  const feedback = request?.kind === 'confirm' ? (
    <ConfirmModal appearance="v2" open title={request.title} description={request.description}
      confirmLabel={request.confirmLabel ?? 'Continue'} cancelLabel={request.cancelLabel ?? 'Cancel'}
      destructive={request.destructive ?? false} onCancel={() => settle(false)} onConfirm={() => settle(true)} />
  ) : (
    <AlertModal appearance="v2" open={request !== null} title={request?.title ?? ''}
      description={request?.description} confirmLabel={request?.confirmLabel} onClose={() => settle(true)} />
  );
  return { notify, ask, feedback, feedbackOpen: request !== null };
}
