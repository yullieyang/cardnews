import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateCardNews,
  InvalidJSONError,
  ProviderError,
  SchemaValidationError,
} from "../scripts/generator.js";

function validDeckText() {
  const slides = [{ slide_number: 1, type: "title", heading: "Title", body: "Subtitle" }];
  for (let i = 2; i <= 9; i++) slides.push({ slide_number: i, type: "content", heading: `P${i}`, body: "text" });
  slides.push({ slide_number: 10, type: "closing", heading: "Bye", body: "wrap up" });
  return JSON.stringify({ title: "T", theme_color: "#1A6B8A", slides });
}

/** A fake Anthropic client: `responses` is an array of strings (or Error
 * instances, to simulate an API failure) returned in order across calls. */
function fakeClient(responses) {
  let i = 0;
  return {
    messages: {
      async create() {
        const next = responses[i++];
        if (next instanceof Error) throw next;
        return { content: [{ text: next }] };
      },
      calls: () => i,
    },
  };
}

test("valid response on first try needs no retries", async () => {
  const client = fakeClient([validDeckText()]);
  const { deck, retries } = await generateCardNews("topic", {}, client);
  assert.equal(retries, 0);
  assert.equal(deck.slides.length, 10);
});

test("markdown-fenced valid JSON is accepted", async () => {
  const client = fakeClient(["```json\n" + validDeckText() + "\n```"]);
  const { deck } = await generateCardNews("topic", {}, client);
  assert.equal(deck.slides.length, 10);
});

test("provider/API failure raises ProviderError, not a generic error", async () => {
  const client = fakeClient([new Error("connection reset")]);
  await assert.rejects(() => generateCardNews("topic", {}, client), ProviderError);
});

test("unparseable JSON raises InvalidJSONError without consuming the retry", async () => {
  const client = fakeClient(["this is not json at all"]);
  await assert.rejects(() => generateCardNews("topic", {}, client), InvalidJSONError);
  assert.equal(client.messages.calls(), 1); // no retry attempted for unparseable text
});

test("schema-invalid response triggers exactly one correction retry, then succeeds", async () => {
  const badDeck = JSON.parse(validDeckText());
  badDeck.slides = badDeck.slides.slice(0, 5); // wrong count -> schema-invalid
  const client = fakeClient([JSON.stringify(badDeck), validDeckText()]);
  const { deck, retries } = await generateCardNews("topic", {}, client);
  assert.equal(retries, 1);
  assert.equal(deck.slides.length, 10);
  assert.equal(client.messages.calls(), 2);
});

test("schema-invalid on every attempt raises SchemaValidationError with the errors attached", async () => {
  const badDeck = JSON.parse(validDeckText());
  badDeck.slides = badDeck.slides.slice(0, 5);
  const client = fakeClient([JSON.stringify(badDeck), JSON.stringify(badDeck)]);
  await assert.rejects(
    () => generateCardNews("topic", {}, client),
    (err) => {
      assert.ok(err instanceof SchemaValidationError);
      assert.ok(err.errors.length > 0);
      return true;
    }
  );
  assert.equal(client.messages.calls(), 2); // exactly one retry, not unbounded
});

test("content controls (audience/tone/language/keyPoints) do not break generation", async () => {
  const client = fakeClient([validDeckText()]);
  const { deck } = await generateCardNews(
    "topic",
    { audience: "beginners", tone: "playful", language: "English", keyPoints: ["a", "b"] },
    client
  );
  assert.equal(deck.slides.length, 10);
});
