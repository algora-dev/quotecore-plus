/** Wire contracts shared by the assistant UI and server. No privileged imports. */
import { ASSISTANT_SECTIONS, isRecord, parseSectionPermissions, type AssistantSection, type SectionPermissions } from '../section-permissions';
export type EntityKind = 'quote' | 'draft_quote' | 'order' | 'invoice' | 'component' | 'customer';
export type SearchKind = EntityKind | 'all';
export type Phase = 'p1' | 'p2' | 'p3' | 'p4';
export type PhaseFlags = Record<Phase, boolean>;
export type Access = {
    userId: string;
    companyId: string;
    workspaceSlug: string;
    phases: PhaseFlags;
    permissions: SectionPermissions;
    permissionRevision: number;
    historyAfter: string | null;
    writePolicy: string | null;
};
export type RecordTarget = {
    kind: EntityKind;
    id: string;
    /** Optional child context is bound to the stored card and re-authorised on open. */
    focus?: { kind: 'quote_component'; id: string };
};
export type EntityHit = RecordTarget & {
    section: AssistantSection;
    label: string;
    detail: string;
    status: string | null;
    score: number;
    fields: Record<string, unknown>;
};
export type PageHint = {
    pathname: string;
    target: RecordTarget | null;
};
export type RecordOption = RecordTarget & {
    label: string;
    detail: string;
};
export type CardContent = {
    kind: 'records';
    title: string;
    options: RecordOption[];
    note: string | null;
    autoOpen: boolean;
} | {
    kind: 'choices';
    title: string;
    options: {
        label: string;
        reply: string;
    }[];
} | {
    kind: 'resolution';
    title: string;
    stateId: string;
    expiresAt: string;
    question: string;
    options: { choiceId: string; label: string; detail: string }[];
} | {
    kind: 'attention';
    title: string;
    asOf: string;
    groups: AttentionGroup[];
    note: string;
} | {
    kind: 'proposal';
    title: string;
    actionId: string;
};
export type AttentionGroup = {
    key: string;
    title: string;
    state: 'available' | 'hidden' | 'unavailable';
    count: number | null;
    items: RecordOption[];
    note: string;
};
export type ConversationCard = {
    id: string;
    runId: string;
    createdAt: string;
    content: CardContent;
};
export type ChangeRow = {
    label: string;
    before: string;
    after: string;
};
export type ActionStatus = 'proposed' | 'applying' | 'committed' | 'cancelled' | 'conflict' | 'needs_review' | 'failed';
export type ActionView = {
    sections: AssistantSection[];
    actionKind: 'quote_details' | 'component_change' | 'draft_create' | null;
    id: string;
    status: ActionStatus;
    title: string;
    changes: ChangeRow[];
    note: string;
    proofDigest: string;
    version: number;
    target: RecordTarget | null;
    error: string | null;
    createdAt: string;
};
export type ChatMessage = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    runId: string | null;
    createdAt: string;
};
export type RunOutcome = {
    id: string;
    requestId: string;
    status: string;
};
export function parseRunOutcome(value: unknown): RunOutcome | null {
    if (!isRecord(value) || !isUuid(value.id) || !isUuid(value.client_request_id) || !['accepted', 'running', 'completed', 'failed', 'cancelled', 'aborted', 'timed_out'].includes(String(value.status)))
        return null;
    return { id: value.id, requestId: value.client_request_id, status: String(value.status) };
}
export type SessionSnapshot = {
    runs: RunOutcome[];
    messages: ChatMessage[];
    activeRunId: string | null;
    runStatus: string | null;
    access: Access;
    cards: ConversationCard[];
    actions: ActionView[];
    page: PageHint | null;
};
export const ENTITY_SECTIONS: Record<EntityKind, AssistantSection> = {
    quote: 'quotes', draft_quote: 'draft_quotes', order: 'orders', invoice: 'invoices',
    component: 'components', customer: 'customers',
};
export const ENTITY_KINDS = Object.keys(ENTITY_SECTIONS) as EntityKind[];
export function isUuid(value: unknown): value is string {
    return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export function boundedText(value: unknown, max: number): string | null {
    return typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value) ? value.trim() : null;
}
export function parseTarget(value: unknown): RecordTarget | null {
    if (!isRecord(value) || !ENTITY_KINDS.includes(value.kind as EntityKind) || !isUuid(value.id)) return null;
    if (value.focus === undefined) return { kind: value.kind as EntityKind, id: value.id };
    if (!['quote', 'draft_quote'].includes(String(value.kind)) || !isRecord(value.focus)
        || Object.keys(value.focus).some(k => !['kind', 'id'].includes(k))
        || value.focus.kind !== 'quote_component' || !isUuid(value.focus.id)) return null;
    return { kind: value.kind as EntityKind, id: value.id, focus: { kind: 'quote_component', id: value.focus.id } };
}
export function canRead(access: Access, section: AssistantSection): boolean {
    return access.phases.p1 && access.permissions[section] !== 'hidden';
}
export function canEdit(access: Access, section: AssistantSection): boolean {
    return access.phases.p3 && access.permissions[section] === 'edit';
}
export function parseAccess(value: unknown): Access | null {
    if (!isRecord(value) || !isUuid(value.user_id) || !isUuid(value.company_id)
        || typeof value.workspace_slug !== 'string' || !/^[a-z0-9][a-z0-9-]*$/i.test(value.workspace_slug)
        || !isRecord(value.phases))
        return null;
    const permissions = parseSectionPermissions(value.permissions);
    if (!permissions || !Number.isInteger(value.permission_revision) || Number(value.permission_revision) < 0)
        return null;
    const phases = {} as PhaseFlags;
    for (const key of ['p1', 'p2', 'p3', 'p4'] as const) {
        if (typeof value.phases[key] !== 'boolean')
            return null;
        phases[key] = value.phases[key];
    }
    if ((phases.p2 && !phases.p1) || (phases.p3 && !phases.p2) || (phases.p4 && !phases.p3))
        return null;
    if (value.history_after !== null && (typeof value.history_after !== 'string' || !Number.isFinite(Date.parse(value.history_after))))
        return null;
    return {
        userId: value.user_id, companyId: value.company_id, workspaceSlug: value.workspace_slug,
        phases, permissions, permissionRevision: Number(value.permission_revision),
        historyAfter: value.history_after as string | null,
        writePolicy: typeof value.write_policy === 'string' ? value.write_policy : null,
    };
}
export function parseHit(value: unknown): EntityHit | null {
    const target = parseTarget(value);
    if (!target || !isRecord(value) || value.section !== ENTITY_SECTIONS[target.kind]
        || !boundedText(value.label, 300) || typeof value.detail !== 'string' || value.detail.length > 600
        || typeof value.score !== 'number' || !Number.isFinite(value.score) || !isRecord(value.fields))
        return null;
    return { ...target, section: ENTITY_SECTIONS[target.kind], label: String(value.label), detail: value.detail,
        score: value.score, status: typeof value.status === 'string' ? value.status : null, fields: value.fields };
}
export function parseOption(value: unknown): RecordOption | null {
    const target = parseTarget(value);
    if (!target || !isRecord(value) || !boundedText(value.label, 300) || typeof value.detail !== 'string' || value.detail.length > 600)
        return null;
    return { ...target, label: String(value.label), detail: value.detail };
}
export function parseCard(value: unknown): ConversationCard | null {
    if (!isRecord(value) || !isUuid(value.id) || !isUuid(value.run_id) || typeof value.created_at !== 'string' || !isRecord(value.content))
        return null;
    const c = value.content;
    if (!boundedText(c.title, 300))
        return null;
    let content: CardContent;
    if (c.kind === 'records') {
        if (!Array.isArray(c.options) || c.options.length > 10 || typeof c.autoOpen !== 'boolean')
            return null;
        const options = c.options.map(parseOption);
        if (options.some((v) => !v))
            return null;
        content = { kind: c.kind, title: String(c.title), options: options as RecordOption[], autoOpen: c.autoOpen,
            note: typeof c.note === 'string' ? c.note.slice(0, 800) : null };
    }
    else if (c.kind === 'choices') {
        if (!Array.isArray(c.options) || c.options.length < 2 || c.options.length > 4)
            return null;
        const options: {
            label: string;
            reply: string;
        }[] = [];
        for (const o of c.options) {
            if (!isRecord(o) || !boundedText(o.label, 100) || !boundedText(o.reply, 500))
                return null;
            options.push({ label: String(o.label), reply: String(o.reply) });
        }
        content = { kind: c.kind, title: String(c.title), options };
    }
    else if (c.kind === 'resolution') {
        if (!isUuid(c.stateId) || typeof c.expiresAt !== 'string' || !Number.isFinite(Date.parse(c.expiresAt))
            || !boundedText(c.question, 400) || !Array.isArray(c.options) || c.options.length < 1 || c.options.length > 5) return null;
        const options: { choiceId: string; label: string; detail: string }[] = [];
        for (const option of c.options) {
            if (!isRecord(option) || !isUuid(option.choiceId) || !boundedText(option.label, 300)
                || typeof option.detail !== 'string' || option.detail.length > 600
                || Object.keys(option).some(k => !['choiceId','label','detail'].includes(k))) return null;
            options.push({ choiceId: option.choiceId, label: String(option.label), detail: option.detail });
        }
        if (new Set(options.map(o => o.choiceId)).size !== options.length) return null;
        content = { kind: 'resolution', title: String(c.title), stateId: c.stateId, expiresAt: c.expiresAt, question: String(c.question), options };
    }
    else if (c.kind === 'attention') {
        if (!Array.isArray(c.groups) || c.groups.length > 5 || typeof c.asOf !== 'string' || typeof c.note !== 'string')
            return null;
        const groups: AttentionGroup[] = [];
        for (const g of c.groups) {
            if (!isRecord(g) || typeof g.key !== 'string' || typeof g.title !== 'string'
                || !['available', 'hidden', 'unavailable'].includes(String(g.state)) || !Array.isArray(g.items) || g.items.length > 10
                || !(g.count === null || (typeof g.count === 'number' && Number.isSafeInteger(g.count) && g.count >= 0)) || typeof g.note !== 'string')
                return null;
            const items = g.items.map(parseOption);
            if (items.some((v) => !v))
                return null;
            groups.push({ key: g.key, title: g.title, state: g.state as AttentionGroup['state'], count: g.count,
                items: items as RecordOption[], note: g.note });
        }
        content = { kind: c.kind, title: String(c.title), groups, asOf: c.asOf, note: c.note };
    }
    else if (c.kind === 'proposal' && isUuid(c.actionId)) {
        content = { kind: c.kind, title: String(c.title), actionId: c.actionId };
    }
    else
        return null;
    return { id: value.id, runId: value.run_id, createdAt: value.created_at, content };
}
export function parseActionView(value: unknown): ActionView | null {
    if (!isRecord(value) || !isUuid(value.id) || !['proposed', 'applying', 'committed', 'cancelled', 'conflict', 'needs_review', 'failed'].includes(String(value.status))
        || !boundedText(value.title, 300) || !Array.isArray(value.changes) || value.changes.length > 80
        || typeof value.note !== 'string' || typeof value.proof_digest !== 'string' || !/^[a-f0-9]{64}$/.test(value.proof_digest)
        || !Number.isSafeInteger(value.version) || typeof value.created_at !== 'string'
        || !Array.isArray(value.sections) || value.sections.length < 1 || value.sections.length > 9
        || value.sections.some(s => !ASSISTANT_SECTIONS.some(allowed => allowed.key === s)))
        return null;
    const changes: ChangeRow[] = [];
    for (const c of value.changes) {
        if (!isRecord(c) || typeof c.label !== 'string' || typeof c.before !== 'string' || typeof c.after !== 'string'
            || c.label.length > 300 || c.before.length > 2000 || c.after.length > 2000)
            return null;
        // Never silently truncate the exact change the user is being asked to approve.
        changes.push({ label: c.label, before: c.before, after: c.after });
    }
    return { sections: value.sections as AssistantSection[], actionKind: ['quote_details', 'component_change', 'draft_create'].includes(String(value.action_kind)) ? value.action_kind as ActionView['actionKind'] : null, id: value.id, status: value.status as ActionStatus, title: String(value.title), changes,
        note: value.note, proofDigest: value.proof_digest, version: Number(value.version),
        target: parseTarget(value.target), error: typeof value.error === 'string' ? value.error : null, createdAt: value.created_at };
}
/** Decode the public camel-case boundary through the same authoritative parser. */
export function parsePublicAccess(value: unknown): Access | null {
    if (!isRecord(value))
        return null;
    return parseAccess({ user_id: value.userId, company_id: value.companyId, workspace_slug: value.workspaceSlug,
        phases: value.phases, permissions: value.permissions, permission_revision: value.permissionRevision,
        history_after: value.historyAfter, write_policy: value.writePolicy });
}
export function parseMessage(value: unknown): ChatMessage | null {
    if (!isRecord(value) || !isUuid(value.id) || !['user', 'assistant'].includes(String(value.role))
        || typeof value.content !== 'string' || typeof value.created_at !== 'string')
        return null;
    return { id: value.id, role: value.role as ChatMessage['role'], content: value.content,
        runId: isUuid(value.run_id) ? value.run_id : null, createdAt: value.created_at };
}
/** Public HTTP shape decoder. Fail closed rather than render executable objects. */
export function parsePublicSession(value: unknown): SessionSnapshot | null {
    if (!isRecord(value))
        return null;
    const access = parsePublicAccess(value.access);
    if (!access || !Array.isArray(value.cards) || value.cards.length > 80 || !Array.isArray(value.actions) || value.actions.length > 60 || !Array.isArray(value.messages) || value.messages.length > 100 || !Array.isArray(value.runs) || value.runs.length > 20)
        return null;
    const cards = value.cards.map(c => isRecord(c) ? parseCard({ ...c, run_id: c.runId, created_at: c.createdAt }) : null);
    const actions = value.actions.map(a => isRecord(a) ? parseActionView({ ...a, action_kind: a.actionKind, proof_digest: a.proofDigest, created_at: a.createdAt }) : null);
    const messages = value.messages.map(m => isRecord(m) ? parseMessage({ ...m, run_id: m.runId, created_at: m.createdAt }) : null);
    const runs = value.runs.map(v => isRecord(v) ? parseRunOutcome({ ...v, client_request_id: v.requestId }) : null);
    if (cards.some(c => !c) || actions.some(a => !a) || messages.some(m => !m) || runs.some(r => !r))
        return null;
    let page: PageHint | null = null;
    if (value.page !== null) {
        if (!isRecord(value.page) || typeof value.page.pathname !== 'string' || value.page.pathname.length > 500)
            return null;
        page = { pathname: value.page.pathname, target: parseTarget(value.page.target) };
    }
    return { access, cards: cards.filter(c => c !== null), actions: actions.filter(a => a !== null), messages: messages.filter(m => m !== null), runs: runs.filter(r => r !== null), page, activeRunId: isUuid(value.activeRunId) ? value.activeRunId : null, runStatus: typeof value.runStatus === 'string' ? value.runStatus : null };
}
