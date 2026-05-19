/**
 * Shared types for the signed-upload-URL flow.
 *
 * Why this file exists separately from `signed-upload.ts`:
 * `signed-upload.ts` is marked `'use server'` which means under Next 16 /
 * React 19 the module is only allowed to export async functions (server
 * actions). Exporting an `interface` or `type` from a `'use server'`
 * module triggers a runtime Server-Component-render error when the module
 * gets re-imported through a client-component boundary \u2014 even if the
 * build passes statically. Splitting the types out keeps the action file
 * to async-only exports.
 *
 * Anything that needs the types (the action implementation, client
 * components, regression scripts) imports from here.
 */

import type { BUCKETS } from '@/app/lib/storage/buckets';

export interface MintUploadInput {
  /**
   * Where the upload is going. `_pending` is the pre-quote-creation
   * staging area; `{quoteId}` is for in-quote uploads (FilesManager etc).
   */
  scope:
    | { kind: 'pending' }
    | { kind: 'quote'; quoteId: string };
  /** Original filename. Used only to derive an extension; not trusted otherwise. */
  filename: string;
  /** Browser-claimed content type. Validated against an allowlist. */
  contentType: string;
  /** Browser-claimed byte size. Pre-flight only; finaliser re-reads real size. */
  claimedSize: number;
}

export type MintUploadResult =
  | {
      ok: true;
      bucket: typeof BUCKETS.QUOTE_DOCUMENTS;
      /** Path the client should pass to `uploadToSignedUrl`. */
      storagePath: string;
      /** Signed upload URL from Supabase Storage. */
      signedUrl: string;
      /** Token paired with the path (Supabase native). */
      token: string;
    }
  | {
      ok: false;
      code:
        | 'unauthenticated'
        | 'invalid_input'
        | 'unsupported_type'
        | 'too_large'
        | 'storage_quota_exceeded'
        | 'subscription_inactive'
        | 'mint_failed';
      message: string;
    };
