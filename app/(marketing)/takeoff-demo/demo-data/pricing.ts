export const DEMO_PRICES = {
  roofing: 42,
  ridge: 18,
  hip: 16,
  valley: 21,
  barge: 14,
  spouting: 12,
  underlay: 4.5,
  fixings: 2.8,
} as const;

export const money = (value: number) => `$${value.toFixed(2)}`;
