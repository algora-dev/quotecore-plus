/**
 * QuickBooks Online OAuth2 + Accounting API helpers.
 *
 * Intuit OAuth2: authorization code grant, Basic-auth token endpoint.
 * Access tokens last 1 hour; refresh tokens last ~100 days and are
 * single-use (rotate on every refresh, same as Xero).
 *
 * All API calls are JSON (Intuit has no XML default surprise).
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/server';

const AUTHORIZE_URL = 'https://accounts.intuit.com/oauth2/v1/authorize';
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';

export const QBO_SCOPE = 'com.intuit.quickbooks.accounting';

export function getQboCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.QBO_CLIENT_ID;
  const clientSecret = process.env.QBO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('QuickBooks client credentials are not configured');
  }
  return { clientId, clientSecret };
}

function qboEnvironment(): 'sandbox' | 'production' {
  return process.env.QBO_ENV === 'production' ? 'production' : 'sandbox';
}

export function qboApiBase(): string {
  return qboEnvironment() === 'production'
    ? 'https://quickbooks.api.intuit.com/v3/company'
    : 'https://sandbox-quickbooks.api.intuit.com/v3/company';
}

function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}

export function buildQboAuthorizeUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const params = [
    `client_id=${encodeURIComponent(clientId)}`,
    `response_type=code`,
    `scope=${encodeURIComponent(QBO_SCOPE)}`,
    `redirect_uri=${encodeURIComponent(redirectUri)}`,
    `state=${encodeURIComponent(state)}`,
  ].join('&');
  return `${AUTHORIZE_URL}?${params}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in?: number;
}

export async function exchangeQboCodeForTokens(
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  const { clientId, clientSecret } = getQboCredentials();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    throw new Error(`QBO token exchange failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<TokenResponse>;
}

export async function refreshQboTokens(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = getQboCredentials();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    throw new Error(`QBO token refresh failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<TokenResponse>;
}

export async function revokeQboToken(token: string): Promise<void> {
  try {
    const { clientId, clientSecret } = getQboCredentials();
    await fetch(REVOKE_URL, {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(clientId, clientSecret),
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({ token }),
    });
  } catch {
    // Best-effort revocation - local row is deleted regardless.
  }
}

export interface QboConnectionRow {
  id: string;
  company_id: string;
  realm_id: string;
  company_name: string | null;
  environment: string;
  access_token: string;
  refresh_token: string;
  access_expires_at: string;
  refresh_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getQboConnection(companyId: string): Promise<QboConnectionRow | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('qbo_connections')
    .select('*')
    .eq('company_id', companyId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as QboConnectionRow | null) ?? null;
}

export async function getQboAccessToken(
  companyId: string
): Promise<{ accessToken: string; connection: QboConnectionRow } | null> {
  const connection = await getQboConnection(companyId);
  if (!connection) return null;

  const expiresAt = new Date(connection.access_expires_at).getTime();
  if (Date.now() < expiresAt - 60_000) {
    return { accessToken: connection.access_token, connection };
  }

  const refreshed = await refreshQboTokens(connection.refresh_token);
  const supabase = createServiceClient();
  const { data: updated } = await supabase
    .from('qbo_connections')
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      access_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      refresh_expires_at: refreshed.x_refresh_token_expires_in
        ? new Date(refreshed.x_refresh_token_expires_in * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id)
    .select('*')
    .single();

  const row = (updated as QboConnectionRow | null) ?? {
    ...connection,
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
  };
  return { accessToken: refreshed.access_token, connection: row };
}

export class QboApi {
  constructor(
    private readonly accessToken: string,
    private readonly realmId: string
  ) {}

  private async call(
    path: string,
    init: { method: string; body?: unknown; contentType?: string }
  ): Promise<Record<string, unknown>> {
    const res = await fetch(`${qboApiBase()}/${this.realmId}/${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/json',
        ...(init.body !== undefined
          ? { 'Content-Type': init.contentType ?? 'application/json' }
          : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    if (!res.ok) {
      throw new Error(`QBO ${path} failed: ${res.status} ${(await res.text()).slice(0, 500)}`);
    }
    return res.json() as Promise<Record<string, unknown>>;
  }

  /** Find or create a customer by display name. Returns the QBO customer Id. */
  async upsertCustomer(displayName: string, email?: string | null): Promise<string> {
    const safeName = displayName.replace(/'/g, "''");
    const query = (await this.call(
      `query?query=${encodeURIComponent(`select Id from Customer where DisplayName = '${safeName}'`)}`,
      { method: 'POST', contentType: 'application/text' }
    )) as { QueryResponse?: { Customer?: Array<{ Id: string }> } };
    const existing = query.QueryResponse?.Customer?.[0];
    if (existing) return existing.Id;

    const created = (await this.call('customer', {
      method: 'POST',
      body: {
        DisplayName: displayName.slice(0, 100),
        ...(email ? { PrimaryEmailAddr: { Address: email } } : {}),
      },
    })) as { Customer: { Id: string } };
    return created.Customer.Id;
  }

  /**
   * Ensure a generic service item exists (QBO requires an ItemRef on
   * amount-bearing invoice lines). Created once per company.
   */
  async ensureServiceItem(): Promise<string> {
    const name = 'QuoteCore+ Line';
    const query = (await this.call(
      `query?query=${encodeURIComponent(`select Id from Item where Name = '${name}'`)}`,
      { method: 'POST', contentType: 'application/text' }
    )) as { QueryResponse?: { Item?: Array<{ Id: string }> } };
    const existing = query.QueryResponse?.Item?.[0];
    if (existing) return existing.Id;

    const created = (await this.call('item', {
      method: 'POST',
      body: {
        Name: name,
        Type: 'Service',
        IncomeAccountRef: { value: '1', name: 'Sales of Product Income' },
      },
    })) as { Item: { Id: string } };
    return created.Item.Id;
  }

  /** Create a draft invoice. Returns invoice Id + doc number. */
  async createDraftInvoice(invoice: {
    customerId: string;
    itemId: string;
    reference: string;
    currency?: string | null;
    lineItems: Array<{ description: string; quantity: number; unitAmount: number }>;
  }): Promise<{ invoiceId: string; docNumber: string }> {
    const res = await this.call('invoice', {
      method: 'POST',
      body: {
        CustomerRef: { value: invoice.customerId },
        ...(invoice.currency ? { CurrencyRef: { value: invoice.currency } } : {}),
        PrivateNote: invoice.reference,
        Line: invoice.lineItems.map((li) => ({
          DetailType: 'SalesItemLineDetail',
          Amount: Math.round(li.quantity * li.unitAmount * 100) / 100,
          Description: li.description.slice(0, 1000),
          SalesItemLineDetail: {
            ItemRef: { value: invoice.itemId },
            Qty: li.quantity,
            UnitPrice: li.unitAmount,
          },
        })),
      },
    });
    const inv = res.Invoice as unknown as { Id: string; DocNumber?: string };
    return { invoiceId: inv.Id, docNumber: inv.DocNumber ?? '' };
  }

  /** Attach a PDF to the invoice via QBO's upload endpoint. Best-effort. */
  async attachPdfToInvoice(
    invoiceId: string,
    fileName: string,
    pdfBuffer: ArrayBuffer
  ): Promise<boolean> {
    try {
      const attachable = {
        FileName: fileName.replace(/[^A-Za-z0-9._() -]/g, '_'),
        ContentType: 'application/pdf',
        Note: 'QuoteCore+ quote PDF',
        AttachableRef: [{ EntityRef: { type: 'Invoice', Id: invoiceId } }],
      };
      const res = await fetch(
        `${qboApiBase()}/${this.realmId}/upload?attachable=${encodeURIComponent(JSON.stringify(attachable))}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/pdf',
          },
          body: pdfBuffer,
        }
      );
      return res.ok;
    } catch {
      return false;
    }
  }
}
