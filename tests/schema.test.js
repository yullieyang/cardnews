import { test } from "node:test";
import assert from "node:assert/strict";
import { validateDeck, formatCorrectionPrompt } from "../scripts/schema.js";

function validDeck() {
  const slides = [];
  slides.push({ slide_number: 1, type: "title", heading: "Title", body: "Subtitle" });
  for (let i = 2; i <= 9; i++) {
    slides.push({ slide_number: i, type: "content", heading: `Point ${i}`, body: "Some explanation." });
  }
  slides.push({ slide_number: 10, type: "closing", heading: "Closing", body: "Wrap up." });
  return { title: "A Deck", theme_color: "#1A6B8A", slides };
}

test("valid deck passes", () => {
  const { valid, errors } = validateDeck(validDeck());
  assert.equal(valid, true);
  assert.deepEqual(errors, []);
});

test("wrong slide count is rejected", () => {
  const deck = validDeck();
  deck.slides = deck.slides.slice(0, 8);
  const { valid, errors } = validateDeck(deck);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("expected exactly 10 slides")));
});

test("missing required field is rejected", () => {
  const deck = validDeck();
  delete deck.slides[3].heading;
  const { valid, errors } = validateDeck(deck);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("slide 4") && e.includes("heading")));
});

test("unsupported slide type is rejected, not silently treated as content", () => {
  const deck = validDeck();
  deck.slides[4].type = "quote";
  const { valid, errors } = validateDeck(deck);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("unsupported type")));
});

test("wrong type for position is rejected (e.g. slide 1 not type title)", () => {
  const deck = validDeck();
  deck.slides[0].type = "content";
  const { valid, errors } = validateDeck(deck);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('expected type "title"')));
});

test("invalid theme_color format is rejected", () => {
  const deck = validDeck();
  deck.theme_color = "blue";
  const { valid, errors } = validateDeck(deck);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("theme_color")));
});

test("unexpected top-level field is rejected", () => {
  const deck = validDeck();
  deck.author = "someone";
  const { valid, errors } = validateDeck(deck);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('unexpected top-level field: "author"')));
});

test("unexpected slide-level field is rejected", () => {
  const deck = validDeck();
  deck.slides[2].footnote = "extra";
  const { valid, errors } = validateDeck(deck);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("unexpected field")));
});

test("heading over max length is rejected", () => {
  const deck = validDeck();
  deck.slides[1].heading = "x".repeat(300);
  const { valid, errors } = validateDeck(deck);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("exceeds 200 characters")));
});

test("non-object deck is rejected without throwing", () => {
  const { valid, errors } = validateDeck("not an object");
  assert.equal(valid, false);
  assert.ok(errors.length > 0);
});

test("null deck is rejected without throwing", () => {
  const { valid, errors } = validateDeck(null);
  assert.equal(valid, false);
  assert.ok(errors.length > 0);
});

test("formatCorrectionPrompt includes every error and stays JSON-only instruction", () => {
  const msg = formatCorrectionPrompt(["problem A", "problem B"]);
  assert.ok(msg.includes("problem A"));
  assert.ok(msg.includes("problem B"));
  assert.ok(msg.toLowerCase().includes("json"));
});
