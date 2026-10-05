import { isUuid, type EntityHit, type PageHint, type RecordTarget } from './contracts';
/** Only known internal routes. Neither model text nor a supplied href is executed. */
export function destinationFor(hit: EntityHit, slug: string): string | null {
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug) || !isUuid(hit.id))
        return null;
    const base = `/${slug}`;
    switch (hit.kind) {
        case 'quote': return `${base}/quotes/${hit.id}/summary`;
        case 'draft_quote':
            if (hit.fields.entry_mode === 'blank')
                return `${base}/quotes/${hit.id}/blank-build`;
            if (hit.fields.entry_mode === 'digital')
                return `${base}/quotes/${hit.id}/build?step=roof-areas`;
            return `${base}/quotes/${hit.id}`;
        case 'order': return `${base}/material-orders/${hit.id}/preview`;
        case 'invoice': return `${base}/invoices/${hit.id}`;
        case 'component': return `${base}/components?created=${hit.id}`; // existing highlightComponentId contract
        // Customers have no independent page/table in the supplied application.
        // A customer hit is a contact snapshot on an authorised source quote.
        case 'customer': return hit.fields.source_status === 'draft'
            ? destinationFor({ ...hit, kind: 'draft_quote', section: 'draft_quotes' }, slug)
            : `${base}/quotes/${hit.id}/summary`;
    }
}
export function isSafeDestination(path: unknown, slug: string): path is string {
    if (typeof path !== 'string' || path.length > 500 || /[\\\u0000-\u0020#%]/.test(path) || !/^[a-z0-9][a-z0-9-]*$/i.test(slug))
        return false;
    const prefix = `/${slug}/`;
    if (!path.startsWith(prefix) || path.includes('..'))
        return false;
    const tail = path.slice(prefix.length);
    const uuid = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
    return new RegExp(`^(quotes/${uuid}(/summary|/blank-build|/build\\?step=roof-areas)?|quotes/${uuid}(\\?sa_component=${uuid}|/build\\?step=(components|extras)&sa_component=${uuid})|material-orders/${uuid}/preview|invoices/${uuid}|components\\?created=${uuid})$`).test(tail);
}
export function pageHint(pathname: unknown, slug: string): PageHint | null {
    if (typeof pathname !== 'string' || pathname.length > 500 || /[\\\u0000-\u0020?#%]/.test(pathname) || !pathname.startsWith(`/${slug}/`))
        return null;
    const parts = pathname.split('/').filter(Boolean);
    let target: RecordTarget | null = null;
    if (parts[1] === 'quotes' && isUuid(parts[2]))
        target = { kind: 'quote', id: parts[2] };
    if (parts[1] === 'material-orders' && isUuid(parts[2]))
        target = { kind: 'order', id: parts[2] };
    if (parts[1] === 'invoices' && isUuid(parts[2]))
        target = { kind: 'invoice', id: parts[2] };
    // A URL is only a hint. The server resolves the live status and permission.
    return { pathname, target };
}
export function targetKey(target: RecordTarget): string { return `${target.kind}:${target.id}${target.focus ? `:${target.focus.kind}:${target.focus.id}` : ''}`; }
export function sameTarget(a: RecordTarget, b: RecordTarget): boolean { return targetKey(a) === targetKey(b); }
export function isSafeReturnDestination(value: unknown, slug: string): value is string {
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug) || typeof value !== 'string')
        return false;
    if (isSafeDestination(value, slug))
        return true;
    return value === `/${slug}` || ['quotes', 'material-orders', 'invoices', 'components'].some(section => value === `/${slug}/${section}`);
}

/** Call only after the server verifies the child belongs to this authorised quote. */
export function componentDestinationFor(hit: EntityHit, componentId: string, componentType: string, slug: string): string | null {
    if (!['quote', 'draft_quote'].includes(hit.kind) || !isUuid(componentId)
        || !isUuid(hit.id) || !/^[a-z0-9][a-z0-9-]*$/i.test(slug) || hit.fields.entry_mode === 'blank') return null;
    if (hit.fields.entry_mode === 'digital') {
        const hasAreas = Array.isArray(hit.fields.roof_areas) && hit.fields.roof_areas.length > 0;
        const step = componentType === 'extra' && hasAreas ? 'extras' : 'components';
        return `/${slug}/quotes/${hit.id}/build?step=${step}&sa_component=${componentId}`;
    }
    return `/${slug}/quotes/${hit.id}?sa_component=${componentId}`;
}
