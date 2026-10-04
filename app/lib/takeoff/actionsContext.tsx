/**
 * Takeoff actions context - the injection seam for running the REAL
 * takeoff workstation outside the authenticated app.
 *
 * Default: the app's real server actions + storage helpers - bit-for-bit
 * current behaviour. No provider mounted = real actions, exactly as before.
 *
 * Wrapped (free tool / MCP plugin): <TakeoffSessionProvider actions={...}>
 * swaps every persistence call for a session-state implementation while the
 * engine, canvas, calibration and touch flows stay identical.
 *
 * This exists so the free tool and the future MCP plugin run the SAME
 * workstation the app does, instead of forking it a fourth time.
 */

'use client';

import { createContext, useContext, type ReactNode } from 'react';
import * as realActions from '@/app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/actions';
import * as realUpload from '@/app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/uploadCanvasImage';
import {
  checkStorageQuota as realCheckStorageQuota,
  saveFileMetadata as realSaveFileMetadata,
} from '@/app/lib/files/storage-actions';
import { mintQuoteDocumentUploadUrl as realMintUploadUrl } from '@/app/lib/files/signed-upload';

/** Everything the workstation persists through, in one bundle. */
export type TakeoffActionsBundle = typeof realActions &
  typeof realUpload & {
    checkStorageQuota: typeof realCheckStorageQuota;
    saveFileMetadata: typeof realSaveFileMetadata;
    mintQuoteDocumentUploadUrl: typeof realMintUploadUrl;
    /** Storage upload used by the add-another-page flow. Real impl wraps
     *  the supabase browser client; sessions stub it. */
    uploadToStorageFromBlob: (input: {
      bucket: string;
      storagePath: string;
      token: string;
      file: File;
      contentType?: string;
    }) => Promise<{ ok: boolean; error?: string }>;
  };

async function realUploadToStorageFromBlob(input: {
  bucket: string;
  storagePath: string;
  token: string;
  file: File;
  contentType?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { createClient: createSupabaseBrowserClient } = await import('@/app/lib/supabase/client');
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage
    .from(input.bucket)
    .uploadToSignedUrl(input.storagePath, input.token, input.file, {
      contentType: input.contentType,
    });
  return error ? { ok: false, error: error.message } : { ok: true };
}

const realBundle: TakeoffActionsBundle = {
  ...realActions,
  ...realUpload,
  checkStorageQuota: realCheckStorageQuota,
  saveFileMetadata: realSaveFileMetadata,
  mintQuoteDocumentUploadUrl: realMintUploadUrl,
  uploadToStorageFromBlob: realUploadToStorageFromBlob,
};

const TakeoffActionsContext = createContext<TakeoffActionsBundle>(realBundle);

export function TakeoffSessionProvider({
  actions,
  children,
}: {
  actions: TakeoffActionsBundle;
  children: ReactNode;
}) {
  return <TakeoffActionsContext.Provider value={actions}>{children}</TakeoffActionsContext.Provider>;
}

export function useTakeoffActions(): TakeoffActionsBundle {
  return useContext(TakeoffActionsContext) ?? realBundle;
}
