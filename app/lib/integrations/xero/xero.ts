/**
 * Xero OAuth2 + Accounting API helpers.
 *
 * Token lifecycle:
 * - Access tokens last 30 minutes; refresh tokens are single-use and rotate
 *   on every refresh (60 day idle expiry).
 * - Tokens live in `xero_connections` (service-role only table). All callers
 *   must authenticate the user + company before calling getXeroAccessToken().
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/server';

const TOKEN_URL = 'https://identity.xero.com/connect/token';
const AUTHORIZE_URL = 'https://login.xero.com/identity/connect/authorize';
const REVOKE_URL = 'https://identity.xero.com/revocation';
const CONNECTIONS_URL = 'https://api.xero.com/connections';
const API_BASE = 'https://api.xero.com/api.xro/2.0';

export const XERO_SCOPES = [
  'openid',
  'offline_access',
  'accounting.invoices',
  'accounting.contacts',
  'accounting.attachments',
].join(' ');

function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export function getXeroCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Xero client credentials are not configured');
  }
  return { clientId, clientSecret };
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}

export function buildAuthorizeUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  // Xero requires %20 separators (a '+' is parsed as part of the scope name).
  const params = [
    `response_type=code`,
    `client_id=${encodeURIComponent(clientId)}`,
    `redirect_uri=${encodeURIComponent(redirectUri)}`,
    `scope=${encodeURIComponent(XERO_SCOPES)}`,
    `state=${encodeURIComponent(state)}`,
  ].join('&');
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  const { clientId, clientSecret } = getXeroCredentials();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    throw new Error(`Xero token exchange failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<TokenResponse>;
}

export async function refreshTokens(
  refreshToken: string
): Promise<TokenResponse> {
  const { clientId, clientSecret } = getXeroCredentials();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    throw new Error(`Xero token refresh failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<TokenResponse>;
}

export async function revokeToken(token: string): Promise<void> {
  try {
    const { clientId, clientSecret } = getXeroCredentials();
    await fetch(REVOKE_URL, {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(clientId, clientSecret),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ token }),
    });
  } catch {
    // Best-effort revocation - local row is deleted regardless.
  }
}

export interface XeroTenant {
  tenantId: string;
  tenantName: string;
  tenantType: string | null;
}

export async function fetchTenants(accessToken: string): Promise<XeroTenant[]> {
  const res = await fetch(CONNECTIONS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Xero connections fetch failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as Array<{
    tenantId: string;
    tenantName: string;
    tenantType: string;
  }>;
  return data.map((t) => ({
    tenantId: t.tenantId,
    tenantName: t.tenantName,
    tenantType: t.tenantType,
  }));
}

export interface XeroConnectionRow {
  id: string;
  company_id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_type: string | null;
  access_token: string;
  refresh_token: string;
  access_expires_at: string;
  created_at: string;
  updated_at: string;
}

export async function getConnection(companyId: string): Promise<XeroConnectionRow | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('xero_connections')
    .select('*')
    .eq('company_id', companyId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as XeroConnectionRow | null) ?? null;
}

/**
 * Returns a valid access token for the company's Xero connection,
 * refreshing + persisting rotated tokens when needed.
 * Returns null when the company has no Xero connection.
 */
export async function getXeroAccessToken(companyId: string): Promise<{ accessToken: string; connection: XeroConnectionRow } | null> {
  const connection = await getConnection(companyId);
  if (!connection) return null;

  const expiresAt = new Date(connection.access_expires_at).getTime();
  if (Date.now() < expiresAt - 60_000) {
    return { accessToken: connection.access_token, connection };
  }

  const refreshed = await refreshTokens(connection.refresh_token);
  const supabase = createServiceClient();
  const { data: updated } = await supabase
    .from('xero_connections')
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      access_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id)
    .select('*')
    .single();

  const row = (updated as XeroConnectionRow | null) ?? {
    ...connection,
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
  };
  return { accessToken: refreshed.access_token, connection: row };
}

export class XeroApi {
  constructor(
    private readonly accessToken: string,
    private readonly tenantId: string
  ) {}

  private headers(json = true): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      'xero-tenant-id': this.tenantId,
      // Xero's 2026 platform returns XML by default - always ask for JSON.
      Accept: 'application/json',
    };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  /** Create or match a contact by name. Returns the Xero contactID. */
  async upsertContact(name: string, email?: string | null): Promise<string> {
    const res = await fetch(`${API_BASE}/Contacts`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        Name: name,
        ...(email ? { EmailAddress: email } : {}),
      }),
    });
    if (!res.ok) {
      throw new Error(`Xero contact upsert failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { Contacts: Array<{ ContactID: string }> };
    return data.Contacts[0].ContactID;
  }

  /** Create a DRAFT ACCREC invoice. Returns invoice id + number. */
  async createDraftInvoice(invoice: {
    contactId: string;
    reference: string;
    currencyCode?: string | null;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitAmount: number;
      accountCode?: string;
      taxType?: string;
    }>;
    lineAmountTypes?: 'Exclusive' | 'Inclusive' | 'NoTax';
  }): Promise<{ invoiceId: string; invoiceNumber: string }> {
    const res = await fetch(`${API_BASE}/Invoices?summarizeErrors=false`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        Invoices: [
          {
            Type: 'ACCREC',
            Status: 'DRAFT',
            Contact: { ContactID: invoice.contactId },
            Reference: invoice.reference,
            Date: new Date().toISOString().slice(0, 10),
            DueDate: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10),
            ...(invoice.currencyCode ? { CurrencyCode: invoice.currencyCode } : {}),
            LineAmountTypes: invoice.lineAmountTypes ?? 'Exclusive',
            LineItems: invoice.lineItems.map((li) => ({
              Description: li.description.slice(0, 4000),
              Quantity: li.quantity,
              UnitAmount: li.unitAmount,
              ...(li.accountCode ? { AccountCode: li.accountCode } : {}),
              ...(li.taxType ? { TaxType: li.taxType } : {}),
            })),
          },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`Xero invoice create failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as {
      Invoices: Array<{ InvoiceID: string; InvoiceNumber: string }>;
    };
    return {
      invoiceId: data.Invoices[0].InvoiceID,
      invoiceNumber: data.Invoices[0].InvoiceNumber,
    };
  }

  /** Attach a binary file (e.g. quote PDF) to an invoice. Best-effort helper. */
  async attachFileToInvoice(
    invoiceId: string,
    fileName: string,
    contentType: string,
    body: ArrayBuffer
  ): Promise<boolean> {
    const safeName = fileName.replace(/[^A-Za-z0-9._() -]/g, '_');
    const res = await fetch(
      `${API_BASE}/Invoices/${invoiceId}/Attachments/${encodeURIComponent(safeName)}`,
      {
        method: 'POST',
        headers: {
          ...this.headers(false),
          'Content-Type': contentType,
        },
        body,
      }
    );
    return res.ok;
  }
}
