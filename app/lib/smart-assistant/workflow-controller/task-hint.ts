import type { TaskSnapshot } from '../tasks/contracts';
import type { TaskDecision } from '../tasks/boundary';
export type WorkflowTaskHint = { startRunId: string | null; lastRunId: string | null; areaLabels: string[]; state: string };
/** Unconfirmed drafts stay bound to their live task. A committed quote-bound
 * draft may inform an explicit later correction as a NEW task. A clear unrelated
 * request still escapes. This never confirms or changes a quote. */
export function applyWorkflowTaskHint(message: string, snapshot: TaskSnapshot, decision: TaskDecision, hint?: WorkflowTaskHint | null, now = new Date()): TaskDecision {
  if (!hint || ['closed','cancelled','needs_review'].includes(hint.state)
    || decision.disposition === 'close' || ['explicit_new_task_prefix','boundary_choice_new'].includes(decision.reason)) return decision;
  const text = message.trim();
  if (/^(?:create|start|prepare|make|build)\s+(?:(?:a|another|the)\s+)?new\b|^new (?:job|quote|draft|task|question)\b/i.test(text)) return { disposition: 'new', reason: 'explicit_new_task_prefix', message };
  if (/^(?:show|open|find|list|search|how|what|when|where|who)\b/i.test(text)) return decision;
  // Owner 2026-10-05 (RS Roofing incident): "Yes use those" - a short answer to a
  // workflow product-choice question - arrived after the task snapshot had
  // expired, so decideTask returned 'new' (no_live_task) and the scope closed the
  // live needs_choices workflow, dead-ending the turn and every later prepare.
  // A workflow awaiting choices outranks a dead task snapshot for short
  // non-question fragments: keep the workflow and continue it. Self-contained
  // requests never reach here (blocked reasons above), so a genuinely new brief
  // still closes the workflow through the scope's own new-task path.
  const workflowAnswer = text.split(/\s+/).length <= 12 && !/[?]/.test(text)
    && !/\b(?:create|new|send|delete|invoice|order|quote number|customer|today|yesterday)\b/i.test(text);
  if (hint.state === 'needs_choices' && workflowAnswer && ['new','ask_boundary'].includes(decision.disposition)
    && ['no_live_task','previous_task_closed','ambiguous_fragment'].includes(decision.reason)) {
    return { disposition: 'continue', reason: 'active_working_brief_delta', message };
  }
  const task = snapshot.task;
  // Owner 2026-10-12/13: a CONFIRMED draft (state 'committed', quote-bound) stays
  // revisable across task boundaries. Do not resurrect a closed/expired task: a
  // later correction becomes a NEW conversational task that is explicitly marked
  // as a committed-workflow follow-up. Snapshot equality remains the mutation
  // safety boundary when the workflow is revised/confirmed.
  const committedDraft = hint.state === 'committed';
  const correction = /^(?:actually[, ]+|instead[, ]+|(?:(?:can|could|would)\s+(?:you|we)\s+|please\s+|i\s+(?:need|want)\s+(?:you\s+)?to\s+)?(?:change|add|remove|rename|set|use)\b|(?:(?:can|could|would)\s+(?:you|we)\s+|please\s+|i\s+(?:need|want)\s+(?:you\s+)?to\s+)?make (?:the|that|this)\b)/i.test(text);
  const areaCorrection = hint.areaLabels.some(label => text.toLowerCase().startsWith(label.toLowerCase() + ' ') && /\b(?:should be|is|make|change|pitch|degrees|square|area)\b/i.test(text));
  const taskOwnsWorkflow = !!task && task.status !== 'closed' && Date.parse(task.expiresAt) > now.getTime()
    && snapshot.runIds.some(id => id === hint.startRunId || id === hint.lastRunId);
  if (committedDraft && (correction || areaCorrection)) {
    if (!taskOwnsWorkflow) return { disposition: 'new', reason: 'committed_workflow_followup', message };
    return { disposition: 'correct', reason: 'active_working_brief_delta', message };
  }
  if (decision.reason === 'self_contained_request') return decision;
  if (!committedDraft && !taskOwnsWorkflow) return decision;
  const choiceFragment = hint.state === 'needs_choices' && text.split(/\s+/).length <= 12 && !/[?]/.test(text)
    && !/\b(?:create|new|send|delete|invoice|order|quote number|customer|today|yesterday)\b/i.test(text);
  if (choiceFragment) return { disposition: 'continue', reason: 'active_working_brief_delta', message };
  return decision;
}
