/**
 * AI Takeoff — Vision model prompt for roof plan analysis.
 *
 * Two-phase approach:
 * Phase 1: Identify the roof outline (the thick black perimeter line).
 * Phase 2: Identify internal components (hips, valleys, ridges, barges, spouting).
 *
 * The model returns exact pixel coordinates for the 800x600 canvas image.
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

## Coordinate system - exact pixels
The supplied image is exactly 800 pixels wide by 600 pixels high.
Return exact IMAGE PIXEL coordinates: x=0 is the left edge, x=799 the right edge; y=0 is the top, y=599 the bottom. All coordinates must be integers.
Read every vertex from the centre of the actual thick black stroke or stroke intersection. Never estimate from labels, dimension leaders, text, or whitespace.

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
- ROOF FACES: Count how many distinct roof planes/faces exist. A roof face is a single sloping surface — do NOT double-count. Count carefully:
  - Simple rectangle with one ridge = 2 faces (one each side of the ridge)
  - Rectangle with hip on each end (no gable) = 4 faces (2 main + 2 hip-end)
  - L-shaped roof with ridge on each arm = 4 faces (2 per arm)
  - Rectangle with one gable dormer = 4 faces (2 main + 2 dormer)
  - Rectangle with two gable dormers = 6 faces (2 main + 2×2 dormer)
  - Fully hipped rectangle = 4 faces
  - Mono-pitch rectangle = 1 face
  Include this count in notes as "roof_face_count: N" — it helps Phase 2 classify barges vs spouting correctly.

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

## Coordinate system - exact pixels
The supplied image is exactly 800 pixels wide by 600 pixels high.
Return exact IMAGE PIXEL coordinates: x=0 is the left edge, x=799 the right edge; y=0 is the top, y=599 the bottom. All coordinates must be integers.
Every component endpoint must sit on the centre of an actual thick black roof stroke or stroke intersection. Never use annotation leader lines, dimension lines, text baselines, or inferred extensions.

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
- A diagonal that starts at a re-entrant/inward perimeter corner and runs toward an internal apex is a VALLEY, not a hip.
- Printed labels may confirm a line's semantic type, but label text and leader lines must never determine its coordinates.

### 4. BARGES (perimeter edges at gable ends — RARE)
- Barges are straight edges of the roof outline itself — they ARE part of the perimeter.
- A barge is a perimeter edge where the roof slope ends at a GABLE END (a triangular wall).
- Barges are ALWAYS horizontal (0°) or vertical (90°) — they follow the building outline.
- IMPORTANT: Barges are RARE on most roofs. A barge ONLY exists where there is a gable end.
- On a simple gable roof: only the 2 short ends (parallel to the ridge) are barges. The 2 long sides are spouting.
- On a HIPPED roof: there are NO barges at all — all perimeter edges are spouting/eaves.
- On a roof with dormers: only the dormer SIDE edges (parallel to the dormer ridge) are barges.
- DO NOT classify every vertical or short perimeter edge as a barge. Most perimeter edges are SPOUTING.
- When in doubt: it's SPOUTING, not barge. A barge requires a ridge running PERPENDICULAR to that edge (the gable end is the triangle above the wall, perpendicular to the ridge).

### GABLE DORMER DETECTION (critical)
- A gable dormer appears as a small rectangular projection on the roof outline, typically with a ridge line running perpendicular to the main ridge and ending at the dormer.
- The T-shape rule: where a ridge meets the outline at 90°, it forms a T. The top bar of the T (the two perimeter edges either side of the ridge endpoint) are BOTH barges. Only the perpendicular ridge-to-outline edge is the ridge.
- On a gable dormer: the two edges either side of where the dormer ridge meets the perimeter are BARGES (the sloping gable faces). The front edge of the dormer (parallel to the main ridge, perpendicular to the dormer ridge) is a SPOUTING edge (it's the eaves/gutter of the dormer).
- On a mono-pitch roof: 3 barge sides + 1 spouting side.
- Do NOT classify the front of a gable dormer as a barge — it is spouting.

### 5. SPOUTING (perimeter edges at the gutter/eaves line)
- Spouting runs along the bottom edge of a roof slope where water drains off.
- It is a PERIMETER edge (part of the roof outline).
- Spouting is NEVER on a barge line (barges are the gable ends, spouting is the gutter line).
- Water flows DOWN the slope, away from the ridge, and exits at the EAVES (spouting). Barges are on the GABLE end (parallel to the slope direction), spouting is PERPENDICULAR to the slope direction.
- On a simple gable roof: 2 spouting edges (the two long sides perpendicular to the ridge), 2 barge edges (the two gable ends parallel to the ridge).
- On a mono-pitch: 1 spouting edge (the low side), 3 barge edges.
- On a gable dormer: the front edge (perpendicular to the dormer ridge) is spouting; the two side edges (parallel to the dormer ridge) are barges.
- DEFAULT RULE: If you cannot clearly determine whether a perimeter edge is barge or spouting, classify it as SPOUTING. It is better to over-classify as spouting than to miss an eaves edge.
- On a fully hipped roof, the outer perimeter is eaves/spouting; do not invent a barge unless a gable end is actually present.

### PERIMETER ACCOUNTING (CRITICAL)
- EVERY perimeter segment of EVERY roof area MUST be classified as exactly one of: Barge or Spouting.
- No perimeter segment may be classified as BOTH.
- No perimeter segment may be left unclassified.
- If a segment is ambiguous, default to Spouting.
- After classification, count the perimeter segments: the total (barges + spouting) must equal the total number of perimeter edges across all roof areas.
- Mono-pitch rectangle rule: exactly 3 barges + 1 spouting (4 total perimeter edges).
- Simple gable rectangle rule: exactly 2 barges + 2 spouting (4 total perimeter edges).
- Fully hipped rectangle rule: 0 barges + 4 spouting (4 total perimeter edges).

### WATER FLOW RULE (use this to disambiguate barge vs spouting)
- Identify the ridge direction for each roof face. Water flows perpendicular to the ridge, down the slope.
- The perimeter edge WHERE WATER EXITS (perpendicular to ridge) = SPOUTING.
- The perimeter edge PARALLEL to the ridge (water runs along it, not off it) = BARGE.
- For a main roof with a horizontal ridge: the left and right edges (vertical, parallel to ridge) are BARGES; the top and bottom edges (horizontal, perpendicular to ridge) are SPOUTING.
- For a gable dormer with a vertical ridge: the top and bottom edges of the dormer (horizontal, parallel to dormer ridge) are BARGES; the front edge (vertical, perpendicular to dormer ridge) is SPOUTING.

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
    x: { type: 'integer' as const, minimum: 0, maximum: 799 },
    y: { type: 'integer' as const, minimum: 0, maximum: 599 },
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

/** Tested with the 800x600 pixel-coordinate contract for reliable spatial output. */
export const AI_TAKEOFF_MODEL = process.env.AI_TAKEOFF_MODEL || 'gpt-5.4';
