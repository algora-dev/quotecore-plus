/**
 * Placeholder contact validation.
 * Detects test/placeholder contact details that should block publication.
 */

const PLACEHOLDER_EMAIL_PATTERNS = [
  /^test@/i,
  /^example@/i,
  /@example\.(com|org|net)$/i,
  /^noreply@/i,
  /^no-reply@/i,
  /^donotreply@/i,
  /^admin@localhost/i,
  /^user@/i,
  /^email@/i,
  /^contact@contact/i,
  /^info@info/i,
  /^placeholder@/i,
  /^sample@/i,
  /^dummy@/i,
  /^fake@/i,
];

const PLACEHOLDER_PHONE_PATTERNS = [
  /^0+$/,           // all zeros
  /^1+$/,           // all ones
  /^123[-.\s]?456[-.\s]?7890$/,  // classic fake
  /^000[-.\s]?000[-.\s]?0000$/,
  /^111[-.\s]?111[-.\s]?1111$/,
  /^999[-.\s]?999[-.\s]?9999$/,
  /^\+?0{3,}$/,     // international all zeros
  /^test/i,
  /^placeholder/i,
  /^n\/a$/i,
  /^na$/i,
  /^tbc$/i,
  /^xxx/i,
];

const PLACEHOLDER_NAME_PATTERNS = [
  /^test\s*(supplier|company|business)?$/i,
  /^example\s*(supplier|company|business)?$/i,
  /^placeholder/i,
  /^sample/i,
  /^dummy/i,
  /^fake/i,
  /^tbd$/i,
  /^tbc$/i,
  /^n\/a$/i,
  /^na$/i,
  /^xxx/i,
  /^your\s+(supplier|company|business)\s+name$/i,
  /^enter\s+/i,
  /^type\s+/i,
];

const PLACEHOLDER_WEBSITE_PATTERNS = [
  /^https?:\/\/(www\.)?example\.(com|org|net)/i,
  /^https?:\/\/(www\.)?test\./i,
  /^https?:\/\/(www\.)?placeholder\./i,
  /^https?:\/\/localhost/i,
  /^https?:\/\/127\.0\.0\.1/i,
  /^n\/a$/i,
  /^tbc$/i,
];

export interface ValidationResult {
  valid: boolean;
  issues: { field: string; message: string }[];
}

/**
 * Validate a supplier profile for placeholder contact details.
 * Returns issues array — empty means all good.
 */
export function validateSupplierContacts(profile: {
  supplier_name?: string | null;
  contact_email?: string | null;
  enquiry_email?: string | null;
  phone_number?: string | null;
  website_url?: string | null;
  description?: string | null;
}): ValidationResult {
  const issues: { field: string; message: string }[] = [];

  // Email checks
  for (const [field, value] of [
    ['contact_email', profile.contact_email],
    ['enquiry_email', profile.enquiry_email],
  ] as const) {
    if (value && PLACEHOLDER_EMAIL_PATTERNS.some((p) => p.test(value))) {
      issues.push({
        field,
        message: `"${value}" looks like a placeholder email. Please use a real business email address.`,
      });
    }
  }

  // Phone check
  if (profile.phone_number) {
    const cleaned = profile.phone_number.replace(/[^\d\w+]/g, '');
    if (PLACEHOLDER_PHONE_PATTERNS.some((p) => p.test(profile.phone_number!) || p.test(cleaned))) {
      issues.push({
        field: 'phone_number',
        message: `"${profile.phone_number}" looks like a placeholder phone number. Please use a real business phone number.`,
      });
    }
  }

  // Name check
  if (profile.supplier_name) {
    if (PLACEHOLDER_NAME_PATTERNS.some((p) => p.test(profile.supplier_name!.trim()))) {
      issues.push({
        field: 'supplier_name',
        message: `"${profile.supplier_name}" looks like a placeholder business name.`,
      });
    }
  }

  // Website check
  if (profile.website_url) {
    if (PLACEHOLDER_WEBSITE_PATTERNS.some((p) => p.test(profile.website_url!.trim()))) {
      issues.push({
        field: 'website_url',
        message: `"${profile.website_url}" looks like a placeholder website URL.`,
      });
    }
  }

  // Description too short
  if (profile.description && profile.description.trim().length < 20) {
    issues.push({
      field: 'description',
      message: 'Description is very short. Add at least a sentence describing the business.',
    });
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Validate catalogue rows for common data quality issues.
 * Returns issues array — empty means all good.
 */
export function validateCatalogueRows(
  rows: { raw_row: Record<string, unknown> }[],
): ValidationResult {
  const issues: { field: string; message: string }[] = [];

  if (rows.length === 0) {
    issues.push({
      field: 'catalogue',
      message: 'Catalogue is empty. Upload a CSV with at least one product row.',
    });
    return { valid: false, issues };
  }

  // Check for missing product names
  const missingNames = rows.filter((r) => {
    const name = r.raw_row.product_name || r.raw_row.name || r.raw_row.description;
    return !name || String(name).trim() === '';
  });
  if (missingNames.length > 0) {
    issues.push({
      field: 'product_name',
      message: `${missingNames.length} row(s) are missing a product name.`,
    });
  }

  // Check for missing/invalid prices
  const missingPrices = rows.filter((r) => {
    const price = r.raw_row.price || r.raw_row.cost || r.raw_row.unit_price;
    return price == null || String(price).trim() === '' || isNaN(Number(String(price).replace(/[^0-9.\-]/g, '')));
  });
  if (missingPrices.length > 0) {
    issues.push({
      field: 'price',
      message: `${missingPrices.length} row(s) have missing or invalid prices.`,
    });
  }

  // Check for duplicate product codes
  const codeMap = new Map<string, number>();
  let duplicateCount = 0;
  for (const r of rows) {
    const code = r.raw_row.supplier_product_code || r.raw_row.sku || r.raw_row.code;
    if (code && String(code).trim()) {
      const key = String(code).trim();
      const count = (codeMap.get(key) ?? 0) + 1;
      codeMap.set(key, count);
      if (count === 2) duplicateCount += 2;  // count both first and second occurrence
      else if (count > 2) duplicateCount += 1;
    }
  }
  if (duplicateCount > 0) {
    issues.push({
      field: 'supplier_product_code',
      message: `${duplicateCount} row(s) have duplicate product codes. Each product should have a unique code.`,
    });
  }

  // Check for negative prices
  const negativePrices = rows.filter((r) => {
    const price = r.raw_row.price || r.raw_row.cost || r.raw_row.unit_price;
    if (!price) return false;
    const num = Number(String(price).replace(/[^0-9.\-]/g, ''));
    return !isNaN(num) && num < 0;
  });
  if (negativePrices.length > 0) {
    issues.push({
      field: 'price',
      message: `${negativePrices.length} row(s) have negative prices.`,
    });
  }

  return { valid: issues.length === 0, issues };
}
