/** Copy retained/recomposed from the supplied 198336b4 marketing snapshot.
 * Price/trial claims that conflict with the new selector are deliberately not repeated.
 * Testimonials are supplied source content, not independently verified here. */
export interface HomepageFaq {
  id: string;
  question: string;
  answer: string;
  link?: { label: string; destination: 'pricing' | 'setup' };
}

/** Visible answers and the homepage FAQ schema share this single source. */
export const homepageFaqs: HomepageFaq[] = [
  {
    id: 'getting-started',
    question: 'Do I need to be tech savvy to use QuoteCore+?',
    answer: 'No. Create a Free Workspace and use it on your own jobs, or follow the optional guided walkthrough to learn the core workflow in around 10 to 15 minutes. If you want more help, Shaun can talk you through the way you currently work.',
  },
  {
    id: 'own-pricing',
    question: 'Can I keep the way I already price jobs?',
    answer: 'Yes. QuoteCore+ uses your own materials, labour rates and pricing rules through reusable Smart Components™. You can review and adjust each quote before sending it.',
  },
  {
    id: 'measurements',
    question: 'Do I need a plan to create a quote?',
    answer: 'No. You can enter measurements you already have or build a quote from individual items. When you need to measure the job, the digital takeoff tools let you measure a plan or image on screen.',
  },
  {
    id: 'subscription',
    question: 'Do I have to choose a paid plan before I start?',
    answer: 'No. Start with a Free Workspace. Try the features first and upgrade only when you need more features, capacity or usage. Your exact plan is built inside Billing when you are ready.',
    link: { label: 'See how QuoteCore+ pricing works', destination: 'pricing' },
  },
  {
    id: 'setup-and-training',
    question: 'Can you set it up and show me how to use it?',
    answer: 'Yes. Open the Done For You enquiry and choose either a free 25-minute discovery call with Shaun or a quick no-call enquiry. Tell us how you work, then Shaun can scope the setup and recommend the best handover.',
    link: { label: 'Inquire about Done For You', destination: 'setup' },
  },
  {
    id: 'free-workspace',
    question: 'Can I try QuoteCore+ before paying?',
    answer: 'Yes. The Free Workspace is a real account with no expiry. Use it on your own jobs and try the optional guided walkthrough, which uses a fictional roofing business to teach the core workflow.',
  },
];

export interface Testimonial {
  name: string;
  business: string;
  quote: string;
  initials: string;
  placeholder?: boolean;
  excerpt?: string;
  highlight?: string;
  emphasis?: string;
}
export const testimonials: Testimonial[] = [
  { name: 'Rob Mander', business: 'FMR Solutions', initials: 'RM', highlight: "Pricing that works your way", excerpt: "The app is so simple and allows us to price everything the way we already have for years.", emphasis: "so simple", quote: "We'd tried other options and just couldn't get their systems working the way we needed. QuoteCore+ nailed it with their Smart Components™ system, they're so simple, and allow us to price everything the way we already have for years. If it existed earlier, I might be retired by now!" },
  { name: 'Greg Kepp', business: 'Sky High Roofing', initials: 'GK', highlight: "Faster measuring", excerpt: "We haven't had to print out a roof plan since we started using QuoteCore+ … at least 4x faster than our old process.", emphasis: "4x faster", quote: "We haven't had to print out a roof plan since we started using QuoteCore+. I was sceptical at first, but once you get used to measuring everything on screen it's hard to imagine going back, not to mention its at least 4x faster than our old process. We're still only using a fraction of what the app offers but very happy so far" },
  { name: 'Tony Edwards', business: 'NZAV', initials: 'TE', highlight: "Everything in one place", excerpt: "…let us do everything that used to need three different apps. Having everything in one place is so handy.", emphasis: "three different apps", quote: "We offer a really diverse range of AV products and services, and most quoting software we tried just wasn't flexible enough for us. With QuoteCore+, Smart Components™ combined with catalogue uploads let us do everything that used to need three different apps. Having everything in one place is so handy. We've just started using the digital takeoff system too, which is very cool!" },
];
export const placeholderReview: Testimonial = {
  name: 'Matt R.', business: 'Roofer · example only', initials: 'MR', placeholder: true,
  quote: 'I’d given up on other roofing apps. With the Done For You Setup, QuoteCore+ was ready for our business. Getting started was so much easier.',
};
export const publishedHeroReview: Testimonial = {
  name: 'RJ',
  excerpt: 'We chose the ‘Done For You’ package. I’ve never had an easier experience…',
  business: 'Right Roofing',
  initials: 'RJ',
  quote: 'We chose the ‘Done For You’ package. I’ve never had an easier experience, we save so much time with our pricing, this app is a game changer for roofers!',
};

export interface WorkflowStep {
  title: string; heading: string; body: string; note?: string;
  images: { src: string; alt: string; width: number; height: number }[];
}
export const workflowSteps: WorkflowStep[] = [
  { title: 'Measure', heading: 'Start with the roof. Not a spreadsheet.', body: 'Upload a plan or image and measure on the digital canvas. Add areas, lengths and components yourself, or use Roof Scan Assist and review the results before pricing.', note: 'Digital takeoff is designed for desktop.', images: [{ src: '/marketing/home/takeoff-workspace.webp', alt: 'Actual QuoteCore+ digital takeoff workspace with measured roof areas, ridges, hips and valleys', width: 2048, height: 1114 }] },
  { title: 'Price', heading: 'Your pricing. Applied consistently.', body: 'Smart Components™ keep your materials, labour, waste and pricing logic together. Set up the way your business works once, then reuse it on the next quote.', images: [{ src: '/how-it-works-smart-components-editor.png', alt: 'QuoteCore+ Smart Component™ editor with material and labour pricing', width: 1280, height: 795 }] },
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
