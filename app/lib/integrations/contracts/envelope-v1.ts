/**
 * Integration Envelope V1 - Versioned contract for exporting QuoteCore+ data
 * to external platforms.
 *
 * This is the canonical shape that the export builder produces and every
 * connector consumes. It is NOT a mirror of database tables - it is a stable
 * domain contract that shields connectors from internal schema changes.
 *
 * Versioning rule: if any breaking field changes, bump to V2 and keep V1
 * alive until all connectors migrate.
 */

export type ExportEventType =
  | 'quote_confirmed'
  | 'quote_sent'
  | 'quote_accepted'
  | 'manual_export';

export type ResourceType = 'quote';

export interface IntegrationEnvelopeV1 {
  schemaVersion: '1.0';
  eventId: string;
  eventType: ExportEventType;
  occurredAt: string;
  exportedAt: string;
  companyId: string;
  resource: {
    type: ResourceType;
    id: string;
    revision: number;
  };
  data: QuoteExportV1;
}

export interface Address {
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  fullAddress: string | null;
}

export interface QuoteExportV1 {
  source: {
    application: 'quote-core-plus';
    quoteId: string;
    quoteNumber: number | null;
    quoteUrl: string | null;
  };

  customer: {
    name: string;
    email: string | null;
    phone: string | null;
    billingAddress: Address | null;
  };

  site: {
    name: string | null;
    address: Address | null;
    latitude: number | null;
    longitude: number | null;
    accessNotes: string | null;
  };

  job: {
    name: string | null;
    trade: string;
    status: string;
    measurementSystem: string;
  };

  quote: {
    currency: string;
    createdAt: string;
    updatedAt: string;
    acceptedAt: string | null;
    validUntil: string | null;
    customerFacingNotes: string | null;
    internalNotes: string | null;
    assumptions: string | null;
  };

  company: {
    name: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    logoUrl: string | null;
    footerText: string | null;
  };

  customerLines: CustomerLineExport[];
  components: ComponentExport[];
  roofAreas: RoofAreaExport[];
  labourLines: LabourLineExport[] | null;

  totals: {
    currency: string;
    taxMode: 'inclusive' | 'exclusive' | 'mixed' | 'unknown';

    customerTotals: {
      subtotalExcludingTax: string;
      discountTotal: string;
      taxTotal: string;
      totalIncludingTax: string;
      roundingAdjustment: string;
    };

    costTotals: {
      materialCost: string;
      labourCost: string;
      totalCost: string;
    };

    marginTotals: {
      materialMargin: string;
      labourMargin: string;
      grossProfit: string;
    };

    taxBreakdown: Array<{
      name: string;
      ratePercent: string;
      amount: string;
      externalTaxCode: string | null;
    }>;
  };

  files: FileManifestItem[];
  documents: DocumentManifestItem[];
  artifacts: ExportArtifactManifestItem[];

  acceptance: {
    status: string;
    acceptedAt: string | null;
    acceptedBy: string | null;
  };
}

export interface CustomerLineExport {
  id: string;
  type: 'component' | 'custom' | 'roof_area_header';
  description: string;
  quantity: number | null;
  quantityText: string | null;
  unitPrice: string | null;
  lineTotal: string;
  visibleToCustomer: boolean;
  includedInTotal: boolean;
  sortOrder: number;
}

export interface ComponentExport {
  id: string;
  name: string;
  mainOrExtra: 'main' | 'extra' | null;
  measurementType: string | null;
  inputMode: string | null;
  quantity: number | null;
  pricedQuantity: number | null;
  pricingUnit: string | null;
  materialRate: string | null;
  labourRate: string | null;
  materialCost: string | null;
  labourCost: string | null;
  wastePercent: string | null;
  pitchDegrees: number | null;
  pricingStrategy: string | null;
  packSize: number | null;
  customerVisible: boolean;
  sortOrder: number;
  libraryRef: string | null;
  sku: string | null;
  overrideFlags: string | null;
  entries: ComponentEntryExport[];
}

export interface ComponentEntryExport {
  id: string;
  rawValue: string | null;
  pitchDegrees: number | null;
  wasteAdjustedValue: string | null;
  originalInputs: Record<string, unknown> | null;
  combinedFrom: string[] | null;
}

export interface RoofAreaExport {
  id: string;
  label: string;
  inputMode: string | null;
  planWidth: number | null;
  planLength: number | null;
  planArea: number | null;
  pitchDegrees: number | null;
  computedArea: number | null;
  finalArea: number | null;
}

export interface LabourLineExport {
  id: string;
  description: string;
  amount: string;
  componentRef: string | null;
  visibleToCustomer: boolean;
  includedInTotal: boolean;
  showPricing: boolean;
}

export interface FileManifestItem {
  id: string;
  fileType:
    | 'plan'
    | 'supporting'
    | 'canvas'
    | 'takeoff_canvas'
    | 'takeoff_lines'
    | 'customer_quote_pdf'
    | 'takeoff_report_pdf'
    | 'takeoff_data_json'
    | 'labour_sheet_pdf';
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  checksum: string | null;
  sourcePath: string;
}

export interface DocumentManifestItem {
  id: string;
  documentType: 'quote_pdf' | 'labour_sheet' | 'material_order' | 'summary';
  fileName: string;
  mimeType: string | null;
  sourcePath: string;
}

export type ExportArtifactRole =
  | 'plan'
  | 'supporting_file'
  | 'takeoff_canvas'
  | 'takeoff_lines'
  | 'customer_quote_pdf'
  | 'takeoff_report_pdf'
  | 'takeoff_data_json'
  | 'labour_sheet_pdf'
  | 'material_order_pdf'
  | 'invoice_pdf'
  | 'quote_summary_pdf';

export interface ExportArtifactManifestItem {
  id: string;
  role: ExportArtifactRole;
  origin: 'uploaded' | 'generated' | 'legacy';
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  checksum: string | null;
  sourcePath: string;
  sourceRevision: string;
}
