import type { DocumentKind } from './document-model';
/** Copy is the only difference in the shared shell. Document-specific fields are
 * handled explicitly by the model, details editor and paper renderer. */
export const DOCUMENT_COPY = {
  quote: {
    label:'Quote', noun:'quote', recipient:'customer', recipientTitle:'Customer', intro:'Your details. Your prices. A quote you’re proud to send.',
    assist:'Quote Assist', assistIntro:'Describe the job or upload a quote photo. We’ll draft the details for you.', textAction:'Describe the job', uploadAction:'Upload a quote photo',
    detailsTitle:'Who’s the quote for?', itemsTitle:'What’s included in the job?', itemsIntro:'Add each part of the job. We’ll calculate the totals as you go.',
    recipientPlaceholder:'Who are you quoting for?', total:'Quote total', notesTitle:'Notes & terms', notesHint:'Payment terms, scope and exclusions', footerPlaceholder:'Thank you for the opportunity to quote for your project.',
    assistQuestion:'What needs quoting?', assistPlaceholder:'For Alex at 24 Oak Street: 120 m² of roofing at 48 per m², 24 m of flashing at 22.50 per m, plus 280 for waste removal. Valid for 30 days.',
    itemPlaceholder:'e.g. Roof covering — supply & install', action:'Generate quote', preview:'Preview quote',
  },
  invoice: {
    label:'Invoice', noun:'invoice', recipient:'customer', recipientTitle:'Customer', intro:'The work. The details. An invoice that’s clear from the start.',
    assist:'Invoice Assist', assistIntro:'Describe the work or upload a document photo. We’ll draft the details for you.', textAction:'Describe the work', uploadAction:'Upload a document photo',
    detailsTitle:'Who are you invoicing?', itemsTitle:'What are you billing for?', itemsIntro:'Add the work, materials or services. We’ll calculate the totals as you go.',
    recipientPlaceholder:'Who should receive this invoice?', total:'Invoice total', notesTitle:'Notes & terms', notesHint:'Payment terms and additional information', footerPlaceholder:'Thank you for your business.',
    assistQuestion:'What needs invoicing?', assistPlaceholder:'Invoice Alex Morgan for 120 m² of roof covering at 48 per m², 24 m of flashing at 22.50 per m and waste removal at 280. Payment due in 14 days.',
    itemPlaceholder:'e.g. Roofing work completed — supply & install', action:'Generate invoice', preview:'Preview invoice',
  },
  order: {
    label:'Purchase order', noun:'purchase order', recipient:'supplier', recipientTitle:'Supplier', intro:'The right materials. Clear quantities. An order your supplier can act on.',
    assist:'Order Assist', assistIntro:'Describe what you need or upload a materials list. We’ll draft the details for you.', textAction:'Describe the order', uploadAction:'Upload a materials photo',
    detailsTitle:'Who are you ordering from?', itemsTitle:'What do you need to order?', itemsIntro:'Add materials, quantities and agreed purchase prices. We’ll calculate the totals.',
    recipientPlaceholder:'Your supplier’s business name', total:'Order total', notesTitle:'Notes for your supplier', notesHint:'Specifications, delivery instructions and terms', footerPlaceholder:'Please quote our PO number on your confirmation and invoice.',
    assistQuestion:'What do you need from your supplier?', assistPlaceholder:'Order from Example Roofing Supplies: 120 m² of charcoal standing-seam roofing at 32 per m², 24 m of barge flashing at 16.50 per m, and 3 boxes of fixings at 38 each. Deliver to 24 Sample Lane.',
    itemPlaceholder:'e.g. Charcoal standing-seam roof sheet', action:'Generate purchase order', preview:'Preview purchase order',
  },
} satisfies Record<DocumentKind,Record<string,string>>;
