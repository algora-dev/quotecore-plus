"use client";

import YouTubeLite from "@/components/YouTubeLite";

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>To create a professional contractor invoice, identify both parties, use a unique invoice number, describe the completed work clearly, show quantities and prices, apply tax correctly, state the total and payment terms, then provide an easy way to pay. The invoice should match the agreed quote and make approved changes easy to understand.</p>
      <p>You can create and download one without signing up using the <a href="/free-invoice-generator">free invoice generator</a>. This guide explains what to include and how to avoid mistakes that delay payment.</p>
      <h2>What a contractor invoice must achieve</h2>
      <p>An invoice has three jobs:</p>
      <ol>
        <li>Tell the customer exactly what they are being charged for.</li>
        <li>Give them the information needed to approve and pay it.</li>
        <li>Create a clear business record for both sides.</li>
      </ol>
      <p>The best invoice is not the longest. It is the one that removes uncertainty.</p>
      <h2>Information to include on an invoice</h2>
      <p>Include:</p>
      <ul>
        <li>Your business or trading name</li>
        <li>Your business address and contact details</li>
        <li>Company registration details where applicable</li>
        <li>Tax registration number where applicable</li>
        <li>Customer name and billing address</li>
        <li>Site address if different</li>
        <li>Unique invoice number</li>
        <li>Invoice date</li>
        <li>Payment due date or payment terms</li>
        <li>Quote, purchase order, job, or customer reference</li>
        <li>Description of work, materials, or services</li>
        <li>Quantities, rates, and line totals</li>
        <li>Subtotal, tax, adjustments, and final total</li>
        <li>Payment instructions</li>
        <li>A contact for invoice questions</li>
      </ul>
      <p>Requirements vary by country and business type. For UK businesses, check the current <a href="https://www.gov.uk/invoicing-and-taking-payment-from-customers/invoices-what-they-must-include">GOV.UK invoicing guidance</a> and the separate rules for VAT invoices if registered.</p>
      <h2>Step 1: start from the accepted quote</h2>
      <p>The accepted quote is the cleanest starting point because the customer has already seen the scope and price. <a href="/construction-quoting-software">Construction quoting software</a> keeps the quote and invoice connected, so scope, prices and payment terms stay in sync from acceptance through to final payment.</p>
      <p>Check that customer and billing details are correct, the job reference matches, the original scope was completed, variations were approved, deposits were recorded, and any staged payment or retention rules apply.</p>
      <p>Do not quietly fold a variation into a vague line. Show it separately with the date, reference, and agreed value where possible.</p>
      <p>If you do not yet have a consistent quote format, use the <a href="/free-quote-generator">free quote generator</a>. For guidance on structuring the quote itself, see <a href="/blog/how-to-price-a-roofing-job">how to price a roofing job</a>. Once the invoice is ready, a <a href="/blog/how-to-send-a-purchase-order">purchase order</a> helps the customer approve material costs separately.</p>
      <h2>Step 2: use a clear numbering system</h2>
      <p>Every invoice needs a unique number. The system should be consistent and easy to search.</p>
      <p>Examples:</p>
      <ul>
        <li>INV-2026-0042</li>
        <li>QC-1048-01</li>
        <li>CUSTOMER-JOB-STAGE</li>
      </ul>
      <p>Avoid changing numbering styles frequently or using duplicate numbers. Sequential numbering is easy to follow, but choose a structure that fits your accounting process and local requirements.</p>
      <h2>Step 3: describe the work in customer language</h2>
      <p>Invoice descriptions should be specific enough to verify but simple enough to understand.</p>
      <p>Weak description:</p>
      <p>Roofing work, ?8,500</p>
      <p>Clearer description:</p>
      <p>Stage 2: Supply and installation of the specified roof covering, underlay, battens, ridge system, and associated fixings in line with accepted quote Q-1048.</p>
      <p>For measured work, show the unit:</p>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Quantity</th>
            <th>Rate</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Roof covering installation</td>
            <td>118 m?</td>
            <td>?x.xx</td>
            <td>?x.xx</td>
          </tr>
          <tr>
            <td>Dry ridge system</td>
            <td>14 m</td>
            <td>?x.xx</td>
            <td>?x.xx</td>
          </tr>
          <tr>
            <td>Approved variation V-02</td>
            <td>1</td>
            <td>?x.xx</td>
            <td>?x.xx</td>
          </tr>
        </tbody>
      </table>
      <p>Do not expose internal pricing detail that the customer did not agree to receive. The invoice should reflect the customer-facing quote format.</p>
      <h2>Step 4: calculate totals and tax carefully</h2>
      <p>For each line, multiply quantity by rate to calculate the line total. Then calculate the subtotal, discounts or credits, tax, payments already received, and final amount due.</p>
      <p>Check rounding, especially when many lines include tax. If you are uncertain about VAT, reverse charge, CIS, or other tax treatment, confirm it with your accountant or current official guidance. An invoice generator can calculate arithmetic, but it cannot decide the correct legal tax treatment for your business.</p>
      <h2>Step 5: state payment terms precisely</h2>
      <p>?Pay promptly? is not a useful term. State:</p>
      <ul>
        <li>The due date or number of days</li>
        <li>Accepted payment methods</li>
        <li>Bank or online payment details</li>
        <li>The reference the customer should use</li>
        <li>Who to contact with a query</li>
        <li>Any agreed staged payment or retention terms</li>
      </ul>
      <p>Example:</p>
      <p>Payment due within 14 days of the invoice date. Please use INV-2026-0042 as the payment reference.</p>
      <p>Use terms that match the accepted quote or contract. Do not introduce new commercial terms after the work is complete.</p>
      <h2>Step 6: check the invoice before sending</h2>
      <p>Use a short pre-send check:</p>
      <ul>
        <li>Is the customer name correct?</li>
        <li>Is it addressed to the right legal entity?</li>
        <li>Does the invoice number exist only once?</li>
        <li>Do line items match the quote and approved variations?</li>
        <li>Is the subtotal correct?</li>
        <li>Is tax treatment correct?</li>
        <li>Are deposits and credits shown?</li>
        <li>Is the final amount due obvious?</li>
        <li>Are the due date and payment instructions visible?</li>
        <li>Does the PDF display correctly on mobile and desktop?</li>
      </ul>
      <p>A five-minute check is usually quicker than resolving a rejected invoice.</p>
      <h2>Step 7: send it to the right person</h2>
      <p>Ask who approves invoices before the job reaches completion. On commercial work, the person who booked the work may not be the accounts contact.</p>
      <p>Send the invoice with a clear subject line, the job and invoice reference, the amount due, the due date, a PDF attachment or secure invoice link, and any required evidence.</p>
      <p>Example subject:</p>
      <p>Invoice INV-2026-0042 for 18 High Street roof works</p>
      <h2>Staged and progress invoices</h2>
      <p>For larger jobs, one final invoice may not reflect how the work is funded or delivered. Staged invoices can follow agreed milestones such as deposit, materials ordered, site setup, watertight stage, covering complete, practical completion, or retention release.</p>
      <p>Define milestones before starting. Each invoice should show the stage, original contract reference, previous invoices, and remaining value where useful.</p>
      <p>Do not invoice a percentage without explaining what the stage represents.</p>
      <h2>Handling variations</h2>
      <p>Variations cause disputes when the work is clear on site but unclear on paper.</p>
      <p>Use this process:</p>
      <ol>
        <li>Describe the change.</li>
        <li>Explain the reason.</li>
        <li>Price it before proceeding where practical.</li>
        <li>Obtain approval.</li>
        <li>Give it a variation reference.</li>
        <li>Show it separately on the invoice.</li>
      </ol>
      <p>If emergency or concealed work makes prior approval impossible, document what was found, take photographs, notify the customer quickly, and follow the contract process.</p>
      <h2>Common invoicing mistakes</h2>
      <ul>
        <li>Sending the invoice to the wrong contact</li>
        <li>Using vague descriptions</li>
        <li>Omitting the purchase order or quote reference</li>
        <li>Applying tax incorrectly</li>
        <li>Forgetting deposits or credits</li>
        <li>Hiding variations inside the original scope</li>
        <li>Changing payment terms after acceptance</li>
        <li>Sending an unreadable document</li>
        <li>Failing to follow up before the invoice becomes seriously overdue</li>
        <li>Keeping invoices separate from quotes and job records</li>
      </ul>
      <h2>A connected quote-to-invoice workflow</h2>
      <p>The <a href="/free-invoice-generator">free invoice generator</a> is ideal when you need a professional invoice quickly. If you create invoices regularly, the bigger improvement is removing repeated entry.</p>
      <p>QuoteCore+ connects customer quotes, acceptance, material orders, invoices, and activity tracking. That helps the invoice start from work already agreed rather than rebuilding it from another document.</p>
      <p>Watch how measurement, quoting and invoicing stay connected instead of being rebuilt in separate tools.</p>
      <div className="not-prose my-8">
        <YouTubeLite
          videoId="ntyS1giH5p0"
          title="A better way to measure, quote and invoice with QuoteCore+"
          uploadDate="2026-06-29"
        />
      </div>
      <h2>Frequently asked questions</h2>
      <h3>What is the difference between a quote and an invoice?</h3>
      <p>A quote sets out proposed scope and price before work is accepted. An invoice requests payment for goods or services supplied, usually after acceptance and according to the agreed payment schedule.</p>
      <h3>Can I create an invoice without accounting software?</h3>
      <p>Yes. A compliant invoice can be created with a generator or document template if it includes required information and your records remain organised. Accounting software may add reconciliation, reporting, and tax features.</p>
      <h3>Should an invoice copy every line from the quote?</h3>
      <p>Not always. It should clearly reconcile to the accepted scope. Some customers need detailed lines, while others use agreed stages. Keep enough detail to verify the charge and show variations separately.</p>
      <h3>When should a contractor send an invoice?</h3>
      <p>Send it at the milestone agreed in the quote or contract. That may be a deposit, progress stage, delivery event, completion, or recurring date.</p>
      <h3>What should I do if an invoice is disputed?</h3>
      <p>Respond promptly, identify the exact disputed line, compare it with the quote and approvals, and keep the undisputed amount separate. Use written records, photographs, variation approvals, and activity history to resolve facts.</p>
      <p>Create a professional PDF now with the <a href="/free-invoice-generator">free invoice generator</a>. Need to order materials for the job first? Use the <a href="/free-purchase-order-generator">free purchase order generator</a>. To connect quoting, ordering, and invoicing, start a <a href="/free-trial">free QuoteCore+ trial</a>.</p>
    </div>
  );
}
