import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, slugify } from "../scripts/cli-utils.js";

test("slugify strips filesystem-unsafe characters", () => {
  assert.equal(slugify('a/b\\c:d*e?f"g<h>i|j'), "abcdefghij");
});

test("slugify collapses whitespace to hyphens", () => {
  assert.equal(slugify("hello   world  foo"), "hello-world-foo");
});

test("slugify truncates to 50 characters", () => {
  const long = "x".repeat(100);
  assert.equal(slugify(long).length, 50);
});

test("slugify strips leading dots", () => {
  assert.equal(slugify("...hidden-topic"), "hidden-topic");
});

test("slugify falls back to a timestamp-based name when everything is stripped", () => {
  // Previously this resolved to an empty string -> output/ itself.
  const slug = slugify('???///\\\\***', 1700000000000);
  assert.equal(slug, "topic-1700000000000");
});

test("slugify never returns an empty string", () => {
  for (const topic of ["", "   ", "///", "???", "..."]) {
    assert.notEqual(slugify(topic, 123).length, 0);
  }
});

test("parseArgs separates flags from positional topic words", () => {
  const { options, positional } = parseArgs(["hello", "world", "--tone=playful", "--audience=kids"]);
  assert.deepEqual(positional, ["hello", "world"]);
  assert.equal(options.tone, "playful");
  assert.equal(options.audience, "kids");
});

test("parseArgs sets generate-only boolean flag", () => {
  const { options, positional } = parseArgs(["--generate-only", "a topic"]);
  assert.equal(options["generate-only"], true);
  assert.deepEqual(positional, ["a topic"]);
});

test("parseArgs sets render flag and _renderFlag marker", () => {
  const { options, positional } = parseArgs(["--render", "path/to/cards.json"]);
  assert.equal(options.render, true);
  assert.equal(options._renderFlag, true);
  assert.deepEqual(positional, ["path/to/cards.json"]);
});

test("parseArgs handles output-dir flag", () => {
  const { options } = parseArgs(["topic", "--output-dir=/tmp/foo"]);
  assert.equal(options["output-dir"], "/tmp/foo");
});
