/** Independent staged rollout, in addition to the existing resolver/retrieval gates. */
export function taskContextEnabled(): boolean {
    return process.env.SMART_ASSISTANT_TASK_CONTEXT_ENABLED === 'true'
        && process.env.SMART_ASSISTANT_RESOLVER_ENABLED === 'true';
}
