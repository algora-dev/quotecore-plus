import type { Capture, ShowcaseFeature } from './showcase-types';

/** Owner-editable story and capture manifest. All scenes are editorial examples,
 * not recorded app output. Keep placeholders labelled until real captures exist.
 * A request can be a phone screenshot and its result a desktop or phone capture.
 * Do not crop controls or sensitive content automatically; supply approved assets.
 */
function capture(label: string, alt: string, caption: string, portrait = false): Capture {
  return { src: '', label, alt, caption, width: portrait ? 900 : 1440, height: portrait ? 1500 : 1080 };
}

const finishedQuote: Capture = {
  src: '/marketing/current-ux/customer-quote-document.webp',
  label: 'Finished customer quotation',
  alt: 'Customer-facing QuoteCore+ quote document with options to accept, request changes, decline or download a PDF.',
  caption: 'A finished QuoteCore+ quotation, including the customer’s options to accept, request changes, decline or download a PDF.',
  width: 1021,
  height: 1311,
};

export const showcaseFeatures: readonly ShowcaseFeature[] = [
  {
    id: 'assistant', label: 'Smart Assistant', eyebrow: 'Your voice. Your business.',
    descriptor: 'A conversation that gets work done.', beta: true,
    scenes: [
      {
        id: 'meet-assistant', label: 'Meet your assistant', icon: 'mic',
        heading: 'Tell the app what to do.\nIt does the work.',
        body: 'Measure, price and quote manually, or tell the Smart Assistant to do it for you by voice or text.',
        benefit: 'Works on mobile and desktop.|Tell the app what you need by voice or text.|Stay in control of important changes.',
        context: 'You stay in control of what the assistant can do. Review important changes before using them.',
        inputLabel: 'Talk or type naturally',
        input: 'I need to price a roofing job. Can you start the quote with my usual components?',
        outputTitle: 'Your instructions.\nYour workflow.', outputSubtitle: 'Assistant introduction · Illustrative example',
        outputRows: [{ label: 'Tell it', value: 'What you need done' }, { label: 'It helps', value: 'With your job and pricing' }, { label: 'You decide', value: 'What to review or approve' }],
        request: capture('Talk to QuoteCore+', 'Smart Assistant conversation started on a mobile phone', 'Voice or text, wherever you are working.', true),
        result: capture('See it happen', 'QuoteCore+ showing the resulting draft or suggested action', 'Use the app without navigating every tool.'),
      },
      {
        id: 'voice-to-quote', label: 'Voice to quote', icon: 'mic',
        heading: 'Say the job.\nGet the quote.',
        body: 'Describe the job by voice or text and QuoteCore+ uses your saved Smart Components™ and pricing to prepare a quote ready for review.',
        benefit: 'Describe measurements, pitch and job details naturally.|Apply your own component library and pricing.|Generate a customer-ready quotation without building it line by line.',
        context: '',
        inputLabel: 'Example voice request',
        input: 'Draft a quote for 120 m² of roofing at 24 River Road. Use my standard roof components.',
        outputTitle: 'A quote draft.\nNot a blank page.', outputSubtitle: '24 River Road · Illustrative example',
        outputRows: [{ label: 'Roof covering', value: '120 m²' }, { label: 'Pricing', value: 'Your saved components' }, { label: 'Next step', value: 'Review the draft' }],
        request: { src: '/marketing/feature-showcase/assistant-voice-request.jpg', label: 'The request', alt: 'QuoteCore+ Smart Assistant voice note asking for a new roofing quote using saved components and pricing', caption: 'Describe the job naturally by voice or text.', width: 591, height: 1280 },
        result: { src: '/marketing/feature-showcase/assistant-voice-result.jpg', label: 'The result', alt: 'Customer-facing QuoteCore+ quotation created from the Smart Assistant request', caption: 'Review the finished quotation created from your saved pricing.', width: 591, height: 1280 },
      },
      {
        id: 'find-details', label: 'Find the detail', icon: 'search',
        heading: 'Ask the question.\nSkip the digging.',
        body: 'Find specific details in your existing quotes and job information without opening document after document.',
        benefit: 'Ask about any existing quote or job.|Find measurements, pricing and allowances.|Skip searching through individual records.',
        context: '',
        inputLabel: 'Example question',
        input: 'What roof area is in the River Road quote, and which flashings did we allow for?',
        outputTitle: 'The detail.\nBack in view.', outputSubtitle: 'Existing quote · Illustrative example',
        outputRows: [{ label: 'Roof area', value: '120 m²' }, { label: 'Flashings', value: 'Ridge and barge included' }, { label: 'Record', value: 'River Road quote' }],
        request: capture('Your question', 'A question to Smart Assistant about roof area and flashing allowances in an existing quote', 'Ask about the job, not where the file is.', true),
        result: capture('The answer', 'Smart Assistant displaying details from the requested quote', 'The relevant information from your account.'),
      },
      {
        id: 'manage-pricing', label: 'Update pricing', icon: 'components',
        heading: 'Change your pricing.\nSkip the hassle.',
        body: 'Ask the assistant to update component pricing or create a new Smart Component™. Keep your library useful without starting from scratch.',
        benefit: 'Update rates with a simple instruction.|Create new Smart Components™ by voice or text.|Review changes before using them.',
        context: '',
        inputLabel: 'Example pricing request',
        input: 'Change ridge flashing to $18 per metre in my component library. Leave labour unchanged.',
        outputTitle: 'Your component.\nYour new rate.', outputSubtitle: 'Fictitious rate · Illustrative example',
        outputRows: [{ label: 'Component', value: 'Ridge flashing' }, { label: 'Material rate', value: '$18 / m' }, { label: 'Labour rate', value: 'Unchanged' }],
        request: capture('Your instruction', 'Smart Assistant asked to update one material rate while preserving labour pricing', 'Be specific about the component and rate.', true),
        result: capture('The change', 'The requested component pricing change in the actual application', 'See what changed in your component library.'),
      },
      {
        id: 'stay-organised', label: 'Know what’s next', icon: 'list',
        heading: 'Ask what needs\nto be done today.',
        body: 'Ask which quotes have been accepted or declined, and what is on your to-do list. Get a clearer picture of the work needing your attention.',
        benefit: 'Receive live updates when you need them.|See quotes accepted, declined or viewed by customers.|Find out which jobs still need finishing.|Ask your assistant to schedule tasks and follow-ups.',
        context: '',
        inputLabel: 'Example daily check-in',
        input: 'Which quotes have been accepted or declined, and what is on my to-do list?',
        outputTitle: 'Less searching.\nMore clarity.', outputSubtitle: 'Account overview · Illustrative example',
        outputRows: [{ label: 'Quotes', value: 'Accepted and declined' }, { label: 'To-do list', value: 'Your open tasks' }, { label: 'Next step', value: 'Choose what to follow up' }],
        request: capture('Your check-in', 'A voice or text request for quote statuses and current tasks', 'Ask for the overview you need.', true),
        result: capture('Your overview', 'Smart Assistant displaying real quote statuses and the account to-do list', 'Your next actions, easier to find.'),
      },
    ],
  },
  {
    id: 'components', label: 'Pricing', eyebrow: 'Your know-how, built in.', descriptor: 'Set up your pricing. Put it to work.',
    scenes: [
      {
        id: 'create-test', label: 'Create & test', icon: 'components',
        heading: 'Set your pricing once.\nUse it everywhere.',
        body: 'Bring your materials, labour rates and pricing rules. Smart Components™ calculate the rest when you enter quantities.',
        benefit: 'Built to be easy: everything is calculated for you.|Use your own rates and rules.|Test and fine-tune before quoting.|Already have pricing in a spreadsheet? Bring it with you.',
        context: '',
        inputLabel: 'Your reusable pricing', input: '',
        outputTitle: '', outputSubtitle: '', outputRows: [],
        request: capture('Your pricing', 'Set up materials, labour and allowances', ''),
        result: capture('Calculated costs', 'Test a component using a measurement', ''),
      },
    ],
  },
  {
    id: 'measurements', label: 'Enter Your Measurements', eyebrow: 'Measurements to pricing.', descriptor: 'Already measured? Start right there.',
    scenes: [
      {
        id: 'enter-quantities', label: 'Enter your quantities', icon: 'measurements',
        heading: 'Got measurements?\nEnter them and get your price.',
        body: 'Enter the areas, lengths and quantities you already have. Your components turn those measurements into materials, labour and pricing.',
        benefit: 'Measured on site? Enter your measurements and get your price.|Already have quantities? Add them directly and get your price.', context: 'For the measurements already on your notepad.',
        inputLabel: 'Start with what you know', input: '120 m² of roof covering, 8 m of ridge and the accessories this job needs.',
        outputTitle: 'Measurements in.\nPricing in view.', outputSubtitle: 'Manual entry · Illustrative example',
        outputRows: [{ label: 'Area', value: 'Roof covering' }, { label: 'Length', value: 'Ridge flashing' }, { label: 'Cost', value: 'Your component rates' }],
        request: capture('Enter measurements', 'Entering area, length and count measurements against components in the app', 'Use the measurements you already have.'),
        result: capture('See your estimate', 'The material and labour pricing produced from entered measurements', 'Review how the job adds up.'),
      },
    ],
  },
  {
    id: 'takeoff', label: 'Measure in App', eyebrow: 'From a plan to a price.', descriptor: 'Draw it on screen. Get your price.',
    scenes: [
      {
        id: 'measure-a-plan', label: 'Measure your plan', icon: 'takeoff',
        heading: 'Draw it.\nGet your price.',
        body: 'Draw on your plan and QuoteCore+ calculates the measurements and price using your saved component rates. Roofs, walls, floors and more.',
        benefit: 'Digital takeoff: draw from roof plans, architectural drawings or satellite images. Use elevations for cladding and floor plans for flooring.|Roof Scan Assist: on a clear, correctly calibrated roof plan, QuoteCore+ can complete the roof geometry quickly. If plan quality or roof complexity makes the result less consistent, edit the takeoff directly in the same workspace. (Roofing only.)|Offcuts + cut list (long run): generate a cut plan while quoting to calculate how much material the roof really needs. If you win the job, installers can use the same plan.', context: 'For jobs that begin with a plan.',
        inputLabel: 'Start with a plan', input: 'Calibrate a known dimension, then trace the areas and lengths you need.',
        outputTitle: 'A measured plan.\nA clearer job.', outputSubtitle: 'Digital measurement · Illustrative example',
        outputRows: [{ label: 'Calibrate', value: 'Known dimension' }, { label: 'Measure', value: 'Areas and lengths' }, { label: 'Review', value: 'Plan and quantities' }],
        request: capture('Your plan', 'A plan opened in the actual QuoteCore+ digital takeoff workspace', 'Upload and calibrate before measuring.'),
        result: capture('Your measurements', 'Roof areas and flashing lengths marked on the plan', 'Keep your working visible.'),
      },
    ],
  },
  {
    id: 'workflow', label: 'Quotes & More', eyebrow: 'The result: everything connected.', descriptor: 'From a priced job to the next step.', outcome: true,
    scenes: [
      {
        id: 'create-documents', label: 'Create your documents', icon: 'document',
        heading: 'From priced job\nto polished documents.',
        body: 'Turn your saved job details into quotes, purchase orders and invoices, without entering the same information again.',
        benefit: 'Everything stays connected to the job.', context: 'For the paperwork that follows the pricing.',
        inputLabel: 'Start with the priced job', input: 'Use the job’s quantities and pricing to prepare the documents you need.',
        outputTitle: 'Quote. Order. Invoice.\nAll connected.', outputSubtitle: 'Document workflow · Illustrative example',
        outputRows: [{ label: 'Quote', value: 'For your customer' }, { label: 'Order', value: 'For your supplier' }, { label: 'Invoice', value: 'For the completed work' }],
        request: capture('Your priced job', 'A completed estimate ready to become a QuoteCore+ document', 'Start with the job, not a blank document.'),
        result: finishedQuote,
      },
      {
        id: 'track-follow-up', label: 'Track & auto follow-up', icon: 'list',
        heading: 'Send it.\nStay on top of it.',
        body: 'Send documents straight from QuoteCore+. See when quotes are read, accepted or declined, and set auto follow-up rules that send the next message automatically.',
        benefit: 'Stay in the loop with quote activity alerts.', context: 'For the work that continues after sending.',
        inputLabel: 'Send it from the app', input: 'Email your documents directly to the customer from QuoteCore+.',
        outputTitle: 'Sent. Read.\nResponded to.', outputSubtitle: 'Quote activity and auto follow-up rules · Illustration',
        outputRows: [{ label: 'Activity', value: 'Sent and read' }, { label: 'Response', value: 'Accepted or declined' }, { label: 'Auto follow-up', value: 'Your timing and rules' }],
        request: capture('Send and track', 'Illustrated quote activity showing sent, read and alternative accepted or declined responses', 'Know where the quote stands.'),
        result: capture('Auto follow-up by your rules', 'Example auto follow-up rules: accepted sends a job confirmation doc or pack; read with no response after seven days sends an auto follow-up; declined sends a thank-you or feedback request', 'Set the rule once. It sends automatically.'),
      },
    ],
  },
];
