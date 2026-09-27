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
  "slug": "planswift-alternative",
  "competitorName": "PlanSwift",
  "checkedDate": "27 September 2026",
  "positioning": "Roofing measurement, pricing and quoting",
  "hero": {
    "title": "A PlanSwift alternative for roofing work on phone and desktop",
    "sub": "Measure roofing plans, apply saved component rules and prepare the quote in one connected workflow. Work on your phone, tablet or desktop instead of reserving the takeoff for a Windows workstation.",
    "qualifier": "PlanSwift has established takeoff, assemblies and AI tools. QuoteCore+ is an alternative for the workflow you need, not an automatic converter for your existing PlanSwift setup.",
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
    "heading": "Take the roofing workflow beyond the workstation",
    "body": "PlanSwift is a Windows takeoff and estimating application. QuoteCore+ brings roofing measurement, pricing and customer quotes into a browser-based workflow that also works on phones and tablets. Both support reusable estimating logic, and PlanSwift now offers AI tools through Takeoff Boost. Consider the practical difference: where you need to measure, how you maintain your rules, and what happens after the estimate. A mature multi-trade PlanSwift setup may still be worth keeping."
  },
  "bestFor": {
    "competitorBestFor": [
      {
        "title": "You depend on a customized PlanSwift setup",
        "body": "Account for the cost of rebuilding and validating established assemblies and plug-ins."
      },
      {
        "title": "Your estimating is deliberately Windows-based",
        "body": "A desktop workflow may already suit your team; mobile access alone is not a reason to replace it."
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
      "answer": "Replace the work you no longer need to split across tools, not every PlanSwift capability."
    },
    "body": "QuoteCore+ is not a replacement for every PlanSwift plug-in, custom assembly or established multi-trade estimating process. Existing assemblies do not automatically transfer.",
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
        "detail": "QuoteCore+ is not a replacement for every PlanSwift plug-in, custom assembly or established multi-trade estimating process. Existing assemblies do not automatically transfer.",
        "positive": false
      }
    ]
  },
  "switching": {
    "intro": "Work through one representative job before switching. Keep any specialist service or integration you still require.",
    "rows": [
      {
        "current": "You use PlanSwift at a Windows workstation",
        "qc": "Measure and continue the roofing job in QuoteCore+ on phone, tablet or desktop.",
        "benefit": "Use the estimating workflow where the work happens."
      },
      {
        "current": "You have established assemblies and rates",
        "qc": "Rebuild the required logic as Smart Components and validate a sample job.",
        "benefit": "Carry forward your method, rather than assuming automatic migration."
      },
      {
        "current": "Your price must become a customer document",
        "qc": "Review and create the customer quote from the same measured job.",
        "benefit": "Avoid a separate quoting handoff when you no longer need it."
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
        "body": "Upload the plan on phone, tablet or desktop. Measure directly or use the staged AI scan and review process. Alternatively, enter dimensions you have already checked."
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
    "heading": "PlanSwift vs QuoteCore+: workflow and capabilities",
    "intro": "Capabilities below distinguish documented features from unverified equivalents. A missing confirmation is not evidence that a competitor lacks a feature.",
    "rows": [
      {
        "feature": "PDF/plan takeoff",
        "competitor": {
          "status": "yes",
          "note": "Desktop plan takeoff."
        },
        "qc": {
          "status": "yes",
          "note": "Measure supplied plans or suitable images; verify scale and geometry."
        }
      },
      {
        "feature": "Roofing-native measurement types",
        "competitor": {
          "status": "different",
          "note": "General measurement tools and configurable assemblies."
        },
        "qc": {
          "status": "yes",
          "note": "Roof areas, pitch adjustments and named roofing components."
        }
      },
      {
        "feature": "AI-assisted measurement",
        "competitor": {
          "status": "yes",
          "note": "Takeoff Boost capabilities differ between Essential and Core."
        },
        "qc": {
          "status": "yes",
          "note": "AI Scan Assist: scan, review the outline, then detect and check components."
        }
      },
      {
        "feature": "Materials, waste & labour rules",
        "competitor": {
          "status": "yes",
          "note": "Reusable estimating assemblies."
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
          "note": "Equivalent native customer acceptance/tracking workflow not verified."
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
          "note": "Equivalent native order/invoice lifecycle not verified."
        },
        "qc": {
          "status": "yes",
          "note": "Connected quote, order and invoice builders."
        }
      },
      {
        "feature": "Cloud / browser access",
        "competitor": {
          "status": "different",
          "note": "Windows installation; not native browser or phone takeoff."
        },
        "qc": {
          "status": "yes",
          "note": "Paid app: measure, price and quote on phone, tablet or desktop."
        }
      },
      {
        "feature": "Multi-trade support",
        "competitor": {
          "status": "yes",
          "note": "General construction estimating scope."
        },
        "qc": {
          "status": "yes",
          "note": "Roofing-first, plus measured construction work."
        }
      },
      {
        "feature": "Pricing model",
        "competitor": {
          "status": "yes",
          "note": "Annual seat licence; Essential US$2,000 for the first seat."
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
          "note": "An equivalent account-record assistant was not verified."
        },
        "qc": {
          "status": "yes",
          "note": "Find account records and propose supported changes for your confirmation."
        }
      }
    ]
  },
  "pricing": {
    "heading": "PlanSwift vs QuoteCore+ pricing",
    "intro": "Compare the required feature set, billing commitment and any external measurement costs. These are different products, not a like-for-like savings guarantee.",
    "sourceNote": "Official vendor pricing reviewed 27 September 2026. Competitor figures are US prices; account, region, tax, discounts and billing conditions may change the total. Check the linked source before buying.",
    "competitorTiers": [
      {
        "name": "Essential, first seat",
        "price": "US$2,000/year",
        "detail": "Annual seat licence. Current plan name is Essential, not the older Professional label."
      },
      {
        "name": "Core, first seat",
        "price": "US$3,000/year",
        "detail": "Annual seat licence; broader Takeoff Boost capability."
      },
      {
        "name": "Additional seats and options",
        "price": "Check vendor pricing",
        "detail": "Do not assume every extra seat costs the full first-seat rate."
      }
    ],
    "scenarios": [
      {
        "label": "One estimator choosing a paid plan",
        "competitor": "Compare the annual Essential or Core seat licence and required features.",
        "qc": "Choose a monthly app tier for quote volume and capabilities, starting at $19/month."
      },
      {
        "label": "Existing customized estimating setup",
        "competitor": "Your assemblies and staff knowledge have value beyond the licence price.",
        "qc": "Allow time to configure and check your own Smart Components before switching."
      }
    ],
    "scenarioNote": "Illustrative workflow comparisons, not equivalent bundles. External imagery, measurement reports, setup time and separately required services are not included in the QuoteCore+ subscription."
  },
  "video": {
    "heading": "See how measurements become a quote",
    "intro": "This existing walkthrough shows the measurement and pricing workflow. It is not a new mobile or Smart Assistant demonstration.",
    "videoKey": "smartComponents",
    "ctaHref": "/features/smart-components",
    "ctaLabel": "Explore Smart Components"
  },
  "honestWhen": {
    "heading": "When to keep PlanSwift",
    "intro": "QuoteCore+ is not a replacement for every PlanSwift plug-in, custom assembly or established multi-trade estimating process. Existing assemblies do not automatically transfer.",
    "cards": [
      {
        "title": "You depend on a customized PlanSwift setup",
        "body": "Account for the cost of rebuilding and validating established assemblies and plug-ins."
      },
      {
        "title": "Your estimating is deliberately Windows-based",
        "body": "A desktop workflow may already suit your team; mobile access alone is not a reason to replace it."
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
      "question": "Does QuoteCore+ require Windows like PlanSwift?",
      "answer": "No. QuoteCore+ is browser-based and its paid takeoff workflow supports phone, tablet and desktop. PlanSwift's published requirements describe a Windows application."
    },
    {
      "question": "Does PlanSwift already have AI takeoff tools?",
      "answer": "Yes. The current Essential and Core plans include different Takeoff Boost capabilities. QuoteCore+ does not claim to be the only product with AI-assisted measuring."
    },
    {
      "question": "Is the PlanSwift price still US$2,000 a year?",
      "answer": "That price is still published for a first Essential seat. The current pricing page also lists Core at US$3,000 per year, with different capabilities and additional-seat arrangements."
    },
    {
      "question": "Will my PlanSwift assemblies import automatically?",
      "answer": "No automatic migration is promised. Identify the measurements, materials, labour, waste and pricing rules you need, then configure and validate the corresponding Smart Components."
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
      "question": "Is switching from PlanSwift automatic?",
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
      "label": "Bluebeam alternative for roofing",
      "description": "Configurable PDF toolkit vs roofing workflow.",
      "href": "/bluebeam-alternative-for-roofing"
    },
    {
      "label": "EagleView alternative",
      "description": "Reports vs owning your workflow.",
      "href": "/eagleview-alternative"
    },
    {
      "label": "Roofr alternative",
      "description": "Broad roofing CRM vs focused estimating.",
      "href": "/roofr-alternative"
    },
    {
      "label": "Free quote generator",
      "description": "Draft a professional quote free.",
      "href": "/free-quote-generator"
    },
    {
      "href": "/features",
      "label": "How QuoteCore+ works",
      "description": "Mobile workflows, Smart Assistant and the connected app."
    }
  ],
  "sectionOrder": [
    "replace",
    "switching",
    "workflow",
    "quickAnswer",
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
      "body": "Upload the plan on phone, tablet or desktop. Measure directly or use the staged AI scan and review process.",
      "href": "/features/digital-roof-takeoff",
      "linkLabel": "Explore digital takeoff"
    },
    {
      "title": "Enter your measurements",
      "body": "Use dimensions already measured in PlanSwift or on site. Enter them into saved Smart Components; this is not an automatic assembly import.",
      "href": "/features/smart-components",
      "linkLabel": "See saved pricing rules"
    },
    {
      "title": "Ask Smart Assistant",
      "body": "Find the saved job or ask for a quote-rate adjustment by text or voice. Check the proposed change before confirming it.",
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
      "label": "PlanSwift plans and feature scope",
      "href": "https://www.planswift.com/pricing/",
      "scope": "Essential and Core plans, assemblies, included AI features, annual prices and training. Essential remains US$2,000 per seat per year; Core is US$3,000. Additional-seat pricing can differ."
    },
    {
      "id": "platform",
      "label": "PlanSwift system requirements",
      "href": "https://help.constructconnect.com/getting-started-with-planswift-117/planswift-system-requirements-1649",
      "scope": "Windows installation requirements; not a native phone/browser application."
    }
  ],
  "rowSources": {
    "PDF/plan takeoff": [
      "product"
    ],
    "Roofing-native measurement types": [
      "product"
    ],
    "AI-assisted measurement": [
      "product"
    ],
    "Materials, waste & labour rules": [
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
    "Multi-trade support": [
      "product"
    ],
    "Pricing model": [
      "product"
    ],
    "Conversational account assistance": [
      "product"
    ]
  },
  "pricingSourceIds": [
    "product"
  ],
  "note": "This comparison is published by QuoteCore+ and is based on the linked vendor documentation, not a hands-on performance test. Feature availability, plans and previews can change. Unverified equivalents are marked explicitly, not scored as missing features."
};

export const metadata: Metadata = {
  "title": "PlanSwift Alternative for Roofing on Mobile | QuoteCore+",
  "description": "Compare PlanSwift with QuoteCore+ for roofing takeoff, pricing and quotes. Review Windows requirements, phone workflows, AI tools and annual pricing.",
  "openGraph": {
    "title": "PlanSwift Alternative for Roofing on Mobile | QuoteCore+",
    "description": "Compare PlanSwift with QuoteCore+ for roofing takeoff, pricing and quotes. Review Windows requirements, phone workflows, AI tools and annual pricing.",
    "url": "/planswift-alternative",
    "siteName": "QuoteCore+",
    "type": "website"
  },
  "alternates": {
    "canonical": "https://quote-core.com/planswift-alternative"
  }
};

const faqSchema = buildFaqSchema(pageData.faqs);
const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: `${siteUrl}/` },
  { name: "PlanSwift Alternative", url: `${siteUrl}/planswift-alternative` },
]);

export default function PlanSwiftAlternativePage() {
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
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "PlanSwift Alternative" }]} />
        <CompetitorPage data={pageData} threeWays={threeWays} research={research} />
        <SiteFooter />
      </main>
    </>
  );
}
