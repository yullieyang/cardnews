// Deck schema validation.
//
// Hand-rolled rather than a validation library: the shape is small and fixed
// (one deck object, ten slides, four string-ish fields per slide), and the
// renderer needs only structural guarantees a few lines can express. Adding
// a dependency (zod/ajv) for this would be more machinery than the problem
// needs.
//
// The renderer only ever branches on `slide.type === "title"` / `"closing"`
// / else-content — before this validator existed, an unsupported type value
// silently fell into the "content" rendering branch instead of being
// rejected. This module exists so that failure mode is caught explicitly,
// before rendering, rather than rendered wrong and discovered later.

export const SUPPORTED_SLIDE_TYPES = ["title", "content", "closing"];
export const EXPECTED_SLIDE_COUNT = 10;
export const MAX_HEADING_LENGTH = 200;
export const MAX_BODY_LENGTH = 800;

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const DECK_FIELDS = new Set(["title", "theme_color", "slides"]);
const SLIDE_FIELDS = new Set(["slide_number", "type", "heading", "body"]);

/**
 * Validate a parsed deck object against the shape the renderer requires.
 * Returns { valid: boolean, errors: string[] }. Never throws.
 */
export function validateDeck(deck) {
  const errors = [];

  if (deck === null || typeof deck !== "object" || Array.isArray(deck)) {
    return { valid: false, errors: ["deck must be a JSON object"] };
  }

  for (const key of Object.keys(deck)) {
    if (!DECK_FIELDS.has(key)) {
      errors.push(`unexpected top-level field: "${key}"`);
    }
  }

  if (typeof deck.title !== "string" || deck.title.trim().length === 0) {
    errors.push("title must be a non-empty string");
  }

  if (typeof deck.theme_color !== "string" || !HEX_COLOR_RE.test(deck.theme_color)) {
    errors.push(`theme_color must be a "#rrggbb" hex color string, got: ${JSON.stringify(deck.theme_color)}`);
  }

  if (!Array.isArray(deck.slides)) {
    errors.push("slides must be an array");
    return { valid: false, errors };
  }

  if (deck.slides.length !== EXPECTED_SLIDE_COUNT) {
    errors.push(`expected exactly ${EXPECTED_SLIDE_COUNT} slides, got ${deck.slides.length}`);
  }

  deck.slides.forEach((slide, idx) => {
    const pos = idx + 1;
    if (slide === null || typeof slide !== "object" || Array.isArray(slide)) {
      errors.push(`slide ${pos}: must be an object`);
      return;
    }
    for (const key of Object.keys(slide)) {
      if (!SLIDE_FIELDS.has(key)) {
        errors.push(`slide ${pos}: unexpected field "${key}"`);
      }
    }
    if (typeof slide.slide_number !== "number" || slide.slide_number !== pos) {
      errors.push(`slide ${pos}: slide_number must equal its position (expected ${pos}, got ${JSON.stringify(slide.slide_number)})`);
    }
    if (!SUPPORTED_SLIDE_TYPES.includes(slide.type)) {
      errors.push(`slide ${pos}: unsupported type ${JSON.stringify(slide.type)} (expected one of ${SUPPORTED_SLIDE_TYPES.join(", ")})`);
    } else {
      const expectedType = pos === 1 ? "title" : pos === EXPECTED_SLIDE_COUNT ? "closing" : "content";
      if (slide.type !== expectedType) {
        errors.push(`slide ${pos}: expected type "${expectedType}" at this position, got "${slide.type}"`);
      }
    }
    if (typeof slide.heading !== "string" || slide.heading.trim().length === 0) {
      errors.push(`slide ${pos}: heading must be a non-empty string`);
    } else if (slide.heading.length > MAX_HEADING_LENGTH) {
      errors.push(`slide ${pos}: heading exceeds ${MAX_HEADING_LENGTH} characters (${slide.heading.length})`);
    }
    if (typeof slide.body !== "string" || slide.body.trim().length === 0) {
      errors.push(`slide ${pos}: body must be a non-empty string`);
    } else if (slide.body.length > MAX_BODY_LENGTH) {
      errors.push(`slide ${pos}: body exceeds ${MAX_BODY_LENGTH} characters (${slide.body.length})`);
    }
  });

  return { valid: errors.length === 0, errors };
}

/** Format a short, model-readable correction message from validation errors. */
export function formatCorrectionPrompt(errors) {
  return (
    "Your previous response did not match the required structure. Fix ONLY these problems " +
    "and return the complete corrected JSON object (still ONLY JSON, no prose, no code fences):\n" +
    errors.map((e) => `- ${e}`).join("\n")
  );
}
