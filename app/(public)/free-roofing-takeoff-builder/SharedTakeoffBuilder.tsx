'use client';

/**
 * QuoteCore+ wrapper around the shared TakeoffFlow.
 *
 * This component:
 * 1. Renders the QuoteCore+ BlogHeader (same as all free tools)
 * 2. Passes the supplier/enquiry/result adapters
 * 3. Enables QuoteCore+ capabilities (known-price, fixed-qty, supplier selection)
 * 4. Hides the shared package's own header (QuoteCore+ uses BlogHeader)
 */

import type {
  ThemeConfig,
  TakeoffCapabilities,
  RoofComponentDef,
} from '@quote-core/roof-takeoff';
import { TakeoffFlow } from '@quote-core/roof-takeoff';
import { quoteCoreSupplierAdapter, quoteCoreEnquiryAdapter, quoteCoreResultAdapter } from './shared-adapters';
import BlogHeader from '@/components/BlogHeader';

// QuoteCore+ brand theme - supplier overrides come at runtime via the adapter
const QUOTECORE_THEME: ThemeConfig = {
  primary: '#FF6B35',
  primaryHover: '#BD4A1A',
  accent: '#FF6B35',
  logoUrl: null, // QuoteCore+ renders its own header/footer chrome
  headingFont: 'Inter, sans-serif',
  bodyFont: 'Inter, sans-serif',
  currency: 'USD',
  currencySymbol: '$',
  defaultUnits: 'metric',
  supplierName: null, // resolved at runtime
  supplierEmail: null, // resolved server-side from slug
  supplierSlug: null, // resolved at runtime
  features: {
    sendToSupplier: true,
    convertToQuote: false, // QuoteCore+ handles this separately
    saveToApp: false,
  },
  pricingModes: ['material', 'material_install'],
  roofTypeOptions: ['new_roof', 're_roof'],
  copy: {
    headerTitle: 'QuoteCore+ Roof Takeoff Builder',
    heroTitle: 'Free Roof Takeoff Builder',
    heroSubtitle: 'Calculate roof materials and costs with real supplier pricing.',
    footerText: 'QuoteCore+',
    poweredBy: 'Powered by QuoteCore+',
  },
};

const QUOTECORE_CAPABILITIES: TakeoffCapabilities = {
  knownPriceEntries: true,
  fixedQuantityComponents: true,
  resultUrls: true,
  draftPersistence: false,
  leaveWarning: true,
  supplierSelection: true,
};

// Default fallback components (used when no supplier is selected)
// These match the DEFAULT_COMPONENTS in the existing calc.ts
const DEFAULT_COMPONENTS: RoofComponentDef[] = [
  { id: 'default-roofing-iron', component_kind: 'roof_area', name: 'Corrugated Iron Roofing', description: '0.42mm corrugated iron profile', unit: 'm\u00B2', price_per_unit: 18.50, pricing_strategy: 'per_unit', pack_size: null, pack_price: null, labour_rate: 12.00, labour_unit: 'per_unit', suggested_waste_percent: 5, pitch_type: 'rafter', is_active: true, sort_order: 1, roof_types: null },
  { id: 'default-metal-tile', component_kind: 'roof_area', name: 'Pressed Metal Tile', description: 'Stone-coated metal tile panel', unit: 'm\u00B2', price_per_unit: 32.00, pricing_strategy: 'per_unit', pack_size: null, pack_price: null, labour_rate: 18.00, labour_unit: 'per_unit', suggested_waste_percent: 7, pitch_type: 'rafter', is_active: true, sort_order: 2, roof_types: null },
  { id: 'default-ridge-cap', component_kind: 'ridge', name: 'Ridge Cap Flashing', description: 'Pre-formed ridge cap', unit: 'm', price_per_unit: 12.00, pricing_strategy: 'per_unit', pack_size: null, pack_price: null, labour_rate: 8.00, labour_unit: 'per_unit', suggested_waste_percent: 3, pitch_type: 'none', is_active: true, sort_order: 1, roof_types: null },
  { id: 'default-ridge-roll', component_kind: 'ridge', name: 'Ridge Roll', description: 'Flexible ridge roll for metal roofs', unit: 'm', price_per_unit: 6.50, pricing_strategy: 'per_unit', pack_size: null, pack_price: null, labour_rate: 5.00, labour_unit: 'per_unit', suggested_waste_percent: 3, pitch_type: 'none', is_active: true, sort_order: 2, roof_types: null },
  { id: 'default-hip-cap', component_kind: 'hip', name: 'Hip Cap Flashing', description: 'Pre-formed hip capping', unit: 'm', price_per_unit: 14.00, pricing_strategy: 'per_unit', pack_size: null, pack_price: null, labour_rate: 10.00, labour_unit: 'per_unit', suggested_waste_percent: 5, pitch_type: 'hip_valley', is_active: true, sort_order: 1, roof_types: null },
  { id: 'default-valley-flash', component_kind: 'valley', name: 'Valley Flashing', description: 'Pre-formed valley tray', unit: 'm', price_per_unit: 16.00, pricing_strategy: 'per_unit', pack_size: null, pack_price: null, labour_rate: 12.00, labour_unit: 'per_unit', suggested_waste_percent: 5, pitch_type: 'hip_valley', is_active: true, sort_order: 1, roof_types: null },
  { id: 'default-barge-flash', component_kind: 'barge', name: 'Barge Flashing', description: 'Barge board flashing', unit: 'm', price_per_unit: 10.00, pricing_strategy: 'per_unit', pack_size: null, pack_price: null, labour_rate: 7.00, labour_unit: 'per_unit', suggested_waste_percent: 3, pitch_type: 'rafter', is_active: true, sort_order: 1, roof_types: null },
  { id: 'default-spouting', component_kind: 'spouting', name: 'Spouting/Gutter', description: 'Continuous gutter system', unit: 'm', price_per_unit: 22.00, pricing_strategy: 'per_unit', pack_size: null, pack_price: null, labour_rate: 10.00, labour_unit: 'per_unit', suggested_waste_percent: 3, pitch_type: 'none', is_active: true, sort_order: 1, roof_types: null },
  { id: 'default-downpipe', component_kind: 'spouting', name: 'Downpipe', description: '100mm round downpipe', unit: 'm', price_per_unit: 15.00, pricing_strategy: 'per_unit', pack_size: null, pack_price: null, labour_rate: 8.00, labour_unit: 'per_unit', suggested_waste_percent: 3, pitch_type: 'none', is_active: true, sort_order: 2, roof_types: null },
  { id: 'default-underlay', component_kind: 'underlay', name: 'Roofing Underlay', description: 'Breathable roofing underlay', unit: 'm\u00B2', price_per_unit: 4.50, pricing_strategy: 'per_unit', pack_size: null, pack_price: null, labour_rate: 3.00, labour_unit: 'per_unit', suggested_waste_percent: 10, pitch_type: 'rafter', is_active: true, sort_order: 1, roof_types: null },
  { id: 'default-fixings', component_kind: 'fixings', name: 'Roofing Screws', description: '10g x 50mm roofing screws with EPDM washers', unit: 'm\u00B2', price_per_unit: 3.50, pricing_strategy: 'per_unit', pack_size: null, pack_price: null, labour_rate: 2.00, labour_unit: 'per_unit', suggested_waste_percent: 5, pitch_type: 'rafter', is_active: true, sort_order: 1, roof_types: null },
];

interface SharedTakeoffBuilderProps {
  initialSupplierSlug?: string;
}

export function SharedTakeoffBuilder({ initialSupplierSlug }: SharedTakeoffBuilderProps) {
  return (
    <>
      <BlogHeader />
      <TakeoffFlow
        theme={QUOTECORE_THEME}
        components={DEFAULT_COMPONENTS}
        capabilities={QUOTECORE_CAPABILITIES}
        supplierAdapter={quoteCoreSupplierAdapter}
        enquiryAdapter={quoteCoreEnquiryAdapter}
        resultAdapter={quoteCoreResultAdapter}
        initialSupplierSlug={initialSupplierSlug}
        hideHeader
      />
    </>
  );
}
