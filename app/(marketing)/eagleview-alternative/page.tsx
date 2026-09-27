import type { Metadata } from "next";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import CompetitorPage, { type ComparisonResearch } from "@/components/competitor-pages/competitor-page";
import type { ThreeWaysToWorkProps } from "@/components/ThreeWaysToWork";
import type { CompetitorPageData } from "@/lib/competitor-pages/types";
import { buildBreadcrumbSchema, buildFaqSchema, siteUrl } from "@/lib/schema";

// Active content stays route-local within the authorized marketing surface.
// Visible FAQs and their structured data use this same object.
const pageData: CompetitorPageData = {
  "slug": "eagleview-alternative",
  "competitorName": "EagleView",
  "checkedDate": "27 September 2026",
  "positioning": "Roofing measurement, pricing and quoting",
  "hero": {
    "title": "An EagleView alternative when you want to do the takeoff yourself",
    "sub": "Measure a supplied plan or usable image, apply your saved pricing and prepare the customer quote on phone, tablet or desktop. Already have a report? Enter its measurements instead.",
    "qualifier": "QuoteCore+ does not supply aerial imagery, professionally produced property reports or automatic 3D property models. It is estimating software, not another report provider.",
    "primaryCta": {
      "href": "/pricing",
      "label": "See paid plans"
    },
    "ghostCta": {
      "href": "/free-roofing-takeoff-builder",
      "label": "Use free roof takeoff"
    }
  },
  "quickAnswer": {
    "heading": "Decide whether you need a report or a quoting workflow",
    "body": "EagleView supplies property measurements and imagery, including reports and the Eagleview One platform. QuoteCore+ lets you measure your own source material, enter existing dimensions and price the work with saved rules. These are different purchases. Self-service takeoff may suit jobs with a usable plan or image; a professional report may remain appropriate when you need externally supplied measurements. You can also use a report as the measurement source and QuoteCore+ for pricing and customer documents."
  },
  "bestFor": {
    "competitorBestFor": [
      {
        "title": "You need externally supplied property measurements",
        "body": "A software subscription is not a substitute for a measurement source you do not have."
      },
      {
        "title": "Your process depends on property intelligence or report formats",
        "body": "Retain the reporting service required by your business or project stakeholders."
      }
    ],
    "qcBestFor": [
      {
        "title": "The recurring task is a measured job and customer quote",
        "body": "You want measurements and your own rates in the same saved workflow."
      },
      {
        "title": "You work between site and office",
        "body": "You need the paid app on phone, tablet and desktop, not just a place to view documents."
      },
      {
        "title": "You want help without giving up control",
        "body": "Use Smart Assistant for supported retrieval and changes, while keeping manual controls available."
      }
    ]
  },
  "replace": {
    "verdict": {
      "pill": "Depends on the workflow",
      "tone": "mixed",
      "answer": "Replace the work you no longer need to split across tools, not every EagleView capability."
    },
    "body": "QuoteCore+ does not replace EagleView's imagery collection, property intelligence, externally produced measurements or 3D property models.",
    "bullets": [
      {
        "label": "Measure, price and quote",
        "detail": "Use your own source material and saved pricing to create customer documents.",
        "positive": true
      },
      {
        "label": "Work from your phone",
        "detail": "The paid app supports takeoff, saved jobs and quoting on phone, tablet and desktop.",
        "positive": true
      },
      {
        "label": "Ask, then review",
        "detail": "Smart Assistant retrieves records and proposes supported changes. You confirm important edits.",
        "positive": true
      },
      {
        "label": "Keep specialist tools when needed",
        "detail": "QuoteCore+ does not replace EagleView's imagery collection, property intelligence, externally produced measurements or 3D property models.",
        "positive": false
      }
    ]
  },
  "switching": {
    "intro": "Work through one representative job before switching. Keep any specialist service or integration you still require.",
    "rows": [
      {
        "current": "You order measurements because you do not have a usable source",
        "qc": "Keep buying the necessary report; enter the verified dimensions into QuoteCore+.",
        "benefit": "Add your own pricing and quote workflow without pretending the report is unnecessary."
      },
      {
        "current": "You have a suitable plan or image",
        "qc": "Calibrate and measure it yourself in QuoteCore+.",
        "benefit": "Control the takeoff and its later revisions."
      },
      {
        "current": "You want to check the quoted amount while away from the office",
        "qc": "Retrieve the saved quote through the mobile interface or Smart Assistant.",
        "benefit": "Use the same job record on site."
      }
    ]
  },
  "workflow": {
    "heading": "From the measurement to the customer quote",
    "intro": "Choose the entry point that fits the job. The paid app keeps the measurement, your pricing rules and customer documents connected.",
    "steps": [
      {
        "number": "01",
        "title": "Measure or enter known dimensions",
        "body": "Use a supplied PDF or suitable image, calibrate the scale and check visible geometry. A phone does not make an unclear image measurable. Alternatively, enter dimensions you have already checked."
      },
      {
        "number": "02",
        "title": "Review before using the quantities",
        "body": "Check scale, pitch and visible geometry. With AI Scan Assist, review and correct the outline before component detection, then verify the result. The scan is assistance, not a guarantee."
      },
      {
        "number": "03",
        "title": "Apply the rules you actually use",
        "body": "Smart Components calculate material, labour, waste and pricing using your saved setup. Check quantities and allowances against the job. New rules still need configuring and validating."
      },
      {
        "number": "04",
        "title": "Review the quote and keep the job connected",
        "body": "Prepare the customer quote from the same job. Use the normal app builders for later orders and invoices. Smart Assistant can retrieve records or propose supported changes; it does not replace takeoff checks or create orders and invoices for you."
      }
    ],
    "proof": {
      "heading": "See the measurement and pricing workflow",
      "images": [
        {
          "src": "/images/features/digital-roof-takeoff.png",
          "alt": "QuoteCore+ roof takeoff showing colour-coded measurement lines over a roof plan",
          "caption": "Example takeoff view. Check the plan scale, roof outline and component measurements."
        },
        {
          "src": "/images/features/smart-components-quote.png",
          "alt": "Smart Components applying material quantities and pricing inside a QuoteCore+ quote",
          "caption": "Example pricing view. Your saved material, labour and waste rules feed the quote."
        }
      ]
    }
  },
  "comparison": {
    "heading": "EagleView vs QuoteCore+: workflow and capabilities",
    "intro": "Capabilities below distinguish documented features from unverified equivalents. A missing confirmation is not evidence that a competitor lacks a feature.",
    "rows": [
      {
        "feature": "Aerial imagery / property reports",
        "competitor": {
          "status": "yes",
          "note": "Imagery, measurement reports and property-model products."
        },
        "qc": {
          "status": "no",
          "note": "No imagery supply or externally produced property reports."
        }
      },
      {
        "feature": "PDF/plan takeoff",
        "competitor": {
          "status": "unconfirmed",
          "note": "A directly editable customer PDF takeoff tool was not verified."
        },
        "qc": {
          "status": "yes",
          "note": "Measure supplied plans or suitable images; verify scale and geometry."
        }
      },
      {
        "feature": "AI-assisted measurement",
        "competitor": {
          "status": "yes",
          "note": "AI-supported property measurement and insights."
        },
        "qc": {
          "status": "yes",
          "note": "AI Scan Assist: scan, review the outline, then detect and check components."
        }
      },
      {
        "feature": "Roofing-native measurements",
        "competitor": {
          "status": "yes",
          "note": "Roof area, pitch and edge measurements in relevant reports."
        },
        "qc": {
          "status": "yes",
          "note": "Roof areas, pitch factors, ridges, hips, valleys and roof edges."
        }
      },
      {
        "feature": "Materials from measurements",
        "competitor": {
          "status": "unconfirmed",
          "note": "Equivalent saved customer pricing-rule workflow not verified."
        },
        "qc": {
          "status": "yes",
          "note": "Smart Components reuse your materials, labour, waste and pricing rules."
        }
      },
      {
        "feature": "Quote generation & tracking",
        "competitor": {
          "status": "unconfirmed",
          "note": "Equivalent native customer quote and tracking workflow not verified."
        },
        "qc": {
          "status": "yes",
          "note": "Create customer quotes from the saved job; send and track where supported."
        }
      },
      {
        "feature": "Material orders & invoices",
        "competitor": {
          "status": "unconfirmed",
          "note": "Equivalent native order/invoice builder not verified."
        },
        "qc": {
          "status": "yes",
          "note": "Use the normal builders with saved job data; not autonomous Assistant creation."
        }
      },
      {
        "feature": "Cloud / browser access",
        "competitor": {
          "status": "yes",
          "note": "Online property viewer and reports."
        },
        "qc": {
          "status": "yes",
          "note": "Paid app: measure, price and quote on phone, tablet or desktop."
        }
      },
      {
        "feature": "Pricing model",
        "competitor": {
          "status": "different",
          "note": "Per-report tiers plus a separate Eagleview One subscription offer."
        },
        "qc": {
          "status": "yes",
          "note": "Paid plans from $19/month; free standalone tools are separate."
        }
      },
      {
        "feature": "Conversational assistance",
        "competitor": {
          "status": "different",
          "note": "Horizon is announced as coming soon for property intelligence."
        },
        "qc": {
          "status": "yes",
          "note": "Find account records and propose supported changes for your confirmation."
        }
      }
    ]
  },
  "pricing": {
    "heading": "EagleView vs QuoteCore+ pricing",
    "intro": "Compare the required feature set, billing commitment and any external measurement costs. These are different products, not a like-for-like savings guarantee.",
    "sourceNote": "Official vendor pricing reviewed 27 September 2026. Competitor figures are US prices; account, region, tax, discounts and billing conditions may change the total. Check the linked source before buying.",
    "competitorTiers": [
      {
        "name": "Premium roof report, small",
        "price": "US$32.75/report",
        "detail": "Bronze list tier; roof category and discounts matter."
      },
      {
        "name": "Premium roof report, medium",
        "price": "US$60/report",
        "detail": "Bronze list tier."
      },
      {
        "name": "Premium roof report, large",
        "price": "US$87/report",
        "detail": "Bronze list tier."
      },
      {
        "name": "Residential gutter report",
        "price": "US$13.75/report",
        "detail": "Published list price."
      },
      {
        "name": "Residential Full House report",
        "price": "US$105/report",
        "detail": "Bronze list tier."
      },
      {
        "name": "Eagleview One subscription",
        "price": "Contact EagleView",
        "detail": "Separate subscription offer; do not infer its cost from the report table."
      }
    ],
    "scenarios": [
      {
        "label": "Five small Premium reports at Bronze list price",
        "competitor": "5 × US$32.75 = US$163.75, before applicable adjustments.",
        "qc": "Starter is $19/month for 25 quotes. You still need your own measurement source and takeoff time."
      },
      {
        "label": "Use a report and QuoteCore+ together",
        "competitor": "Your applicable report or platform charge remains payable.",
        "qc": "The app subscription is additional. It supplies pricing and quoting, not the report."
      }
    ],
    "scenarioNote": "Illustrative workflow comparisons, not equivalent bundles. External imagery, measurement reports, setup time and separately required services are not included in the QuoteCore+ subscription."
  },
  "video": {
    "heading": "See how measurements become a quote",
    "intro": "This existing walkthrough shows the measurement and pricing workflow. It is not a new mobile or Smart Assistant demonstration.",
    "videoKey": "quoteWalkthrough",
    "ctaHref": "/features/smart-components",
    "ctaLabel": "Explore Smart Components"
  },
  "honestWhen": {
    "heading": "When to keep EagleView",
    "intro": "QuoteCore+ does not replace EagleView's imagery collection, property intelligence, externally produced measurements or 3D property models.",
    "cards": [
      {
        "title": "You need externally supplied property measurements",
        "body": "A software subscription is not a substitute for a measurement source you do not have."
      },
      {
        "title": "Your process depends on property intelligence or report formats",
        "body": "Retain the reporting service required by your business or project stakeholders."
      }
    ]
  },
  "freeTool": {
    "heading": "Try a useful tool before choosing the paid app",
    "body": "Use the free roof takeoff tool with your own suitable plan or image. It is a standalone tool with its own device support and limits, not access to the complete paid app. The paid app adds saved setup, reusable pricing and connected jobs.",
    "primaryHref": "/free-roofing-takeoff-builder",
    "primaryLabel": "Use free roof takeoff",
    "secondaryLinks": [
      {
        "label": "Free measurement-to-quote tool",
        "href": "/measurement-to-quote-tool",
        "description": "Use dimensions you already have."
      },
      {
        "label": "Browse free tools",
        "href": "/free-tools",
        "description": "Choose a standalone tool for the task."
      }
    ]
  },
  "faqs": [
    {
      "question": "Is QuoteCore+ another aerial roof report service?",
      "answer": "No. You measure your own plans or images, or enter measurements you already have. QuoteCore+ does not acquire aerial imagery or produce an externally verified property report."
    },
    {
      "question": "Can I use both EagleView and QuoteCore+?",
      "answer": "Yes, by entering the relevant dimensions from a report you are entitled to use. You then apply your own saved pricing rules. Automatic report import or an EagleView integration is not being claimed."
    },
    {
      "question": "Does EagleView only sell individual reports?",
      "answer": "No. Its current product pages also describe the Eagleview One subscription platform. The report table here is specifically its published report pricing, not every EagleView offer."
    },
    {
      "question": "Does Smart Assistant replace EagleView's property intelligence?",
      "answer": "No. Smart Assistant works with your QuoteCore+ account. Eagleview Horizon is an announced property-intelligence offering, marked coming soon on the page reviewed. These are not equivalent services."
    },
    {
      "question": "Can I measure, price and quote from my phone in QuoteCore+?",
      "answer": "Yes, in the paid app. Upload a plan, measure or use the reviewed AI scan workflow, apply saved pricing and prepare the quote on phone, tablet or desktop. Standalone free tools and the Roofing Takeoff Demo have separate device support and limits."
    },
    {
      "question": "What can QuoteCore+ Smart Assistant do?",
      "answer": "Use text or voice to find jobs, quotes, orders, invoices and status information in your account. It can propose supported changes such as adjusting a quote rate, which you review and confirm. It works within the access you give it. It does not perform takeoff geometry or create orders and invoices. Check current feature access on the pricing page."
    },
    {
      "question": "Is there a free QuoteCore+ app plan?",
      "answer": "No. The app is paid, with plans from $19/month and a 30-day money-back guarantee. Separate free tools can be used without signing up, but they are not a free account with the full app's saved workspace and capabilities."
    },
    {
      "question": "Is switching from EagleView automatic?",
      "answer": "No automatic migration or native integration is promised. Check which dimensions, rates, templates and records you need. Configure your pricing rules and validate a representative job before relying on the new setup."
    }
  ],
  "related": [
    {
      "label": "Roofing takeoff software",
      "description": "Measure roof plans digitally with AI assistance.",
      "href": "/roofing-takeoff-software"
    },
    {
      "label": "Roofing estimating software",
      "description": "Turn measurements into priced estimates.",
      "href": "/roofing-estimating-software"
    },
    {
      "label": "Roofing quoting software",
      "description": "The full quote-to-invoice workflow for roofers.",
      "href": "/roofing-quoting-software"
    },
    {
      "label": "RoofSnap alternative",
      "description": "Closest product-to-product comparison.",
      "href": "/roofsnap-alternative"
    },
    {
      "label": "PlanSwift alternative",
      "description": "General takeoff vs roofing-native.",
      "href": "/planswift-alternative"
    },
    {
      "label": "Roofr alternative",
      "description": "Broad roofing CRM vs focused estimating.",
      "href": "/roofr-alternative"
    },
    {
      "label": "STACK alternative for roofing",
      "description": "Multi-trade platform vs roofing-native.",
      "href": "/stack-alternative-for-roofing"
    },
    {
      "label": "HOVER alternative",
      "description": "Generated 3D measurement vs owned takeoff.",
      "href": "/hover-alternative"
    },
    {
      "label": "AI roof measuring guide",
      "description": "How AI measurement actually works.",
      "href": "/blog/ai-roof-measuring"
    },
    {
      "href": "/features",
      "label": "How QuoteCore+ works",
      "description": "Mobile workflows, Smart Assistant and the connected app."
    }
  ],
  "sectionOrder": [
    "replace",
    "quickAnswer",
    "switching",
    "workflow",
    "comparison",
    "pricing",
    "bestFor",
    "video",
    "honestWhen",
    "freeTool",
    "faq",
    "related"
  ],
  "finalCta": {
    "heading": "Make the next measured job easier to quote",
    "body": "Work with your measurements and your pricing, from site or office. Review paid plans for saved jobs and connected workflows, or use a separate free tool first.",
    "ctaLabel": "See paid plans"
  }
};

const threeWays: ThreeWaysToWorkProps = {
  "eyebrow": "One job. Three ways to work.",
  "title": "Measure it, enter it or ask Smart Assistant",
  "intro": "Choose the path for the task. You can switch between direct controls and the Assistant; these are not three steps you must complete in order.",
  "cards": [
    {
      "title": "Measure in the app",
      "body": "Use a supplied PDF or suitable image, calibrate the scale and check visible geometry. A phone does not make an unclear image measurable.",
      "href": "/features/digital-roof-takeoff",
      "linkLabel": "Explore digital takeoff"
    },
    {
      "title": "Enter your measurements",
      "body": "Enter verified dimensions from your site notes or an existing report. Saved components then calculate the price using your rules.",
      "href": "/features/smart-components",
      "linkLabel": "See saved pricing rules"
    },
    {
      "title": "Ask Smart Assistant",
      "body": "Ask for an existing quote, job or invoice status. Review supported changes before confirming them; Assistant does not generate an aerial report.",
      "href": "/features",
      "linkLabel": "Explore the app features"
    }
  ],
  "footnote": "Your inputs and saved pricing rules remain the basis of the quote. Smart Assistant access and supported actions depend on the available feature and permissions. Important changes are proposed for confirmation.",
  "footnoteLink": {
    "href": "/pricing",
    "label": "Check plans and feature access"
  }
};

const research: ComparisonResearch = {
  "reviewedDate": "27 September 2026",
  "sources": [
    {
      "id": "product",
      "label": "EagleView residential property reports",
      "href": "https://www.eagleview.com/product/residential-property-reports-for-construction/",
      "scope": "Report scope, roofing measurements, property outputs and subscription-based Eagleview One access."
    },
    {
      "id": "pricing",
      "label": "EagleView published report prices",
      "href": "https://www.eagleview.com/pricing/",
      "scope": "Bronze list prices and volume tiers. Do not confuse report prices with Eagleview One subscription quotes."
    },
    {
      "id": "platform",
      "label": "Eagleview One",
      "href": "https://www.eagleview.com/eagleview-one/",
      "scope": "Interactive property models, imagery and report selection."
    },
    {
      "id": "assistant",
      "label": "Eagleview Horizon announcement",
      "href": "https://www.eagleview.com/horizon/",
      "scope": "Natural-language property intelligence described as coming soon on the reviewed page, not verified general availability."
    }
  ],
  "rowSources": {
    "Aerial imagery / property reports": [
      "product"
    ],
    "PDF/plan takeoff": [
      "product"
    ],
    "AI-assisted measurement": [
      "platform"
    ],
    "Roofing-native measurements": [
      "product"
    ],
    "Materials from measurements": [
      "product"
    ],
    "Quote generation & tracking": [
      "product"
    ],
    "Material orders & invoices": [
      "product"
    ],
    "Cloud / browser access": [
      "platform"
    ],
    "Pricing model": [
      "pricing",
      "product"
    ],
    "Conversational assistance": [
      "assistant"
    ]
  },
  "pricingSourceIds": [
    "pricing"
  ],
  "note": "This comparison is published by QuoteCore+ and is based on the linked vendor documentation, not a hands-on performance test. Feature availability, plans and previews can change. Unverified equivalents are marked explicitly, not scored as missing features."
};

export const metadata: Metadata = {
  "title": "EagleView Alternative for Roof Takeoff & Quotes | QuoteCore+",
  "description": "Compare EagleView reports with QuoteCore+ self-service roof takeoff and quoting. See pricing, mobile workflows, report limitations and when to use both.",
  "openGraph": {
    "title": "EagleView Alternative for Roof Takeoff & Quotes | QuoteCore+",
    "description": "Compare EagleView reports with QuoteCore+ self-service roof takeoff and quoting. See pricing, mobile workflows, report limitations and when to use both.",
    "url": "/eagleview-alternative",
    "siteName": "QuoteCore+",
    "type": "website"
  },
  "alternates": {
    "canonical": "https://quote-core.com/eagleview-alternative"
  }
};

const faqSchema = buildFaqSchema(pageData.faqs);
const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: `${siteUrl}/` },
  { name: "EagleView Alternative", url: `${siteUrl}/eagleview-alternative` },
]);

export default function EagleViewAlternativePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <main className="min-h-screen bg-white text-zinc-950">
        <BlogHeader />
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "EagleView Alternative" }]} />
        <CompetitorPage data={pageData} threeWays={threeWays} research={research} />
        <SiteFooter />
      </main>
    </>
  );
}
