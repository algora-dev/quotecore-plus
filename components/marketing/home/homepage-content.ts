/** Copy retained/recomposed from the supplied 198336b4 marketing snapshot.
 * Price/trial claims that conflict with the new selector are deliberately not repeated.
 * Testimonials are supplied source content, not independently verified here. */
export const homepageFaqs = [
  { question: 'Who is QuoteCore+ built for?', answer: 'QuoteCore+ is built first for roofing contractors and estimators who need a faster, more accurate way to measure, price, quote and manage work. Smart Components™ can also support construction, cladding and other measured trades that use repeatable materials, labour and pricing rules.' },
  { question: 'How fast can I create a quote?', answer: 'Once your Smart Components™ and pricing are configured, a complex roofing quote can be created and sent in just a few minutes. The exact time depends on the job, the quality of the plan or measurements, and the quoting method you choose — AI-assisted roof scans, manual digital takeoffs, direct measurements with Smart Components, or custom line-by-line quotes.' },
  { question: 'Does QuoteCore+ create quotes automatically?', answer: 'QuoteCore+ automates significant parts of the quoting process — measurement assistance, quantities, pricing, waste, labour and reusable quote items. AI-assisted results should always be reviewed before sending. You remain in control and can correct measurements, change components, adjust pricing and add or remove items before finalising the quote.' },
  { question: 'Why do contractors switch to QuoteCore+?', answer: 'It replaces disconnected spreadsheets, documents and separate quoting tools with one connected workflow. Reuse your pricing and component rules, send material orders from accepted work, convert approved work into invoices, and keep your quote, job and customer information together.' },
  { question: 'Can I try it without signing up?', answer: 'Yes. The interactive demo and free tools are available without signup. Explore a sample job in the demo, or use the free digital takeoff tool with your own plan.' },
  { question: 'Can you help set it up for my business?', answer: 'Yes. The Done For You Setup service helps load your pricing and services, shape QuoteCore+ around your business, and teach you using your own jobs. Start with a free conversation to discuss your workflow and the setup help you need.' },
  { question: 'How much does QuoteCore+ cost?', answer: 'Visit the pricing page to explore the options for your business. Your chosen tools, setup and usage determine the right configuration. Done For You Setup is a separate service, scoped and quoted around your requirements.' },
];

export interface Testimonial {
  name: string;
  business: string;
  quote: string;
  initials: string;
  placeholder?: boolean;
}
export const testimonials: Testimonial[] = [
  { name: 'Greg Kepp', business: 'Sky High Roofing', initials: 'GK', quote: "We haven't had to print out a roof plan since we started using QuoteCore+. I was sceptical at first, but once you get used to measuring everything on screen it's hard to imagine going back, not to mention its at least 4x faster than our old process. We're still only using a fraction of what the app offers but very happy so far" },
  { name: 'Tony Edwards', business: 'NZAV', initials: 'TE', quote: "We offer a really diverse range of AV products and services, and most quoting software we tried just wasn't flexible enough for us. With QuoteCore+, Smart Components combined with catalogue uploads let us do everything that used to need three different apps. Having everything in one place is so handy. We've just started using the digital takeoff system too, which is very cool!" },
  { name: 'Rob Mander', business: 'FMR Solutions', initials: 'RM', quote: "We'd tried other options and just couldn't get their systems working the way we needed. QuoteCore+ nailed it with their Smart Components system, they're so simple, and allow us to price everything the way we already have for years. If it existed earlier, I might be retired by now!" },
];
export const placeholderReview: Testimonial = {
  name: 'Matt R.', business: 'Roofer · example only', initials: 'MR', placeholder: true,
  quote: 'I’d given up on other roofing apps. With the Done For You Setup, QuoteCore+ was ready for our business. Getting started was so much easier.',
};
export const publishedHeroReview: Testimonial = {
  ...testimonials[2],
  quote: "We'd tried other options and just couldn't get their systems working the way we needed. QuoteCore+ nailed it with their Smart Components system…",
};

export interface WorkflowStep {
  title: string; heading: string; body: string; note?: string;
  images: { src: string; alt: string; width: number; height: number }[];
}
export const workflowSteps: WorkflowStep[] = [
  { title: 'Measure', heading: 'Start with the roof. Not a spreadsheet.', body: 'Upload a plan or image and measure on the digital canvas. Add areas, lengths and components yourself, or use AI Scan Assist and review the results before pricing.', note: 'Digital takeoff is designed for desktop.', images: [{ src: '/marketing/home/takeoff-workspace.webp', alt: 'Actual QuoteCore+ digital takeoff workspace with measured roof areas, ridges, hips and valleys', width: 2048, height: 1114 }] },
  { title: 'Price', heading: 'Your pricing. Applied consistently.', body: 'Smart Components™ keep your materials, labour, waste and pricing logic together. Set up the way your business works once, then reuse it on the next quote.', images: [{ src: '/how-it-works-smart-components-editor.png', alt: 'QuoteCore+ Smart Component editor with material and labour pricing', width: 1280, height: 795 }] },
  { title: 'Quote', heading: 'Make a professional first impression.', body: 'Turn measurements and pricing into a fully editable quote. Review the details and use your own header and footer templates to suit the customer.', images: [{ src: '/how-it-works/how-it-works-2-2.png', alt: 'QuoteCore+ quote editor', width: 1280, height: 795 }, { src: '/how-it-works/how-it-works-2-3.png', alt: 'Customer-facing quote preview', width: 1280, height: 795 }] },
  { title: 'Send', heading: 'Send it. Know where it stands.', body: 'Send quotes, orders and invoices directly from QuoteCore+. See when your document has been opened and configure automatic follow-ups around your workflow.', images: [{ src: '/how-it-works/how-it-works-3.png', alt: 'QuoteCore+ message centre and document sending', width: 1280, height: 795 }] },
  { title: 'Order', heading: 'The job is approved. Keep it moving.', body: 'Create material orders from a saved quote or start from scratch. Choose a layout, adjust the details and send the order to your supplier without retyping the job.', images: [{ src: '/how-it-works-order-form.png', alt: 'QuoteCore+ material order form', width: 1280, height: 795 }, { src: '/how-it-works/how-it-works-4.png', alt: 'QuoteCore+ material ordering workspace', width: 1280, height: 795 }] },
  { title: 'Invoice', heading: 'Finish the job. Not another spreadsheet.', body: 'Create an invoice from a saved quote in a few clicks, or build a custom invoice from scratch. Keep the customer, documents and job details together.', images: [{ src: '/how-it-works/how-it-works-5-2.png', alt: 'QuoteCore+ invoice workspace', width: 1280, height: 795 }] },
];

export const comparisonRows = [
  ['Measure a roof', 'Print, scale, calculate, re-enter.', 'Measure digitally and carry the result into pricing.'],
  ['Price materials & labour', 'Maintain formulas across separate files.', 'Reuse your Smart Components™ and pricing rules.'],
  ['Send & follow up', 'Export a PDF and keep checking your inbox.', 'Send, track opens and schedule follow-ups.'],
  ['Order & invoice', 'Type the same job into another system.', 'Create documents from your saved quote.'],
];
