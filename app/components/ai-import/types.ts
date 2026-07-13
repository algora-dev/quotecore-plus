export interface ParsedLine {
  description: string;
  qty: number;
  unit: string;
  rate: number;
}

export interface ParsedDocumentResult {
  companyName: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  quoteDate: string;
  validDays: string;
  notes: string;
  lines: ParsedLine[];
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
}
