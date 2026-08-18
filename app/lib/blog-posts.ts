/**
 * Single source of truth for blog post metadata.
 *
 * Used by:
 *   - app/(marketing)/blog/[slug]/page.tsx  (renders posts)
 *   - app/sitemap.ts                         (includes posts in sitemap)
 *
 * The content imports stay in page.tsx because they use dynamic import()
 * which is page-specific. This file only holds the metadata needed by both
 * consumers: slug, title, description, date, lastModified.
 */

export type BlogCategory =
  | 'roofing-estimating'
  | 'construction-quoting'
  | 'digital-takeoffs'
  | 'contractor-business'
  | 'quotecore-guides'
  | 'comparisons'
  | 'ai';

export interface FaqItem {
  question: string;
  answer: string;
}

export interface VideoClipMeta {
  name: string;
  startOffset: number;
  endOffset?: number;
}

export interface BlogVideoMeta {
  videoId: string;
  title: string;
  description: string;
  uploadDate: string;
  duration: string;
  start?: number;
  clips?: VideoClipMeta[];
}

export interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;        // ISO date (datePublished)
  lastModified: string; // ISO date for sitemap
  draft?: boolean;     // if true, hidden from index, noindex, excluded from sitemap
  category?: BlogCategory; // primary topic for resource hubs
  faqs?: FaqItem[];    // FAQ questions for FAQPage schema
  video?: BlogVideoMeta; // primary embedded video for VideoObject schema
}

export const BLOG_POSTS: BlogPostMeta[] = [
  {
    slug: 'quotecore-plus-reviews',
    category: 'comparisons',
    title: 'QuoteCore+ Reviews: Is It Legit and Who Is It For?',
    description:
      'Wondering if QuoteCore+ is legit? Here\u2019s what the platform does, who it is for, how the free trial works, and how it helps construction businesses manage the workflow from quote to material orders, job management and invoicing.',
    date: '2026-05-27',
    lastModified: '2026-05-27',
  },
  {
    slug: 'quotecore-plus-vs-quotesmith',
    category: 'comparisons',
    title: 'QuoteCore+ vs QuoteSmith: Full Quote Workflow',
    description:
      'QuoteSmith and QuoteCore+ both help trades create better quotes, but they solve different problems. One focuses on proposal writing, the other on the workflow from measurement to quote, material orders, job management and invoicing.',
    date: '2026-05-23',
    lastModified: '2026-05-23',
  },
  {
    slug: 'roofing-quoting-software-uk',
    category: 'comparisons',
    title: 'How UK Roofing Contractors Are Getting Quotes Out Faster',
    description:
      'Many UK roofing businesses lose time after the site visit, when notes, photos, pricing and material details have to be pulled together manually. Here\u2019s how a better quote workflow helps.',
    date: '2026-05-06',
    lastModified: '2026-05-06',
  },
  {
    slug: 'roofing-quoting-software-vs-spreadsheets',
    category: 'comparisons',
    title: 'Roofing Quoting Software vs Spreadsheets: What Saves Time?',
    description:
      'Spreadsheets can work for roofing quotes, but they start to slow businesses down when measurements, pricing, approvals, material orders, job details and invoicing need to stay connected.',
    date: '2026-05-11',
    lastModified: '2026-05-11',
  },
  {
    slug: 'built-by-a-roofer',
    category: 'quotecore-guides',
    title: 'Built From Roofing Experience: The Story Behind QuoteCore+',
    description:
      'QuoteCore+ was shaped by real roofing and construction experience, with Shaun leading the product direction around the quoting and job workflow problems trades businesses deal with every day.',
    date: '2026-05-06',
    lastModified: '2026-05-06',
  },
  {
    slug: 'construction-quote-speed-checklist',
    category: 'construction-quoting',
    title: 'The Construction Quote Speed Checklist',
    description:
      'A practical checklist for construction businesses that want to send quotes faster without rushing the numbers or losing track of job details.',
    date: '2026-06-05',
    lastModified: '2026-06-05',
  },
  {
    slug: 'how-to-get-more-work-as-a-contractor',
    category: 'contractor-business',
    title: 'Get More Work as a Contractor: 7 Things to Fix First',
    description:
      'Most contractors don\u2019t struggle because they\u2019re bad at the work - they struggle because getting work is left to chance. Here are 7 things to fix first, plus a free weekly checklist.',
    date: '2026-06-13',
    lastModified: '2026-06-13',
  },
  {
    slug: 'best-quoting-software-nz',
    category: 'comparisons',
    title: 'Best Quoting Software for Contractors (2026) — NZ & UK',
    description:
      'Comparing quoting software for contractors: QuoteCore+, Tradify, Fergus, ServiceM8, Buildxact and Xero Projects on pricing, features and fit. NZ-focused with UK guidance.',
    date: '2026-07-15',
    lastModified: '2026-08-05',
  },
  {
    slug: 'best-quoting-software-au',
    category: 'comparisons',
    title: 'Best Quoting Software for Australian Tradies (2026)',
    description:
      'Compare the best quoting software for Australian builders and trades. Features, pricing in AUD, GST support, and AU-specific tools for roofers, builders, and contractors.',
    date: '2026-08-05',
    lastModified: '2026-08-05',
  },
  {
    slug: 'best-quoting-software-us',
    category: 'comparisons',
    title: 'Best Quoting Software for US Contractors (2026)',
    description:
      'Compare the best quoting software for US contractors. Features, pricing in USD, and trade-specific tools for roofers, builders, and home service businesses.',
    date: '2026-08-05',
    lastModified: '2026-08-05',
  },
  {
    slug: 'best-roofing-quoting-software-uk-2026',
    category: 'comparisons',
    title: 'Best Roofing Quoting Software UK (2026)',
    description:
      'Comparing the best roofing quoting software available to UK contractors in 2026. Honest breakdown of QuoteCore+, Sleepless Tradesman, Tradify, Jobber, Powered Now, Fergus, and EasyEstimate - with a comparison table and recommendations by business type.',
    date: '2026-06-15',
    lastModified: '2026-06-15',
    faqs: [
      { question: 'What is roofing quoting software?', answer: 'Roofing quoting software helps contractors turn measurements and job specifications into professional, priced quotes without spreadsheets or manual calculation. The best tools for roofers include workflows specific to roofing: digital takeoffs, component-level pricing, material calculations, and structured output that customers can read and act on.' },
      { question: 'What is the best roofing quoting software for UK contractors in 2026?', answer: 'The best option depends on your workflow. QuoteCore+ is the strongest for contractors quoting from plans who need a full workflow from measurement to quote, material orders, job management and invoicing. Sleepless Tradesman is a strong choice for sole traders doing high volumes of repair work who want AI-assisted quoting from customer photos. Tradify works well for small teams that need job management alongside quoting.' },
      { question: 'How long does it take to send a roofing quote with software?', answer: 'With a platform like QuoteCore+, most contractors send their first quote within minutes of entering their measurements. The goal is to quote the same day as the site visit - ideally before leaving. The delay in most quoting processes is not measurement but the admin that comes after it.' },
      { question: 'Do I need to be technical to use roofing quoting software?', answer: 'No. Modern quoting software is designed to be usable from day one. If you can use email and a computer, you can use most platforms on this list. The best ones require no setup beyond entering your pricing templates.' },
      { question: 'Is there free roofing quoting software for UK roofers?', answer: 'QuoteCore+ offers a 14-day free trial with no credit card required. Sleepless Tradesman has a free tier with a limited number of quotes per month. Most other platforms on this list do not offer a free option, though some include a trial period.' },
      { question: 'What should a professional roofing quote include?', answer: 'A professional roofing quote should include: a clear scope of work, itemised materials and labour, scaffold costs as a separate line item, your company details and accreditations, a validity period, and a way for the customer to accept or decline.' },
      { question: 'Can roofing quoting software help me win more jobs?', answer: 'Yes - indirectly. Research suggests the first contractor to respond wins a significant proportion of competitive quote situations. Software that helps you quote faster, and that produces a more professional output, improves your position in both dimensions.' },
    ],
  },
  {
    slug: 'how-to-calculate-roof-pitch',
    category: 'roofing-estimating',
    title: 'How to Calculate Roof Pitch for Your Quote',
    description:
      'Complete guide to roof pitch: what it is, the three ways it gets expressed (degrees, ratio, percentage), how to calculate it from measurements, common mistakes, and free tools that do the maths for you.',
    date: '2026-07-29',
    lastModified: '2026-07-29',
  },
  {
    slug: 'how-to-measure-a-roof',
    category: 'roofing-estimating',
    title: 'How to Measure a Roof for Materials (Complete Guide)',
    description:
      'Three ways to measure a roof (site visit, plans, digital takeoff), how to calculate actual surface area from plan dimensions with pitch factors, and free tools that handle the maths for you.',
    date: '2026-07-29',
    lastModified: '2026-07-29',
  },
  {
    slug: 'how-much-roofing-material',
    category: 'roofing-estimating',
    title: 'How Much Roofing Material Do You Need? Guide',
    description:
      'How to calculate tile, underlay, batten, and fixing quantities for any roofing job. Real coverage rates, waste allowances by roof type, and free tools that do the calculation for you.',
    date: '2026-07-29',
    lastModified: '2026-07-29',
  },
  {
    slug: 'how-to-price-a-roofing-job',
    category: 'roofing-estimating',
    title: 'How to Price a Roofing Job: Step-by-Step Pricing Guide',
    description:
      'Complete roofing pricing guide with worked example. Covers materials, labour, scaffold, disposal, overhead, profit margin, common pricing mistakes, and how to present your price professionally.',
    date: '2026-07-29',
    lastModified: '2026-07-29',
  },
  {
    slug: 'best-free-tools-for-roofers',
    category: 'quotecore-guides',
    title: 'Best Free Tools for Roofers and Contractors (2026)',
    description:
      'Complete list of the best free roofing and construction tools: takeoff builder, pitch calculator, area calculator, material calculator, quote generator, invoice generator, and 30+ specialised calculators. All free, no signup.',
    date: '2026-07-29',
    lastModified: '2026-07-29',
  },
  {
    slug: 'roofing-quote-example',
    category: 'roofing-estimating',
    title: 'Roofing Quote Example: Free Template and What to Include',
    description:
      'See a complete roofing quote example, learn what to include, avoid common omissions, and create your own professional roofing quotation with a free template.',
    date: '2026-08-14',
    lastModified: '2026-08-14',
    video: {
      videoId: '5ifiryxMBDQ',
      title: 'How to Use the QuoteCore+ Free Quote Generator',
      description:
        'Create a professional contractor quote step by step with the free QuoteCore+ quote generator.',
      uploadDate: '2026-08-11',
      duration: 'PT1M51S',
      clips: [
        { name: 'Add customer and business details', startOffset: 0, endOffset: 34 },
        { name: 'Build quote line items and pricing', startOffset: 34, endOffset: 78 },
        { name: 'Review and download the finished quote', startOffset: 78 },
      ],
    },
    faqs: [
      {
        question: 'What should a roofing quote include?',
        answer:
          'A roofing quote should identify both parties, define the roof and scope, list materials and labour, show the total and applicable tax, state exclusions and assumptions, set a validity period, explain payment terms, and provide a clear acceptance method.',
      },
      {
        question: 'Should a roofing quote itemise every material?',
        answer:
          'The customer-facing quote should be detailed enough to define the scope without exposing every internal cost. Grouping related materials and labour is often clearer, while the estimator keeps the full quantity and cost breakdown internally.',
      },
      {
        question: 'How long should a roofing quote remain valid?',
        answer:
          'The validity period should reflect supplier price stability, workload and project timing. Many contractors use a defined period such as 14 or 30 days, but the correct period depends on the job and local market.',
      },
    ],
  },
  {
    slug: 'how-to-quote-a-roof-from-plans',
    category: 'digital-takeoffs',
    title: 'How to Quote a Roof From Plans: Complete Workflow',
    description:
      'Learn how to quote a roof from plans: verify scale, complete the takeoff, apply pitch and waste, price the job, build the customer quote, send it and track the result.',
    date: '2026-08-14',
    lastModified: '2026-08-14',
    video: {
      videoId: 'AHXhlOuRAvw',
      title: 'Quote a Roof From Start to Finish with QuoteCore+',
      description:
        'Watch a complete roof move from plan calibration and digital takeoff to pricing, customer quote, sending, tracking, material order and invoice.',
      uploadDate: '2026-08-13',
      duration: 'PT19M11S',
      clips: [
        { name: 'Why the old roofing quote process breaks down', startOffset: 0, endOffset: 82 },
        { name: 'Set up Smart Components', startOffset: 107, endOffset: 183 },
        { name: 'Start the roof quote', startOffset: 183, endOffset: 250 },
        { name: 'Calibrate and measure the roof plan', startOffset: 250, endOffset: 641 },
        { name: 'Review pricing and margin', startOffset: 641, endOffset: 725 },
        { name: 'Create and send the customer quote', startOffset: 725, endOffset: 918 },
        { name: 'Track opens, acceptance and follow-ups', startOffset: 918, endOffset: 1029 },
        { name: 'Turn the quote into an order and invoice', startOffset: 1078 },
      ],
    },
    faqs: [
      {
        question: 'Can you quote a roof accurately from plans?',
        answer:
          'Yes, when the plans are current, clearly scaled and detailed enough for the required scope. Confirm uncertain dimensions, site conditions and hidden work before treating plan quantities as final.',
      },
      {
        question: 'What measurements are needed to quote a roof?',
        answer:
          'Typical measurements include roof areas, pitch, ridges, hips, valleys, barges or verges, eaves, penetrations, flashings and rainwater goods. The exact list depends on the roof system and quoted scope.',
      },
      {
        question: 'How long does it take to quote a roof from plans?',
        answer:
          'Time varies with roof complexity, plan quality and how much pricing logic is already configured. A repeatable digital workflow is generally faster than printing plans and rebuilding measurements in separate spreadsheets and quote documents.',
      },
    ],
  },
  {
    slug: 'how-to-do-a-roof-takeoff',
    category: 'digital-takeoffs',
    title: 'How to Do a Roof Takeoff: Complete Step-by-Step Guide',
    description:
      'Complete roof takeoff guide: measure roof area from plans, calculate pitch-adjusted quantities, separate roof planes and linear components, apply waste, and produce a material order. With free tools and video walkthroughs.',
    date: '2026-07-31',
    lastModified: '2026-07-31',
  },
  {
    slug: 'roofing-material-list',
    category: 'roofing-estimating',
    title: 'Roofing Material List: What You Need for Every Roof Type',
    description:
      'Complete roofing material list for every roof type: tiles, slates, shingles, metal sheets, flat roofs, and membranes. Covers underlay, battens, fixings, flashings, gutters, and accessories with free calculators for each.',
    date: '2026-07-31',
    lastModified: '2026-07-31',
  },
  {
    slug: 'how-to-create-an-invoice-for-contractors',
    category: 'construction-quoting',
    title: 'How to Create an Invoice: Free Guide for Contractors',
    description:
      'Step-by-step invoice guide for contractors: what to include, how to number invoices, describe work clearly, calculate tax, set payment terms, handle variations, and avoid common mistakes. With free invoice generator.',
    date: '2026-07-31',
    lastModified: '2026-08-14',
    video: {
      videoId: 'ntyS1giH5p0',
      title: 'A Better Way to Measure, Quote and Invoice with QuoteCore+',
      description:
        'See how QuoteCore+ connects measurement, quoting and invoicing in one contractor workflow.',
      uploadDate: '2026-06-29',
      duration: 'PT29S',
    },
  },
  {
    slug: 'how-to-send-a-purchase-order',
    category: 'construction-quoting',
    title: 'How to Send a Purchase Order to a Supplier',
    description:
      'Complete purchase order guide for contractors: what a PO includes, how to number and send it, avoid common mistakes, and connect quotes to material ordering. With free purchase order generator.',
    date: '2026-07-31',
    lastModified: '2026-07-31',
  },
  {
    slug: 'roofing-waste-calculation',
    category: 'roofing-estimating',
    title: 'Roofing Waste Calculation: How Much Extra Material to Order',
    description:
      'How to calculate roofing waste allowances by material type, roof complexity, and product format. Covers net vs gross vs order quantities, linear materials, fixings, and common mistakes. With free waste calculator.',
    date: '2026-07-31',
    lastModified: '2026-07-31',
  },
  {
    slug: 'construction-cost-estimator-guide',
    category: 'construction-quoting',
    title: 'Construction Cost Estimator: How to Budget Any Project',
    description:
      'Complete construction cost estimating guide: scope definition, quantity measurement, material pricing, labour estimation, subcontractors, overheads, risk, and margin. With free construction and concrete calculators.',
    date: '2026-07-31',
    lastModified: '2026-07-31',
  },
  {
    slug: 'roof-replacement-cost-guide-uk',
    category: 'roofing-estimating',
    title: 'Roof Replacement Cost Guide: UK Estimate',
    description:
      'How to build an accurate roof replacement cost estimate in the UK: factors that drive cost, material price ranges, labour and access, stripping and disposal, and how to present a replacement quote professionally.',
    date: '2026-07-31',
    lastModified: '2026-07-31',
  },
  {
    slug: 'reusable-quoting-templates-smart-components',
    category: 'quotecore-guides',
    title: 'Reusable Quoting Templates: Smart Components',
    description:
      'How to build reusable quoting templates with Smart Components: choose repeatable work units, define inputs, add materials, build calculation logic, separate cost and price, and test against completed jobs.',
    date: '2026-07-31',
    lastModified: '2026-08-14',
    video: {
      videoId: 'aFXJwOiliPI',
      title: 'What Are Smart Components?',
      description:
        'Learn how QuoteCore+ Smart Components store repeatable materials, labour, waste, measurements and pricing logic for faster contractor quotes.',
      uploadDate: '2026-07-07',
      duration: 'PT4M19S',
      clips: [
        { name: 'What a Smart Component stores', startOffset: 0, endOffset: 76 },
        { name: 'How components speed up quoting', startOffset: 76, endOffset: 181 },
        { name: 'Using components across the workflow', startOffset: 181 },
      ],
    },
  },
  {
    slug: 'how-to-follow-up-on-a-quote',
    category: 'contractor-business',
    title: 'How to Follow Up on a Quote Without Losing the Job',
    description:
      'Practical guide to following up on quotes: when to follow up, what to say, how many times, handling objections, and using automated follow-ups to win more jobs without chasing.',
    date: '2026-07-31',
    lastModified: '2026-08-14',
    video: {
      videoId: 'AHXhlOuRAvw',
      title: 'Automatic Quote Follow-Ups and Customer Tracking in QuoteCore+',
      description:
        'Watch QuoteCore+ send a customer quote, trigger automatic messages, track opens and record accepted or declined outcomes.',
      uploadDate: '2026-08-13',
      duration: 'PT19M11S',
      start: 918,
      clips: [
        { name: 'Automatic quote follow-ups', startOffset: 918, endOffset: 981 },
        { name: 'Track quote opens and customer decisions', startOffset: 982, endOffset: 1029 },
      ],
    },
  },
  {
    slug: 'how-to-start-a-roofing-business-uk',
    category: 'contractor-business',
    title: 'How to Start a Roofing Business in the UK: Practical Guide',
    description:
      'Complete guide to starting a roofing business in the UK: qualifications, insurance, pricing, finding work, quoting, invoicing, and growing from sole trader to employer. With free tools and templates.',
    date: '2026-07-31',
    lastModified: '2026-07-31',
  },
  {
    slug: 'ai-roof-measuring',
    category: 'ai',
    title: 'AI Roof Measuring: How to Measure a Roof with AI in 2026',
    description:
      'What AI roof measuring can actually do in 2026: how AI traces roof plans, detects lines, and classifies geometry. Where it excels, where it struggles, and what always needs human verification.',
    date: '2026-07-29',
    lastModified: '2026-07-29',
    draft: true,
  },
  {
    slug: 'ai-roofing-tools-guide',
    category: 'ai',
    title: 'AI Roofing Tools: The Complete Guide to AI in Roofing (2026)',
    description:
      'Honest guide to AI in roofing: the three layers of AI technology, what it does well, what it does poorly, what always needs a human, and how to evaluate AI roofing tools for your business.',
    date: '2026-07-29',
    lastModified: '2026-07-29',
    draft: true,
  },
  {
    slug: 'roofing-estimating-vs-quoting',
    category: 'roofing-estimating',
    title: 'Roofing Estimating vs Quoting: What\'s the Difference?',
    description:
      'Estimating and quoting are often confused but serve different purposes in roofing. Learn what each involves, how they connect, and why combining them in one workflow saves time.',
    date: '2026-08-09',
    lastModified: '2026-08-09',
    faqs: [
      { question: 'Is estimating the same as quoting?', answer: 'No. Estimating calculates the true cost of delivering the job. Quoting presents a price to the customer. They are connected stages, but they serve different purposes and produce different outputs.' },
      { question: 'Can I estimate without creating a quote?', answer: 'Yes. Estimating is an internal exercise. You can estimate a job to decide whether to tender, what margin to target, or whether the work fits your schedule. You only create a quote when you are ready to present a price to the customer.' },
      { question: 'Do I need separate software for estimating and quoting?', answer: 'Not necessarily. QuoteCore+ handles both in one workflow — the estimate is built from takeoff measurements and Smart Components, and the quote is generated from the same data.' },
      { question: 'What\'s included in a roofing estimate vs a quote?', answer: 'An estimate typically includes material quantities, waste allowances, labour hours, rates, and a total cost. A quote includes the price the customer pays, scope of work, terms, payment schedule, and validity period. The quote may simplify or group the estimate\'s line items for presentation.' },
    ],
  },
  {
    slug: 'how-to-estimate-roofing-materials',
    category: 'roofing-estimating',
    title: 'How to Estimate Roofing Materials Accurately: A Complete Guide',
    description:
      'Learn how to estimate roofing materials with accuracy. Covers roof measurement, material quantities, waste allowances, and how digital takeoff tools reduce errors.',
    date: '2026-08-09',
    lastModified: '2026-08-09',
    faqs: [
      { question: 'How do I calculate how many roofing sheets I need?', answer: 'Divide the roof width by the sheet cover width to get the number of sheets. For length, use the roof slope length (not the plan length). Round up to full sheets and add the waste allowance. Include flashings, screws, and closures separately.' },
      { question: 'What waste percentage should I add for roofing materials?', answer: 'It depends on the material and roof complexity. Metal roofing typically needs 5-10%, tiles 5-12%, shingles 10-15%, and slate 15-20%. Complex roofs with hips, valleys, and dormers generate more waste than simple gables.' },
      { question: 'Do I need to measure the roof myself or can I use plans?', answer: 'You can use plans if they are current, accurately scaled, and detailed enough. Verify key dimensions on site if possible. QuoteCore+ lets you measure directly from PDF plans using digital takeoff tools, and AI Scan Assist can auto-detect roof geometry from a plan.' },
      { question: 'Can software estimate roofing materials automatically?', answer: 'Yes. QuoteCore+ Smart Components™ store material calculations, waste rules, and pricing for each roof element. When you measure a roof area or length in the takeoff, the component applies the correct materials and quantities automatically.' },
    ],
  },
  {
    slug: 'manual-vs-digital-roof-takeoff',
    category: 'digital-takeoffs',
    title: 'Manual vs Digital Roof Takeoff: Time, Cost and Accuracy Compared',
    description:
      'Manual roof takeoff with a scale rule vs digital takeoff with software. Compare time per job, accuracy, material waste, and cost to decide which method wins.',
    date: '2026-08-09',
    lastModified: '2026-08-09',
    faqs: [
      { question: 'Is digital roof takeoff accurate?', answer: 'Yes, when the plan is accurately scaled and the software uses the embedded scale correctly. Digital takeoff eliminates the measurement error of a physical scale ruler and the transcription error of moving numbers from paper to spreadsheet. Always verify key dimensions, especially if the plan may have been re-scaled.' },
      { question: 'Do I need special hardware for digital takeoff?', answer: 'No. QuoteCore+ runs in a web browser on any laptop or desktop. You upload a PDF plan and measure on screen. No drawing tablet, large monitor, or specialised hardware is required.' },
      { question: 'Can AI really measure a roof from a plan?', answer: 'AI Scan Assist can identify roof areas, ridges, hips, valleys, and barges from a digital roof plan. It does the initial detection — you review and adjust every measurement before committing. The AI speeds up the first pass, but the estimator stays in control of the final numbers.' },
      { question: 'How long does digital takeoff take compared to manual?', answer: 'For a standard residential roof, digital takeoff typically takes 10-20 minutes compared to 45-90 minutes for manual. With AI Scan Assist, the initial detection can take as little as 5-10 minutes, with additional time for review and adjustment. The exact time depends on roof complexity and plan quality.' },
    ],
  },
  {
    slug: 'chrome-roof-pitch-calculator-extension',
    category: 'roofing-estimating',
    title: 'Free Roof Pitch Calculator for Chrome: Pitch, Angle and Rafter Length Instantly',
    description:
      'The QuoteCore+ Roof Pitch Calculator Chrome extension works out pitch, angle, slope and rafter length as you type, and converts rise/run, degrees and ratios. Free, no account.',
    date: '2026-08-18',
    lastModified: '2026-08-18',
    faqs: [
      { question: 'Is the QuoteCore+ Roof Pitch Calculator extension free?', answer: 'Yes. The extension is completely free with no paid tier, no trial limit and no account required. It installs from the Chrome Web Store like any other extension.' },
      { question: 'Does the roof pitch calculator extension need an account?', answer: 'No. It is a self-contained popup calculator that opens when you click the toolbar icon. It does not ask for any personal details and does not connect to an account.' },
      { question: 'What data does the roof pitch extension access?', answer: 'None beyond its own popup. The extension does not request permissions to read your browsing history, tabs, or website data. It is a calculator that opens on click and closes when you are done.' },
      { question: 'Does the extension work in Edge, Brave, Arc or Opera?', answer: 'Yes. Any Chromium-based browser can install extensions from the Chrome Web Store, including Edge, Brave, Arc and Opera.' },
      { question: 'Can the extension convert roof pitch to degrees?', answer: 'Yes. Enter rise and run, a pitch ratio, or an angle, and the extension shows the equivalent values in the other formats, plus rafter length from span and pitch.' },
    ],
  },
  {
    slug: 'how-to-reduce-roofing-waste',
    category: 'roofing-estimating',
    title: 'How to Reduce Roofing Waste in Estimates: 7 Practical Strategies',
    description:
      'Roofing waste eats your profit margins. Learn 7 practical strategies to reduce waste in your estimates, from accurate takeoffs to Smart Components that apply the right waste factor automatically.',
    date: '2026-08-09',
    lastModified: '2026-08-09',
    faqs: [
      { question: 'What is a typical waste percentage for roofing?', answer: 'It depends on the material. Metal roofing typically needs 5-10%, concrete tiles 5-8%, clay tiles 7-12%, asphalt shingles 10-15%, and slate 15-20%. Roof complexity, crew experience, and site conditions also affect the actual waste generated.' },
      { question: 'How do I calculate roofing waste?', answer: 'Calculate the net quantity (measured area or length), apply the waste percentage for the material type, and round up to the nearest supplier pack size. For example: 120 m² net area at 8% waste = 129.6 m² gross. If packs cover 2.4 m², order 54 packs.' },
      { question: 'Does roof pitch affect waste?', answer: 'Pitch itself does not directly increase waste, but steeper roofs can be harder to work on, which may increase breakage and cutting errors. Pitch does affect the total surface area — a steeper roof has more covering area than the plan area, which must be calculated correctly before applying waste.' },
      { question: 'Can software calculate waste automatically?', answer: 'Yes. QuoteCore+ Smart Components™ store waste rules by material type. When you measure a roof area or length, the component applies the correct waste percentage and produces the gross quantity automatically. This eliminates manual calculation errors and ensures consistent allowances across jobs.' },
    ],
  },
  {
    slug: 'ai-quoting-software',
    category: 'ai',
    title: 'AI Quoting Software: Can AI Write Quotes for Contractors?',
    description:
      'Can AI write quotes for contractors? What AI quoting software can do (draft line items, calculate materials, format documents) and what it cannot do (set prices, assess job difficulty, define scope).',
    date: '2026-07-29',
    lastModified: '2026-07-29',
    draft: true,
  },
];

/** Map slug -> BlogPostMeta for quick lookups. */
export const BLOG_POST_MAP = new Map(BLOG_POSTS.map((p) => [p.slug, p]));

/** Get all blog slugs (for generateStaticParams). */
export function getBlogSlugs(): string[] {
  return BLOG_POSTS.map((p) => p.slug);
}

/** Get posts visible on the blog index (excludes drafts). */
export function getPublishedPosts(): BlogPostMeta[] {
  return BLOG_POSTS.filter((p) => !p.draft);
}

/** Get posts for the sitemap (excludes drafts). */
export function getSitemapPosts(): BlogPostMeta[] {
  return BLOG_POSTS.filter((p) => !p.draft);
}

/** Get published posts by category. */
export function getPostsByCategory(category: BlogCategory): BlogPostMeta[] {
  return BLOG_POSTS.filter((p) => !p.draft && p.category === category);
}

/** All blog categories with display names. */
export const BLOG_CATEGORIES: { slug: BlogCategory; title: string; description: string }[] = [
  { slug: 'roofing-estimating', title: 'Roofing Estimating Guides', description: 'Measurement, pricing, waste, materials, and calculations for roofing contractors.' },
  { slug: 'construction-quoting', title: 'Construction Quoting Guides', description: 'Quote workflow, invoicing, purchase orders, and cost estimating for construction trades.' },
  { slug: 'digital-takeoffs', title: 'Digital Takeoff Guides', description: 'Roof takeoff, measurement, and digital plan reading for contractors.' },
  { slug: 'contractor-business', title: 'Contractor Business Guides', description: 'Lead generation, starting a business, quote follow-up, and growing a trade company.' },
  { slug: 'quotecore-guides', title: 'QuoteCore+ Product Guides', description: 'How to use Smart Components, free tools, and the QuoteCore+ quoting workflow.' },
  { slug: 'comparisons', title: 'Software Comparisons', description: 'Roofing quoting software comparisons, reviews, and alternatives.' },
  { slug: 'ai', title: 'AI in Roofing and Construction', description: 'AI roof measuring, AI roofing tools, and AI quoting software guides.' },
];
