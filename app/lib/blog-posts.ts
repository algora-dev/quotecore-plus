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
    slug: 'price-a-job-from-measurements',
    category: 'construction-quoting',
    title: 'How to Price a Job From Your Measurements',
    description:
      'Already measured the job? Learn how to turn areas, lengths and quantities into materials, labour and pricing using reusable components instead of manually rebuilding calculations each time.',
    date: '2026-08-24',
    lastModified: '2026-08-24',
    faqs: [
      { question: 'How do I price a job from site measurements?', answer: 'Turn each measurement into a quantity (applying waste where relevant), multiply by your material and labour rates, and total the lines. Reusable pricing components save those rules once so every new measurement set flows through the same logic.' },
      { question: 'How do I turn a takeoff into a quote?', answer: 'Take your takeoff quantities (areas, lengths, counts), price them through reusable components, then convert the priced output into a customer-facing quote in one click - no retyping.' },
      { question: 'Can I calculate materials and labour from measurements?', answer: 'Yes. Each component carries both a material rate and a labour rate plus waste rules, so quantities, materials, labour and totals come out together.' },
      { question: 'Can I use my own material and labour rates?', answer: 'Yes. Every rate is yours - nothing is locked to a supplier price book.' },
      { question: 'Can I import prices from Excel or CSV?', answer: 'Yes. Upload a CSV export of your price list, map your columns, and turn rows into reusable components - up to 7 at a time in the free tool.' },
      { question: 'Is the measurement-to-quote tool free?', answer: 'Yes, the core workflow is free with no signup required.' },
      { question: 'Do I need to create an account?', answer: 'Not for the free workflow. An account is only needed to save components and continue in the QuoteCore+ app.' },
      { question: 'Can I convert the result into a customer quote?', answer: 'Yes - one click sends the priced lines into the Free Quote Generator without retyping anything.' },
      { question: 'Can I reuse the pricing rules on future jobs?', answer: 'That is the core idea: save the pricing logic once, then reuse it every time you measure a new job.' },
      { question: 'Which trades can use this workflow?', answer: 'Roofing, cladding, flooring, fencing, decking, landscaping, concrete, carpentry and any measured work where quantities drive pricing.' },
    ],
  },
  {
    slug: 'construction-estimating-spreadsheet-alternative',
    category: 'construction-quoting',
    title: 'Is There a Better Alternative to a Construction Estimating Spreadsheet?',
    description:
      'Spreadsheets can price jobs well, but they become slow when formulas, copying and quoting are spread across multiple files. See a free reusable alternative built for measured jobs.',
    date: '2026-08-24',
    lastModified: '2026-08-24',
    faqs: [
      { question: 'Is a construction estimating spreadsheet still worth using?', answer: 'Yes, if your estimating volume is low, one person understands the file, pricing rarely changes and there is little copying between systems. The reason to change is workflow cost, not licence cost.' },
      { question: 'What is the alternative to an estimating spreadsheet?', answer: 'A reusable pricing component system: save the pricing logic (materials, waste, labour, rates) once as components, then enter each job\u2019s measurements and get a priced output you can convert directly into a quote.' },
      { question: 'Can I import my spreadsheet pricing into QuoteCore+?', answer: 'Yes. Export your price list as CSV, upload it, map your columns, and turn rows into reusable components. You keep your pricing work - you move it into a reusable workflow.' },
      { question: 'Is the Measurement-to-Quote Tool free?', answer: 'Yes - free to use with no signup required for the core workflow.' },
    ],
  },
  {
    slug: 'roofing-estimating-spreadsheet-vs-software',
    category: 'roofing-estimating',
    title: 'Still Quoting Roofing Jobs in Excel? When Spreadsheets Stop Saving Time',
    description:
      'Still pricing roofing jobs in Excel? See where spreadsheets work, where they start costing time, and how to switch without rebuilding your estimating system from scratch.',
    date: '2026-08-26',
    lastModified: '2026-08-26',
    faqs: [
      { question: 'Is Excel good enough for roofing estimates?', answer: 'It can be. If you quote a small number of straightforward jobs and your spreadsheet is accurate, easy to maintain and quick to use, there may be no reason to change. Dedicated estimating software becomes more useful when you are repeatedly copying jobs, re-entering measurements, maintaining complicated formulas or moving the same information between several systems.' },
      { question: 'What can replace a roofing estimating spreadsheet?', answer: 'Roofing estimating software can replace the calculation and quoting parts of a spreadsheet while adding reusable materials, labour, waste rules, digital takeoffs, quote generation and other connected workflows. The right choice depends on how you currently estimate and which parts of your process actually need improving.' },
      { question: 'Can I move my existing roofing pricing into QuoteCore+?', answer: 'Yes. Your existing material pricing, labour rates, waste allowances and estimating logic can be recreated as Smart Components. You can build these yourself or use the Done-For-You Setup if you would rather have QuoteCore+ configure the agreed setup for you.' },
      { question: 'Do I need to stop using my spreadsheet immediately?', answer: 'No. Running both systems for several jobs is often the safest way to switch. Compare familiar jobs, check the calculations and move across once you are comfortable with the new workflow.' },
      { question: 'Can someone set up roofing estimating software for me?', answer: "Yes. QuoteCore+'s Done-For-You Setup is designed for contractors who want a better estimating system but do not want to configure everything themselves. We first check whether QuoteCore+ suits your workflow, then use the pricing and information you provide to build the agreed setup and help you learn how to use it." },
      { question: 'Does QuoteCore+ only work for roofing?', answer: 'No. QuoteCore+ was built for roofing first, but Smart Components can represent products, materials, services and labour across other measured trades where reusable pricing and calculation rules are useful.' },
    ],
  },
  {
    slug: 'simple-roofing-estimating-software',
    category: 'roofing-estimating',
    title: 'I Need Better Estimating Software — But I Don\u2019t Want Another Complicated App',
    description:
      'Need better roofing estimating software but don\u2019t want another complicated app? Learn what simple estimating software should actually do — and how to switch without the setup pain.',
    date: '2026-08-26',
    lastModified: '2026-08-26',
    faqs: [
      { question: 'What is the easiest roofing estimating software to use?', answer: 'The easiest system depends on how you already work. Look for software that lets you reuse your common pricing, labour and material rules, supports the measurements you already have, and avoids forcing you to configure features you do not need.' },
      { question: 'Is roofing estimating software difficult to set up?', answer: 'It can be if you have a large amount of existing pricing, products and labour rules to move across. A sensible approach is to start with your most common work and build gradually, or use a setup service if the software provider offers one.' },
      { question: 'Can estimating software be set up for me?', answer: 'Yes. QuoteCore+ offers a Done-For-You Estimating Setup where we first check whether the system suits your workflow, then configure agreed components, pricing and setup using the information you provide.' },
      { question: 'Do I need a full roofing CRM just to estimate and quote?', answer: 'Not necessarily. A full CRM can be useful for businesses that need broader sales and job-management tools, but contractors who mainly want to improve measurement, estimating and quoting may prefer a more focused system.' },
      { question: 'Can I use estimating software if I already have roof measurements?', answer: 'Yes. You should not need to remeasure a job simply because you changed estimating systems. QuoteCore+ supports workflows where you already have the measurements, as well as digital takeoff for plan-based jobs.' },
      { question: 'What should I look for in simple contractor estimating software?', answer: 'Look for reusable pricing, clear calculations, flexible labour and waste rules, easy measurement entry, quote generation, straightforward setup and support when you need it. The system should remove repetitive work rather than create more administration.' },
    ],
  },
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
    title: 'Best Quoting Software NZ (2026): 6 Tools Compared',
    description:
      'Compare QuoteCore+, Tradify, Fergus and ServiceM8 on pricing, features and NZ trade fit. Free tools and free trial to get you quoting faster.',
    date: '2026-07-15',
    lastModified: '2026-08-28',
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
    slug: 'how-to-measure-a-roof-from-a-pdf-plan',
    category: 'roofing-estimating',
    title: 'How to Measure a Roof from a PDF Plan (2026 Guide)',
    description:
      'Measure a roof from a PDF plan: verify or calibrate the scale, work plane by plane, apply pitch factors, and price linear components. Free Roof Takeoff Builder, no signup.',
    date: '2026-08-28',
    lastModified: '2026-08-28',
    faqs: [
      { question: 'Can you measure a roof from a PDF plan?', answer: 'Yes. Verify the drawing scale against a labelled dimension first (or calibrate from any known dimension), then measure each roof plane on screen, apply pitch factors for true area, and measure ridges, hips, valleys, verges and eaves separately. The free Roof Takeoff Builder does this from an uploaded PDF with no account required.' },
      { question: 'What if the PDF plan has no scale?', answer: 'Calibrate from a known dimension: any labelled dimension string, or a standard component drawn to scale such as a door leaf or parking bay. Measure it on screen, divide the real size by the measured size, and apply that factor to every other measurement. If nothing on the drawing has a knowable size, request a scaled drawing or measure on site.' },
      { question: 'How accurate is measuring from a PDF plan?', answer: 'Vector PDFs exported from CAD hold their scale exactly once calibrated, so accuracy is limited mainly by your measuring care. Scanned plans add distortion risk. The bigger accuracy risk is not the measuring but the drawing itself: stale revisions, grid vs external dimensions, and details hidden on other sheets.' },
      { question: 'Do I still need a site visit if I measure from the PDF?', answer: 'Not always. New-build and fully specified work can usually be quoted from plans alone. You need a site visit when access, existing damage, or as-built deviations could change the scope. A hybrid works well: full takeoff from the PDF now, short site check before contract.' },
    ],
  },
  {
    slug: 'quoting-from-plans-vs-site-visits',
    category: 'construction-quoting',
    title: 'Quoting From Plans vs Site Visits: When to Visit',
    description:
      'When contractors can safely quote from PDF plans alone, when a site visit is unavoidable, and the hybrid approach that gets the quote out same day without carrying the risk.',
    date: '2026-08-28',
    lastModified: '2026-08-28',
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
  {
    slug: 'do-professional-quotes-win-more-jobs',
    category: 'contractor-business',
    title: 'Do Professional Quotes Win More Jobs? What the Evidence Says',
    description:
      'Does a professional-looking quote actually win more work? We break down what matters - presentation, speed, clarity - and how to test it free.',
    date: '2026-08-23',
    lastModified: '2026-08-23',
    faqs: [
      { question: 'Do professional quotes really win more jobs?', answer: 'There is no single verified percentage, and any specific number should be treated with suspicion. What the available evidence supports is more modest: clear, well-structured quotes make an offer easier to understand and compare, official guidance stresses clear written scope and pricing, and fast response to enquiries is linked to materially better lead outcomes. Presentation helps your position - it is not a guarantee.' },
      { question: 'What makes a quote look professional?', answer: 'Business details and branding, an itemised scope separating materials and labour, plain-language inclusions and exclusions, a validity period, payment terms, and a clean layout the customer can read and compare. Presentation matters because it reduces the perceived risk of saying yes.' },
      { question: 'Does it matter how fast I send a quote?', answer: 'Probably, though the direct evidence is about enquiries rather than quotes. Harvard Business Review research on online sales leads found qualification odds fall sharply as response time increases. Sending your quote the same day as the site visit keeps you in the conversation while it is still live.' },
      { question: 'Can I test this without paying for software?', answer: 'Yes. The QuoteCore+ free quote generator builds itemised, professional quotes free with no signup. Send your next 10 quotes through it, same-day, and compare your win rate against your previous quotes.' },
    ],
  },
  {
    slug: 'how-to-measure-a-roof-online',
    category: 'digital-takeoffs',
    title: 'How to Measure a Roof Online for Free (From Any Plan Image)',
    description:
      'Measure a roof from a plan image online - free, no signup. Upload, set the scale, and get pitch-calculated areas, ridges, hips and valleys.',
    date: '2026-08-23',
    lastModified: '2026-08-23',
    faqs: [
      { question: 'Can I measure a roof online for free?', answer: 'Yes. The QuoteCore+ free roof takeoff tool lets you upload a plan image, set the scale, and measure roof areas, ridges, hips, valleys and gutters entirely free - no signup, no credit card, nothing saved.' },
      { question: 'Can I measure a roof from a photo or image?', answer: 'Yes, as long as the image is a plan or drawing you can calibrate: draw a line along any known true dimension, enter its length, and every measurement is to scale. A clear screenshot or export of a PDF plan works well.' },
      { question: 'Can I upload a PDF plan?', answer: 'Not yet. The free tool accepts PNG, JPG and WebP images. Export or screenshot the PDF page as an image first - virtually any PDF viewer can do this.' },
      { question: 'Do I need an account to measure a roof online?', answer: 'No. Measuring and getting the full output is completely free with no signup. An account is only needed if you want to save a takeoff and continue into the QuoteCore+ app.' },
      { question: 'Does the free tool handle roof pitch?', answer: 'Yes. Every length is pitch-calculated, converting plan measurements to true roof measurements automatically. Pitch can be entered as degrees or a ratio like 6:12, and units as metric, imperial or roofing squares.' },
    ],
  },
  {
    slug: 'margin-vs-markup',
    category: 'construction-quoting',
    title: 'Margin vs Markup: The Difference Explained (With Free Calculator)',
    description:
      'Margin and markup are not the same - get it wrong and you underprice. Learn the difference and set different margins per item with our free calculator.',
    date: '2026-08-23',
    lastModified: '2026-08-23',
    faqs: [
      { question: 'What is the difference between margin and markup?', answer: 'Margin is profit as a percentage of the selling price; markup is profit as a percentage of the cost price. A £100 cost sold at £125 has 25% markup and 20% margin. Margin divides by the sell price, so it is always the smaller number for the same price.' },
      { question: 'How do I add margin to a quote?', answer: 'Convert margin to a selling price with: sell = cost divided by (1 minus margin%). A 20% margin on £1,000 of cost is £1,250. Do not multiply cost by 1.20 - that is markup and only earns 16.7% margin.' },
      { question: 'Can I have different margins for each item in a quote?', answer: 'Yes. In the free margin calculator Line-by-line mode, set a default margin, then override the margin on any individual line. Blank lines inherit the default, and totals update live so you can see the blended margin across the whole quote.' },
      { question: 'How do I convert margin to markup?', answer: 'Markup % = (margin / (1 - margin)) x 100. So 20% margin equals 25% markup, 30% margin equals 42.9% markup, and 50% margin equals 100% markup.' },
      { question: 'What margin should a contractor charge?', answer: 'There is no universal number - it depends on trade, overheads, job risk and local competition. What matters is pricing with sell = cost / (1 - margin%) so the margin you intend is the margin you get, and making sure it covers overheads with real profit left over.' },
    ],
  },
  {
    slug: 'can-chatgpt-create-a-quote',
    category: 'ai',
    title: 'Can ChatGPT Create a Quote, Invoice or Purchase Order?',
    description:
      'Yes, ChatGPT can create a good quote. But editing and repeating the process in chat can become slow. See how a free structured AI quote generator works instead.',
    date: '2026-08-23',
    lastModified: '2026-08-23',
    faqs: [
      { question: 'Can ChatGPT create a quote?', answer: 'Yes. It can create a good first draft from instructions or supplied information. For repeated use, a structured quote generator can make detailed editing and consistency easier.' },
      { question: 'Can ChatGPT create an invoice?', answer: 'Yes. General AI can draft an invoice, but customer details, tax, quantities, prices and totals should be checked before sending.' },
      { question: 'Can ChatGPT create a purchase order?', answer: 'Yes. It can draft a PO from supplied information. A structured PO generator can be easier when documents need consistent fields and repeatable formatting.' },
      { question: 'Can AI calculate a quote accurately?', answer: 'AI can perform calculations, but customer-facing prices, quantities, tax and totals should always be verified before sending - whether the document came from chat or a structured tool.' },
      { question: 'Is there a free AI quote generator?', answer: 'Yes. The QuoteCore+ free quote generator includes AI-assisted input (image upload and job description) with structured, editable output. AI-assisted input has a small number of free scans per day; everything else is unlimited.' },
      { question: 'Do I need to sign up to use the QuoteCore+ quote generator?', answer: 'No. The free quote generator, invoice generator and purchase order generator all work without an account. Signing up is only needed for the wider QuoteCore+ workflow - saved documents, tracking, takeoff and connected quoting.' },
      { question: 'Is ChatGPT better than quoting software?', answer: 'It depends on the task. ChatGPT is excellent for drafting and one-off work. Quoting software is usually better for repeatable, structured documents that need precise editing, consistent fields and connected workflows.' },
    ],
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
