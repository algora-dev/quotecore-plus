/** Pure, dependency-free boundary parsers. Invalid input is never silently dropped. */
export class ContractError extends Error {
  constructor(readonly field: string) { super(`Invalid intelligence field: ${field}`); this.name = 'ContractError'; }
}
export function ensure(ok: unknown, field: string): asserts ok { if (!ok) throw new ContractError(field); }
export function record(v: unknown, field: string, keys: readonly string[]): Record<string, unknown> {
  ensure(typeof v === 'object' && v !== null && !Array.isArray(v), field);
  const r = v as Record<string, unknown>;
  ensure(Object.getPrototypeOf(r) === Object.prototype || Object.getPrototypeOf(r) === null, field);
  ensure(Object.keys(r).every(k => keys.includes(k)), field);
  return r;
}
export function text(v: unknown, field: string, max = 2000): string {
  ensure(typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v), field);
  return v;
}
export function id(v: unknown, field: string): string {
  const s = text(v, field, 128); ensure(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(s), field); return s;
}
export function hash(v: unknown, field: string): string {
  const s = text(v, field, 64); ensure(/^[a-f0-9]{64}$/.test(s), field); return s;
}
export function integer(v: unknown, field: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  ensure(typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max, field); return v;
}
export function finite(v: unknown, field: string, min: number, max: number): number {
  ensure(typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max, field); return v;
}
export function choice<T extends string>(v: unknown, field: string, allowed: readonly T[]): T {
  ensure(typeof v === 'string' && allowed.includes(v as T), field); return v as T;
}
export function list<T>(v: unknown, field: string, parse: (v: unknown, field: string) => T, max = 1000): T[] {
  ensure(Array.isArray(v) && v.length <= max, field); return Array.from(v, (x,i) => parse(x, `${field}[${i}]`));
}
export function unique<T>(values: readonly T[], key: (v:T)=>string, field:string): void {
  ensure(new Set(values.map(key)).size === values.length, field);
}
export function ids(v: unknown, field: string): string[] { const a = list(v, field, id, 100); unique(a, x=>x, field); return a; }
