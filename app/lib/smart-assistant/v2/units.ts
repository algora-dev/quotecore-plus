import { linearInputToMetric, areaInputToMetric, volumeInputToMetric } from '@/app/lib/measurements/conversions';
import { ProposalError, finite, type ComponentChanges } from './action-domain';
export const UNITS = ['m', 'ft', 'm2', 'ft2', 'rs', 'm3', 'ft3', 'each'] as const;
export type Unit = typeof UNITS[number];
export function baseUnit(type: unknown): Unit {
    if (['area', 'irregular_area', 'length_x_height', 'multi_lineal_lxh', 'length_x_height_freestyle', 'multi_lineal_lxh_freestyle'].includes(String(type)))
        return 'm2';
    if (['lineal', 'linear', 'curved_line', 'multi_lineal'].includes(String(type)))
        return 'm';
    if (['volume', 'volume_3d'].includes(String(type)))
        return 'm3';
    if (['quantity', 'count', 'fixed'].includes(String(type)))
        return 'each';
    throw new ProposalError('This measurement needs its specialised editor to confirm the unit.');
}
export function canonicalQuantity(value: number, unit: unknown, type: unknown): number {
    finite(value, 'quantity');
    const base = baseUnit(type);
    if (base === 'm' && (unit === 'm' || unit === 'ft'))
        return linearInputToMetric(value, unit === 'm' ? 'metric' : 'imperial_ft');
    if (base === 'm2' && ['m2', 'ft2', 'rs'].includes(String(unit)))
        return areaInputToMetric(value, unit === 'm2' ? 'metric' : unit === 'rs' ? 'imperial_rs' : 'imperial_ft');
    if (base === 'm3' && (unit === 'm3' || unit === 'ft3'))
        return volumeInputToMetric(value, unit === 'm3' ? 'metric' : 'imperial_ft');
    if (base === 'each' && unit === 'each')
        return value;
    throw new ProposalError(`Specify a compatible unit. This component is stored in ${base}.`);
}
export function canonicalChanges(changes: ComponentChanges, type: unknown, quantityUnit: unknown, rateUnit: unknown): ComponentChanges {
    const next = { ...changes };
    if (next.raw_quantity !== undefined)
        next.raw_quantity = canonicalQuantity(next.raw_quantity, quantityUnit, type);
    if (next.material_rate !== undefined || next.labour_rate !== undefined) {
        const factor = canonicalQuantity(1, rateUnit, type);
        if (next.material_rate !== undefined)
            next.material_rate /= factor;
        if (next.labour_rate !== undefined)
            next.labour_rate /= factor;
    }
    return next;
}
