/**
 * Shared client-side types for the unified send-document modal.
 */

export type EntityKind = 'quote' | 'order' | 'invoice';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  is_default: boolean | null;
  attachment_id?: string | null;
}

export type MergeData = Record<string, string>;

export interface PickerFile {
  id: string;
  name: string;
  fileSize: number;
}

export interface SendDocumentProps {
  entityKind: EntityKind;
  entityId: string;
  workspaceSlug: string;
  emailTemplates: EmailTemplate[];
  mergeData: MergeData;
  defaultRecipientEmail?: string | null;
  defaultRecipientName?: string | null;
  canFollowups: boolean;
  canEmail: boolean;
  sendTestTipSeen: boolean;
  libraryFiles: PickerFile[];
  entityFiles: PickerFile[];
  libraryLocked: boolean;
  existingToken?: string | null;
  existingExpiresAt?: string | null;
  showMarginWarning?: boolean;
  hidden?: boolean;
  /** Quotes only: false when no customer quote lines exist yet.
   *  Gates the send button with a "build customer quote first" modal. */
  hasCustomerQuote?: boolean;
}
