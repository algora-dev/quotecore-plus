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
  "slug": "roofr-alternative",
  "competitorName": "Roofr",
  "checkedDate": "27 September 2026",
  "positioning": "Roofing measurement, pricing and quoting",
  "hero": {
    "title": "A Roofr alternative for measuring, pricing and quoting",
    "sub": "Keep roofing takeoff, your pricing rules and customer quotes together on phone, tablet or desktop. Use the interface yourself, or ask Smart Assistant to find information and propose supported changes.",
    "qualifier": "Roofr also connects measurements and proposals. Consider QuoteCore+ when your priority is a focused measure-to-quote workflow, rather than a wider sales CRM.",
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
    "heading": "Compare the workflow, not just the feature count",
    "body": "Roofr is a roofing platform with measurement reports, DIY measurement, estimating and sales workflows. QuoteCore+ is a roofing-first measurement, pricing and quoting app. The choice is not whether either can produce a quote. It is whether you need Roofr's broader CRM and payments, or want to work directly with plans, existing measurements and your saved pricing in QuoteCore+. Smart Assistant adds another way to work with your account, not a substitute for checking the estimate."
  },
  "bestFor": {
    "competitorBestFor": [
      {
        "title": "You need a roofing sales CRM",
        "body": "Keep the sales and customer-acquisition workflow that your team depends on."
      },
      {
        "title": "You buy measurements and manage payments together",
        "body": "Evaluate the report, payment and sales features as a package, not just the subscription price."
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
      "answer": "Replace the work you no longer need to split across tools, not every Roofr capability."
    },
    "body": "QuoteCore+ does not replace Roofr's sales pipelines, lead capture, integrated payment processing or crew-management system.",
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
        "detail": "QuoteCore+ does not replace Roofr's sales pipelines, lead capture, integrated payment processing or crew-management system.",
        "positive": false
      }
    ]
  },
  "switching": {
    "intro": "Work through one representative job before switching. Keep any specialist service or integration you still require.",
    "rows": [
      {
        "current": "Your team depends on Roofr sales boards",
        "qc": "Use QuoteCore+ for estimating only when a separate sales system is still acceptable.",
        "benefit": "Keep the scope of any switch explicit."
      },
      {
        "current": "You already have roof dimensions",
        "qc": "Enter those measurements into saved Smart Components.",
        "benefit": "Reuse your rates without redrawing the roof."
      },
      {
        "current": "You need to check a quote while on site",
        "qc": "Open the same saved job on your phone or ask Smart Assistant for its status.",
        "benefit": "Work from the saved account instead of relying on a separate note."
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
        "body": "Upload a PDF or usable image and measure the roof on phone, tablet or desktop. Review AI Scan Assist results before pricing. Alternatively, enter dimensions you have already checked."
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
    "heading": "Roofr vs QuoteCore+: workflow and capabilities",
    "intro": "Capabilities below distinguish documented features from unverified equivalents. A missing confirmation is not evidence that a competitor lacks a feature.",
    "rows": [
      {
        "feature": "Roofing-specific product",
        "competitor": {
          "status": "yes",
          "note": "Roofing-focused platform."
        },
        "qc": {
          "status": "yes",
          "note": "Roofing-first, with broader measured-trade use."
        }
      },
      {
        "feature": "Digital roof measurement",
        "competitor": {
          "status": "yes",
          "note": "Ordered reports and DIY measurement."
        },
        "qc": {
          "status": "yes",
          "note": "Measure supplied plans or suitable images; verify scale and geometry."
        }
      },
      {
        "feature": "Blueprint measurement",
        "competitor": {
          "status": "yes",
          "note": "DIY workflow accepts supplied source images."
        },
        "qc": {
          "status": "yes",
          "note": "Calibrated takeoff from supplied PDF plans."
        }
      },
      {
        "feature": "Aerial/satellite imagery",
        "competitor": {
          "status": "yes",
          "note": "Measurement service and imagery options."
        },
        "qc": {
          "status": "different",
          "note": "Use your own suitable image; imagery is not supplied."
        }
      },
      {
        "feature": "Ordered measurement reports",
        "competitor": {
          "status": "yes",
          "note": "Report charges and delivery depend on the selected option."
        },
        "qc": {
          "status": "no",
          "note": "No measurement-report ordering service."
        }
      },
      {
        "feature": "AI-assisted roof detection",
        "competitor": {
          "status": "unconfirmed",
          "note": "Specific user-reviewed plan-scanning scope not verified in the reviewed sources."
        },
        "qc": {
          "status": "yes",
          "note": "AI Scan Assist: scan, review the outline, then detect and check components."
        }
      },
      {
        "feature": "Reusable estimating logic",
        "competitor": {
          "status": "yes",
          "note": "Material calculations and estimating tools."
        },
        "qc": {
          "status": "yes",
          "note": "Smart Components reuse your materials, labour, waste and pricing rules."
        }
      },
      {
        "feature": "Quotes / proposals",
        "competitor": {
          "status": "yes",
          "note": "Proposals with plan-dependent allowances."
        },
        "qc": {
          "status": "yes",
          "note": "Create customer quotes from the saved job; send and track where supported."
        }
      },
      {
        "feature": "E-signatures",
        "competitor": {
          "status": "yes",
          "note": "Signing capability depends on plan."
        },
        "qc": {
          "status": "different",
          "note": "Customer quote acceptance; do not assume equivalent e-signature functionality."
        }
      },
      {
        "feature": "Material ordering",
        "competitor": {
          "status": "yes",
          "note": "Ordering and supplier-connected workflows."
        },
        "qc": {
          "status": "yes",
          "note": "Create material orders from saved quote data using the order builder."
        }
      },
      {
        "feature": "Invoicing",
        "competitor": {
          "status": "yes",
          "note": "Invoicing with plan-dependent allowances."
        },
        "qc": {
          "status": "yes",
          "note": "Create and track invoices from saved job data using the invoice builder."
        }
      },
      {
        "feature": "Online payments",
        "competitor": {
          "status": "yes",
          "note": "Integrated payment options."
        },
        "qc": {
          "status": "different",
          "note": "Payment instructions and configured links; no direct processing."
        }
      },
      {
        "feature": "CRM / job boards",
        "competitor": {
          "status": "yes",
          "note": "Sales boards and CRM features."
        },
        "qc": {
          "status": "different",
          "note": "Saved job workflow, not a sales CRM."
        }
      },
      {
        "feature": "Lead capture / instant website estimates",
        "competitor": {
          "status": "yes",
          "note": "Separate sales and lead-generation options."
        },
        "qc": {
          "status": "no",
          "note": "Not a website lead-estimator or campaign system."
        }
      },
      {
        "feature": "Crew management",
        "competitor": {
          "status": "yes",
          "note": "Advertised on Scale."
        },
        "qc": {
          "status": "different",
          "note": "Not a crew-management replacement."
        }
      },
      {
        "feature": "Pricing model",
        "competitor": {
          "status": "yes",
          "note": "Account plans plus applicable report charges."
        },
        "qc": {
          "status": "yes",
          "note": "Paid plans from $19/month; free standalone tools are separate."
        }
      },
      {
        "feature": "Phone and tablet workflow",
        "competitor": {
          "status": "yes",
          "note": "Mobile workflows advertised; task scope depends on the feature."
        },
        "qc": {
          "status": "yes",
          "note": "Paid app: measure, price and quote on phone, tablet or desktop."
        }
      },
      {
        "feature": "Conversational assistance",
        "competitor": {
          "status": "different",
          "note": "AI Receptionist handles customer calls; internal quote-record action parity is unverified."
        },
        "qc": {
          "status": "yes",
          "note": "Find account records and propose supported changes for your confirmation."
        }
      }
    ]
  },
  "pricing": {
    "heading": "Roofr vs QuoteCore+ pricing",
    "intro": "Compare the required feature set, billing commitment and any external measurement costs. These are different products, not a like-for-like savings guarantee.",
    "sourceNote": "Official vendor pricing reviewed 27 September 2026. Competitor figures are US prices; account, region, tax, discounts and billing conditions may change the total. Check the linked source before buying.",
    "competitorTiers": [
      {
        "name": "Starter",
        "price": "US$0/month",
        "detail": "Roofr account tier. Measurement reports and usage conditions are separate."
      },
      {
        "name": "Measure+",
        "price": "From US$109/month",
        "detail": "Monthly price depends on report delivery option; report charges remain separate."
      },
      {
        "name": "Essentials",
        "price": "US$249/month",
        "detail": "Monthly billing; annual-billing offers differ."
      },
      {
        "name": "Scale",
        "price": "US$349/month",
        "detail": "Monthly billing; annual-billing offers differ."
      }
    ],
    "scenarios": [
      {
        "label": "You need an estimating app, not a sales CRM",
        "competitor": "Check which Roofr tier covers the features you actually use.",
        "qc": "Paid app from $19/month; choose a tier for quote volume and feature needs."
      },
      {
        "label": "You will keep ordering roof reports",
        "competitor": "Budget for report charges as well as any software plan.",
        "qc": "External imagery or reports remain separate costs; QuoteCore+ does not supply them."
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
    "heading": "When to keep Roofr",
    "intro": "QuoteCore+ does not replace Roofr's sales pipelines, lead capture, integrated payment processing or crew-management system.",
    "cards": [
      {
        "title": "You need a roofing sales CRM",
        "body": "Keep the sales and customer-acquisition workflow that your team depends on."
      },
      {
        "title": "You buy measurements and manage payments together",
        "body": "Evaluate the report, payment and sales features as a package, not just the subscription price."
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
      "question": "Is QuoteCore+ a full Roofr replacement?",
      "answer": "Only when measurement, pricing and quoting are the parts you need to replace. It is not a like-for-like replacement for Roofr's CRM, lead capture, payment processing or crew tools."
    },
    {
      "question": "Does Roofr also offer mobile access and AI?",
      "answer": "Yes. Roofr advertises mobile workflows and an AI Receptionist. That receptionist is not the same category as an assistant working on quote records. This comparison does not claim that mobile access or AI is unique to QuoteCore+."
    },
    {
      "question": "Can I use a Roofr report in QuoteCore+?",
      "answer": "You can enter dimensions from a report you are entitled to use and apply your own saved rules. This is not a claim of automatic Roofr import or a native integration."
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
      "question": "Is switching from Roofr automatic?",
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
      "label": "PlanSwift alternative",
      "description": "General takeoff vs roofing-native.",
      "href": "/planswift-alternative"
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
    "workflow",
    "comparison",
    "pricing",
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
      "body": "Upload a PDF or usable image and measure the roof on phone, tablet or desktop. Review AI Scan Assist results before pricing.",
      "href": "/features/digital-roof-takeoff",
      "linkLabel": "Explore digital takeoff"
    },
    {
      "title": "Enter your measurements",
      "body": "Already have site dimensions or a measurement report? Enter the dimensions and apply your own saved material, labour and waste rules.",
      "href": "/features/smart-components",
      "linkLabel": "See saved pricing rules"
    },
    {
      "title": "Ask Smart Assistant",
      "body": "Ask for the latest quote or its status by text or voice. Review a proposed rate adjustment before confirming it.",
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
      "label": "Roofr measurement workflow",
      "href": "https://roofr.com/measurements",
      "scope": "Ordered reports and DIY measurement are both offered."
    },
    {
      "id": "pricing",
      "label": "Roofr plans and pricing",
      "href": "https://roofr.com/pricing",
      "scope": "US plan pricing, proposal and invoice allowances, job boards, payments and plan-dependent features."
    },
    {
      "id": "assistant",
      "label": "Roofr AI Receptionist",
      "href": "https://roofr.com/ai-receptionist",
      "scope": "A customer-call assistant. It should not be equated with an internal estimating assistant."
    }
  ],
  "rowSources": {
    "Roofing-specific product": [
      "product"
    ],
    "Digital roof measurement": [
      "product"
    ],
    "Blueprint measurement": [
      "product"
    ],
    "Aerial/satellite imagery": [
      "product"
    ],
    "Ordered measurement reports": [
      "pricing"
    ],
    "AI-assisted roof detection": [
      "product"
    ],
    "Reusable estimating logic": [
      "pricing"
    ],
    "Quotes / proposals": [
      "pricing"
    ],
    "E-signatures": [
      "pricing"
    ],
    "Material ordering": [
      "pricing"
    ],
    "Invoicing": [
      "pricing"
    ],
    "Online payments": [
      "pricing"
    ],
    "CRM / job boards": [
      "pricing"
    ],
    "Lead capture / instant website estimates": [
      "pricing"
    ],
    "Crew management": [
      "pricing"
    ],
    "Pricing model": [
      "pricing"
    ],
    "Phone and tablet workflow": [
      "pricing"
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
  "title": "Roofr Alternative for Roofing Takeoff & Quotes | QuoteCore+",
  "description": "Compare Roofr with QuoteCore+ for roofing takeoff, pricing and quotes. Review mobile workflows, AI scope, CRM differences and current plan costs.",
  "openGraph": {
    "title": "Roofr Alternative for Roofing Takeoff & Quotes | QuoteCore+",
    "description": "Compare Roofr with QuoteCore+ for roofing takeoff, pricing and quotes. Review mobile workflows, AI scope, CRM differences and current plan costs.",
    "url": "/roofr-alternative",
    "siteName": "QuoteCore+",
    "type": "website"
  },
  "alternates": {
    "canonical": "https://quote-core.com/roofr-alternative"
  }
};

const faqSchema = buildFaqSchema(pageData.faqs);
const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: `${siteUrl}/` },
  { name: "Roofr Alternative", url: `${siteUrl}/roofr-alternative` },
]);

export default function RoofrAlternativePage() {
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
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Roofr Alternative" }]} />
        <CompetitorPage data={pageData} threeWays={threeWays} research={research} />
        <SiteFooter />
      </main>
    </>
  );
}
