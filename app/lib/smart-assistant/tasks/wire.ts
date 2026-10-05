import { isUuid } from '../v2/contracts';
/** Only a server-stored pending message may be resumed by this protocol. */
export const TASK_PREFIX = '[[sa-task:v1:';
export type TaskChoice = {
    taskId: string;
    version: number;
    choice: 'continue' | 'new';
};
export function encodeTaskChoice(value: TaskChoice): string {
    if (!isUuid(value.taskId) || !Number.isSafeInteger(value.version) || value.version < 1 || !['continue', 'new'].includes(value.choice))
        throw new Error('Invalid task choice');
    return `${TASK_PREFIX}${value.taskId}:${value.version}:${value.choice}]]`;
}
export function isTaskMessage(message: string): boolean { return message.trimStart().toLowerCase().startsWith('[[sa-task:'); }
export function decodeTaskChoice(message: string): TaskChoice | null {
    const m = /^\[\[sa-task:v1:([0-9a-f-]{36}):([1-9]\d{0,9}):(continue|new)\]\]$/i.exec(message);
    return m && isUuid(m[1]) ? { taskId: m[1], version: Number(m[2]), choice: m[3].toLowerCase() as TaskChoice['choice'] } : null;
}
export function displayTaskMessage(message: string): string {
    const choice = decodeTaskChoice(message);
    return choice ? choice.choice === 'new' ? 'Use my message as a new question.' : 'Use my message for the previous task.'
        : isTaskMessage(message) ? 'That task choice is no longer available.' : message;
}
