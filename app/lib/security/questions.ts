/**
 * Curated list of suggested security questions, plus a "Custom" sentinel.
 *
 * Why curate: a free-form question creates two failure modes — users picking
 * questions whose answers can be Googled (DOB, mother's maiden name on social
 * media), and support staff getting answers in a hundred different shapes.
 * The curated list keeps support's verification workflow predictable and
 * pushes users toward questions whose answers are unlikely to be public.
 */

export const SUGGESTED_QUESTIONS: readonly string[] = [
  'What was the name of your first pet?',
  'What was the make of your first vehicle?',
  'What was your childhood nickname?',
  'What primary school did you attend?',
  'What is the name of the street you grew up on?',
  "What was your favourite teacher's surname?",
  'What is the first concert you ever attended?',
  'What was the name of your first manager at work?',
] as const;

export const CUSTOM_QUESTION_LABEL = 'Write my own…';

/**
 * Number of question slots a user can fill. Two is the standard minimum that
 * still gives support enough confidence on a recovery call. We wired the
 * schema for up to 5 in case we ever want to expand.
 */
export const QUESTION_SLOTS = 2;

/**
 * Normalise an answer before hashing or comparing.
 * - lowercased to remove case sensitivity
 * - whitespace collapsed and trimmed (handles trailing-space typos)
 * - punctuation passed through (rare but legitimate, e.g. "St. Mary's")
 */
export function normaliseAnswer(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, ' ').trim();
}
