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
- ROOF FACES: Only if you are fully confident, count the distinct physical roof planes and add exactly one note in the form "roof_face_count: N". If any face boundary is unclear, do not include a roof-face count. Never infer the count from the number of visible line compartments, and never use a guessed face count to classify perimeter components.

## Critical rules
- If the image is not a roof plan, return {"error":"unreadable"}.
- If you cannot confidently trace the roof outline, return your best guess AND add a note.
- Do NOT include dimension lines, text, or annotations as part of the outline polygon.
- Do NOT simplify the outline — include every vertex you can see.
- ONLY RETURN ONE ROOF AREA. Trace the ENTIRE outer perimeter of the roof as a single polygon. Do NOT create separate areas for dormers, extensions, or sub-structures — they are all part of the main roof outline. The user will add additional areas manually if needed.

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

export const AI_TAKEOFF_PROMPT_PHASE2 = `You are an expert roofing plan analyst. Analyse the bright roof plan in the centre of the image and ignore the dark canvas margins.

## Coordinate contract
The image is exactly 800 pixels wide by 600 pixels high. Return integer image-pixel coordinates: x=0..799 and y=0..599.
Place every endpoint on the centre of an actual roof stroke or stroke intersection. Never use dimension lines, annotation leaders, text, borders, or an imagined extension as component geometry.

## Authoritative roof outline from Phase 1
{OUTLINE_CONTEXT}

Use this outline as fixed geometry. Return the same roof_areas polygon unchanged. Do not redraw, simplify, split, or expand it.

## Required classification process - perform these steps in order

### STEP 1 - Confirm the roof area
- Use only the supplied Phase 1 outline as the roof perimeter.
- Ignore skylights, chimneys, vents, labels, dimensions, and other non-roof objects.
- Do not use a guessed roof-face count to create or classify any component.

### STEP 2 - Detect every ridge
- A ridge is a solid internal line where roof planes meet at their highest point.
- Detect all clearly visible ridge runs before considering barges or spouting.
- Standard-plan ridges must be horizontal (0 degrees) or vertical (90 degrees).
- A ridge endpoint may meet another ridge, a hip, a valley, or the roof perimeter. Record its actual visible endpoints exactly.
- A mono-pitch roof may have no ridge. Do not invent one.

### STEP 3 - Detect every hip and valley
- Hips and valleys are diagonal internal roof lines, normally near 45 or 135 degrees.
- HIP: an external high junction, normally joining an outward roof corner to a ridge or another internal junction.
- VALLEY: an internal low junction where water collects, normally beginning at a re-entrant/inward roof corner.
- Classify from the corner type and visible junctions, not from labels or roof-style assumptions.
- Complete this step before classifying any perimeter run.

### STEP 4 - Detect barges only from ridge endpoints
A barge is a gable-edge run on the roof perimeter. Barges do not collect water. They are the exception, not the default.

For EACH ridge endpoint, apply this exact test:
1. Does the ridge endpoint land directly on the supplied roof perimeter?
2. If NO - create no barge from that endpoint. An endpoint that meets a hip, valley, ridge, or other internal junction does not create a barge.
3. If YES - inspect the two perimeter directions leaving that exact endpoint.
4. If both perimeter runs leave approximately perpendicular to the ridge, classify those two runs as barges.
5. Trace each barge away from the ridge endpoint only until the first roof corner, obvious join, or change of perimeter direction. Return each run separately.

Mandatory barge constraints:
- Never classify a perimeter run as barge merely because it is perpendicular to a ridge somewhere else. It must be one of the two runs branching directly from a ridge endpoint on the perimeter.
- A hipped roof has no barge at an end where the ridge terminates into hips. Its outer perimeter is spouting.
- Apply the same endpoint test independently to dormer ridges. Do not use a separate dormer rule.
- Example: if a vertical dormer ridge reaches a horizontal front perimeter, the two horizontal runs branching left and right from that endpoint are barges. The dormer's vertical side runs are spouting, not barges.
- If the endpoint/perimeter connection is unclear, create no barge there. Leave those perimeter runs for Step 5.

### STEP 5 - Assign spouting by perimeter elimination
- Start with the complete supplied roof perimeter.
- Subtract only the barge runs positively identified in Step 4.
- Every remaining perimeter run is spouting.
- Spouting is the eaves/gutter edge where water exits the roof. Water runs into spouting; it does not run into a barge.
- Split spouting at every roof corner, join, or barge endpoint and return each run separately.
- A fully hipped roof therefore has zero barges and spouting around its entire outer perimeter.

### STEP 6 - Final consistency check
- Every perimeter run must appear exactly once: either barges or spouting, never both.
- Barges plus spouting must reconstruct the complete supplied perimeter with no gaps.
- No ridge, hip, or valley may be copied into barges or spouting.
- If any barge fails the ridge-endpoint test, remove it and classify that perimeter run as spouting.

## Geometry rules
- Return every visible run individually. Never merge or sum separate lines.
- Ridges must be at 0 or 90 degrees. Hips and valleys must be within 8 degrees of 45 or 135 degrees.
- Barges and spouting must follow the supplied roof perimeter.
- If a ridge, hip, or valley is not clearly visible, return an empty array for that type.
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
