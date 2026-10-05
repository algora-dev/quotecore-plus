import type { TaskSnapshot } from '../tasks/contracts';
import type { TaskDecision } from '../tasks/boundary';
export type WorkflowTaskHint = { startRunId: string | null; lastRunId: string | null; areaLabels: string[]; state: string };
/** A draft may inform a turn only when it belongs to this live task. A clear
 * new request always escapes. This never confirms or changes a quote. */
export function applyWorkflowTaskHint(message: string, snapshot: TaskSnapshot, decision: TaskDecision, hint?: WorkflowTaskHint | null, now = new Date()): TaskDecision {
  if (!hint || ['closed','cancelled','needs_review'].includes(hint.state)
    || decision.disposition === 'close' || ['explicit_new_task_prefix','self_contained_request','boundary_choice_new'].includes(decision.reason)) return decision;
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
  if (!task || task.status === 'closed' || Date.parse(task.expiresAt) <= now.getTime()
    || !snapshot.runIds.some(id => id === hint.startRunId || id === hint.lastRunId)) return decision;
  const correction = /^(?:actually[, ]+|instead[, ]+|change\b|add\b|remove\b|rename\b|make (?:the|that|this)\b|set (?:the|that|this)\b|use\b)/i.test(text);
  const areaCorrection = hint.areaLabels.some(label => text.toLowerCase().startsWith(label.toLowerCase() + ' ') && /\b(?:should be|is|make|change|pitch|degrees|square|area)\b/i.test(text));
  const choiceFragment = hint.state === 'needs_choices' && text.split(/\s+/).length <= 12 && !/[?]/.test(text)
    && !/\b(?:create|new|send|delete|invoice|order|quote number|customer|today|yesterday)\b/i.test(text);
  if (correction || areaCorrection || choiceFragment) return { disposition: correction || areaCorrection ? 'correct' : 'continue', reason: 'active_working_brief_delta', message };
  return decision;
}
