/**
 * Per-entity client configuration for the unified send-document modal.
 *
 * Everything conditional keys off one config object instead of forked components.
 */

import type { EntityKind } from './types';

export interface TriggerOption {
  value: string;
  label: string;
  description: string;
}

export interface EntityClientConfig {
  kind: EntityKind;
  noun: string; // 'Quote' | 'Order' | 'Invoice'
  recipientNoun: string; // 'customer' | 'supplier' | 'customer'
  publicPathPrefix: '/accept' | '/orders' | '/invoice';
  ctaHint: string;
  modes: Array<'send' | 'url' | 'email' | 'create-template'>;
  tokenStrategy: 'expiring-commit' | 'idempotent-generate' | 'static';
  expiryOptions?: number[];
  followUps: {
    supportsTriggered: boolean;
    triggerOptions: TriggerOption[];
    timeBasedLabel: string;
    timeBasedDescription: string;
  };
  attachments: 'library+entity' | 'library-only' | 'none';
  templateKind: 'quote_send' | 'order_send' | 'invoice_send';
  sendButtonLabel: string;
  sendButtonDataCopilot: string;
}

export const ENTITY_CONFIG: Record<EntityKind, EntityClientConfig> = {
  quote: {
    kind: 'quote',
    noun: 'Quote',
    recipientNoun: 'customer',
    publicPathPrefix: '/accept',
    ctaHint: 'The recipient sees a "Respond now" button to accept or decline.',
    modes: ['send', 'url', 'email', 'create-template'],
    tokenStrategy: 'expiring-commit',
    expiryOptions: [7, 14, 30, 60, 90, 180, 365],
    followUps: {
      supportsTriggered: true,
      triggerOptions: [
        { value: 'quote_accepted', label: 'On Accept', description: 'Sends when the customer accepts the quote.' },
        { value: 'quote_declined', label: 'On Decline', description: 'Sends when the customer declines the quote.' },
        { value: 'quote_revision_requested', label: 'On Revision Request', description: 'Sends when the customer requests a revision.' },
        { value: 'quote_viewed', label: 'On Read', description: 'Starts counting once the customer opens the quote. Auto-cancels if they accept/decline.' },
      ],
      timeBasedLabel: 'Time-based follow-up',
      timeBasedDescription: 'Chases the customer if they haven\'t responded. Auto-cancels when they accept, decline, or request a revision. Respects quiet hours.',
    },
    attachments: 'library+entity',
    templateKind: 'quote_send',
    sendButtonLabel: 'Send Quote',
    sendButtonDataCopilot: 'send-quote',
  },
  order: {
    kind: 'order',
    noun: 'Order',
    recipientNoun: 'supplier',
    publicPathPrefix: '/orders',
    ctaHint: 'The supplier sees a "Respond now" button to accept, decline, or ask a question.',
    modes: ['send', 'url', 'create-template'],
    tokenStrategy: 'idempotent-generate',
    followUps: {
      supportsTriggered: true,
      triggerOptions: [
        { value: 'order_accepted', label: 'On Accept', description: 'Sends when the supplier accepts the order.' },
        { value: 'order_declined', label: 'On Decline', description: 'Sends when the supplier declines the order.' },
        { value: 'order_viewed', label: 'On Read', description: 'Starts counting once the supplier opens the order. Auto-cancels if they accept/decline.' },
      ],
      timeBasedLabel: 'Time-based follow-up',
      timeBasedDescription: 'Chases the supplier if they haven\'t responded. Auto-cancels when they accept or decline. Respects quiet hours.',
    },
    attachments: 'library-only',
    templateKind: 'order_send',
    sendButtonLabel: 'Send Order',
    sendButtonDataCopilot: 'send-order',
  },
  invoice: {
    kind: 'invoice',
    noun: 'Invoice',
    recipientNoun: 'customer',
    publicPathPrefix: '/invoice',
    ctaHint: 'The customer sees a "View Invoice" button and can report payment.',
    modes: ['send', 'url', 'email', 'create-template'],
    tokenStrategy: 'static',
    followUps: {
      supportsTriggered: false,
      triggerOptions: [
        { value: 'invoice_viewed', label: 'On Read', description: 'Starts counting once the customer opens the invoice, then sends after the delay. Auto-cancels if they report payment, pay, or dispute first.' },
      ],
      timeBasedLabel: 'Time-based follow-up',
      timeBasedDescription: 'Chases the customer if the invoice isn\'t marked paid. Auto-cancels when they report payment, pay, or dispute. Respects quiet hours.',
    },
    attachments: 'library-only',
    templateKind: 'invoice_send',
    sendButtonLabel: 'Send Invoice',
    sendButtonDataCopilot: 'invoice-send',
  },
};
