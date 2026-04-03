// Currency definitions and formatting utilities
// ISO 4217 currency codes with display metadata

export interface Currency {
  code: string;           // ISO 4217 code (e.g., 'NZD', 'USD')
  symbol: string;         // Display symbol (e.g., '$', '£', '€')
  name: string;           // Full name (e.g., 'New Zealand Dollar')
  symbolPosition: 'before' | 'after';  // $100 or 100€
  decimalSeparator: '.' | ',';
  thousandsSeparator: ',' | '.' | ' ' | '';
  decimals: number;       // Usually 2, but JPY uses 0
}

// =============================================================================
// Currency Definitions
// =============================================================================

export const CURRENCIES: Record<string, Currency> = {
  // Dollar variants (all use $ symbol)
  NZD: {
    code: 'NZD',
    symbol: '$',
    name: 'New Zealand Dollar',
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimals: 2,
  },
  AUD: {
    code: 'AUD',
    symbol: '$',
    name: 'Australian Dollar',
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimals: 2,
  },
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimals: 2,
  },
  CAD: {
    code: 'CAD',
    symbol: '$',
    name: 'Canadian Dollar',
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimals: 2,
  },
  SGD: {
    code: 'SGD',
    symbol: '$',
    name: 'Singapore Dollar',
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimals: 2,
  },
  HKD: {
    code: 'HKD',
    symbol: '$',
    name: 'Hong Kong Dollar',
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimals: 2,
  },

  // Major currencies (non-dollar)
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimals: 2,
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    symbolPosition: 'before',
    decimalSeparator: ',',
    thousandsSeparator: '.',
    decimals: 2,
  },
  JPY: {
    code: 'JPY',
    symbol: '¥',
    name: 'Japanese Yen',
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimals: 0,  // Yen has no decimal subdivision
  },
  CNY: {
    code: 'CNY',
    symbol: '¥',
    name: 'Chinese Yuan',
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimals: 2,
  },
  CHF: {
    code: 'CHF',
    symbol: 'CHF',
    name: 'Swiss Franc',
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimals: 2,
  },
  INR: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    symbolPosition: 'before',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimals: 2,
  },
};

// =============================================================================
// Currency Lists for UI
// =============================================================================

export const DOLLAR_CURRENCIES = ['NZD', 'AUD', 'USD', 'CAD', 'SGD', 'HKD'];
export const OTHER_CURRENCIES = ['GBP', 'EUR', 'JPY', 'CNY', 'CHF', 'INR'];
export const ALL_CURRENCY_CODES = [...DOLLAR_CURRENCIES, ...OTHER_CURRENCIES];

// Grouped for dropdown UI
export const CURRENCY_GROUPS = [
  {
    label: 'Dollar Currencies',
    currencies: DOLLAR_CURRENCIES.map(code => CURRENCIES[code]),
  },
  {
    label: 'Other Currencies',
    currencies: OTHER_CURRENCIES.map(code => CURRENCIES[code]),
  },
];

// =============================================================================
// Formatting Functions
// =============================================================================

/**
 * Format a number as currency
 * @param amount - Raw number (e.g., 1234.56)
 * @param currencyCode - ISO 4217 code (e.g., 'NZD')
 * @returns Formatted string (e.g., '$1,234.56')
 */
export function formatCurrency(amount: number, currencyCode: string): string {
  const currency = CURRENCIES[currencyCode];
  
  if (!currency) {
    // Fallback: use NZD formatting if currency not found
    console.warn(`Unknown currency code: ${currencyCode}, falling back to NZD`);
    return formatCurrency(amount, 'NZD');
  }

  // Round to correct decimal places
  const rounded = Math.round(amount * Math.pow(10, currency.decimals)) / Math.pow(10, currency.decimals);

  // Format integer and decimal parts
  const [integerPart, decimalPart] = rounded.toFixed(currency.decimals).split('.');

  // Add thousands separators
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, currency.thousandsSeparator);

  // Combine with decimal separator
  let formattedNumber = formattedInteger;
  if (currency.decimals > 0) {
    formattedNumber += currency.decimalSeparator + decimalPart;
  }

  // Add currency symbol
  if (currency.symbolPosition === 'before') {
    return `${currency.symbol}${formattedNumber}`;
  } else {
    return `${formattedNumber}${currency.symbol}`;
  }
}

/**
 * Get currency symbol only
 */
export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCIES[currencyCode]?.symbol || '$';
}

/**
 * Get currency name
 */
export function getCurrencyName(currencyCode: string): string {
  return CURRENCIES[currencyCode]?.name || currencyCode;
}

/**
 * Format currency with code suffix (for disambiguation)
 * @example formatCurrencyWithCode(1234.56, 'NZD') => '$1,234.56 NZD'
 */
export function formatCurrencyWithCode(amount: number, currencyCode: string): string {
  return `${formatCurrency(amount, currencyCode)} ${currencyCode}`;
}

// =============================================================================
// Helper: Get effective currency (with company fallback)
// =============================================================================

/**
 * Resolve effective currency (quote.currency || company.default_currency)
 * @param quoteCurrency - Quote's currency (can be null)
 * @param companyDefaultCurrency - Company's default currency
 * @returns Effective currency code to use
 */
export function getEffectiveCurrency(
  quoteCurrency: string | null,
  companyDefaultCurrency: string
): string {
  return quoteCurrency || companyDefaultCurrency;
}
