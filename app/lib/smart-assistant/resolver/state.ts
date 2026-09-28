import { isRecord } from '../section-permissions';
import { isUuid } from '../v2/contracts';
import { UNITS } from '../v2/units';
import { RESOLVER_LIMITS } from './config';
import { parseCandidateRef, parseResolverIntent, bounded, type ResolutionState } from './contracts';

/** Versioned, bounded conversation metadata. No authoritative financial values
 * are persisted here. Rereads are mandatory, including for explicit clicks. */
export function parseResolutionState(value: unknown): ResolutionState | null {
  try {
    if (!isRecord(value) || JSON.stringify(value).length > RESOLVER_LIMITS.payloadBytes
      || Object.keys(value).some(k => !['version','status','intent','candidates','rejected','clarifications','question','previousStateId','candidateSetComplete'].includes(k))
      || value.version !== 1 || !['pending','resolved','closed'].includes(String(value.status))
      || !Array.isArray(value.candidates) || value.candidates.length > RESOLVER_LIMITS.candidates
      || !Array.isArray(value.rejected) || value.rejected.length > RESOLVER_LIMITS.rejected || value.rejected.some(x => !bounded(x, 400))
      || !Number.isInteger(value.clarifications) || Number(value.clarifications) < 0 || Number(value.clarifications) > RESOLVER_LIMITS.clarificationTurns
      || !isRecord(value.question) || Object.keys(value.question).some(k => !['key','text'].includes(k))
      || !['domain','parent','customer','job','date','name'].includes(String(value.question.key)) || !bounded(value.question.text, 400)
      || (value.candidateSetComplete !== undefined && typeof value.candidateSetComplete !== 'boolean')
      || (value.previousStateId !== undefined && !isUuid(value.previousStateId)) || !isRecord(value.intent)) return null;
    const raw = { ...value.intent };
    const internalTask = raw.task === 'propose_component';
    const proposal = raw.proposal;
    const nameOrContents = raw.nameOrContents;
    const customerOrName = raw.customerOrName;
    delete raw.proposal; delete raw.nameOrContents; delete raw.customerOrName;
    if (internalTask) raw.task = 'find';
    const intent = parseResolverIntent(raw);
    if (nameOrContents !== undefined) {
      if (nameOrContents !== true || !intent.contains || !['quotes','drafts'].includes(intent.domain)) return null;
      intent.nameOrContents = true;
    }
    if (customerOrName !== undefined) {
      if (customerOrName !== true || !intent.customer || intent.query || intent.id || intent.number || intent.parent || !intent.selection) return null;
      intent.customerOrName = true;
    }
    if (internalTask) {
      if (!isRecord(proposal) || Object.keys(proposal).some(k => !['changes','quantity_unit','rate_unit'].includes(k))
        || !isRecord(proposal.changes) || !Object.keys(proposal.changes).length || Object.keys(proposal.changes).length > 5
        || Object.entries(proposal.changes).some(([k,v]) => !['material_rate','labour_rate','waste_percent','pitch_degrees','raw_quantity'].includes(k) || typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1_000_000)
        || ![...UNITS, null].includes(proposal.quantity_unit as never) || ![...UNITS, null].includes(proposal.rate_unit as never)
        || intent.domain !== 'components') return null;
      intent.task = 'propose_component';
      intent.proposal = proposal as ResolutionState['intent']['proposal'];
    } else if (proposal !== undefined) return null;
    const candidates = value.candidates.map(parseCandidateRef);
    if (candidates.some(x => x === null) || new Set(candidates.map(x => x!.choiceId)).size !== candidates.length || new Set(candidates.map(x => x!.key)).size !== candidates.length) return null;
    return { ...value, intent, candidates } as ResolutionState;
  } catch { return null; }
}
