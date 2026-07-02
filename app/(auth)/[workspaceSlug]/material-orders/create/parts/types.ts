import type { FlashingLibraryRow } from '@/app/lib/types';

/** Sentinel for the "All components" option in the library selector. */
export const ALL_LIBRARIES = '__all__';

/** Minimal component-library option for the order item picker. */
export interface ComponentOption {
  id: string;
  name: string;
  /** Named library (component_collections.id) this component belongs to. Null = unfiled. */
  collection_id?: string | null;
}

/** Named component library for the add-component library selector. */
export interface ComponentCollection {
  id: string;
  name: string;
}

export interface Variable {
  name: string;
  value: number;
  unit: string;
}

export interface LengthEntry {
  /** For linear: the length value. For area/volume: the computed total. */
  length: number;
  multiplier: number;
  variables?: Variable[];
  /** Area/Volume optional calculator breakdown (display only). When present the
   *  entry was built from L x W (area) or L x W x D (volume); `length` holds
   *  the resulting total. Absent when the user typed the total directly. */
  calcLength?: number;
  calcWidth?: number;
  calcDepth?: number;
}

/**
 * entryMode: 'single' (qty + optional description), 'linear' (length x qty
 * entries, formerly 'multiple'), 'area' (m2/ft2 entries), 'volume' (m3/ft3).
 * Legacy rows stored 'multiple' - normalised to 'linear' on load.
 */
export type OrderEntryMode = 'single' | 'linear' | 'area' | 'volume';

export interface OrderLineItem {
  id: string;
  componentName: string;
  flashingId?: string;
  flashingImageUrl?: string;
  entryMode: OrderEntryMode;
  // Single mode
  quantity: number;
  unit: string;
  // Linear / area / volume mode
  lengths?: LengthEntry[];
  lengthUnit?: string;
  // Fixed Quantity display: when the component uses per_pack_* pricing,
  // pricedQuantity is the rounded-up purchasable unit count and
  // measurementDisplay is the human-readable total length/area/volume
  // (e.g. "23.4m" or "12.5m²"). Rendered as: qty (measurement).
  pricedQuantity?: number;
  measurementDisplay?: string;
  // Common
  notes?: string;
  showComponentName: boolean;
  showFlashingImage: boolean;
  showMeasurements: boolean;
}

export interface AddItemModalProps {
  flashings: FlashingLibraryRow[];
  /** Company component library for the "add from library" dropdown. */
  components?: ComponentOption[];
  /** Named component libraries for the add-component library selector. */
  collections?: ComponentCollection[];
  /** Workspace slug for the catalog search modal endpoint. */
  workspaceSlug?: string;
  /** Company/quote measurement system - drives metric vs imperial unit options. */
  measurementSystem?: string;
  existingLine?: OrderLineItem;
  onSave: (data: {
    componentName: string;
    flashingId?: string;
    entryMode: OrderEntryMode;
    quantity?: number;
    unit?: string;
    lengths?: LengthEntry[];
    lengthUnit?: string;
    notes?: string;
    pricedQuantity?: number;
    measurementDisplay?: string;
  }) => void;
  onCancel: () => void;
  /** Inherited from the parent so this modal can pop the same app-style alerts instead of native ones. */
  showAlert: (title: string, description?: string, variant?: 'info' | 'success' | 'error') => void;
}
