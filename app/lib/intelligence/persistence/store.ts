import type { DocumentRun } from '../documents/worker';
import type { JobScope } from '../contracts/evidence';
import type { AgentPolicy } from '../contracts/policy';
import type { Task } from '../contracts/tasks';
import type { JobBrief, JobFact, JobIssue } from '../contracts/brief';
import type { MemoryRecord } from '../contracts/memory';
import type { AuthoritySnapshot } from '../policy/admission';
import type { ApprovalReceipt, ActionBinding } from '../policy/approval';

export type Actor = { id: string; kind: 'user' | 'worker' };
export type Reservation = { id: string; taskId: string; fence: number; amount: number; actual: number | null; state: 'held' | 'settled' };
export type Upload = { id: string; bytes: number; state: 'reserved' | 'finalized' | 'abandoned'; expiresAtMs: number; revisionId?: string };
export type Audit = { actorId: string; atMs: number; event: string; target: string };
/** Private review history, not operational telemetry; retention and storage require integration approval. */
export type RoofingReviewHistory = { actorId:string; atMs:number; briefRevision:number; reason:string; previous:JobFact|JobIssue|JobBrief['selectedPages'] };
export type JobState = { scope: JobScope; revision: number; inputHash: string; tasks: Task[]; reservations: Reservation[]; uploads: Upload[]; brief?: JobBrief; roofingReviewHistory?: RoofingReviewHistory[]; documentRun?: DocumentRun; approvals: ApprovalReceipt[]; outbox: ActionBinding[]; audit: Audit[] };
export type CompanyState = { policy: AgentPolicy; enabled: boolean; memory: MemoryRecord[]; jobs: JobState[] };
export type Transaction = { company: CompanyState; job: JobState; authority: AuthoritySnapshot; canControl: boolean; canReview: boolean; nowMs: number; approverAuthorized(id: string): boolean };
/** Server-only port. Implementations MUST authenticate actor, authorize canonical scope,
 * lock company budget and job together, load fresh permissions and trusted time,
 * commit atomically or roll back all writes, and never expose this state to clients.
 * Callbacks are synchronous, contain no external side effects and may be retried.
 * No implementation is registered in the application until reviewed integration. */
export interface IntelligenceStore {
  transact<T>(scope: JobScope, actor: Actor, fn: (tx: Transaction) => T): Promise<T>;
}
