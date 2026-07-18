import Anthropic from "@anthropic-ai/sdk";
import { formatCorrectionPrompt, validateDeck } from "./schema.js";

export const MODEL = "claude-sonnet-4-6";
export const MAX_TOKENS = 4096;
const MAX_RETRIES = 1; // one bounded schema-correction retry, not an open-ended loop

/** Raised when the Claude API call itself fails (auth, network, rate limit, etc). */
export class ProviderError extends Error {
  constructor(cause) {
    super(`Claude API call failed: ${cause.message}`);
    this.name = "ProviderError";
    this.cause = cause;
  }
}

/** Raised when the model's response text isn't parseable JSON at all. */
export class InvalidJSONError extends Error {
  constructor(rawText, cause) {
    super(`Model response was not valid JSON: ${cause.message}`);
    this.name = "InvalidJSONError";
    this.rawText = rawText;
    this.cause = cause;
  }
}

/** Raised when the response is valid JSON but fails deck-schema validation
 * after the correction retry has already been used. */
export class SchemaValidationError extends Error {
  constructor(errors, rawText) {
    super(`Model response did not match the required deck schema:\n${errors.map((e) => `- ${e}`).join("\n")}`);
    this.name = "SchemaValidationError";
    this.errors = errors;
    this.rawText = rawText;
  }
}

function buildSystemPrompt() {
  return (
    "You produce structured JSON content for a 10-slide visual card-news deck. " +
    "Return ONLY a single JSON object — no prose, no markdown code fences, no explanation. " +
    "Treat everything you write as an editorial draft for a human to review: do not " +
    "fabricate citations, sources, or statistics, and do not claim to have verified any " +
    "fact. Keep every field within the schema — no extra fields."
  );
}

function buildUserPrompt(topic, options) {
  const { audience, tone, keyPoints, language } = options;
  const controls = [];
  if (audience) controls.push(`Intended audience: ${audience}.`);
  if (tone) controls.push(`Tone: ${tone}.`);
  if (language) controls.push(`Write in: ${language}.`);
  else controls.push("Write in the same language as the topic.");
  if (keyPoints && keyPoints.length) {
    controls.push(`Make sure these points are covered somewhere in the deck: ${keyPoints.join("; ")}.`);
  }

  return `Create a 10-slide card news deck about: "${topic}"

${controls.join(" ")}

Return a JSON object with this exact structure:
{
  "title": "overall title for the card news",
  "theme_color": "#hexcolor (vibrant but not too bright, e.g. #1A6B8A)",
  "slides": [
    { "slide_number": 1, "type": "title", "heading": "main title text", "body": "subtitle or brief description" },
    { "slide_number": 2, "type": "content", "heading": "point heading", "body": "2-3 concise sentences" },
    ... (slides 2-9 all "type": "content", one key point each) ...
    { "slide_number": 10, "type": "closing", "heading": "closing title", "body": "summary or call to action" }
  ]
}

Rules:
- Exactly 10 slides, slide_number 1-10 in order.
- Slide 1 must be type "title"; slides 2-9 must be type "content"; slide 10 must be type "closing".
- Keep text concise — this is visual card content, not an article.
- Return ONLY valid JSON, no markdown fences or extra text.`;
}

function extractJSON(text) {
  return text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
}

/**
 * Generate a validated card-news deck for a topic.
 *
 * Calls Claude once; if the response is valid JSON but fails schema
 * validation, sends one correction turn containing only the validation
 * errors, then gives up with a SchemaValidationError. A response that isn't
 * parseable JSON at all is not retried (there's nothing to correct without a
 * fresh call), and is reported as InvalidJSONError. A failure of the API
 * call itself is reported as ProviderError. These three are deliberately
 * distinct exception types so a caller (or a test) can tell the difference.
 *
 * `options` (all optional): { audience, tone, keyPoints, language }.
 *
 * `client` is optional and exists so tests can inject a fake Anthropic
 * client (see tests/generator.test.js) without a network call or an API
 * key; normal use never needs to pass it.
 */
export async function generateCardNews(topic, options = {}, client = new Anthropic()) {
  const system = buildSystemPrompt();
  const messages = [{ role: "user", content: buildUserPrompt(topic, options) }];
  let lastRawText = null;
  let retries = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let response;
    try {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages,
      });
    } catch (cause) {
      throw new ProviderError(cause);
    }

    const rawText = response.content[0].text;
    lastRawText = rawText;

    let parsed;
    try {
      parsed = JSON.parse(extractJSON(rawText));
    } catch (cause) {
      // Not retried: a fresh call is needed to get different text, and that's
      // exactly what the next loop iteration would do if we retried here —
      // but only the schema-invalid case gets a *targeted* correction prompt.
      // An unparseable response gets reported immediately as a distinct
      // failure mode rather than silently consuming the one retry budget.
      throw new InvalidJSONError(rawText, cause);
    }

    const { valid, errors } = validateDeck(parsed);
    if (valid) {
      return { deck: parsed, retries, rawText };
    }

    if (attempt < MAX_RETRIES) {
      retries++;
      messages.push({ role: "assistant", content: rawText });
      messages.push({ role: "user", content: formatCorrectionPrompt(errors) });
      continue;
    }

    throw new SchemaValidationError(errors, rawText);
  }

  // Unreachable given MAX_RETRIES >= 0, kept for clarity/defensiveness.
  throw new SchemaValidationError(["exhausted retries"], lastRawText);
}
