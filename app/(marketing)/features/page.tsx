import type { Metadata } from 'next';
import { WorkflowExplorer } from '@/components/marketing/home/WorkflowExplorer';
import {
  BulletList,
  Container,
  ConversionPaths,
  FaqAccordion,
  FeatureGrid,
  FinalCta,
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

export const metadata: Metadata = {
  title: 'Estimating & Quoting Software Features | QuoteCore+',
  description: 'Explore QuoteCore+ features for measuring, takeoff, reusable pricing, customer quotes, sending and tracking, material ordering, invoicing and day-to-day job workflow.',
  alternates: { canonical: 'https://quote-core.com/features', languages: hreflangLanguages('/features') },
  openGraph: {
    title: 'Estimating & Quoting Software Features | QuoteCore+',
    description: 'See the connected QuoteCore+ workflow from measurements and pricing through customer quotes, tracking, orders and invoices.',
    url: 'https://quote-core.com/features',
    siteName: 'QuoteCore+',
    type: 'website',
  },
};

const faqs: FaqItem[] = [
  { question: 'What does QuoteCore+ include?', answer: 'QuoteCore+ connects job measurements, Digital Takeoff, Roof Scan Assist, reusable Smart Components, estimating and pricing, customer quotes, sending and tracking, material orders, invoices and supporting account tools in one web-based workflow.' },
  { question: 'Can QuoteCore+ measure plans digitally?', answer: 'Yes. Digital Takeoff lets you calibrate a plan and measure areas and lengths directly in the app. Roofing can also use Roof Scan Assist to automate the roof geometry on suitable plans.' },
  { question: 'Can Roof Scan Assist complete a roof takeoff?', answer: 'Yes. On a clear, correctly calibrated plan, especially a simple to moderately complex roof, Roof Scan Assist can complete the roof geometry quickly and accurately. Lower-quality drawings or more complex geometry can require manual edits in the same takeoff workspace.' },
  { question: 'Can I use measurements I already have?', answer: 'Yes. You can enter areas, lengths and quantities from a site measure, another takeoff, an aerial report or a spreadsheet instead of measuring a plan inside QuoteCore+.' },
  { question: 'Does QuoteCore+ use my own material and labour prices?', answer: 'Yes. Smart Components store the materials, labour, waste, quantity rules and pricing logic you choose. The measured quantity then drives the calculation instead of using a generic price book.' },
  { question: 'What happens after I send a quote?', answer: 'QuoteCore+ can keep the customer quote connected to its job, help you track quote activity and follow-up, and carry accepted work into downstream steps such as material orders and invoices.' },
  { question: 'Is QuoteCore+ only for roofing?', answer: 'No. QuoteCore+ has deep roofing workflows, including Roof Scan Assist and long-run offcut tools, but the core measure-to-price workflow can also suit construction and measured trades such as cladding, flooring and other work that begins with quantities.' },
];

const schemas = [
  buildSoftwareApplicationSchema(),
  buildBreadcrumbSchema([{ name: 'Home', url: 'https://quote-core.com/' }, { name: 'Features', url: 'https://quote-core.com/features' }]),
  buildFaqSchema(faqs),
];

export default function FeaturesPage() {
  return (
    <PageScaffold breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Features' }]} schemas={schemas}>
      <Hero
        eyebrow="QuoteCore+ features"
        title={<>The complete estimating and quoting workflow, <strong>connected.</strong></>}
        lead="Take measurements, apply your own pricing rules, build the customer quote, send and track it, then carry accepted work into orders and invoices. Use the quick interactive tour or scroll through the workflow in detail below."
        primary={{ href: '/demo', label: 'Explore the interactive demo' }}
        secondary={{ href: '/pricing', label: 'Build your plan' }}
        proof={['Measure or enter quantities', 'Use your own pricing logic', 'Keep the job connected after the quote']}
        visual={<ProductFrame src="/marketing/current-ux/job-space-overview.webp" alt="Current QuoteCore+ Job Space overview with the connected job workflow" width={2048} height={1112} eager caption="Job Space keeps the job, pricing and document workflow together instead of splitting the work across disconnected tools." />}
      />

      <Section tone="soft" id="quick-tour">
        <Container>
          <SectionHeader eyebrow="Quick product tour" title="Prefer to click through? Explore the core workflow in a few minutes." lead="This is the same interactive feature showcase used on the homepage. Use the tabs and examples for the short version, then continue below for a detailed scroll-through of the workflow." />
        </Container>
        <WorkflowExplorer demoHref="/demo" />
      </Section>

      <Section>
        <Container>
          <SectionHeader eyebrow="Prefer to scroll?" title="Follow the workflow from measurements to the next job step." lead="The interactive tour gives you the short version. The sections below explain what each part does, what information moves forward and where to go deeper." />
        </Container>
      </Section>

      <Section tone="dark">
        <Container>
          <SectionHeader eyebrow="One connected workflow" title="Measure. Price. Quote. Track. Order. Invoice." lead="Not every job uses every feature, but the information can stay attached to the same job as the work moves forward." dark />
          <WorkflowRail steps={[
            { label: 'Measure', body: 'Use Digital Takeoff, Roof Scan Assist or measurements you already have.' },
            { label: 'Price', body: 'Apply Smart Components with your materials, labour, waste and pricing rules.' },
            { label: 'Quote', body: 'Build and edit the customer-facing quote from the priced job.' },
            { label: 'Send & track', body: 'Send from QuoteCore+ and keep quote activity and follow-up connected.' },
            { label: 'Order', body: 'Use the accepted job and material quantities as the starting point for ordering.' },
            { label: 'Invoice', body: 'Create the invoice from the same job instead of rebuilding the information again.' },
          ]} />
        </Container>
      </Section>

      <Section>
        <Container>
          <SplitFeature visual={<ProductFrame src="/marketing/current-ux/ai-scan-assist-completed-roof.webp" alt="Current Roof Scan Assist result in the QuoteCore+ Digital Takeoff workspace" width={2048} height={1114} caption="Roof Scan Assist can complete the roof geometry on a suitable calibrated plan, while the same workspace keeps full manual editing control available." />}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#BD4A1A]">01 · Start with the measurements</p>
            <h2>Measure in the app, or start from measurements you already trust.</h2>
            <p>QuoteCore+ does not force every job through the same measurement method. Start with a plan when that is useful, or enter the areas, lengths and quantities you already have from site, another report or another takeoff.</p>
            <BulletList items={['Digital Takeoff for plan areas and lengths', 'Roof Scan Assist for suitable roof plans', 'Full manual editing in the takeoff workspace', 'Direct entry for measurements from site, reports or existing notes']} />
            <TextLink href="/roofing-takeoff-software">Explore roofing takeoff</TextLink>
          </SplitFeature>
          <div className="mt-12">
            <FeatureGrid items={[
              { title: 'Digital Roof Takeoff', body: <p>Calibrate a roof plan and measure the geometry directly in QuoteCore+.</p> },
              { title: 'Roof Scan Assist', body: <p>Let AI complete the roof geometry first on a clear, correctly calibrated plan, then edit only when needed.</p> },
              { title: 'Measurements you already have', body: <p>Enter areas, lengths and quantities directly when measurement work has already been completed.</p> },
            ]} />
          </div>
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <SplitFeature reverse visual={<ProductFrame src="/marketing/current-ux/smart-components-pricing-library.webp" alt="Current QuoteCore+ Pricing Library for Smart Components" width={2048} height={1111} caption="Smart Components keep reusable materials, labour, waste and pricing logic available for the next measured job." />}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#BD4A1A]">02 · Apply your own pricing</p>
            <h2>Your materials, labour, waste and pricing rules.</h2>
            <p>Smart Components are the repeatable logic between a measurement and a priced job. Instead of rebuilding a formula for every estimate, save the way your business prices repeated work and apply it to the relevant quantity.</p>
            <BulletList items={['Material products and costs', 'Labour rates and quantity-driven labour', 'Waste, coverage and pack rules', 'Your selling-price or margin logic', 'Reusable setup for future jobs']} />
            <TextLink href="/features/smart-components">Explore Smart Components</TextLink>
          </SplitFeature>
        </Container>
      </Section>

      <Section>
        <Container>
          <SplitFeature visual={<ProductFrame src="/marketing/current-ux/customer-quote-editor.webp" alt="Current QuoteCore+ customer quote editor" width={2048} height={1114} caption="Edit the customer-facing scope and presentation while keeping the underlying job pricing connected." />}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#BD4A1A]">03 · Build the customer quote</p>
            <h2>Turn the priced work into the document the customer sees.</h2>
            <p>The customer quote is the next presentation layer of the job, not a separate document you need to rebuild from scratch. Review what the customer sees, edit the scope and presentation, then send it when it is ready.</p>
            <BulletList items={['Customer-facing scope and pricing', 'Professional quote document', 'Edit before sending', 'Quote activity and status stay connected to the job']} />
            <TextLink href="/construction-quoting-software">Explore construction quoting</TextLink>
          </SplitFeature>
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <SplitFeature reverse visual={<ProductFrame src="/marketing/current-ux/job-space-overview.webp" alt="Current QuoteCore+ Job Space with quote and job status information" width={2048} height={1112} caption="Job Space keeps the accepted work and the next workflow stages visible around the same job." />}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#BD4A1A]">04 · Keep accepted work moving</p>
            <h2>The workflow does not stop when the quote is sent.</h2>
            <p>Sending, follow-up, material ordering and invoicing sit downstream of the priced job. QuoteCore+ is designed to reduce the amount of information you have to re-enter as the work moves forward.</p>
            <BulletList items={['Send quotes and keep activity visible', 'Use follow-up tools around the quote workflow', 'Create material orders from accepted work', 'Create invoices from the same job information']} />
            <TextLink href="/features/sending-and-tracking">Explore sending and tracking</TextLink>
          </SplitFeature>
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader eyebrow="Supporting features" title="Useful tools around the core measure-to-price workflow." lead="These features help you maintain the information, find what you need and reduce repetitive account work without changing the underlying pricing logic you control." />
          <FeatureGrid items={[
            { title: 'Smart Assistant', body: <p>Use voice or text for supported account tasks, finding information and working with parts of your pricing or quote workflow while keeping important changes reviewable.</p> },
            { title: 'Supplier Resources', body: <p>Use supplier catalogues and component resources as inputs when maintaining the products and pricing available to your workflow.</p> },
            { title: 'Done For You Setup', body: <p>If configuring the system is the part you do not want to spend time on, QuoteCore+ can help translate the agreed pricing and workflow into your account.</p> },
          ]} />
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <SectionHeader eyebrow="Feature index" title="Go straight to the part you want to understand." />
          <FeatureGrid columns={4} items={[
            { kicker: 'Measure', title: 'Digital Takeoff', body: <><p>Measure plans directly in the app.</p><TextLink href="/features/digital-roof-takeoff">Open feature</TextLink></> },
            { kicker: 'Measure', title: 'Roof Scan Assist', body: <><p>Automate roof geometry on suitable plans.</p><TextLink href="/features/ai-scan-assist">Open feature</TextLink></> },
            { kicker: 'Assist', title: 'Smart Assistant', body: <><p>Use voice or text for supported estimating tasks.</p><TextLink href="/features/smart-assistant">Open feature</TextLink></> },
            { kicker: 'Plan', title: 'Offcut Optimiser', body: <><p>Suggest cutting plans for long-run metal roofs.</p><TextLink href="/features/offcut-optimiser">Open feature</TextLink></> },
            { kicker: 'Price', title: 'Smart Components', body: <><p>Reuse your own materials, labour and pricing logic.</p><TextLink href="/features/smart-components">Open feature</TextLink></> },
            { kicker: 'Send', title: 'Sending & Tracking', body: <><p>Send quotes and keep activity or follow-up connected.</p><TextLink href="/features/sending-and-tracking">Open feature</TextLink></> },
            { kicker: 'Order', title: 'Material Ordering', body: <><p>Carry accepted job quantities into supplier orders.</p><TextLink href="/features/material-ordering">Open feature</TextLink></> },
            { kicker: 'Invoice', title: 'Invoicing', body: <><p>Create invoices from the same connected job workflow.</p><TextLink href="/features/invoicing">Open feature</TextLink></> },
            { kicker: 'Resources', title: 'Supplier Resources', body: <><p>Find and maintain useful supplier and catalogue inputs.</p><TextLink href="/features/supplier-resources">Open feature</TextLink></> },
            { kicker: 'Free tool', title: 'Measurement-to-Quote', body: <><p>Already measured the job? Price those quantities without starting from a plan.</p><TextLink href="/measurement-to-quote-tool">Open tool</TextLink></> },
          ]} />
        </Container>
      </Section>

      <Section>
        <Container><FaqAccordion faqs={faqs} title="QuoteCore+ feature FAQ" /></Container>
      </Section>

      <Section tone="soft">
        <Container>
          <SectionHeader eyebrow="Choose your next step" title="Choose the next step that suits you" lead="Use the route that answers what you need to know next." />
          <ConversionPaths items={[
            { title: 'Explore the interactive app demo', body: 'Open a prepared QuoteCore+ roofing workspace and explore the current workflow at your own pace.', href: '/demo', label: 'Explore the demo' },
            { title: 'Book a tailored 20-minute demo', body: 'Tell us how you currently work and we will screen-share a workflow that is relevant to your trade and questions.', href: 'https://calendly.com/quote-core-info/15-minute-meeting', label: 'Book a tailored demo' },
            { title: 'Build your plan', body: 'Choose the workload and tools your business needs and see the current monthly price before you continue.', href: '/pricing', label: 'Build your configuration' },
          ]} />
        </Container>
      </Section>

      <Section>
        <Container>
          <RelatedLinks items={[
            { href: '/features/ai-scan-assist', title: 'Roof Scan Assist', body: 'See when AI can complete a roof takeoff and when manual edits are more likely.' },
            { href: '/features/smart-assistant', title: 'Smart Assistant', body: 'Use voice or text to draft, revise and retrieve, with the result left reviewable.' },
            { href: '/features/offcut-optimiser', title: 'Offcut Optimiser', body: 'Turn long-run roof geometry into suggested cutting plans and a realistic material allowance.' },
            { href: '/features/smart-components', title: 'Smart Components', body: 'See how your own material, labour, waste and pricing rules become reusable.' },
            { href: '/measurement-to-quote-tool', title: 'Measurement-to-Quote', body: 'Already have quantities? Try the free pricing workflow.' },
            { href: '/done-for-you-setup', title: 'Done For You Setup', body: 'Want help translating your existing pricing into QuoteCore+?' },
          ]} />
        </Container>
      </Section>

      <FinalCta title="One workflow. Start at the part that matters to you." body="Explore the prepared app demo, build a pricing configuration or start with a free tool. QuoteCore+ keeps the measure-to-price workflow connected when you are ready to go further." primary={{ href: '/demo', label: 'Explore the interactive demo' }} secondary={{ href: '/pricing', label: 'Build your plan' }} />
      <div style={{ height: 72 }} />
    </PageScaffold>
  );
}
