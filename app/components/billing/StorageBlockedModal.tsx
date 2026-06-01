'use client';

import { UpgradeModal } from '@/app/components/UpgradeModal';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Shown when a user tries to start a FILE upload while their company is over
 * its storage limit ("red"). Thin wrapper over UpgradeModal with fixed
 * storage copy so every upload portal surfaces the same message + CTA.
 *
 * Usage in any upload portal (client component):
 *
 *   const ent = ...;            // entitlementsForClient snapshot (has isOverStorage)
 *   const [storageBlocked, setStorageBlocked] = useState(false);
 *
 *   function handleUploadClick() {
 *     if (ent.isOverStorage) { setStorageBlocked(true); return; }
 *     // ...proceed with the normal upload flow
 *   }
 *
 *   <StorageBlockedModal open={storageBlocked} onClose={() => setStorageBlocked(false)} />
 *
 * The CTA routes to /<slug>/account?tab=billing so the user can free space
 * (delete files/quotes) or upgrade. Non-file actions are NOT gated by this.
 */
export function StorageBlockedModal({ open, onClose }: Props) {
  return (
    <UpgradeModal
      open={open}
      onClose={onClose}
      title="Storage limit reached"
      description={
        'You\u2019re over your storage limit, so new file uploads are paused. ' +
        'Delete files or quotes to free up space, or upgrade your plan to keep uploading.'
      }
      ctaLabel="Manage storage"
      closeLabel="Close"
    />
  );
}
