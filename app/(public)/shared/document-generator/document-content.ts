/** Shared by visible, server-rendered help and FAQ structured data. */
export const QUOTE_FAQS = [
  {q:'How many quotes can I create for free?',a:'Guests can generate 2 documents and make 1 AI extraction request per day. A free verified account gets 10 documents and 3 AI requests per day. Document allowances are shared across quotes, invoices and purchase orders. Typed and photo-based AI requests share one AI allowance. The server uses 24-hour windows, not necessarily a midnight reset.'},
  {q:'How do I remove QuoteCore+ branding?',a:'Generate your quote, then choose Remove branding — free. Continue with Google or verify your email. Once your account is confirmed, branding is removed automatically, without generating the same quote again. A free tools account does not include the separate paid QuoteCore+ app.'},
  {q:'How do I save my quote as a PDF?',a:'Review your quote and select Generate quote. Then choose Print / Save PDF and select Save as PDF in your browser’s print dialog. Turn off the browser’s headers and footers for a clean document. Nothing is emailed to your customer automatically.'},
  {q:'Can Quote Assist fill in the quote for me?',a:'Yes. Use Quote Assist above the form to describe a job, paste existing details or upload a photo. Review the extracted details before adding them to your quote. Check all quantities, units and prices. An extraction request uses the shared AI allowance even when you do not apply the result. You can always enter details manually.'},
  {q:'Will my work be saved?',a:'Your draft stays in this browser tab when storage is available. It is not automatically saved to your account or the paid app. Export your PDF before closing the tab. When you choose to sign in, a device-local backup allows your quote to return after verification; it expires after one hour and is cleared after successful sign-in. Optional Quote Assist sends your supplied text or photo for processing only when you choose Extract.'},
  {q:'Can I add my logo, tax and terms?',a:'Yes. Add a PNG, JPEG or WebP logo, business and customer details, line items and notes. Tax can be switched off, renamed or adjusted. Check the tax settings for your business before sharing the quote.'},
  {q:'Can I turn the quote into an invoice or order?',a:'After generating, open Use these items in another free tool. You can transfer visible line items into the existing invoice, purchase order or margin tools. Recheck tax, totals and document settings in the destination; hidden items are not transferred.'},
];

export const INVOICE_FAQS = [
  {q:'How many invoices can I create for free?',a:QUOTE_FAQS[0].a.replace('quotes can','invoices can')},
  {q:'How do I remove QuoteCore+ branding?',a:QUOTE_FAQS[1].a.replaceAll('quote','invoice')},
  {q:'How do I save and send the invoice?',a:'Review your invoice and select Generate invoice. Then choose Print / Save PDF and Save as PDF in your browser’s print dialog. Turn off browser headers and footers for a clean document. You can then send the saved PDF yourself. This free tool does not email your customer, take payments or track payment status.'},
  {q:'Can Invoice Assist fill in the details?',a:'Describe the completed work, paste details or upload a PNG, JPEG or WebP photo. Review the extracted customer, items, dates and payment instructions before applying them. Check all prices, quantities, tax and bank details. An extraction request uses the shared AI allowance even if you do not apply the result.'},
  {q:'Can I use items from a quote?',a:'Yes. Transfer visible items from the Quote Generator and check the invoice details. Tax settings transfer with the new shared editor; review older links carefully. Set your invoice number, due date and payment instructions. A customer is never automatically treated as a supplier when you switch to a purchase order.'},
  {q:'Are payment details and due dates optional?',a:'Yes. Add your agreed due date and payment instructions when relevant. Due-date shortcuts use the invoice date. Changing the invoice date does not silently move an existing due date. Existing notes and payment terms remain available.'},
  {q:'Will my invoice be saved?',a:QUOTE_FAQS[4].a.replaceAll('quote','invoice').replaceAll('Quote Assist','Invoice Assist')},
];
export const ORDER_FAQS = [
  {q:'How many purchase orders can I create for free?',a:QUOTE_FAQS[0].a},
  {q:'How do I remove QuoteCore+ branding?',a:QUOTE_FAQS[1].a.replaceAll('quote','purchase order')},
  {q:'What should I add to a purchase order?',a:'Add your business, your supplier and the materials you need. Check quantities, units and agreed purchase prices. You can include a job reference, requested delivery date, delivery address, supplier instructions and tax settings.'},
  {q:'Can Order Assist read a materials list?',a:'Yes. Describe the order, paste a list or upload a PNG, JPEG or WebP photo. Check the extracted details before applying them. Your business is the buyer; the supplier is the recipient. Confirm the parties and prices before sending the document.'},
  {q:'Does generating a PO place an order?',a:'No. Generate the document, then use Print / Save PDF to save it. Nothing is emailed, ordered, paid for or confirmed automatically. Send the PDF to your supplier yourself and ask them to confirm availability, pricing and delivery.'},
  {q:'Can I reuse items from a quote or invoice?',a:'Yes. The new shared editor transfers visible items, currency and tax settings. Customer details are not copied into supplier fields. Check purchase prices rather than using customer sale prices without review. Hidden items are not transferred.'},
  {q:'Will my purchase order be saved?',a:QUOTE_FAQS[4].a.replaceAll('quote','purchase order').replaceAll('Quote Assist','Order Assist')},
];
