import 'server-only';
import type { TaskDecision } from '../tasks/boundary';
import { stableArguments } from '../speed/tool-batch';
import { randomUUID } from 'node:crypto';
import { isRecord, type AssistantSection } from '../section-permissions';
import { isUuid, type Access, type CardContent, type RecordTarget } from '../v2/contracts';
import { AssistantV2Error } from '../v2/runtime.server';
import { RetrievalError, type QueryPlan, type RetrievalResult } from '../retrieval/contracts';
import { targetForRow, targetKey } from '../retrieval/targets';
import { compileIntelligentPlan } from '../retrieval/semantics';
import { RESOLVER_LIMITS } from './config';
import { constrainIntent, extractAnchors, normalizeName } from './anchors';
import { requestFromText, refineRequest } from './clues';
import { mergeRefinement } from './continuation';
import { decodeResolutionChoice, type ResolutionChoice } from './wire';
import { currentParent, discoveryQuery, identityFields, parentQuery, rereadQuery, sourcesFor, visibleResolverSources, qualifiers, type ResolverSource } from './sources';
import { chooseCandidates, discriminator, makeCandidate } from './relevance';
import { type Candidate, type CandidateRef, type DiscoveryCoverage, type Parent, type ResolutionState, type ResolverIntent, type ResolverResult, type StoredResolution } from './contracts';
import type { ResolutionStore } from './state.server';

export interface ResolverDependencies {
  access: Access; runId: string; userMessage: string; catalogues: boolean;
  lookup: (plan: QueryPlan, signal?: AbortSignal) => Promise<RetrievalResult>;
  current: () => Promise<RecordTarget | null>;
  store: ResolutionStore;
  emit: (sections: AssistantSection[], content: CardContent) => Promise<string>;
  guard: () => Promise<void>;
  /** Existing P3 domain planner, NEVER a commit/confirm operation. */
  propose?: (args: Record<string, unknown>, expectedQuoteId: string) => Promise<unknown>;
  /** Supplied only after the single authenticated task-boundary decision. */
  taskTurn?: { decision: TaskDecision; previous: StoredResolution | null };
  onResult?: (intent: ResolverIntent, result: ResolverResult) => void;
  now?: () => Date; uuid?: () => string; report?: (event: Record<string, unknown>) => void;
}
const refOnly = ({ row: _row, evidence: _evidence, ...ref }: Candidate): CandidateRef => ref;
const emptyCoverage = (): DiscoveryCoverage => ({ searched: [], failed: [], truncated: [], skipped: [], reads: 0, broadened: false });
const available = (r: RetrievalResult) => ['ok','empty','ambiguous','incomplete'].includes(r.state);
const unique = <T,>(a: T[]) => [...new Set(a)];
const identityIntent = (p: Parent): ResolverIntent => ({ version: 1, task: 'find', domain: p.domain, query: p.text, number: p.number, id: p.id, current: p.current, customer: p.customer, job: p.job });
const sameNames = (a: string[], b: string[]) => a.map(normalizeName).join('|') === b.map(normalizeName).join('|');

/** One admitted run, one resolution outcome. No model-owned entity authority or
 * second database. Persisted candidates are hints until reread under current RLS. */
export function createEntityResolver(dep: ResolverDependencies) {
  const now = dep.now ?? (() => new Date()), uuid = dep.uuid ?? randomUUID;
  const visible = visibleResolverSources(dep.access.permissions, dep.catalogues);
  const produced = new WeakSet<object>();
  let outcome: Promise<ResolverResult> | undefined;
  let outcomeKey: string | undefined;
  let previousPromise: Promise<StoredResolution | null> | undefined;
  const readable = Object.entries(dep.access.permissions).filter(([,v]) => v !== 'hidden').map(([k]) => k as AssistantSection);
  // Conservative replay: all currently readable sections, plus revision fencing.
  const sectionsFor = (_intent: ResolverIntent, _sources: string[]) => readable;
  const loadPrevious = (signal?: AbortSignal) => previousPromise ??= dep.store.load(undefined, signal);

  async function run(intent: ResolverIntent, signal?: AbortSignal, previous?: StoredResolution, clicked?: CandidateRef, rejection = false, useful = true): Promise<ResolverResult> {
    const start = performance.now(), coverage = emptyCoverage();
    const budget = new AbortController();
    const stop = () => budget.abort();
    signal?.addEventListener('abort', stop, { once: true });
    const timer = setTimeout(stop, RESOLVER_LIMITS.deadlineMs);
    const rejected = unique([...(previous?.state.rejected ?? []), ...(rejection ? previous?.state.candidates.map(c => c.key) ?? [] : [])]).slice(-RESOLVER_LIMITS.rejected);
    const clarifications = Math.min(RESOLVER_LIMITS.clarificationTurns, (previous?.state.clarifications ?? 0) + Number(!!previous && !clicked && (!rejection || useful || previous.state.candidates.length === 0)));
    let parentId: string | undefined, parentSelector = intent.parent;
    let persisted = false, candidateSetComplete = false;
    let orderParentIds: string[] | undefined;
    const readCache = new Map<string, RetrievalResult>();
    const checkOuter = () => { if (signal?.aborted) throw new AssistantV2Error('turn_timeout','The assistant turn timed out.',408); };
    const base = (state: ResolverResult['state'], answer: string): ResolverResult => ({ state, answer, candidates: [], canClarify: false, coverage, applied: false });
    const finish = async (result: ResolverResult, candidates: Candidate[] = [], status: ResolutionState['status'] = result.canClarify ? 'pending' : 'resolved'): Promise<ResolverResult> => {
      checkOuter();
      await dep.guard();
      const question = result.question ?? discriminator(candidates, intent);
      const refs = candidates.map(refOnly).slice(0, RESOLVER_LIMITS.candidates);
      const state: ResolutionState = { version: 1, status, intent, candidates: refs, rejected, clarifications, question, candidateSetComplete: status === 'pending' && refs.length > 0 && candidateSetComplete, ...(previous ? { previousStateId: previous.id } : {}) };
      const sections = sectionsFor(intent, unique([...coverage.searched, ...refs.map(r => r.source)]));
      // Permission revocation can invalidate the current admitted run while a
      // read was executing. The writer rechecks run/revision; finish guards again.
      const saved = await dep.store.save(state, sections, signal); persisted = true;
      if(intent.period) result.answer += `\nDate scope: ${intent.period.label}; ${intent.period.from.slice(0,10)} to ${intent.period.to.slice(0,10)} (exclusive).`;
      result.stateId = saved.id;
      result.candidates = refs;
      if (result.state === 'candidates' && refs.length) {
        result.cardId = await dep.emit(sections, { kind: 'resolution', title: 'Is one of these what you meant?', stateId: saved.id,
          expiresAt: saved.expiresAt, question: question.text,
          options: refs.map(r => ({ choiceId: r.choiceId, label: r.label, detail: r.detail })) });
      }
      dep.onResult?.(intent, result);
      produced.add(result);
      return result;
    };
    const questionResult = async (state: ResolverResult['state'], answer: string, candidates: Candidate[] = [], fallback?: ResolverResult['question']) => {
      const canClarify = clarifications < RESOLVER_LIMITS.clarificationTurns;
      const question = fallback ?? discriminator(candidates, intent);
      const result = { ...base(state, answer), canClarify, question };
      if(state==='candidates' && (coverage.failed.length||coverage.truncated.length))result.answer += ' Some sources were incomplete; these are plausible matches, not a complete list.';
      result.answer += canClarify ? ` ${candidates.length ? 'Choose a matching record below, or send me more information. ' : ''}${question.text}` : ' I still cannot identify it reliably. Start a fresh request with its exact name or number and where it belongs; no substitute was selected.';
      if (!canClarify) result.state = coverage.failed.length ? 'read_failed' : 'not_found';
      return await finish(result, canClarify ? candidates : [], canClarify ? 'pending' : 'closed');
    };
    async function read(plan: QueryPlan): Promise<RetrievalResult> {
      checkOuter();
      // Only failed-to-match DISCOVERY can reuse this below. Identity/fact rereads
      // always execute again and therefore still observe deletion/price changes.
      if (coverage.reads >= RESOLVER_LIMITS.reads || budget.signal.aborted) throw new RetrievalError('too_broad','The bounded discovery budget was reached. Narrow the record type, parent or name.');
      coverage.reads++;
      if (!coverage.searched.includes(plan.source)) coverage.searched.push(plan.source);
      const controller = new AbortController();
      const abort = () => controller.abort();
      budget.signal.addEventListener('abort', abort, { once: true });
      const deadline = setTimeout(abort, RESOLVER_LIMITS.queryMs);
      try {
        const result = await dep.lookup(plan, controller.signal);
        checkOuter();
        if (controller.signal.aborted) throw new RetrievalError('too_broad','This source exceeded its bounded read time.');
        if (!available(result)) {
          if (!coverage.failed.includes(plan.source)) coverage.failed.push(plan.source);
        } else if (!result.complete || result.truncated) {
          if (!coverage.truncated.includes(plan.source)) coverage.truncated.push(plan.source);
        }
        readCache.set(stableArguments(plan), result);
        return result;
      } catch (error) {
        checkOuter();
        if (error instanceof AssistantV2Error && error.code !== 'turn_timeout') throw error;
        if (controller.signal.aborted || error instanceof RetrievalError) {
          if (!coverage.failed.includes(plan.source)) coverage.failed.push(plan.source);
          const code = error instanceof RetrievalError ? error.code : 'too_broad';
          return { state: code, code, source: plan.source, mode: 'none', rows: [], complete: false, truncated: false, asOf: null, scope: 'Read incomplete.', warnings: [], answer: error instanceof Error ? error.message : 'Read failed.' };
        }
        throw error;
      } finally { clearTimeout(deadline); budget.signal.removeEventListener('abort', abort); }
    }
    async function parallel<T>(items: T[], work: (item: T) => Promise<Candidate[]>): Promise<Candidate[]> {
      let index = 0;
      const result: Candidate[][] = new Array(items.length);
      const workers = Array.from({ length: Math.min(items.length, RESOLVER_LIMITS.concurrency) }, async () => {
        while (index < items.length) { const i = index++; result[i] = await work(items[i]); }
      });
      try { await Promise.all(workers); } catch (error) { budget.abort(); await Promise.allSettled(workers); throw error; }
      return result.flat();
    }
    const resultCandidates = (result: RetrievalResult, context: ResolverIntent, stage: 'parent'|'entity' = 'entity') => available(result)
      ? result.rows.map(row => makeCandidate(result.source, row, context, uuid(), stage)).filter((c): c is Candidate => !!c && !rejected.includes(c.key)) : [];
    const incomplete = () => !!(coverage.failed.length || coverage.truncated.length);

    const sourceContext = (source:string, context:ResolverIntent):ResolverIntent => orderParentIds && ['order_lines','order_text_lines'].includes(source)
      ? {...context,period:undefined,customer:undefined,job:undefined} : context;
    const orderScoped = (plan:QueryPlan):QueryPlan => orderParentIds && ['order_lines','order_text_lines'].includes(plan.source)
      ? compileIntelligentPlan({...plan,filters:[...plan.filters,{field:'order_id',op:'in',value:orderParentIds}]},dep.access.permissions).plan : plan;
    async function prepareOrderScope():Promise<ResolverResult|null>{
      if(intent.period?.basis!=='ordered' || !sourcesFor(intent,visible,parentSelector).some(s=>['order_lines','order_text_lines'].includes(s)))return null;
      // Registered line readers have no order_date or customer fields. First
      // resolve the bounded authoritative parent population, then restrict BOTH
      // line representations to those IDs. Never replace order_date with updated_at.
      const q=qualifiers('orders',intent);
      if(parentId)q.filters.push({field:'id',op:'eq',value:parentId});
      const r=await read(compileIntelligentPlan({version:1,source:'orders',mode:'rows',fields:['id'],...q,limit:10,resolve:false},dep.access.permissions).plan);
      if(!available(r)||!r.complete||r.truncated)return await questionResult('too_broad','I cannot safely scan an incomplete set of orders for that date range.',[],{key:'parent',text:'Which order number, job or supplier should narrow this search?'});
      orderParentIds=r.rows.map(row=>String(row.id??row._row_id)).filter(isUuid);
      if(!orderParentIds.length)return await questionResult('no_meaningful_match','No permitted orders matched those date and customer/job constraints.',[],{key:'date',text:'Was it a different week or month?'});
      return null;
    }
    async function reread(ref: CandidateRef, context: ResolverIntent, facts: boolean): Promise<{ result: RetrievalResult; candidate: Candidate } | null> {
      const result = await read(orderScoped(rereadQuery(ref, sourceContext(ref.source, context), dep.access.permissions, facts)));
      if (!available(result) || (!result.complete && !facts) || result.truncated || result.rows.length !== 1) return null;
      const row = result.rows[0];
      // Membership and all user constraints were applied by the same scoped RPC.
      const candidate = makeCandidate(ref.source, row, { ...context, id: ref.id, query: undefined }, ref.choiceId, ref.stage);
      if (!candidate || candidate.key !== ref.key || !sameNames(candidate.names, ref.names)) return null;
      return { result, candidate };
    }
    async function bindParent(): Promise<ResolverResult | null> {
      if (!parentSelector) return null;
      // The shared quote URL can contain a draft. Page context is not a status
      // authority: retain both permitted quote sections until the scoped read.
      if(parentSelector.current && parentSelector.domain==='quotes'){parentSelector={...parentSelector,quoteScope:'all_permitted'};intent={...intent,parent:parentSelector};}
      const source = parentSelector.domain === 'drafts' ? 'quotes' : parentSelector.domain;
      if (!visible.includes(source)) return await questionResult('permission_denied','The requested parent is outside the assistant’s permitted sources. No other parent was substituted.', [], { key:'domain', text:'Which permitted record should I use instead?' });
      let result = await read(parentQuery(parentSelector, dep.access.permissions));
      if (!available(result)) return await questionResult(result.state === 'feature_disabled' ? 'feature_disabled' : 'read_failed', result.answer);
      const context = identityIntent(parentSelector);
      let candidates = resultCandidates(result, context, 'parent');
      if (!candidates.length && parentSelector.text && !incomplete()) {
        coverage.broadened = true;
        const plan = parentQuery(parentSelector, dep.access.permissions);
        if (plan.search) plan.search = { ...plan.search, match:'natural' };
        result = await read(plan); candidates = resultCandidates(result, context, 'parent');
      }
      const selected = chooseCandidates(candidates, incomplete());
      if (selected.state !== 'resolved') {
        const answer = selected.state === 'candidates' ? 'I found plausible parent records, but I need your selection before looking inside one.'
          : !candidates.length ? 'I could not identify the requested parent in the permitted data. I did not substitute another quote, order or invoice.'
            : 'Several parent records are equally plausible; I will not choose arbitrary ones.';
        return await questionResult(selected.state === 'candidates' ? 'candidates' : 'needs_discriminator', answer, selected.state === 'candidates' ? selected.candidates : [], { key: parentSelector.number ? 'name' : 'customer', text: parentSelector.number ? 'Please check the exact number, or give the record name and type.' : 'Which customer or exact record number distinguishes it?' });
      }
      parentId = selected.candidates[0].id;
      if (!isUuid(parentId)) throw new RetrievalError('read_failed','The parent has no valid authoritative identity.');
      return null;
    }
    async function showResolved(candidate: Candidate): Promise<ResolverResult> {
      let current = await reread(candidate, intent, true);
      if (!current && ['cost','charge'].includes(intent.task)) {
        const identity = await reread(candidate, intent, false);
        if (identity) current = { ...identity, result: { ...identity.result, complete: false, warnings: [...identity.result.warnings, 'The authoritative price read was unavailable or incomplete. No price is inferred.'] } };
      }
      if (!current) return await questionResult(coverage.failed.length ? 'read_failed' : 'no_meaningful_match','That record is no longer available under the same identity and constraints. No replacement was selected.');
      candidate = current.candidate;
      if (parentId && candidate.parentId !== parentId) throw new RetrievalError('read_failed','The child is no longer linked to the selected parent. No proposal was prepared.');
      if (intent.task === 'propose_component') {
        if (!dep.propose || !intent.proposal || candidate.source !== 'quote_components' || !isUuid(candidate.parentId)) {
          return await finish(base('feature_disabled','This assistant cannot prepare that component edit in the current phase/permission setup. Nothing was applied.'));
        }
        await dep.guard();
        const action = await dep.propose({ component_id: candidate.id, ...intent.proposal }, candidate.parentId);
        const refused = !isRecord(action) || !isRecord(action.action);
        const answer = refused ? `${isRecord(action) && typeof action.error === 'string' ? action.error : 'The existing P3 domain guard refused this proposal.'} Nothing was applied.`
          : 'The component and its parent are verified. I prepared the change for review; it is not applied. Use the proposal card’s Confirm button to approve it.';
        const result = { ...base(refused ? 'proposal_refused' : 'resolved', answer), selected: { source:candidate.source,id:candidate.id,parentId:candidate.parentId }, proposalPrepared: !refused };
        return await finish(result, [], 'resolved');
      }
      const selectedDate = intent.selection ? candidate.row.created_at : undefined;
      const answer = formatFacts(candidate, intent, current.result)
        + (intent.selection ? `\n${intent.selection==='latest'?'Newest':'Earliest'} by creation date${typeof selectedDate==='string'?`: ${selectedDate.slice(0,10)}`:''}.` : '');
      const result: ResolverResult = { ...base('resolved', answer), selected: {source:candidate.source,id:candidate.id,...(candidate.parentId?{parentId:candidate.parentId}:{})} };
      await dep.guard();
      const target = targetForRow(candidate.row, candidate.source, true);
      if (target) result.cardId = await dep.emit(sectionsFor(intent,[candidate.source]), { kind:'records',title:candidate.label,
        options:[{...target,label:candidate.label,detail:candidate.detail}], note:'Opening a record does not approve a change. Your conversation stays available.',autoOpen:intent.task==='open' });
      return await finish(result, [], 'resolved');
    }
    async function showList(candidates: Candidate[]): Promise<ResolverResult> {
      const list = [...new Map(candidates.map(c=>[c.key,c])).values()].slice(0,RESOLVER_LIMITS.rowsPerSource);
      const lines: string[] = [];
      for (const c of list) {
        lines.push(c.label);
        for (const kind of intent.include ?? []) {
          if (!visible.includes(kind)) { lines.push(`  ${kind}: hidden or unavailable; not treated as zero.`); continue; }
          const plan = compileIntelligentPlan({version:1,source:kind,mode:'rows',fields:identityFields(kind,dep.access.permissions),related:[{relation:'quote',filters:[{field:'id',op:'eq',value:c.id}]}],limit:5},dep.access.permissions).plan;
          const related = await read(plan);
          if (!available(related)) lines.push(`  ${kind}: read did not complete.`);
          else if (!related.rows.length) lines.push(`  ${kind}: no permitted linked records found.`);
          else lines.push(`  ${kind}: ` + related.rows.map(row=>`${row.order_number ?? row.invoice_number ?? 'record'} - ${row.status ?? 'status unavailable'}`).join('; ') + (related.truncated?' (more matches exist)':''));
        }
      }
      const result = base('resolved', `${lines.join('\n')}\n${intent.nameOrContents?'Matches may be by record name or by a contained component. ':''}${incomplete() || candidates.length>list.length ? 'This is a bounded list, not a complete account total or ranking.' : 'Matched within your permitted data.'}\nNot these? Give a customer, job, or component detail to narrow this list.`);
      const options = [...new Map(list.flatMap(c=>{const target=targetForRow(c.row,c.source,true);return target?[[targetKey(target),{...target,label:c.label,detail:c.detail}] as const]:[];})).values()];
      await dep.guard();
      if(options.length)result.cardId=await dep.emit(sectionsFor(intent,list.map(c=>c.source)),{kind:'records',title:'Matching records',options,note:'Matching records, not an inferred ranking. Opening does not approve a change.',autoOpen:false});
      return await finish(result,[], 'resolved');
    }
    try {
      checkOuter();
      if (clicked && clicked.stage === 'parent') {
        const p = intent.parent;
        if (!p) return await questionResult('expired','That parent selection no longer corresponds to this request.');
        const current = await reread(clicked, identityIntent(p), false);
        if (!current) return await questionResult('expired','The parent changed or is no longer available. Please identify it again.');
        parentSelector = { domain:p.domain, id:clicked.id, ...(p.quoteScope?{quoteScope:p.quoteScope}:{}), ...(p.customer?{customer:p.customer}:{}), ...(p.job?{job:p.job}:{}) };
        intent = { ...intent, parent:parentSelector }; parentId=clicked.id;
        clicked=undefined;
      }
      if (!useful && previous) return await questionResult('needs_discriminator',rejection?'Those candidates are excluded from the next search.':'I still need one distinguishing clue; I have not guessed a replacement.',[],previous.state.question);
      if (!parentId) { const stopped=await bindParent(); if(stopped)return stopped; }
      { const stopped=await prepareOrderScope(); if(stopped)return stopped; }
      if (clicked) {
        if (rejected.includes(clicked.key)) return await questionResult('expired','That candidate was already rejected. Please identify the record again.');
        const current = await reread(clicked,intent,false);
        if(!current)return await questionResult('expired','That selection expired, changed, or is no longer available under the same constraints.');
        return await showResolved(current.candidate);
      }
      // Revalidate a COMPLETE prior candidate universe before another broad scan.
      // Changed query/parent/scope or an incomplete prior population cannot use
      // this shortcut. Cached labels never stand in for current authoritative rows.
      if(previous && previous.state.candidateSetComplete && !rejection && priorIsSubset(previous.state.intent,intent) && previous.state.candidates.every(c=>c.stage==='entity')) {
        const allowed=sourcesFor(intent,visible,parentSelector);
        const refs=previous.state.candidates.filter(c=>!rejected.includes(c.key)&&allowed.includes(c.source as ResolverSource)&&(!parentId||c.parentId===parentId));
        const matches=await parallel(refs,async ref=>{
          try { const got=await reread(ref,intent,false);return got?[got.candidate]:[]; }
          catch(e){if(e instanceof RetrievalError&&e.code==='unsupported_field')return [];throw e;}
        });
        if(matches.length)return await decide(matches);
      }
      // Current page is a first-pass hint only for genuinely unspecified scope.
      // Explicit IDs/parents always outrank it. It never grants access.
      if (!intent.parent && !intent.id && !intent.number && ['any','components'].includes(intent.domain) && intent.query && !intent.customer && !intent.job && !intent.period) {
        const hint = currentParent(await dep.current());
        if(hint){
          const scoped={...intent,parent:hint};
          const names=sourcesFor(scoped,visible,hint);
          const found=await parallel(names,async source=>resultCandidates(await read(discoveryQuery(source,scoped,dep.access.permissions,hint.id)),scoped));
          if(found.length){intent=scoped;parentId=hint.id;parentSelector=hint;return await decide(found);}
          // Failed current-context reads cannot establish a safe broad winner.
          if(coverage.failed.length)return await questionResult('read_failed','The current record could not be checked. I have not substituted a match from elsewhere.');
        }
      }
      return await discover();
    } catch (error) {
      if (error instanceof RetrievalError && !persisted) {
        const state = error.code === 'permission_denied' ? 'permission_denied' : error.code === 'feature_disabled' ? 'feature_disabled' : error.code === 'setup_required' ? 'setup_required' : error.code === 'too_broad' ? 'too_broad' : 'read_failed';
        // A missing state RPC cannot be used to store a second error. Return a
        // plain accurate failure; old candidate buttons remain unusable server-side.
        if(state==='setup_required'){const r=base(state,error.message);produced.add(r);return r;}
        return await questionResult(state,error.message);
      }
      throw error;
    } finally {
      clearTimeout(timer); budget.abort(); signal?.removeEventListener('abort',stop);
      try { dep.report?.({event:'sa_entity_resolution',version:1,runId:dep.runId,reads:coverage.reads,sources:coverage.searched,failedSources:coverage.failed,truncatedSources:coverage.truncated,skippedSources:coverage.skipped,broadened:coverage.broadened,clarifications,totalMs:Math.round(performance.now()-start)}); } catch { /* telemetry cannot change the outcome */ }
    }

    async function decide(candidates: Candidate[]): Promise<ResolverResult> {
      candidateSetComplete = !incomplete() && new Set(candidates.map(c=>c.key)).size <= RESOLVER_LIMITS.candidates;
      if(intent.list && candidates.length)return await showList(candidates);
      // A sorted, filtered header lookup already specifies which row. A display
      // limit is not ambiguity. Read errors still prevent a claim of selection.
      if (intent.selection && candidates.length && !coverage.failed.length) return await showResolved(candidates[0]);
      const selected=chooseCandidates(candidates,incomplete());
      if(selected.state==='resolved')return await showResolved(selected.candidates[0]);
      if(selected.state==='candidates')return await questionResult('candidates','These have positive matching evidence. Is one of them what you meant?',selected.candidates);
      if(selected.state==='needs_discriminator')return await questionResult('needs_discriminator','There are too many equally plausible matches to offer an arbitrary few.',[],discriminator(candidates,intent));
      return await questionResult(coverage.failed.length?'read_failed':'no_meaningful_match',coverage.failed.length
        ? 'Some permitted sources did not finish, so I cannot claim the item does not exist.'
        : 'I have not found a genuinely relevant match in the sources searched. I will not offer unrelated substitutes.');
    }
    async function discover(): Promise<ResolverResult> {
      const names=sourcesFor(intent,visible,parentSelector);
      if(!names.length)return await questionResult('permission_denied','The requested scope has no permitted entity sources in this configuration. This is not proof that the record is absent.');
      const readSource=async(source:ResolverSource,match:'words'|'natural'):Promise<Candidate[]>=>{
        try {
          const plan=orderScoped(discoveryQuery(source,sourceContext(source,intent),dep.access.permissions,parentId,match));
          const key=stableArguments(plan);
          // A parent/component-only query has no text match mode to broaden.
          // Repeating it cannot find new data. Only discovery (never the final
          // authoritative reread) may reuse a same-run result.
          const cached=readCache.get(key);
          if(cached)return resultCandidates(cached,intent);
          if(match==='natural')coverage.broadened=true;
          return resultCandidates(await read(plan),intent);
        }
        catch(error){if(error instanceof RetrievalError&&['unsupported_field','permission_denied'].includes(error.code)){coverage.skipped.push(source);return [];}throw error;}
      };
      let candidates=await parallel(names,source=>readSource(source,'words'));
      if(intent.nameOrContents){
        const named={...intent,query:intent.contains,contains:undefined,nameOrContents:undefined};
        const result=await read(discoveryQuery('quotes',named,dep.access.permissions));
        candidates.push(...resultCandidates(result,named));
      }
      // Only the explicitly ambiguous colloquial form "latest Smith quote"
      // can try a job/name interpretation after a COMPLETE empty customer read.
      // "quote for Smith" is an explicit customer constraint and never widens.
      if(!candidates.length&&!incomplete()&&intent.customerOrName&&intent.customer){
        const clue=intent.customer;
        intent={...intent,query:clue}; delete intent.customer; delete intent.customerOrName;
        coverage.broadened=true;
        candidates=await parallel(names,source=>readSource(source,'words'));
      }
      if(!candidates.length&&!incomplete()&&!intent.id&&!intent.number){
        // Natural fuzzy ranking on a 100k catalogue is not a cheap broadening.
        // Ask for a spelling/catalogue clue rather than launch an unindexed scan.
        candidates=await parallel(names.filter(n=>!['catalogue_rows','catalogues'].includes(n)),source=>readSource(source,'natural'));
      }
      if(!coverage.searched.length)return await questionResult('needs_discriminator','The supplied constraints cannot yet be combined for these source types without identifying their parent. None of those constraints was dropped.',[],{key:'parent',text:'Which quote, order or invoice did it belong to? A name or number is enough.'});
      return await decide(candidates);
    }
  }

  async function start(intent: ResolverIntent, signal?: AbortSignal, previous?: StoredResolution, clicked?: CandidateRef, rejection=false, useful=true): Promise<ResolverResult> {
    // Single outcome per admitted run prevents competing calls from changing the
    // server-stored choice set after a user-facing question has been produced.
    const key=JSON.stringify({intent,previous:previous?.id,clicked:clicked?.key,rejection,useful});
    if(outcome && outcomeKey!==key)throw new RetrievalError('invalid_query','One entity-resolution continuation is allowed per turn. No second selection or proposal was prepared; finish or clarify the current request first.');
    outcomeKey=key;
    return outcome ??= run(intent,signal,previous,clicked,rejection,useful);
  }
  async function choose(choice: ResolutionChoice, signal?: AbortSignal): Promise<ResolverResult> {
    const saved=await dep.store.load(choice.stateId,signal);
    if(!saved || saved.id!==choice.stateId || saved.state.status!=='pending' || Date.parse(saved.expiresAt)<=now().getTime()) {
      const result:ResolverResult={state:'expired',answer:'Those choices are no longer current. Please repeat the record or item you need; nothing was selected or applied.',candidates:[],canClarify:false,coverage:emptyCoverage(),applied:false};produced.add(result);return result;
    }
    if(choice.choice==='cancel') {
      await dep.guard();
      await dep.store.save({...saved.state,status:'closed',candidates:[],previousStateId:saved.id},readable,signal);
      const result:ResolverResult={state:'cancelled',answer:'Search cancelled. Nothing was changed.',candidates:[],canClarify:false,coverage:emptyCoverage(),applied:false};produced.add(result);return result;
    }
    if(choice.choice==='none')return start(saved.state.intent,signal,saved,undefined,true,false);
    const ref=saved.state.candidates.find(c=>c.choiceId===choice.choice);
    if(!ref){const result:ResolverResult={state:'expired',answer:'That choice does not belong to the current request. Please ask again; nothing was selected.',candidates:[],canClarify:false,coverage:emptyCoverage(),applied:false};produced.add(result);return result;}
    return start(saved.state.intent,signal,saved,ref);
  }
  const api={
    terminal(value:unknown):string|null{return isRecord(value)&&produced.has(value)&&typeof value.answer==='string'?value.answer:null;},
    execute(intent:ResolverIntent,signal?:AbortSignal){
      if(dep.taskTurn && ['continue','correct'].includes(dep.taskTurn.decision.disposition) && dep.taskTurn.previous?.state.status==='pending')
        throw new RetrievalError('invalid_query','This is a continuation of the current task. Use refinement to preserve its operation and qualifiers, or query_workspace for the requested scoped data. Do not start an unrelated entity search.');
      return start(constrainIntent(intent,extractAnchors(dep.userMessage)),signal);
    },
    async pendingContext(signal?:AbortSignal){
      if (dep.taskTurn && !['continue','correct'].includes(dep.taskTurn.decision.disposition)) return null;
      const saved=await loadPrevious(signal);
      if(!saved||(saved.state.status!=='pending' && !(dep.taskTurn?.decision.disposition==='correct' && saved.state.status==='resolved'))||Date.parse(saved.expiresAt)<=now().getTime())return null;
      return {intent:saved.state.intent,question:saved.state.question,clarifications:saved.state.clarifications,candidates:saved.state.candidates.map(c=>({label:c.label,detail:c.detail})),rejectedCount:saved.state.rejected.length};
    },
    async refine(raw:unknown,signal?:AbortSignal){
      if (dep.taskTurn && !['continue','correct'].includes(dep.taskTurn.decision.disposition)) throw new RetrievalError('invalid_query','This is a new task. Do not reuse the previous search; use a fresh request.');
      const saved=await loadPrevious(signal);
      if(!saved || (saved.state.status!=='pending' && !(dep.taskTurn?.decision.disposition==='correct' && saved.state.status==='resolved')) || Date.parse(saved.expiresAt)<=now().getTime())throw new RetrievalError('invalid_query','There is no current clarification to resume. Use a new request.');
      const parsed=mergeRefinement(saved.state,raw,dep.userMessage);
      return start(parsed.intent,signal,saved,undefined,parsed.rejectShown,parsed.useful);
    },
    async tryTurn(signal?:AbortSignal):Promise<ResolverResult|null>{
      const choice=decodeResolutionChoice(dep.userMessage);if(choice)return choose(choice,signal);
      if (dep.taskTurn) {
        const {decision, previous} = dep.taskTurn;
        if (decision.disposition === 'new') return decision.parsed ? api.execute(decision.parsed,signal) : null;
        if (!['continue','correct'].includes(decision.disposition)) return null;
        if (!previous || Date.parse(previous.expiresAt)<=now().getTime()) return null;
        const refinement=decision.refinement;
        // Unknown wording is interpreted in the existing first model step. No
        // fabricated no-match and no consumed clarification budget.
        if (!refinement) return null;
        if ('cancel' in refinement) return choose({version:1,stateId:previous.id,choice:'cancel'},signal);
        if ('choiceIndex' in refinement) {
          const ref=previous.state.candidates[refinement.choiceIndex];
          return ref ? choose({version:1,stateId:previous.id,choice:ref.choiceId},signal) : null;
        }
        return start(refinement.intent,signal,previous,undefined,refinement.rejectShown,refinement.useful);
      }
      const parsed=requestFromText(dep.userMessage,now());if(parsed)return api.execute(parsed,signal);
      if(dep.userMessage.length>240 || /^(?:please\s+)?(?:what|how|why|show|open|find|set|change|send|delete|compare|could|can|would|tell)\b/i.test(dep.userMessage.trim()))return null;
      const saved=await loadPrevious(signal);
      if(!saved||saved.state.status!=='pending'||Date.parse(saved.expiresAt)<=now().getTime())return null;
      const refinement=refineRequest(saved.state,dep.userMessage,now());if(!refinement)return null;
      if('cancel' in refinement)return choose({version:1,stateId:saved.id,choice:'cancel'},signal);
      if('choiceIndex' in refinement){const ref=saved.state.candidates[refinement.choiceIndex];return ref?choose({version:1,stateId:saved.id,choice:ref.choiceId},signal):start(saved.state.intent,signal,saved,undefined,false,false);}
      return start(refinement.intent,signal,saved,undefined,refinement.rejectShown,refinement.useful);
    },
  };
  return api;
}

/** Stored figures stay labelled by their domain meaning. No arithmetic, inferred
 * taxes/units or internal costs presented as a customer selling price. */
export function formatFacts(candidate:Candidate,intent:ResolverIntent,result:RetrievalResult):string {
  const row=candidate.row;
  if(!['cost','charge'].includes(intent.task))return `Found ${candidate.label}. ${candidate.detail}`;
  const currency=typeof row.currency==='string'?row.currency:'currency not recorded';
  const unit=typeof row.unit==='string'?row.unit:'unit not recorded';
  const pricedUnit=typeof row.pricing_unit==='string' ? row.pricing_unit : unit;
  const facts:[string,string,boolean][] = candidate.source==='quote_components'
    ? [['material_rate',`Material rate (${currency}/${pricedUnit})`,true],['labour_rate',`Labour rate (${currency}/${pricedUnit})`,true],['material_cost',`Stored material cost before quote margins/taxes (${currency})`,true],['labour_cost',`Stored labour cost before quote margins/taxes (${currency})`,true]]
    : candidate.source==='component_library' ? [['default_material_rate',`Library material rate (${currency}/${unit})`,true],['default_labour_rate',`Library labour rate (${currency}/${unit})`,true],['pricing_strategy','Pricing strategy',false],['pack_size','Pack size',false],['pack_price',`Pack price (${currency})`,true]]
    : candidate.source==='customer_quote_lines' ? [['amount',`Saved customer line amount (${currency})`,true],['unit_price',`Saved customer line unit price (${currency})`,true],['quantity_text','Saved quantity description',false],['is_visible','Shown to customer',false],['include_in_total','Included in saved quote total',false]]
    : candidate.source==='invoice_lines' ? [['unit_price',`Invoice unit price (${currency}/${unit})`,true],['line_total',`Invoice line total (${currency})`,true],['is_visible','Shown to customer',false],['include_in_total','Included in invoice total',false]]
    : candidate.source==='invoices' ? [['total',`Stored invoice total (${currency})`,true],['status','Invoice status',false],['paid_at','Recorded paid date',false]]
    : candidate.source==='quotes' ? [['customer_total',`Saved customer-facing quote total including tax (${currency})`,true]]
    : candidate.source==='order_text_lines' ? [['saved_amount','Saved order line amount (currency not recorded in this reader)',true],['saved_unit_price','Saved unit price (currency not recorded in this reader)',true]]
    : candidate.source==='catalogue_rows' ? [['mapped_price_text',`Imported catalogue price text (${currency}); not parsed or converted`,false]] : [];
  const lines=facts.filter(([field])=>row[field]!==null&&row[field]!==undefined).map(([field,label])=>`${label}: ${String(row[field]).slice(0,500)}`);
  if(!lines.length)return `${candidate.label}: I found the record, but this authoritative reader has no usable price for it. Missing prices are not zero. ${result.warnings.join(' ')}`;
  return `${candidate.label}\n${lines.join('\n')}${candidate.source==='quote_components'?'\nThese are internal component rates/costs, not the price charged to the customer.':''}${!result.complete?'\nThe authoritative calculation is incomplete; no complete total is claimed.':''}${result.warnings.length?'\n'+result.warnings.join(' '):''}`;
}

/** Only additive refinements may reuse a complete candidate universe. */
export function priorIsSubset(before:ResolverIntent, after:ResolverIntent):boolean {
  if(normalizeName(before.query??'')!==normalizeName(after.query??'') || before.contains!==after.contains || before.id!==after.id || before.number!==after.number)return false;
  if(before.parent && JSON.stringify(before.parent)!==JSON.stringify(after.parent))return false;
  if(before.domain!=='any' && before.domain!==after.domain)return false;
  if(before.current && !after.current)return false;
  if(before.customer && normalizeName(before.customer)!==normalizeName(after.customer??''))return false;
  if(before.job && normalizeName(before.job)!==normalizeName(after.job??''))return false;
  if(before.period && (!after.period || before.period.basis!==after.period.basis || before.period.from>after.period.from || before.period.to<after.period.to))return false;
  return true;
}
