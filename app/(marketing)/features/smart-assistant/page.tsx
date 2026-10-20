import type { Metadata } from 'next';
import {
  BulletList,
  Container,
  ConversionPaths,
  FaqAccordion,
  FeatureGrid,
  FinalCta,
  FitPanel,
  Hero,
  PageScaffold,
  ProductFrame,
  RelatedLinks,
  Section,
  SectionHeader,
  SplitFeature,
  TextLink,
  WorkflowRail,
  type FaqItem,
} from '@/components/marketing/page-v2/PageV2';
import { buildBreadcrumbSchema, buildFaqSchema, buildSoftwareApplicationSchema } from '@/lib/schema';
import { hreflangLanguages } from '@/lib/seo/hreflang';
import { workflowCallHref } from '@/lib/booking';

const bookingHref = workflowCallHref;

export const metadata: Metadata = {
  title: 'Smart Assistant: AI Estimating Assistant for Contractors | QuoteCore+',
  description: 'Smart Assistant gives QuoteCore+ a conversational interface. Use voice or text to draft or revise quotes, retrieve authorised account information and propose supported pricing changes for review.',
  alternates: { canonical: 'https://quote-core.com/features/smart-assistant', languages: hreflangLanguages('/features/smart-assistant') },
  openGraph: {
    title: 'Smart Assistant: AI Estimating Assistant for Contractors | QuoteCore+',
    description: 'Tell your estimating software what you want done. Voice or text, built for mobile and desktop, with every result left reviewable.',
    url: 'https://quote-core.com/features/smart-assistant',
    siteName: 'QuoteCore+',
    type: 'website',
    images: [
      {
        url: '/images/social/og-smart-assistant.jpg',
        width: 1200,
        height: 630,
        alt: 'QuoteCore+ Smart Assistant - Run your estimating app just by asking.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Smart Assistant: AI Estimating Assistant for Contractors | QuoteCore+',
    description: 'Voice or text. Draft quotes, calculate materials, measure a roof - just by asking.',
    images: ['/images/social/og-smart-assistant.jpg'],
  },
};

const faqs: FaqItem[] = [
  { question: 'What is an AI estimating assistant?', answer: 'It lets you describe the task you want completed in normal language instead of navigating every screen manually. Smart Assistant is a conversational controller for the QuoteCore+ workflow, not a separate generic chatbot.' },
  { question: 'Can I create an estimate or quote by voice?', answer: 'Yes. V1 Beta can prepare or revise a quote draft by voice or text for review. The draft stays inside the normal QuoteCore+ workflow with your configured pricing logic.' },
  { question: 'Can I use Smart Assistant on my phone?', answer: 'Yes. Mobile is one of the strongest use cases because voice or text can be easier than navigating a complex app on a small screen.' },
  { question: 'Does it use my own pricing?', answer: 'It works with supported QuoteCore+ account context and Smart Components rather than replacing your pricing with a generic public price list.' },
  { question: 'Is it just voice-to-PDF software?', answer: 'No. It can retrieve authorised account information and work with supported pricing changes as well as draft quotes.' },
  { question: 'What if it gets something wrong?', answer: 'Review, edit or discard the result. The normal QuoteCore+ interface remains available at every step.' },
  { question: 'Can it send quotes today?', answer: 'Not in V1 Beta. Sending and finalising quotes is part of the V2 direction and remains a manual step until it ships live.' },
];

const schemas = [
  buildSoftwareApplicationSchema(),
  buildBreadcrumbSchema([
    { name: 'Home', url: 'https://quote-core.com/' },
    { name: 'Features', url: 'https://quote-core.com/features' },
    { name: 'Smart Assistant', url: 'https://quote-core.com/features/smart-assistant' },
  ]),
  buildFaqSchema(faqs),
];

export default function SmartAssistantPage() {
  return (
    <PageScaffold breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Features', href: '/features' }, { label: 'Smart Assistant' }]} schemas={schemas}>
      <Hero
        eyebrow="AI estimating assistant for contractors - V1 Beta"
        title={<>Tell your estimating software what you want done.</>}
        lead="Smart Assistant gives QuoteCore+ a conversational interface. Use voice or text instead of learning where every screen, field and action lives. In V1 Beta it can draft or revise quotes, retrieve authorised account information and propose supported pricing changes, with the result left for you to review."
        primary={{ href: '/demo', label: 'Try Smart Assistant in the demo' }}
        secondary={{ href: bookingHref, label: 'Book a tailored 20-minute demo' }}
        proof={['Voice or text', 'Built for mobile and desktop', 'Review, edit or discard the result']}
        visual={<ProductFrame src="/marketing/current-ux/smart-assistant-workspace.webp" alt="QuoteCore+ Smart Assistant alongside the estimating workspace" width={1635} height={962} eager caption="Smart Assistant is a conversational controller for the QuoteCore+ workflow, not a separate generic chatbot or voice note tool." />}
      />

      <Section>
        <Container>
          <SectionHeader eyebrow="Why this matters" title="The easiest way to use complex software can be to stop navigating it." lead="Traditional estimating software makes the user learn the interface first: find the job, open the right screen, locate the right field, make the change and move to the next screen. A conversational layer lets the user start with the outcome instead." />
          <FeatureGrid items={[
            { title: 'Say what you need', body: <p>Describe the quote, change or information you want in normal language by voice or text.</p> },
            { title: 'Let the app find the path', body: <p>For supported tasks, Smart Assistant works with the relevant QuoteCore+ account context instead of making you navigate there first.</p> },
            { title: 'Keep control of the result', body: <p>Review the draft, answer or proposed change. Edit it, continue the conversation or discard it when it is not right.</p> },
          ]} />
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <SectionHeader eyebrow="A different interface" title="Ask for the outcome instead of remembering the clicks." lead="Smart Assistant is most useful when the task is easier to explain than the software path needed to complete it." />
          <WorkflowRail steps={[
            { label: 'Ask', body: 'Use voice or text to describe the task or information you need.' },
            { label: 'Understand context', body: 'The assistant works with supported, authorised information already inside QuoteCore+.' },
            { label: 'Draft or propose', body: 'Prepare the quote draft, retrieve the answer or propose the supported change.' },
            { label: 'Review', body: 'Check the measurements, pricing and commercial details that matter.' },
            { label: 'Continue', body: 'Approve the manual next step today, or use broader assistant actions as they become available in V2.' },
          ]} />
        </Container>
      </Section>

      <Section>
        <Container>
          <SplitFeature visual={<ProductFrame src="/marketing/current-ux/smart-assistant-voice-quote.webp" alt="Preparing a quote draft by voice with QuoteCore+ Smart Assistant" width={1672} height={941} caption="Describe the work naturally, then review the resulting draft instead of building every line from a blank screen." />}>
            <h2>Create a quote draft by talking through the job.</h2>
            <p>Voice estimating is useful because contractors already know how to explain a job. Smart Assistant lets that explanation become structured work inside QuoteCore+ rather than another note that somebody has to type up later.</p>
            <BulletList items={['Describe the work by voice or text', 'Use the measurements and job information you already have', 'Revise the same draft as the conversation continues', 'Keep your configured pricing logic and final review in the workflow']} />
          </SplitFeature>
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <SplitFeature reverse visual={<ProductFrame src="/marketing/current-ux/smart-assistant-mobile.webp" alt="Smart Assistant used on a mobile phone" width={520} height={1001} portrait caption="On a phone, voice and text can replace a surprising amount of small-screen navigation." />}>
            <h2>The smaller the screen, the more useful conversation becomes.</h2>
            <p>A full estimating and quoting app has a lot of screens because the job itself has a lot of moving parts. On mobile, asking for the task can be far easier than tapping through that structure.</p>
            <BulletList items={['Use voice when typing is inconvenient', 'Ask for a quote or job detail without opening record after record', 'Prepare supported draft work while you are away from the desk', 'Return to the normal QuoteCore+ screen whenever you want direct control']} />
          </SplitFeature>
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader eyebrow="Real contractor use cases" title="A useful assistant should remove admin, not invent work for itself." lead="These are practical moments where a conversational controller can reduce interface knowledge, typing and repetitive navigation without hiding the commercial result." />
          <FeatureGrid columns={2} items={[
            { kicker: 'On site', title: 'Capture it while it is fresh', body: <p>Talk through measurements or job details and prepare a draft while the information is fresh instead of rebuilding the note later.</p> },
            { kicker: 'In the office', title: 'Ask instead of searching', body: <p>Ask for the latest quote total, job detail, order, invoice or status without opening several records to find it.</p> },
            { kicker: 'Maintaining pricing', title: 'Describe the change', body: <p>Describe a supported Smart Component or pricing change and review the proposed update instead of hunting through settings first.</p> },
            { kicker: 'Training and delegation', title: 'Let juniors ask', body: <p>Let less-experienced team members ask for supported tasks while an authorised person continues to review the important pricing and customer decisions.</p> },
          ]} />
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <SplitFeature visual={<ProductFrame src="/marketing/current-ux/smart-assistant-answer.webp" alt="Smart Assistant answering a question about job information" width={1672} height={941} caption="The assistant can bring authorised account information back into view without making you remember where every detail is stored." />}>
            <h2>Ask about the job instead of searching through the job.</h2>
            <p>Smart Assistant is connected to the supported QuoteCore+ account context. It can be useful when the question is simply, &quot;What was that total?&quot;, &quot;Which job needs attention?&quot; or &quot;What is the current status?&quot;</p>
            <BulletList items={['Quote totals and quote details', 'Job information and measurements', 'Order or invoice information', 'Current statuses and attention items']} />
          </SplitFeature>
        </Container>
      </Section>

      <Section>
        <Container>
          <SplitFeature reverse visual={<ProductFrame src="/marketing/current-ux/smart-assistant-pricing.webp" alt="Smart Assistant proposing a supported pricing component change for review" width={1692} height={930} caption="Supported pricing and Smart Component changes can be proposed conversationally, then checked before they are used." />}>
            <h2>Your pricing should stay yours, even when AI helps operate it.</h2>
            <p>Many AI estimate generators build a price from generic data. QuoteCore+ is designed around your own Smart Components, materials, labour and pricing logic.</p>
            <BulletList items={['Work with your saved QuoteCore+ account context', 'Propose supported material or pricing changes', 'Review what is changing before it is used', 'Keep the underlying Smart Components visible and editable']} />
            <TextLink href="/features/smart-components">Explore Smart Components</TextLink>
          </SplitFeature>
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <SectionHeader eyebrow="V1 Beta today" title="Draft, retrieve and propose now. Broader actions are coming in V2." lead="We would rather be clear about the current boundary than pretend every conversational request is already autonomous. V1 removes a lot of navigation. V2 is designed to carry more approved work through the next action." />
          <FeatureGrid columns={2} items={[
            { kicker: 'Today', title: 'What V1 can do now', body: <p>Use voice or text to prepare and revise quote drafts, retrieve authorised account information and propose supported pricing or Smart Component changes. The user reviews important commercial work before the downstream action is completed.</p> },
            { kicker: 'Coming soon', title: 'What V2 is planned to add', body: <p>V2 is planned to extend into broader workflow actions such as sending or finalising approved quotes and follow-up scheduling. Until each action ships, V1 Beta remains the source of truth for what the assistant can execute today.</p> },
          ]} />
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader eyebrow="When AI gets it wrong" title="The fastest workflow is the one that lets you correct the exception without starting again." lead="Smart Assistant is not useful because it is assumed to be perfect. It is useful because a strong first result can remove a large amount of navigation and typing, while the human keeps the ability to change or reject anything that matters." />
          <FeatureGrid items={[
            { kicker: 'Review it', title: 'Check the result', body: <p>Check the job information, measurements, pricing and customer-facing details before relying on the result.</p> },
            { kicker: 'Refine it', title: 'Correct the part that needs it', body: <p>Continue the conversation or use the normal QuoteCore+ interface to correct the part that needs changing.</p> },
            { kicker: 'Discard it', title: 'Fall back to manual', body: <p>If the assistant misunderstood the task, ignore the result and complete the work manually. The normal app remains available.</p> },
          ]} />
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <FitPanel
            title="An easier way to operate the app, with visible boundaries."
            bestFor={['Contractors who prefer describing a task to learning every software screen', 'Mobile users who want to do more than view information on a phone', 'Office teams that need faster access to job, quote and pricing information', 'Businesses that want AI assistance while keeping their own pricing logic and review process']}
            limits={['V1 Beta does not yet send or finalise quotes through the assistant', 'V1 Beta does not yet schedule follow-ups through the assistant', 'The assistant only works with supported actions and authorised account information', 'Commercial outputs still need normal user review before they are relied on']}
          />
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader eyebrow="Try the easier interface" title="Use the interactive demo yourself, or let us show how Smart Assistant fits the way your business already quotes." lead="The prepared demo shows the current QuoteCore+ experience. A tailored screen-share shows where the assistant can remove work for your workflow." />
          <ConversionPaths items={[
            { title: 'Explore the interactive app demo', body: 'Open the prepared roofing workspace and try the current QuoteCore+ experience at your own pace.', href: '/demo', label: 'Explore the demo' },
            { title: 'Book a tailored 20-minute demo', body: 'Tell us how your team measures, prices and quotes and we will show where the assistant can remove work. No obligation.', href: bookingHref, label: 'Book a tailored demo' },
            { title: 'Build your configuration', body: 'Choose the Smart Assistant allowance that fits how often you expect to use conversational tasks.', href: '/pricing', label: 'See pricing' },
          ]} />
        </Container>
      </Section>

      <Section tone="soft">
        <Container><FaqAccordion faqs={faqs} title="AI estimating assistant and Smart Assistant FAQ" /></Container>
      </Section>

      <Section>
        <Container>
          <RelatedLinks items={[
            { href: '/features/ai-scan-assist', title: 'Roof Scan Assist', body: 'Use roofing-specific AI to build editable roof geometry from a calibrated plan.' },
            { href: '/features/offcut-optimiser', title: 'Offcut Optimiser', body: 'Turn long-run roof geometry into suggested cutting plans and a more realistic material allowance.' },
            { href: '/features/smart-components', title: 'Smart Components', body: 'See the reusable materials, labour and pricing logic that keeps your business rules inside the workflow.' },
            { href: '/features', title: 'All features', body: 'See how the assistant fits into the complete measure-to-price workflow.' },
          ]} />
        </Container>
      </Section>

      <FinalCta title="Stop learning the clicks. Start with what you want done." body="Try Smart Assistant by voice or text, keep the result reviewable and use the normal QuoteCore+ interface whenever direct control is the better option." primary={{ href: '/demo', label: 'Try the interactive demo' }} secondary={{ href: bookingHref, label: 'Book a tailored 20-minute demo' }} />
      <div style={{ height: 72 }} />
    </PageScaffold>
  );
}
