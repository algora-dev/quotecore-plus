import type { Metadata } from "next";
import {
  Container,
  ConversionPaths,
  FaqAccordion,
  FeatureGrid,
  FinalCta,
  Hero,
  PageScaffold,
  Section,
  SectionHeader,
} from "@/components/marketing/page-v2/PageV2";
import { homepageConfig } from "@/components/marketing/home/homepage-config";
import { buildBreadcrumbSchema, buildFaqSchema, buildSoftwareApplicationSchema, siteUrl } from "@/lib/schema";
import { publicPricing } from "@/lib/public-pricing";
import { hreflangLanguages } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: "Try QuoteCore+ Before You Subscribe | Demos & Free Tools",
  description:
    "QuoteCore+ does not offer a full-app free trial. Explore the interactive app demo, use free tools, book a tailored 20-minute demo, or build a paid plan from US$29/month.",
  alternates: {
    canonical: "https://quote-core.com/free-trial",
    languages: hreflangLanguages("/free-trial"),
  },
};

const faqs = [
  {
    question: "Does QuoteCore+ offer a free trial?",
    answer:
      "No. QuoteCore+ does not offer a conventional full-app free trial. You can explore the interactive app demo, use the free browser tools, book a tailored demo call, or build your paid configuration before you subscribe.",
  },
  {
    question: "Can I try the full QuoteCore+ workflow before subscribing?",
    answer:
      "The interactive app demo gives you a prepared fictional roofing workspace so you can explore several real QuoteCore+ capabilities without starting from an empty account. It is designed to show how the connected workflow works before you decide whether to subscribe.",
  },
  {
    question: "Are the free tools really free?",
    answer:
      "Yes. QuoteCore+ provides standalone browser tools for practical tasks such as takeoff, estimating and quote preparation. They are separate from the paid QuoteCore+ account and are useful when you want to test a specific workflow first.",
  },
  {
    question: "Can someone show me QuoteCore+ for my own trade?",
    answer:
      "Yes. You can book a tailored product demo. The call is approximately 20 minutes and focuses on how you currently work, with the screen-share demonstration adapted to make the workflow relevant to your trade or business.",
  },
  {
    question: "How much does the paid QuoteCore+ app cost?",
    answer: `The public pricing builder creates a configuration around the features and usage you need. Current global configurations range from US$${publicPricing.monthlyMin} to US$${publicPricing.monthlyMax} per month.`,
  },
  {
    question: "What is Done For You Setup?",
    answer: `Done For You Setup is a separate setup service starting from US$${publicPricing.doneForYouStarting}. QuoteCore+ helps configure your account around your existing materials, labour, waste, quantities and pricing logic, then guides you through the system using real work.`,
  },
];

export default function GetStartedPage() {
  const bookingHref = homepageConfig.bookingHref || "/contact";

  const schemas = [
    buildBreadcrumbSchema([
      { name: "Home", url: `${siteUrl}/` },
      { name: "Try QuoteCore+", url: `${siteUrl}/free-trial` },
    ]),
    buildFaqSchema(faqs),
    { "@context": "https://schema.org", ...buildSoftwareApplicationSchema() },
  ];

  return (
    <PageScaffold breadcrumbs={[{ label: "Home", href: "/" }, { label: "Try QuoteCore+" }]} schemas={schemas}>
      <Hero
        eyebrow="Try QuoteCore+"
        title="There is no full-app trial. You can still try QuoteCore+ before you subscribe."
        lead="Choose the evaluation path that answers what you actually want to know: explore the prepared app demo, use a practical free tool, book a tailored 20-minute walkthrough, or build your paid configuration."
        primary={{ href: "/demo", label: "Explore the interactive demo" }}
        secondary={{ href: "/free-tools", label: "Use free tools" }}
        proof={["No full-app trial", "Free browser tools available", `Paid configurations from US$${publicPricing.monthlyMin}/month`]}
      />

      <Section tone="soft">
        <Container>
          <SectionHeader
            eyebrow="Choose your route"
            title="Four paths, depending on what you want to learn."
            lead="You do not need to create a blank account simply to find out whether QuoteCore+ makes sense for your workflow."
          />
          <ConversionPaths
            items={[
              {
                kicker: "Self-guided",
                title: "Explore the interactive app demo",
                body: "Open a prepared fictional roofing account and explore several real QuoteCore+ capabilities in context.",
                href: "/demo",
                label: "Open the app demo",
              },
              {
                kicker: "Practical task",
                title: "Use free tools",
                body: "Try focused takeoff, estimating and quote tools in your browser when you want to test one part of the workflow first.",
                href: "/free-tools",
                label: "Browse free tools",
              },
              {
                kicker: "Personal",
                title: "Book a tailored 20-minute demo",
                body: "Tell us how you currently measure, price and quote. We will screen-share a workflow that is relevant to your trade and questions.",
                href: bookingHref,
                label: "Book a tailored demo",
              },
              {
                kicker: "Ready to price it",
                title: "Build your paid configuration",
                body: `Choose the features and usage you need. The pricing builder shows your monthly setup before signup, with current global configurations from US$${publicPricing.monthlyMin} to US$${publicPricing.monthlyMax}.`,
                href: "/pricing",
                label: "Build your plan",
              },
            ]}
          />
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader
            eyebrow="Pick the proof you need"
            title="Use the evaluation path that answers your actual question."
            lead="A full product tour, a hands-on task and a conversation with your team answer different questions. QuoteCore+ keeps those options separate."
          />
          <FeatureGrid
            items={[
              {
                title: "Want to understand the whole product?",
                body: "Start with the interactive app demo. It shows a populated QuoteCore+ workspace rather than asking you to judge the product from an empty account.",
              },
              {
                title: "Want to test one practical task?",
                body: "Use the free tools or the focused takeoff demo. They are the fastest way to try measurement, takeoff or quoting without committing to the paid app.",
              },
              {
                title: "Want to know if it fits your business?",
                body: "Book a tailored demo. We will ask how you work now and relate the walkthrough to your trade, current process and questions.",
              },
            ]}
          />
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <SectionHeader
            eyebrow="Setup help"
            title={`Done For You Setup starts from US$${publicPricing.doneForYouStarting}.`}
            lead="Done For You is separate from the software subscription. It is for businesses that want help turning their existing estimating logic into a configured QuoteCore+ account."
          />
          <FeatureGrid
            items={[
              {
                title: "Bring your existing logic",
                body: "Start from the spreadsheets, supplier data, labour rates, waste rules and pricing approach you already use.",
              },
              {
                title: "We configure the agreed system",
                body: "QuoteCore+ helps turn that logic into reusable Smart Components and the account structure you need.",
              },
              {
                title: "Learn it using real work",
                body: "The setup is paired with guidance so your team understands how the configured workflow applies to real jobs.",
              },
            ]}
          />
        </Container>
      </Section>

      <Section>
        <Container>
          <FaqAccordion faqs={faqs} title="Trying QuoteCore+ before you subscribe" />
        </Container>
      </Section>

      <Section tone="dark">
        <Container>
          <FinalCta
            eyebrow="Start where it makes sense"
            title="No trial needed to see how QuoteCore+ works."
            body="Explore the interactive app now, or build the configuration and price that fits the way you work."
            primary={{ href: "/demo", label: "Explore the interactive demo" }}
            secondary={{ href: "/pricing", label: "Build your plan" }}
          />
        </Container>
      </Section>
    </PageScaffold>
  );
}
