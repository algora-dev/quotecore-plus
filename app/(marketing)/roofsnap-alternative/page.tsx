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
  "slug": "roofsnap-alternative",
  "competitorName": "RoofSnap",
  "checkedDate": "27 September 2026",
  "positioning": "Roofing measurement, pricing and quoting",
  "hero": {
    "title": "A RoofSnap alternative for your own roof takeoff and pricing rules",
    "sub": "Measure your plan, enter existing dimensions or ask Smart Assistant about the saved job. Keep pricing and customer quotes together on phone, tablet or desktop.",
    "qualifier": "RoofSnap also offers DIY takeoff, mobile access and estimating. This is a workflow comparison, not a claim that it only sells reports.",
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
    "heading": "Compare two self-service workflows, not tools versus reports",
    "body": "RoofSnap combines ordered reports with draw-it-yourself measurements, estimates and material orders. QuoteCore+ focuses on measuring, applying your reusable pricing logic and producing the customer quote, with an assistant for supported account tasks. Both can support self-service workflows. Compare the source material you use, how you want to maintain your rules, and whether you need RoofSnap's integrated payments and financing. QuoteCore+ does not supply aerial imagery or a report-ordering service."
  },
  "bestFor": {
    "competitorBestFor": [
      {
        "title": "You want report ordering and imagery in the same service",
        "body": "Keep that supply route when you do not have suitable source material yourself."
      },
      {
        "title": "Customer payments or financing are part of the sale",
        "body": "Check those requirements separately from measuring and quoting."
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
      "answer": "Replace the work you no longer need to split across tools, not every RoofSnap capability."
    },
    "body": "QuoteCore+ does not replace RoofSnap's measurement-ordering service, imagery supply or integrated payment and financing options.",
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
        "detail": "QuoteCore+ does not replace RoofSnap's measurement-ordering service, imagery supply or integrated payment and financing options.",
        "positive": false
      }
    ]
  },
  "switching": {
    "intro": "Work through one representative job before switching. Keep any specialist service or integration you still require.",
    "rows": [
      {
        "current": "You use RoofSnap DIY tools or order reports",
        "qc": "Measure your own plan in QuoteCore+ or enter existing report dimensions.",
        "benefit": "Choose the measurement entry point that matches the job."
      },
      {
        "current": "You want repeatable material and labour rules",
        "qc": "Configure Smart Components once, then apply them to new measurements.",
        "benefit": "Keep your method and reduce repeat setup."
      },
      {
        "current": "You need to check the job away from a desk",
        "qc": "Open the saved job on mobile or ask Smart Assistant for account information.",
        "benefit": "Use the same data without navigating every screen."
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
        "body": "Upload a roofing PDF or usable image on phone, tablet or desktop. Measure it yourself or review an AI-assisted scan. Alternatively, enter dimensions you have already checked."
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
          "src": "/images/features/smart-components-admin.png",
          "alt": "Smart Components library showing stored materials, coverage, waste and pricing rules",
          "caption": "Example pricing view. Your saved material, labour and waste rules feed the quote."
        }
      ]
    }
  },
  "comparison": {
    "heading": "RoofSnap vs QuoteCore+: workflow and capabilities",
    "intro": "Capabilities below distinguish documented features from unverified equivalents. A missing confirmation is not evidence that a competitor lacks a feature.",
    "rows": [
      {
        "feature": "DIY roof measurement tools",
        "competitor": {
          "status": "yes",
          "note": "DIY drawing from imagery or supplied blueprints."
        },
        "qc": {
          "status": "yes",
          "note": "Measure supplied plans or suitable images; verify scale and geometry."
        }
      },
      {
        "feature": "AI-assisted measurement",
        "competitor": {
          "status": "unconfirmed",
          "note": "Equivalent user-reviewed AI plan scan not verified."
        },
        "qc": {
          "status": "yes",
          "note": "AI Scan Assist: scan, review the outline, then detect and check components."
        }
      },
      {
        "feature": "Ordered measurement reports",
        "competitor": {
          "status": "yes",
          "note": "Report-ordering service available."
        },
        "qc": {
          "status": "no",
          "note": "No report-ordering service."
        }
      },
      {
        "feature": "Roofing-native measurements",
        "competitor": {
          "status": "yes",
          "note": "Roof measurement tools and report options."
        },
        "qc": {
          "status": "yes",
          "note": "Roof areas, pitch factors, ridges, hips, valleys and edges."
        }
      },
      {
        "feature": "Materials from measurements",
        "competitor": {
          "status": "yes",
          "note": "Custom material and pricing setup."
        },
        "qc": {
          "status": "yes",
          "note": "Smart Components reuse your materials, labour, waste and pricing rules."
        }
      },
      {
        "feature": "Quotes / estimates",
        "competitor": {
          "status": "yes",
          "note": "Estimates, options and branded contracts."
        },
        "qc": {
          "status": "yes",
          "note": "Create customer quotes from the saved job; send and track where supported."
        }
      },
      {
        "feature": "Material orders",
        "competitor": {
          "status": "yes",
          "note": "Material-order documents."
        },
        "qc": {
          "status": "yes",
          "note": "Create material orders from saved quote data using the order builder."
        }
      },
      {
        "feature": "Invoices",
        "competitor": {
          "status": "unconfirmed",
          "note": "Equivalent invoice lifecycle not verified."
        },
        "qc": {
          "status": "yes",
          "note": "Create and track invoices from saved job data using the invoice builder."
        }
      },
      {
        "feature": "In-app payments / financing",
        "competitor": {
          "status": "yes",
          "note": "Payments and homeowner-financing options."
        },
        "qc": {
          "status": "different",
          "note": "Payment details and links, not direct processing or financing."
        }
      },
      {
        "feature": "Cloud / browser access",
        "competitor": {
          "status": "yes",
          "note": "DIY tools and documents across devices."
        },
        "qc": {
          "status": "yes",
          "note": "Paid app: measure, price and quote on phone, tablet or desktop."
        }
      },
      {
        "feature": "Pricing model",
        "competitor": {
          "status": "yes",
          "note": "Per-report or per-user subscription; annual team conditions apply."
        },
        "qc": {
          "status": "yes",
          "note": "Paid plans from $19/month; free standalone tools are separate."
        }
      },
      {
        "feature": "Conversational account assistance",
        "competitor": {
          "status": "unconfirmed",
          "note": "Equivalent quote-record assistant not verified."
        },
        "qc": {
          "status": "yes",
          "note": "Find account records and propose supported changes for your confirmation."
        }
      }
    ]
  },
  "pricing": {
    "heading": "RoofSnap vs QuoteCore+ pricing",
    "intro": "Compare the required feature set, billing commitment and any external measurement costs. These are different products, not a like-for-like savings guarantee.",
    "sourceNote": "Official vendor pricing reviewed 27 September 2026. Competitor figures are US prices; account, region, tax, discounts and billing conditions may change the total. Check the linked source before buying.",
    "competitorTiers": [
      {
        "name": "Pay-as-you-go measurements",
        "price": "From US$13/report",
        "detail": "Report category and delivery options affect cost."
      },
      {
        "name": "Monthly subscription",
        "price": "From US$105/user/month",
        "detail": "Includes DIY tools; additional imagery or report charges may apply."
      },
      {
        "name": "Annual, 2 to 4 users",
        "price": "US$78/user/month",
        "detail": "Annual arrangement, not a solo monthly price."
      },
      {
        "name": "Annual, 5 to 9 users",
        "price": "US$61/user/month",
        "detail": "Team-size condition applies."
      },
      {
        "name": "Annual, 10 or more users",
        "price": "US$52/user/month",
        "detail": "Do not treat the headline rate as a one-user offer."
      }
    ],
    "scenarios": [
      {
        "label": "One person paying monthly",
        "competitor": "Published subscription starts at US$105/user/month.",
        "qc": "Paid app starts at $19/month; compare required features and quote allowances."
      },
      {
        "label": "You outsource the measurements",
        "competitor": "Report costs depend on the report and delivery selected.",
        "qc": "External reports remain extra. The app supplies your pricing and quote workflow."
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
    "heading": "When to keep RoofSnap",
    "intro": "QuoteCore+ does not replace RoofSnap's measurement-ordering service, imagery supply or integrated payment and financing options.",
    "cards": [
      {
        "title": "You want report ordering and imagery in the same service",
        "body": "Keep that supply route when you do not have suitable source material yourself."
      },
      {
        "title": "Customer payments or financing are part of the sale",
        "body": "Check those requirements separately from measuring and quoting."
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
      "question": "Is RoofSnap just a report-ordering service?",
      "answer": "No. RoofSnap also advertises DIY measurements, estimating, material orders and use across devices. Both products deserve comparison as software, not only as ways to acquire measurements."
    },
    {
      "question": "Can QuoteCore+ order a RoofSnap-style measurement report?",
      "answer": "No. Supply a usable plan or image for takeoff, or enter verified dimensions. Any external imagery or report purchase is separate."
    },
    {
      "question": "Is the US$52 RoofSnap price available to a solo user?",
      "answer": "The reviewed pricing page ties that monthly-equivalent annual rate to teams of at least ten users. It publishes different rates for smaller teams and monthly subscriptions."
    },
    {
      "question": "Does QuoteCore+ process payments or offer financing?",
      "answer": "QuoteCore+ can present invoice payment instructions and configured payment links. It does not itself process payments or replace an integrated homeowner-financing service."
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
      "question": "Is switching from RoofSnap automatic?",
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
      "label": "Roofing quoting software",
      "description": "The full quote-to-invoice workflow for roofers.",
      "href": "/roofing-quoting-software"
    },
    {
      "label": "Roofing estimating software",
      "description": "Turn measurements into priced estimates.",
      "href": "/roofing-estimating-software"
    },
    {
      "label": "EagleView alternative",
      "description": "Reports vs owning your workflow.",
      "href": "/eagleview-alternative"
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
      "label": "Free takeoff builder",
      "description": "Try roof takeoff free, no signup.",
      "href": "/free-roofing-takeoff-builder"
    },
    {
      "href": "/features",
      "label": "How QuoteCore+ works",
      "description": "Mobile workflows, Smart Assistant and the connected app."
    }
  ],
  "sectionOrder": [
    "quickAnswer",
    "replace",
    "bestFor",
    "switching",
    "comparison",
    "pricing",
    "workflow",
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
      "body": "Upload a roofing PDF or usable image on phone, tablet or desktop. Measure it yourself or review an AI-assisted scan.",
      "href": "/features/digital-roof-takeoff",
      "linkLabel": "Explore digital takeoff"
    },
    {
      "title": "Enter your measurements",
      "body": "Use dimensions already measured on site or supplied in a report. Apply your saved components rather than rebuilding the pricing.",
      "href": "/features/smart-components",
      "linkLabel": "See saved pricing rules"
    },
    {
      "title": "Ask Smart Assistant",
      "body": "Ask which quotes need attention or find an invoice. Review supported rate changes before confirming them.",
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
      "label": "RoofSnap software subscription",
      "href": "https://roofsnap.com/solutions/roofing-software-subscription/",
      "scope": "DIY measurement on multiple devices, blueprints, estimating and business documents."
    },
    {
      "id": "pricing",
      "label": "RoofSnap plans and pricing",
      "href": "https://roofsnap.com/pricing/",
      "scope": "Report prices, per-user subscriptions and team-size conditions for annual rates. In-app payments and Acorn financing are advertised; product eligibility and terms apply."
    }
  ],
  "rowSources": {
    "DIY roof measurement tools": [
      "product"
    ],
    "AI-assisted measurement": [
      "product"
    ],
    "Ordered measurement reports": [
      "pricing"
    ],
    "Roofing-native measurements": [
      "product"
    ],
    "Materials from measurements": [
      "product"
    ],
    "Quotes / estimates": [
      "product"
    ],
    "Material orders": [
      "product"
    ],
    "Invoices": [
      "product"
    ],
    "In-app payments / financing": [
      "pricing"
    ],
    "Cloud / browser access": [
      "product"
    ],
    "Pricing model": [
      "pricing"
    ],
    "Conversational account assistance": [
      "product"
    ]
  },
  "pricingSourceIds": [
    "pricing"
  ],
  "note": "This comparison is published by QuoteCore+ and is based on the linked vendor documentation, not a hands-on performance test. Feature availability, plans and previews can change. Unverified equivalents are marked explicitly, not scored as missing features."
};

export const metadata: Metadata = {
  "title": "RoofSnap Alternative for Takeoff & Quoting | QuoteCore+",
  "description": "Compare RoofSnap and QuoteCore+ for DIY roof takeoff, mobile pricing and quotes. See report options, payment differences and subscription conditions.",
  "openGraph": {
    "title": "RoofSnap Alternative for Takeoff & Quoting | QuoteCore+",
    "description": "Compare RoofSnap and QuoteCore+ for DIY roof takeoff, mobile pricing and quotes. See report options, payment differences and subscription conditions.",
    "url": "/roofsnap-alternative",
    "siteName": "QuoteCore+",
    "type": "website"
  },
  "alternates": {
    "canonical": "https://quote-core.com/roofsnap-alternative"
  }
};

const faqSchema = buildFaqSchema(pageData.faqs);
const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: `${siteUrl}/` },
  { name: "RoofSnap Alternative", url: `${siteUrl}/roofsnap-alternative` },
]);

export default function RoofSnapAlternativePage() {
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
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "RoofSnap Alternative" }]} />
        <CompetitorPage data={pageData} threeWays={threeWays} research={research} />
        <SiteFooter />
      </main>
    </>
  );
}
