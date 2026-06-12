import type { ReactNode } from 'react';

/**
 * Tutorials data — the 13 onboarding cards.
 *
 * Each tutorial renders as a card on /tutorials. Clicking opens TutorialModal,
 * which pages through `pages[]` and shows two CTAs:
 *   - "Go to <feature>"          -> router.push(ctaHref(base))
 *   - "Walk me through with Q"    -> launches guide `workflowId` (hidden if null)
 *
 * workflowId maps to an existing guide in app/components/copilot/guides.generic.ts.
 * When null, the Q button is hidden for that card (no dead button).
 *
 * Copy is trade-neutral per Shaun's standing preference.
 */

export interface TutorialPage {
  /** Shown only when pages.length > 1. */
  heading?: string;
  /** Short paragraphs / bullet lines — scannable, not prose walls. */
  body: string[];
}

export interface Tutorial {
  id: string;
  title: string;
  tagline: string;
  icon: ReactNode;
  /** CTA label, e.g. "Go to Quotes". */
  ctaLabel: string;
  /** Workspace-prefixed target, e.g. b => `${b}/quotes`. */
  ctaHref: (base: string) => string;
  /** Q guide workflow id, or null to hide the Q-walkthrough button. */
  workflowId: string | null;
  pages: TutorialPage[];
}

/* Heroicons outline 24x24, accent colour. */
const icon = (d: string): ReactNode => (
  <svg className="w-6 h-6 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
);

export const TUTORIALS: Tutorial[] = [
  // 1 ------------------------------------------------------------------
  {
    id: 'quotes',
    title: 'Quotes',
    tagline: 'Three ways to build a quote — pick what suits the job.',
    icon: icon('M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'),
    ctaLabel: 'Go to Quotes',
    ctaHref: (b) => `${b}/quotes`,
    workflowId: 'create-quote',
    pages: [
      {
        heading: 'What & why',
        body: [
          'A quote is the priced document you send a customer.',
          'QuoteCore+ gives you three entry modes so you can quote fast for simple jobs and in detail for complex ones.',
        ],
      },
      {
        heading: 'Manual Mode',
        body: [
          'Type lines in yourself (description, qty, price).',
          'Best when you already know your numbers or want a fully custom quote.',
          'You can add components or catalog items as lines too.',
        ],
      },
      {
        heading: 'Digital Mode',
        body: [
          'Measure the job on-screen (digital takeoff), attach your saved components, and let QuoteCore+ price it from your rates.',
          'Best for measured work where area or length drives the price.',
        ],
      },
      {
        heading: 'Blank Quote Mode',
        body: [
          'Start from an empty quote and add lines freely — no measuring, no template.',
          'Fastest for a quick one-off.',
        ],
      },
      {
        heading: 'Then what',
        body: [
          'Save it, preview it, and send by link or email.',
          'See the "Sending" tutorial for how delivery and tracking work.',
        ],
      },
    ],
  },

  // 2 ------------------------------------------------------------------
  {
    id: 'sending',
    title: 'Sending Quotes, Orders & Invoices',
    tagline: 'Get any document in front of your customer or supplier.',
    icon: icon('M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'),
    ctaLabel: 'Go to Quotes',
    ctaHref: (b) => `${b}/quotes`,
    workflowId: 'customer-labor',
    pages: [
      {
        heading: 'What',
        body: [
          'Quotes go to customers, Orders to suppliers, Invoices to customers for payment.',
          'Sending works the same way for all three.',
        ],
      },
      {
        heading: 'Two ways to send',
        body: [
          'Send from QuoteCore+ — we email it for you with a tracked link (shows Read / opened).',
          'Copy URL link — paste it anywhere (WhatsApp, your own email). Both open the live customer/supplier page.',
        ],
      },
      {
        heading: 'Follow-ups at send time',
        body: [
          'When sending, you can attach automatic follow-ups (chase if no reply, or trigger on accept/decline).',
          'See the "Auto Follow-up" tutorial.',
        ],
      },
      {
        heading: 'After sending',
        body: [
          'The document page shows status (Read, Accepted, Paid, Disputed…).',
          'Replies and actions land in your Message Center.',
        ],
      },
    ],
  },

  // 3 ------------------------------------------------------------------
  {
    id: 'components',
    title: 'Components',
    tagline: 'Reusable priced building blocks for fast, consistent quoting.',
    icon: icon('M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'),
    ctaLabel: 'Go to Components',
    ctaHref: (b) => `${b}/components`,
    workflowId: 'components',
    pages: [
      {
        heading: 'What & why',
        body: [
          'A component is a saved item with your material + labour rates, waste %, and how it\u2019s measured (per m\u00B2, per metre, each…).',
          'Build them once, reuse on every quote — consistent pricing, no re-typing.',
        ],
      },
      {
        heading: 'How to use',
        body: [
          'Create components in Resources → Components.',
          'When quoting in Digital Mode, your measurements pull the right components and price automatically.',
          'You can also drop a component straight onto any quote or order line.',
        ],
      },
      {
        heading: 'When',
        body: [
          'Set up your common components first (the app seeds starter ones for your trade).',
          'Edit rates any time — new quotes use the latest.',
        ],
      },
    ],
  },

  // 4 ------------------------------------------------------------------
  {
    id: 'catalogs',
    title: 'Catalogs',
    tagline: 'Your supplier price lists, searchable inside any quote.',
    icon: icon('M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'),
    ctaLabel: 'Go to Catalogs',
    ctaHref: (b) => `${b}/resources/catalogs`,
    workflowId: 'catalog-add-to-quote',
    pages: [
      {
        heading: 'What',
        body: [
          'Upload a supplier price list (CSV) and QuoteCore+ makes it searchable.',
          'No more digging through PDFs for a price.',
        ],
      },
      {
        heading: 'How',
        body: [
          'Resources → Catalogs → Upload → name it → map the columns (which is the description, which is the price) → save.',
        ],
      },
      {
        heading: 'Using it',
        body: [
          'In a quote or order: Add line → Search catalog → type → pick the item → it drops in with description + price.',
          'Pro plan: up to 3 catalogs.',
        ],
      },
    ],
  },

  // 5 ------------------------------------------------------------------
  {
    id: 'templates',
    title: 'Templates',
    tagline: 'Save once, reuse everywhere — quotes, messages, and headers.',
    icon: icon('M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z'),
    ctaLabel: 'Go to Resources',
    ctaHref: (b) => `${b}/resources`,
    workflowId: null,
    pages: [
      {
        heading: 'What templates exist',
        body: [
          'Quote templates — reusable quote layouts.',
          'Message templates — pre-written send emails with auto-filling placeholders.',
          'Header templates — for quotes, orders, and invoices (your branding / letterhead).',
        ],
      },
      {
        heading: 'Why',
        body: [
          'Stop re-typing the same intro email or rebuilding the same quote shape.',
          'Placeholders like the customer name or quote total fill themselves in.',
        ],
      },
      {
        heading: 'Where',
        body: [
          'All under Resources.',
          'Pick the matching template when creating a quote, or in the send modal when emailing.',
        ],
      },
    ],
  },

  // 6 ------------------------------------------------------------------
  {
    id: 'drawings',
    title: 'Drawings & Images',
    tagline: 'Draw or upload diagrams and images for quotes and orders.',
    icon: icon('M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'),
    ctaLabel: 'Go to Drawings & Images',
    ctaHref: (b) => `${b}/flashings`,
    workflowId: 'flashing-draw',
    pages: [
      {
        body: [
          'Use the drawing tool to sketch a detail or upload an image, then attach it to a component, quote, or order so your customer or supplier sees exactly what you mean.',
          'This is the same tool whether your trade calls it "Drawings & Images" or, for roofing, "Flashings".',
          'Find it in Resources → Drawings & Images.',
        ],
      },
    ],
  },

  // 7 ------------------------------------------------------------------
  {
    id: 'attachments',
    title: 'Attachments',
    tagline: 'Upload a file once, reuse it across quotes and orders.',
    icon: icon('M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13'),
    ctaLabel: 'Go to Attachments',
    ctaHref: (b) => `${b}/resources/attachments`,
    workflowId: 'attachments-send',
    pages: [
      {
        heading: 'What',
        body: [
          'A library of files (PDFs, brochures, certs, terms) you upload once and attach to any quote or order — no re-uploading per job.',
        ],
      },
      {
        heading: 'How',
        body: [
          'Resources → Attachments → upload.',
          'When sending a quote or order, open the attachment picker and tick the files to include — they go as a download link on the customer page (not a heavy email attachment).',
        ],
      },
      {
        heading: 'Tip',
        body: [
          'Set a default attachment on a message template so it auto-attaches every time you use that template.',
        ],
      },
    ],
  },

  // 8 ------------------------------------------------------------------
  {
    id: 'orders',
    title: 'Orders',
    tagline: 'Turn a quote into a supplier order — or build one from scratch.',
    icon: icon('M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'),
    ctaLabel: 'Go to Orders',
    ctaHref: (b) => `${b}/material-orders`,
    workflowId: 'order-from-quote',
    pages: [
      {
        heading: 'What',
        body: [
          'A material/supplier order lists what you need to buy for a job and goes to your supplier.',
          'Two ways: build line-by-line, or generate from an existing quote.',
        ],
      },
      {
        heading: 'From a quote',
        body: [
          'Open Orders → Order from Quote → pick the quote → it pre-fills the priced lines.',
          'Add your supplier header and send.',
        ],
      },
      {
        heading: 'Line-by-line',
        body: [
          'Build a custom order: add lines (custom, component, or catalog), set what shows, optional taxes/footer, then send.',
          'You can hide prices if the supplier shouldn\u2019t see your figures.',
        ],
      },
    ],
  },

  // 9 ------------------------------------------------------------------
  {
    id: 'invoices',
    title: 'Invoices',
    tagline: 'Bill the customer and track payment to "Paid".',
    icon: icon('M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z'),
    ctaLabel: 'Go to Invoices',
    ctaHref: (b) => `${b}/invoices`,
    workflowId: 'create-invoice',
    pages: [
      {
        heading: 'What',
        body: [
          'An invoice requests payment.',
          'Create one blank or straight from an accepted quote (it imports the lines + branding).',
        ],
      },
      {
        heading: 'How',
        body: [
          'Invoices → New Invoice → blank or from a quote → add/adjust lines, set dates and payment details → save → send.',
        ],
      },
      {
        heading: 'Getting paid',
        body: [
          'The customer opens the invoice and hits "Payment Sent"; you confirm to mark it Paid.',
          'Disputes come back as an alert. Status shows on the Invoices list.',
        ],
      },
    ],
  },

  // 10 -----------------------------------------------------------------
  {
    id: 'message-center',
    title: 'Message Center / Alerts',
    tagline: 'Every reply, open, and action — in one inbox.',
    icon: icon('M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'),
    ctaLabel: 'Go to Message Center',
    ctaHref: (b) => `${b}/inbox`,
    workflowId: 'message-center',
    pages: [
      {
        heading: 'What',
        body: [
          'When a customer opens/accepts/declines a quote, a supplier responds, or an invoice is paid/disputed, an alert lands in the Message Center.',
          'The bell is a quick glance; the inbox is the full record.',
        ],
      },
      {
        heading: 'Folders & actions',
        body: [
          'Filter by Quotes / Orders / Invoices, search, expand a row for the full message, mark Done, archive or delete.',
          'Clearing the bell does NOT delete inbox items.',
        ],
      },
      {
        heading: 'Settings',
        body: [
          'The Settings tab controls which events notify you and whether you also get an email — per event, per channel.',
        ],
      },
    ],
  },

  // 11 -----------------------------------------------------------------
  {
    id: 'follow-ups',
    title: 'Auto Follow-up Messages',
    tagline: 'Chase quotes and reminders automatically — set and forget.',
    icon: icon('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'),
    ctaLabel: 'Go to Message Center',
    ctaHref: (b) => `${b}/inbox`,
    workflowId: null,
    pages: [
      {
        heading: 'What & why',
        body: [
          'Follow-ups send themselves so deals don\u2019t go cold.',
          'Set them when you send a quote, order, or invoice.',
        ],
      },
      {
        heading: 'Two kinds',
        body: [
          'Triggered — fire on an event (customer accepts/declines), optionally after a delay.',
          'Time-based — chase after X days/hours/minutes if there\u2019s no reply; cancels automatically once they respond.',
        ],
      },
      {
        heading: 'Rules',
        body: [
          'Up to 3 per document; one per trigger.',
          'If one trigger fires (e.g. accepted), the opposing parked follow-ups cancel themselves.',
          'Quotes support both kinds; invoices are time-based reminders.',
        ],
      },
    ],
  },

  // 12 -----------------------------------------------------------------
  {
    id: 'download-delete',
    title: 'Downloading & Deleting Files',
    tagline: 'Get PDFs out, and remove what you don\u2019t need.',
    icon: icon('M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'),
    ctaLabel: 'Go to Quotes',
    ctaHref: (b) => `${b}/quotes`,
    workflowId: null,
    pages: [
      {
        body: [
          'Every quote, order, and invoice can be downloaded as a PDF that matches the on-screen preview exactly (logo, lines, totals). Use the Download icon on the item, or multi-select on a list and "Download as ZIP".',
          'Deleting: use the row menu — drafts delete outright; sent items can be cancelled/withdrawn (the public link stops working).',
          'Deleting frees storage.',
        ],
      },
    ],
  },

  // 13 -----------------------------------------------------------------
  {
    id: 'q-and-docs',
    title: 'Q & Docs / Help',
    tagline: 'Your built-in assistant and help docs.',
    icon: icon('M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'),
    ctaLabel: 'Open Q',
    ctaHref: (b) => `${b}`,
    // This card IS the Q intro — Q-walkthrough button hidden (handled in modal).
    workflowId: null,
    pages: [
      {
        heading: 'Meet Q',
        body: [
          'Q is the in-app assistant. Ask "how do I…?" and Q answers from the docs, or offers to walk you through it — highlighting each button as you go (that\u2019s "Guide Me").',
        ],
      },
      {
        heading: 'Docs & Help',
        body: [
          'The ? help icon on any screen opens the matching help doc. The full docs are searchable.',
          'Q draws its answers from these docs, so anything in Help, Q can explain.',
        ],
      },
      {
        heading: 'How to use Guide Me',
        body: [
          'Ask Q, pick "walk me through", and follow the glowing highlights — Next / Back / Finish at your pace.',
          'Toggle highlights off if you just want the instructions.',
        ],
      },
    ],
  },
];
