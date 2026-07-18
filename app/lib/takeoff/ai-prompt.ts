/**
 * AI Takeoff — Vision model prompt for roof plan analysis.
 *
 * Two-phase approach:
 * Phase 1: Identify the roof outline (the thick black perimeter line).
 * Phase 2: Identify internal components (hips, valleys, ridges, barges, spouting).
 *
 * The model returns NORMALIZED coordinates on a 0–1000 grid.
 */

// ── Phase 1: Outline detection prompt ──────────────────────────────────────

export const AI_TAKEOFF_PROMPT_PHASE1 = `You are an expert roofing plan analyst. You are analysing a screenshot of a canvas displaying a roof plan image — a top-down architectural drawing of a roof. The plan image is centred on a dark background (dark grey/slate canvas margin). The roof plan is the bright area in the centre. Ignore the dark margins completely.

## YOUR PRIMARY TASK
Identify the ROOF OUTLINE — the thick black perimeter line that defines the actual roof shape. This is the most important thing you do. Everything else depends on getting this right.

## How to identify the roof outline
- The roof outline is the THICKEST continuous black line forming a closed shape.
- It is NOT dimension lines (thin lines with arrows or tick marks).
- It is NOT text, annotations, leaders, or callouts.
- It is NOT the drawing border/frame.
- It is NOT grid lines or construction lines.
- The outline may be a simple rectangle, an L-shape, T-shape, U-shape, or have stepped/complex geometry.
- Multiple separate roof structures = multiple outlines.

## Coordinate system
Use NORMALIZED coordinates on a 0–1000 grid covering the ENTIRE image (including the dark margins): x=0 is the image's left edge, x=1000 the right edge; y=0 the top, y=1000 the bottom. All coordinates must be integers.

## What to return
Return ONLY the roof outline polygon(s). Do NOT detect hips, valleys, ridges, barges, or spouting yet.

For each roof outline:
- List every vertex of the perimeter polygon in order (clockwise or counter-clockwise).
- Include EVERY corner — even small steps or notches in the outline.
- The polygon must be CLOSED (first vertex = last vertex conceptually).
- Name each area (e.g. "Main Roof", "Garage Roof").

## Also detect (but do NOT guess)
- SCALE: Look for a labelled dimension line (a line with text like "5000mm", "5.0m", "16'4\"") or a ratio (e.g. "1:100"). If you find a dimension line, return its two endpoints and the stated real-world length.
- PITCH: Look for pitch annotations (e.g. "25°", "Pitch 22.5°", "1/4 pitch"). Return per-area if marked differently, or one global value.

## Critical rules
- If the image is not a roof plan, return {"error":"unreadable"}.
- If you cannot confidently trace the roof outline, return your best guess AND add a note.
- Do NOT include dimension lines, text, or annotations as part of the outline polygon.
- Do NOT simplify the outline — include every vertex you can see.

## Response format — STRICT JSON, no markdown
{
  "scale": {"detected": true, "ratio": "1:100" | null,
            "dimension_line": {"p1":{"x":0,"y":0},"p2":{"x":0,"y":0},
                               "real_length": 5000, "unit":"mm"} | null},
  "pitch": {"detected": true, "global_degrees": 25 | null},
  "roof_areas": [
    {"name": "Main Roof",
     "points": [{"x":100,"y":200},{"x":500,"y":200},{"x":500,"y":600}],
     "pitch_degrees": 25 | null}
  ],
  "notes": []
}`;

// ── Phase 2: Component detection prompt ────────────────────────────────────

export const AI_TAKEOFF_PROMPT_PHASE2 = `You are an expert roofing plan analyst. You are analysing a screenshot of a canvas displaying a roof plan image. The plan image is centred on a dark background (dark grey/slate canvas margin). The roof plan is the bright area in the centre. Ignore the dark margins completely.

## Coordinate system
Use NORMALIZED coordinates on a 0–1000 grid covering the ENTIRE image (including the dark margins): x=0 is the image's left edge, x=1000 the right edge; y=0 the top, y=1000 the bottom. All coordinates must be integers.

## The roof outline (already identified)
{OUTLINE_CONTEXT}

## Component types to detect — IN THIS ORDER OF PRIORITY

### 1. RIDGES (horizontal or vertical lines INSIDE the roof area)
- Ridges run at exactly 0° (horizontal) or 90° (vertical) to the page.
- A ridge is where two roof slopes meet at the highest point.
- On the plan, ridges appear as solid lines INSIDE the roof outline, typically running along the centre/long axis.
- A ridge may extend from one barge line to another, forming a "T" at each end.
- On a mono-pitch roof, there may be NO ridge.

### 2. HIPS (diagonal lines at 45° starting/ending on EXTERNAL corners)
- Hips are diagonal lines at approximately 45° (or 135°).
- A hip ALWAYS starts or ends on an EXTERNAL corner of the roof outline (a corner that points OUTWARD, away from the building body).
- A hip connects an external corner to either: a ridge endpoint, another hip, or the roof edge.
- If a 45° line inside the roof does NOT start/end on an external corner, it is still likely a hip (not a valley) — assume hip by default for internal 45° lines.

### 3. VALLEYS (diagonal lines at 45° starting/ending on INTERNAL corners)
- Valleys are diagonal lines at approximately 45° (or 135°).
- A valley ALWAYS starts or ends on an INTERNAL corner of the roof outline (a corner that points INWARD, into the building body — where two roof planes meet at a re-entrant angle).
- Valleys are where two roof slopes meet at a low point (water collects here).
- If a 45° line does NOT start/end on an internal corner, it is NOT a valley — it's a hip.

### 4. BARGES (perimeter edges at gable ends)
- Barges are straight edges of the roof outline itself — they ARE part of the perimeter.
- A barge is a perimeter edge where the roof slope ends at a gable (triangular wall).
- On a mono-pitch roof: 3 barge sides + 1 spouting side.
- On a multi-face roof: a ridge that finishes 90° to the outline forming a "T" usually means 2 barges on that gable end.
- Barges are ALWAYS horizontal (0°) or vertical (90°) — they follow the building outline.

### 5. SPOUTING (perimeter edges at the gutter/eaves line)
- Spouting runs along the bottom edge of a roof slope where water drains off.
- It is a PERIMETER edge (part of the roof outline).
- Spouting is NEVER on a barge line (barges are the gable ends, spouting is the gutter line).
- On a simple gable roof: 2 spouting edges (the two long sides), 2 barge edges (the two gable ends).
- On a mono-pitch: 1 spouting edge, 3 barge edges.
- If you cannot clearly identify which perimeter edges are spouting vs barge, return empty arrays for both — do NOT guess.

## Rules
- Return EVERY line individually. NEVER merge, combine, or sum separate lines.
- Ridges MUST be at 0° or 90°. Hips and valleys MUST be within ±8° of 45° or 135°.
- Barges and spouting MUST be at 0° or 90° (they follow the building outline).
- Do NOT detect grid lines, dimension lines, text, north arrows, or borders as roof components.
- Do NOT re-detect the roof outline — that's already been done.
- If a component type is not clearly present, return an empty array for it.
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

// ── Legacy single-phase prompt (kept for fallback) ─────────────────────────

export const AI_TAKEOFF_PROMPT = AI_TAKEOFF_PROMPT_PHASE2;

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
    error: { type: ['string', 'null'] as const },
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
  required: ['error', 'scale', 'pitch', 'roof_areas', 'components', 'notes'] as const,
  additionalProperties: false,
};

// ── Phase 1 schema (no components, outline only) ───────────────────────────

export const AI_TAKEOFF_PHASE1_SCHEMA = {
  type: 'object' as const,
  properties: {
    error: { type: ['string', 'null'] as const },
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
    notes: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
  },
  required: ['error', 'scale', 'pitch', 'roof_areas', 'notes'] as const,
  additionalProperties: false,
};

/** Model config — using gpt-4.1 for significantly better vision/spatial reasoning than gpt-4o. */
export const AI_TAKEOFF_MODEL = process.env.AI_TAKEOFF_MODEL || 'gpt-4.1';
