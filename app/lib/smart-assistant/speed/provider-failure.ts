/** Sanitized diagnostics only. Never log prompt, reply, API key, body or stack. */
export function providerFailure(error: unknown): {
    category: string;
    status: number | null;
    code: string | null;
} {
    if (!error || typeof error !== 'object')
        return { category: 'unknown', status: null, code: null };
    const value = error as Record<string, unknown>;
    const allowed = new Set(['rate_limit_exceeded', 'insufficient_quota', 'invalid_api_key', 'model_not_found', 'invalid_request_error', 'server_error', 'context_length_exceeded', 'unsupported_parameter', 'invalid_value']);
    const status = typeof value.status === 'number' && Number.isInteger(value.status) && value.status >= 100 && value.status <= 599 ? value.status : null;
    const code = typeof value.code === 'string' && allowed.has(value.code) ? value.code : null;
    const category = status === 429 ? 'rate_limit' : status === 401 || status === 403 ? 'authentication' : status !== null && status >= 500 ? 'provider_server' : status !== null && status >= 400 ? 'request_rejected' : value.name === 'AbortError' || value.name === 'TimeoutError' ? 'timeout' : 'upstream';
    return { category, status, code };
}
