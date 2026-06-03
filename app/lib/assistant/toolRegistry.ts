/**
 * AI Assistant — Tool Registry Scaffolding (Phase 0A)
 * ====================================================
 *
 * The STABLE tool contract the orchestrator exposes to the model (plan §3.1).
 * Phase 0A defines the registry SHAPE, the V1 tool ids, their JSON-schema
 * parameter definitions, and per-tool permission scopes. Handlers are wired in
 * Phases 1/3/4 — this file intentionally contains NO handler logic and makes
 * no network/DB calls.
 *
 * Two hard rules (Gerald review M-06 + plan §8 security model):
 *
 *  1. V1 tools are ALL read-only. `requiresWrite` is `false` for every live
 *     tool. The flag exists so future write-tools must opt in explicitly and
 *     can be gated on `serverPermissions.canWrite`.
 *
 *  2. FUTURE TOOLS ARE NOT REGISTERED HERE. Schedule / task / notification /
 *     account-summary / draft-action tools live only as a typed design list
 *     ({@link FUTURE_TOOL_IDS}) so they can never be accidentally wired into
 *     the live tool loop before they are implemented, permissioned, tested.
 */

// ---------------------------------------------------------------------------
// Tool ids
// ---------------------------------------------------------------------------

/** The ONLY tools the live V1 registry exposes. All read-only. */
export const V1_TOOL_IDS = [
  'search_help_docs',
  'get_current_context',
  'get_current_workflow',
  'get_current_step',
  'get_ui_element_details',
  'request_ui_highlight',
] as const;

export type V1ToolId = (typeof V1_TOOL_IDS)[number];

/**
 * Design-only future tools. NEVER added to the live registry until each is
 * implemented, permissioned and tested. Listed here purely so the shape is
 * documented and type-checked, not exposed.
 */
export const FUTURE_TOOL_IDS = [
  'get_schedule',
  'get_tasks',
  'get_notifications',
  'get_account_summary',
  'create_event_draft',
  'create_task_draft',
  'submit_user_action',
] as const;

export type FutureToolId = (typeof FUTURE_TOOL_IDS)[number];

// ---------------------------------------------------------------------------
// Tool definition shape
// ---------------------------------------------------------------------------

/** A minimal JSON-schema-ish parameter spec (provider-agnostic). */
export interface ToolParameterSchema {
  type: 'object';
  properties: Record<
    string,
    {
      type: 'string' | 'number' | 'boolean' | 'array' | 'object';
      description: string;
      enum?: readonly string[];
      items?: { type: string };
    }
  >;
  required?: string[];
}

export interface ToolDefinition {
  id: V1ToolId;
  description: string;
  parameters: ToolParameterSchema;
  /** True for tools that mutate state. ALWAYS false in V1. */
  requiresWrite: boolean;
  /**
   * Optional entitlement/feature scope required to call the tool. Undefined
   * means "any authenticated user". Reserved for future gated tools.
   */
  requiredFeature?: string;
}

// ---------------------------------------------------------------------------
// V1 registry (definitions only — handlers wired later)
// ---------------------------------------------------------------------------

export const V1_TOOLS: Record<V1ToolId, ToolDefinition> = {
  search_help_docs: {
    id: 'search_help_docs',
    description:
      'Semantic search over QuoteCore+ help documentation. Returns the most relevant doc chunks (title, slug, section, snippet) for a natural-language query. Summarise and contextualise the results; do not paste them verbatim.',
    requiresWrite: false,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural-language question.' },
        section: {
          type: 'string',
          description: 'Optional docs section id to scope the search.',
        },
        k: {
          type: 'number',
          description: 'Number of chunks to return (default 5).',
        },
      },
      required: ['query'],
    },
  },

  get_current_context: {
    id: 'get_current_context',
    description:
      'Return the SERVER-VALIDATED context for the current user: screen, server-verified selected entities, visible element ids, and server-computed permissions. Never trust client claims beyond what this returns.',
    requiresWrite: false,
    parameters: { type: 'object', properties: {} },
  },

  get_current_workflow: {
    id: 'get_current_workflow',
    description:
      'Return the workflow definition (steps, instructions, required element ids, completion events) for the current or named workflow, from the compiled workflow service.',
    requiresWrite: false,
    parameters: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description:
            'Optional workflow id; defaults to the current workflow from context.',
        },
      },
    },
  },

  get_current_step: {
    id: 'get_current_step',
    description:
      'Return the current step, its completion requirement, and the next valid step. The application decides progression; you only read and narrate it — never advance it yourself.',
    requiresWrite: false,
    parameters: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'Optional workflow id; defaults to current.',
        },
      },
    },
  },

  get_ui_element_details: {
    id: 'get_ui_element_details',
    description:
      'Return the label, role and description for a registry UI element id, so you can explain what a button/field/dropdown does.',
    requiresWrite: false,
    parameters: {
      type: 'object',
      properties: {
        elementId: {
          type: 'string',
          description: 'A UI Element Registry id (semantic, not a selector).',
        },
      },
      required: ['elementId'],
    },
  },

  request_ui_highlight: {
    id: 'request_ui_highlight',
    description:
      'Ask the client to visually highlight a UI element to guide the user. Provide a registry elementId (semantic, never a selector). The server validates it against the registry and the currently-visible element set.',
    requiresWrite: false,
    parameters: {
      type: 'object',
      properties: {
        elementId: {
          type: 'string',
          description: 'Registry element id to highlight.',
        },
        treatment: {
          type: 'string',
          description: 'Optional visual treatment.',
          enum: ['pulse', 'glow', 'spotlight', 'arrow'],
        },
        reason: {
          type: 'string',
          description: 'Short reason for the highlight (for accessibility/logging).',
        },
      },
      required: ['elementId'],
    },
  },
};

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

/** The live tool list handed to the model. V1 read-only tools only. */
export function getLiveToolDefinitions(): ToolDefinition[] {
  return V1_TOOL_IDS.map((id) => V1_TOOLS[id]);
}

export function isLiveToolId(id: string): id is V1ToolId {
  return (V1_TOOL_IDS as readonly string[]).includes(id);
}

/**
 * Defence-in-depth invariant: assert no write-capable or future tool can ever
 * leak into the live set. Call from a unit test (Phase 1) and/or at startup.
 */
export function assertRegistryReadOnly(): void {
  for (const def of getLiveToolDefinitions()) {
    if (def.requiresWrite) {
      throw new Error(
        `Assistant tool registry invariant violated: "${def.id}" requiresWrite in a read-only V1 registry.`
      );
    }
    if ((FUTURE_TOOL_IDS as readonly string[]).includes(def.id)) {
      throw new Error(
        `Assistant tool registry invariant violated: future tool "${def.id}" is registered live.`
      );
    }
  }
}
