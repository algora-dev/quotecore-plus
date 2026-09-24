import { ProposalError } from './action-domain';
/** Storage adapter, NOT a pricing formula. The supplied schema/patch_002 use
 * numeric(*,4) for component rates, costs and source measurements. PostgreSQL
 * rounds decimal ties away from zero. Round the JSON decimal representation,
 * not the approximate binary float, before passing stored inputs to the engine.
 * P3's migration asserts this source-schema assumption against the live DB.
 */
export function storageNumber(value: number): number {
    if (!Number.isFinite(value))
        throw new ProposalError('A stored number must be finite.');
    const negative = value < 0;
    const [mantissa, exponent = '0'] = Math.abs(value).toString().split(/[eE]/);
    const parts = mantissa.split('.');
    const decimals = (parts[1] ?? '').length - Number(exponent);
    const digits = BigInt(parts.join(''));
    const removed = decimals - 4;
    if (removed <= 0)
        return value;
    const divisor = BigInt('1' + '0'.repeat(removed));
    let rounded = digits / divisor;
    if ((digits % divisor) * BigInt(2) >= divisor)
        rounded += BigInt(1);
    return (negative ? -1 : 1) * Number(rounded) / 10000;
}
export function storedMeasurement(value: number): number {
    const rounded = storageNumber(value);
    if (rounded <= 0)
        throw new ProposalError('This measurement is too small for the stored precision. Choose a larger span or use the builder.');
    return rounded;
}
