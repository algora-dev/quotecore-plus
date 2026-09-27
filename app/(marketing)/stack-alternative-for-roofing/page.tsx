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
  "slug": "stack-alternative-for-roofing",
  "competitorName": "STACK",
  "checkedDate": "27 September 2026",
  "positioning": "Roofing measurement, pricing and quoting",
  "hero": {
    "title": "A STACK alternative focused on roofing measurement, pricing and quotes",
    "sub": "Keep the roofing job in one place from plan or site dimensions to customer quote. Work from your phone, tablet or desktop, and ask Smart Assistant to retrieve account information or propose supported changes.",
    "qualifier": "STACK already connects takeoff and estimating and now advertises conversational actions through STACK IQ. QuoteCore+ is an alternative in scope and workflow, not the only app with an assistant.",
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
    "heading": "Compare the job you need to finish, not an AI checkbox",
    "body": "STACK provides cloud takeoff, estimating and proposals, with separate field capabilities and integrations. Its STACK IQ offering also describes conversational access to project data and actions. QuoteCore+ focuses on roofing-first measurement, saved pricing rules and customer quoting, with supported assistant tasks inside the app. Evaluate the tools your work actually requires: a broad preconstruction setup and document collaboration, or a focused roofing workflow that also works from your phone."
  },
  "bestFor": {
    "competitorBestFor": [
      {
        "title": "Your estimates span large multi-trade plan sets",
        "body": "Retain the collaboration and estimating structure that your team has already established."
      },
      {
        "title": "ERP or field-operation connections are essential",
        "body": "Check integration and operational requirements before narrowing the software scope."
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
      "answer": "Replace the work you no longer need to split across tools, not every STACK capability."
    },
    "body": "QuoteCore+ does not replace STACK's full preconstruction collaboration, ERP integrations, cost libraries or Build & Operate field platform.",
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
        "detail": "QuoteCore+ does not replace STACK's full preconstruction collaboration, ERP integrations, cost libraries or Build & Operate field platform.",
        "positive": false
      }
    ]
  },
  "switching": {
    "intro": "Work through one representative job before switching. Keep any specialist service or integration you still require.",
    "rows": [
      {
        "current": "Your business needs broad preconstruction collaboration",
        "qc": "Keep STACK when that scope remains necessary.",
        "benefit": "Avoid trading away required team or integration capabilities."
      },
      {
        "current": "Your recurring task is to price and quote a roof",
        "qc": "Set up roofing Smart Components and use them on each measured job.",
        "benefit": "Organize the workflow around your own repeatable work."
      },
      {
        "current": "You want conversational help",
        "qc": "Compare real supported tasks in each assistant, including required accounts and permissions.",
        "benefit": "Choose based on the task, not on the presence of an AI label."
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
        "body": "Measure the roofing plan on phone, tablet or desktop. Use AI Scan Assist in stages with outline review and component checks. Alternatively, enter dimensions you have already checked."
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
    "heading": "STACK vs QuoteCore+: workflow and capabilities",
    "intro": "Capabilities below distinguish documented features from unverified equivalents. A missing confirmation is not evidence that a competitor lacks a feature.",
    "rows": [
      {
        "feature": "Cloud-based takeoff",
        "competitor": {
          "status": "yes",
          "note": "Cloud-based plan takeoff."
        },
        "qc": {
          "status": "yes",
          "note": "Measure supplied plans or suitable images; verify scale and geometry."
        }
      },
      {
        "feature": "Roofing takeoff",
        "competitor": {
          "status": "yes",
          "note": "Takeoff can be used for roofing."
        },
        "qc": {
          "status": "yes",
          "note": "Roofing-first measurements and component workflow."
        }
      },
      {
        "feature": "Multi-trade takeoff",
        "competitor": {
          "status": "yes",
          "note": "General construction takeoff and estimating."
        },
        "qc": {
          "status": "yes",
          "note": "Roofing-first, plus other measured work."
        }
      },
      {
        "feature": "AI assistance",
        "competitor": {
          "status": "yes",
          "note": "STACK IQ plus AI takeoff tools and optional aerial tools."
        },
        "qc": {
          "status": "yes",
          "note": "Reviewed AI Scan Assist and a separate account assistant."
        }
      },
      {
        "feature": "Items / assemblies vs Smart Components",
        "competitor": {
          "status": "yes",
          "note": "Reusable items and assemblies."
        },
        "qc": {
          "status": "yes",
          "note": "Smart Components reuse your materials, labour, waste and pricing rules."
        }
      },
      {
        "feature": "Material + labour estimating",
        "competitor": {
          "status": "yes",
          "note": "Integrated worksheet-style estimating."
        },
        "qc": {
          "status": "yes",
          "note": "Materials and labour priced from saved components."
        }
      },
      {
        "feature": "Waste / markup / pricing logic",
        "competitor": {
          "status": "yes",
          "note": "Estimating rates and assembly logic."
        },
        "qc": {
          "status": "yes",
          "note": "Saved waste allowances, pricing and margin rules."
        }
      },
      {
        "feature": "Proposals / quotes",
        "competitor": {
          "status": "yes",
          "note": "Native proposals listed on Pro."
        },
        "qc": {
          "status": "yes",
          "note": "Create customer quotes from the saved job; send and track where supported."
        }
      },
      {
        "feature": "Material ordering",
        "competitor": {
          "status": "different",
          "note": "ERP-connected workflows depend on integrations and tier."
        },
        "qc": {
          "status": "yes",
          "note": "Create material orders from saved quote data using the order builder."
        }
      },
      {
        "feature": "Invoicing",
        "competitor": {
          "status": "different",
          "note": "ERP/accounting-connected workflow; not the core quote builder."
        },
        "qc": {
          "status": "yes",
          "note": "Create and track invoices from saved job data using the invoice builder."
        }
      },
      {
        "feature": "Aerial imagery",
        "competitor": {
          "status": "yes",
          "note": "Aerial Image Takeoff is a paid add-on."
        },
        "qc": {
          "status": "different",
          "note": "Use your own suitable imagery; no imagery supply."
        }
      },
      {
        "feature": "Large plan/document collaboration",
        "competitor": {
          "status": "yes",
          "note": "Plan organization, overlays and viewer seats."
        },
        "qc": {
          "status": "different",
          "note": "Saved job documents, not the same preconstruction toolset."
        }
      },
      {
        "feature": "API / integrations",
        "competitor": {
          "status": "yes",
          "note": "ERP connectors and integration options."
        },
        "qc": {
          "status": "different",
          "note": "Do not assume equivalent ERP or API integrations."
        }
      },
      {
        "feature": "Field/project operations",
        "competitor": {
          "status": "yes",
          "note": "Separate field product and mobile workflows."
        },
        "qc": {
          "status": "different",
          "note": "Supporting job workflow, not a Build & Operate replacement."
        }
      },
      {
        "feature": "Entry price",
        "competitor": {
          "status": "yes",
          "note": "Limited free account; paid Premium and Pro differ in scope."
        },
        "qc": {
          "status": "yes",
          "note": "Paid plans from $19/month; free standalone tools are separate."
        }
      },
      {
        "feature": "Conversational actions and control",
        "competitor": {
          "status": "yes",
          "note": "STACK IQ/MCP supports authorized actions with selectable capabilities."
        },
        "qc": {
          "status": "yes",
          "note": "Account retrieval and supported propose-then-confirm changes."
        }
      },
      {
        "feature": "Phone and tablet workflow",
        "competitor": {
          "status": "different",
          "note": "Mobile field and conversational routes; verify the exact takeoff task."
        },
        "qc": {
          "status": "yes",
          "note": "Paid app: measure, price and quote on phone, tablet or desktop."
        }
      }
    ]
  },
  "pricing": {
    "heading": "STACK vs QuoteCore+ pricing",
    "intro": "Compare the required feature set, billing commitment and any external measurement costs. These are different products, not a like-for-like savings guarantee.",
    "sourceNote": "Official vendor pricing reviewed 27 September 2026. Competitor figures are US prices; account, region, tax, discounts and billing conditions may change the total. Check the linked source before buying.",
    "competitorTiers": [
      {
        "name": "Limited free account",
        "price": "US$0",
        "detail": "Restricted usage, not the paid estimating feature set."
      },
      {
        "name": "Premium",
        "price": "US$249/user/month",
        "detail": "Displayed with annual billing; takeoff-focused tier."
      },
      {
        "name": "Pro",
        "price": "US$299/user/month",
        "detail": "Displayed with annual billing; integrated estimating and native proposals."
      },
      {
        "name": "Field products and add-ons",
        "price": "Priced separately",
        "detail": "Do not assume Build & Operate, ERP or aerial add-ons are included."
      }
    ],
    "scenarios": [
      {
        "label": "You need integrated estimates and proposals",
        "competitor": "Check Pro and any required add-ons, not only the lower Premium headline.",
        "qc": "Choose a paid tier for your quote volume and supported features, from $19/month."
      },
      {
        "label": "You need conversational actions",
        "competitor": "Check STACK IQ, connector access and the compatible AI client required.",
        "qc": "Smart Assistant works with your QuoteCore+ account; confirm feature access on the pricing page."
      }
    ],
    "scenarioNote": "Illustrative workflow comparisons, not equivalent bundles. External imagery, measurement reports, setup time and separately required services are not included in the QuoteCore+ subscription."
  },
  "video": {
    "heading": "See how measurements become a quote",
    "intro": "This existing walkthrough shows the measurement and pricing workflow. It is not a new mobile or Smart Assistant demonstration.",
    "videoKey": "roofingSmartComponents",
    "ctaHref": "/features/smart-components",
    "ctaLabel": "Explore Smart Components"
  },
  "honestWhen": {
    "heading": "When to keep STACK",
    "intro": "QuoteCore+ does not replace STACK's full preconstruction collaboration, ERP integrations, cost libraries or Build & Operate field platform.",
    "cards": [
      {
        "title": "Your estimates span large multi-trade plan sets",
        "body": "Retain the collaboration and estimating structure that your team has already established."
      },
      {
        "title": "ERP or field-operation connections are essential",
        "body": "Check integration and operational requirements before narrowing the software scope."
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
      "question": "Does STACK already have an AI assistant?",
      "answer": "Yes. STACK IQ and its MCP connector describe conversational access to takeoffs, estimates and project information, including supported create/update operations. It would be inaccurate to call STACK's AI only a plan-question chatbot."
    },
    {
      "question": "How is QuoteCore+ Smart Assistant different?",
      "answer": "It works with records in your QuoteCore+ account, such as finding a quote or proposing a rate change for confirmation. Compare supported tasks and setup requirements, not an unsupported claim that one assistant does everything."
    },
    {
      "question": "Is STACK a disconnected takeoff and quoting workflow?",
      "answer": "No. Its estimating product already connects takeoff, items, assemblies and proposals. The choice is the scope and working method that suit your business."
    },
    {
      "question": "Does the US$249 STACK headline include all estimating features?",
      "answer": "The reviewed pricing page shows Premium at US$249 per user per month, billed annually, and Pro at US$299 on that basis. Pro lists integrated estimating and native proposals; add-ons and other products have separate conditions."
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
      "question": "Is switching from STACK automatic?",
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
      "label": "Roofr alternative",
      "description": "Broad roofing CRM vs focused estimating.",
      "href": "/roofr-alternative"
    },
    {
      "label": "PlanSwift alternative",
      "description": "General takeoff vs roofing-native.",
      "href": "/planswift-alternative"
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
      "href": "/features",
      "label": "How QuoteCore+ works",
      "description": "Mobile workflows, Smart Assistant and the connected app."
    }
  ],
  "sectionOrder": [
    "quickAnswer",
    "replace",
    "bestFor",
    "comparison",
    "pricing",
    "workflow",
    "switching",
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
      "body": "Measure the roofing plan on phone, tablet or desktop. Use AI Scan Assist in stages with outline review and component checks.",
      "href": "/features/digital-roof-takeoff",
      "linkLabel": "Explore digital takeoff"
    },
    {
      "title": "Enter your measurements",
      "body": "Enter existing measurements and apply your saved coverage, labour, waste and rate rules. You do not have to redraw work you already measured.",
      "href": "/features/smart-components",
      "linkLabel": "See saved pricing rules"
    },
    {
      "title": "Ask Smart Assistant",
      "body": "Find a job or quote by text or voice, then review a proposed rate change. QuoteCore+ does not claim that conversational estimating is unique.",
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
      "label": "STACK integrated estimating",
      "href": "https://www.stackct.com/estimating/",
      "scope": "Takeoff-to-estimate workflow, items, assemblies and proposals."
    },
    {
      "id": "pricing",
      "label": "STACK Takeoff & Estimate pricing",
      "href": "https://www.stackct.com/takeoff-and-estimate-pricing/",
      "scope": "Premium and Pro per-user prices shown with annual billing; proposal and integration scope by tier. Aerial Image Takeoff is an add-on; confirm subscription and usage conditions."
    },
    {
      "id": "assistant",
      "label": "STACK IQ",
      "href": "https://www.stackct.com/stack-iq/",
      "scope": "Conversational interaction with takeoffs, estimates and project information."
    },
    {
      "id": "control",
      "label": "STACK MCP connector and controls",
      "href": "https://www.stackct.com/mcp/",
      "scope": "An external compatible AI client, authorized account access, selectable capabilities and revocable access."
    },
    {
      "id": "field",
      "label": "STACK field collaboration",
      "href": "https://www.stackct.com/field-collaboration/",
      "scope": "Field mobile document workflows are distinct from the estimating product."
    }
  ],
  "rowSources": {
    "Cloud-based takeoff": [
      "product"
    ],
    "Roofing takeoff": [
      "product"
    ],
    "Multi-trade takeoff": [
      "product"
    ],
    "AI assistance": [
      "assistant",
      "pricing"
    ],
    "Items / assemblies vs Smart Components": [
      "product"
    ],
    "Material + labour estimating": [
      "product"
    ],
    "Waste / markup / pricing logic": [
      "product"
    ],
    "Proposals / quotes": [
      "pricing"
    ],
    "Material ordering": [
      "pricing"
    ],
    "Invoicing": [
      "pricing"
    ],
    "Aerial imagery": [
      "pricing"
    ],
    "Large plan/document collaboration": [
      "pricing"
    ],
    "API / integrations": [
      "pricing"
    ],
    "Field/project operations": [
      "field"
    ],
    "Entry price": [
      "pricing"
    ],
    "Conversational actions and control": [
      "assistant",
      "control"
    ],
    "Phone and tablet workflow": [
      "field",
      "assistant"
    ]
  },
  "pricingSourceIds": [
    "pricing"
  ],
  "note": "This comparison is published by QuoteCore+ and is based on the linked vendor documentation, not a hands-on performance test. Feature availability, plans and previews can change. Unverified equivalents are marked explicitly, not scored as missing features."
};

export const metadata: Metadata = {
  "title": "STACK Alternative for Roofing Takeoff & Quotes | QuoteCore+",
  "description": "Compare STACK and QuoteCore+ for roofing takeoff, estimating, mobile workflows and AI assistants. Review proposal features, pricing and workflow scope.",
  "openGraph": {
    "title": "STACK Alternative for Roofing Takeoff & Quotes | QuoteCore+",
    "description": "Compare STACK and QuoteCore+ for roofing takeoff, estimating, mobile workflows and AI assistants. Review proposal features, pricing and workflow scope.",
    "url": "/stack-alternative-for-roofing",
    "siteName": "QuoteCore+",
    "type": "website"
  },
  "alternates": {
    "canonical": "https://quote-core.com/stack-alternative-for-roofing"
  }
};

const faqSchema = buildFaqSchema(pageData.faqs);
const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: `${siteUrl}/` },
  { name: "STACK Alternative for Roofing", url: `${siteUrl}/stack-alternative-for-roofing` },
]);

export default function StackAlternativeForRoofingPage() {
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
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "STACK Alternative for Roofing" }]} />
        <CompetitorPage data={pageData} threeWays={threeWays} research={research} />
        <SiteFooter />
      </main>
    </>
  );
}
