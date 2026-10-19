export type SharedMeasurementKind = 'area' | 'lineal';
export type SharedMeasurementMode = 'entry' | 'combined' | 'all';

export interface SharedMeasurementOption {
  id: string;
  sourceComponentId: string;
  sourceComponentName: string;
  kind: SharedMeasurementKind;
  mode: SharedMeasurementMode;
  measurementIds: string[];
  value: number;
}

export interface ShareableMeasurement {
  id: string;
  value: number;
  label: string;
  kind: SharedMeasurementKind;
}

export function sharedKindForComponent(type: string): SharedMeasurementKind | null {
  switch (type.toLowerCase()) {
    case 'area':
    case 'irregular_area':
    case 'volume':
      return 'area';
    case 'lineal':
    case 'linear':
    case 'multi_lineal':
    case 'curved_line':
    case 'quantity_by_spacing':
    case 'length_x_height':
    case 'multi_lineal_lxh':
      return 'lineal';
    default:
      return null;
  }
}

export function sharedKindForMeasurementType(type: string): SharedMeasurementKind | null {
  if (type === 'area') return 'area';
  if (type === 'line' || type === 'multi_lineal') return 'lineal';
  return null;
}

export function resolveSharedValue(
  option: SharedMeasurementOption,
  measurements: Array<{ id: string; value: number; type: string }>,
): number {
  const usable = measurements.filter(m => sharedKindForMeasurementType(m.type) === option.kind);
  if (option.mode === 'all') return usable.reduce((sum, m) => sum + Number(m.value || 0), 0);
  const ids = new Set(option.measurementIds);
  return usable.filter(m => ids.has(m.id)).reduce((sum, m) => sum + Number(m.value || 0), 0) || option.value;
}
