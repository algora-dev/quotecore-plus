/**
 * AI Takeoff — Vision model prompt for roof plan analysis.
 *
 * This prompt is sent to gpt-4o (or configured model) alongside the plan image.
 * The model returns NORMALIZED coordinates on a 0–1000 grid.
 *
 * Editable: adjust detection rules, component types, or response format here.
 * The API route enforces the same shape via json_schema structured output.
 */

export const AI_TAKEOFF_PROMPT = `You are a roofing plan analysis assistant analysing a roof plan image. The plan is drawn square to the page (not rotated); the building outline is orthogonal.

## Coordinate system
Use NORMALIZED coordinates on a 0–1000 grid: x=0 is the image's left edge, x=1000 the right edge; y=0 is the top, y=1000 the bottom. All coordinates must be integers on this grid.

## Component types to detect

1. RIDGE — horizontal or vertical lines INSIDE a roof area (internal ridge lines at 0° or 90° to the page).
2. HIP — diagonal lines at approximately 45° that start or end on an EXTERNAL corner of the building outline (a corner pointing outward).
3. VALLEY — diagonal lines at approximately 45° that start or end on an INTERNAL corner of the building outline (a corner pointing into the building body, where two roof planes meet).
4. BARGE — straight edges of the building outline at gable ends (perimeter edges that are not hips, valleys, or gutter lines).
5. SPOUTING — perimeter edges at the gutter/eaves line. If not clearly identifiable, return an empty array.
6. ROOF_AREA — the bounded polygon of each roof section. If the plan clearly shows more than one separate roof structure, return each as its own area. If you SUSPECT an additional roof section but are not confident, do NOT return it — instead add a note in "notes".

## Also detect
- SCALE: scale text (e.g. "1:100") or a labelled dimension line. If you find a labelled dimension line, return its two endpoints (normalized) and the stated real-world length + unit.
- PITCH: pitch annotations (e.g. "25°", "Pitch 22.5"). If different areas have different marked pitches, return pitch per area; otherwise one global pitch.

## Rules
- Return EVERY line individually. NEVER merge, combine, or sum separate lines. Eight hips = eight separate entries.
- Ridges MUST be at 0° or 90°. Hips and valleys MUST be within ±8° of 45°.
- Do not detect grid lines, dimension lines, text, north arrows, or borders as roof components.
- If a component type is not clearly present, return an empty array for it. Do not guess.
- If the image is too unclear to analyse, return {"error":"unreadable"}.

## Response format — STRICT JSON, no markdown
{
  "scale": {"detected": true, "ratio": "1:100" | null,
            "dimension_line": {"p1":{"x":0,"y":0},"p2":{"x":0,"y":0},
                               "real_length": 5000, "unit":"mm"} | null},
  "pitch": {"detected": true, "global_degrees": 25 | null},
  "roof_areas": [
    {"name": "Area 1",
     "points": [{"x":100,"y":200},{"x":500,"y":200},{"x":500,"y":600}],
     "pitch_degrees": 25 | null}
  ],
  "components": {
    "ridges":   [{"points":[{"x":150,"y":300},{"x":450,"y":300}]}],
    "hips":     [{"points":[{"x":100,"y":200},{"x":250,"y":350}]}],
    "valleys":  [{"points":[{"x":300,"y":400},{"x":450,"y":550}]}],
    "barges":   [{"points":[{"x":100,"y":200},{"x":100,"y":500}]}],
    "spouting": [{"points":[{"x":100,"y":200},{"x":500,"y":200}]}]
  },
  "notes": ["Possible separate garage roof at bottom-left — not included."]
}`;

// ── Response schema (for OpenAI structured output) ──────────────────────────

const pointSchema = {
  type: 'object' as const,
  properties: {
    x: { type: 'integer' as const },
    y: { type: 'integer' as const },
  },
  required: ['x', 'y'] as const,
  additionalProperties: false,
};

const lineItemSchema = {
  type: 'object' as const,
  properties: {
    points: {
      type: 'array' as const,
      items: pointSchema,
    },
  },
  required: ['points'] as const,
  additionalProperties: false,
};

/**
 * JSON schema for OpenAI structured output (response_format: json_schema).
 * Mirrors the prompt's response format exactly.
 */
export const AI_TAKEOFF_RESPONSE_SCHEMA = {
  type: 'object' as const,
  properties: {
    error: { type: 'string' as const },
    scale: {
      type: 'object' as const,
      properties: {
        detected: { type: 'boolean' as const },
        ratio: { type: ['string', 'null'] as const },
        dimension_line: {
          type: ['object', 'null'] as const,
          properties: {
            p1: pointSchema,
            p2: pointSchema,
            real_length: { type: 'number' as const },
            unit: { type: 'string' as const },
          },
          required: ['p1', 'p2', 'real_length', 'unit'] as const,
          additionalProperties: false,
        },
      },
      required: ['detected', 'ratio', 'dimension_line'] as const,
      additionalProperties: false,
    },
    pitch: {
      type: 'object' as const,
      properties: {
        detected: { type: 'boolean' as const },
        global_degrees: { type: ['number', 'null'] as const },
      },
      required: ['detected', 'global_degrees'] as const,
      additionalProperties: false,
    },
    roof_areas: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          name: { type: 'string' as const },
          points: {
            type: 'array' as const,
            items: pointSchema,
          },
          pitch_degrees: { type: ['number', 'null'] as const },
        },
        required: ['name', 'points', 'pitch_degrees'] as const,
        additionalProperties: false,
      },
    },
    components: {
      type: 'object' as const,
      properties: {
        ridges: { type: 'array' as const, items: lineItemSchema },
        hips: { type: 'array' as const, items: lineItemSchema },
        valleys: { type: 'array' as const, items: lineItemSchema },
        barges: { type: 'array' as const, items: lineItemSchema },
        spouting: { type: 'array' as const, items: lineItemSchema },
      },
      required: ['ridges', 'hips', 'valleys', 'barges', 'spouting'] as const,
      additionalProperties: false,
    },
    notes: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
  },
  required: ['scale', 'pitch', 'roof_areas', 'components', 'notes'] as const,
  additionalProperties: false,
};

/** Model config — V1 tested configuration. Revisit at Phase C go/no-go. */
export const AI_TAKEOFF_MODEL = process.env.AI_TAKEOFF_MODEL || 'gpt-4o';
