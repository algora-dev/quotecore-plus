import { parseBrief, parseCandidates, type JobBrief } from '../contracts/brief';
import { evidenceIsCurrent } from '../contracts/evidence';
import { ensure } from '../contracts/validation';

/** Admit model proposals into an existing trusted brief, never into confirmed facts.
 * Evidence references must have been registered by the ingestion adapter first.
 * Future persistence must compare-and-swap the brief revision and authenticate the actor.
 */
export function appendCandidates(briefRaw:unknown,providerRaw:unknown,expectedRevision:number):JobBrief {
  const brief=parseBrief(briefRaw);const batch=parseCandidates(providerRaw);
  ensure(brief.revision===expectedRevision,'brief version');
  const current=new Set(brief.evidence.filter(e=>evidenceIsCurrent(e,brief.manifest)).map(e=>e.id));
  ensure([...batch.facts,...batch.issues].every(x=>x.evidenceIds.every(e=>current.has(e))),'candidate evidence not current');
  return parseBrief({...brief,revision:brief.revision+1,
    facts:[...brief.facts,...batch.facts.map(f=>({...f,version:1,state:'proposed'}))],
    issues:[...brief.issues,...batch.issues.map(i=>({...i,version:1,state:'open'}))]});
}
