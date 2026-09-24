import type { ReactNode } from 'react';
import type { JobSection } from './JobSpaceContext';
export interface CustomerLine {
  id: string;
  custom_text: string | null;
  custom_amount: number | null;
  show_price: boolean;
  is_visible: boolean;
  include_in_total: boolean | null;
}

export interface SummaryTabsProps {
  workspaceSlug: string;
  quoteId: string;
  customerLines: CustomerLine[];
  hasCustomerQuote: boolean;
  quote: {
    quote_number: number | null;
    customer_name: string;
    job_name: string | null;
    site_address: string | null;
    created_at: string;
    tax_rate: number;
    cq_company_name: string | null;
    cq_company_address: string | null;
    cq_company_phone: string | null;
    cq_company_email: string | null;
    cq_company_logo_url: string | null;
    cq_footer_text: string | null;
  };
  effectiveCurrency: string;
  hasLaborSheet: boolean;
  laborLines: CustomerLine[];
  children: ReactNode;
  summaryActions: ReactNode;
  /** Optional slot rendered between the tab nav and the summary tab content. */
  summaryHeaderSlot?: ReactNode;
  /** Phase 2AB: supplied by the job page; absent keeps the original Summary default. */
  overview?: ReactNode;
  filesPanel?: ReactNode;
  activityPanel?: ReactNode;
  managementActions?: ReactNode;
  initialSection?: JobSection;

}

