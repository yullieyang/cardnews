import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { renderSlides, RenderValidationError } from "../scripts/renderer.js";

// These tests launch a real headless Chromium via Puppeteer (the project's
// actual rendering dependency) rather than mocking it — rendering is the
// part of this project that most needs a real, not simulated, check. They
// are slower than the schema/generator tests but still run offline with no
// API key or network access.

function deckWithSlides(n) {
  const slides = [{ slide_number: 1, type: "title", heading: "Title", body: "Subtitle" }];
  for (let i = 2; i <= n - 1; i++) {
    slides.push({ slide_number: i, type: "content", heading: `Point ${i}`, body: "Some text." });
  }
  if (n > 1) slides.push({ slide_number: n, type: "closing", heading: "Closing", body: "Wrap up." });
  return { title: "Test Deck", theme_color: "#1A6B8A", slides };
}

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cardnews-test-"));
}

test("renders exactly the expected slide files plus a non-empty diary shot", async () => {
  const dir = tmpDir();
  await renderSlides(deckWithSlides(10), dir);
  const files = fs.readdirSync(dir);
  for (let i = 1; i <= 10; i++) {
    const name = `slide-${String(i).padStart(2, "0")}.png`;
    assert.ok(files.includes(name), `missing ${name}`);
    assert.ok(fs.statSync(path.join(dir, name)).size > 0, `${name} is empty`);
  }
  assert.ok(files.includes("diary-shot.png"));
  assert.ok(fs.statSync(path.join(dir, "diary-shot.png")).size > 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("no leftover staging directory after a successful render", async () => {
  const dir = tmpDir();
  await renderSlides(deckWithSlides(10), dir);
  assert.equal(fs.existsSync(`${dir}.rendering-tmp`), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("re-rendering with fewer slides does not leave stale files from a longer prior run", async () => {
  const dir = tmpDir();
  await renderSlides(deckWithSlides(10), dir);
  assert.ok(fs.existsSync(path.join(dir, "slide-10.png")));

  await renderSlides(deckWithSlides(3), dir);
  const files = fs.readdirSync(dir).filter((f) => f.startsWith("slide-"));
  assert.deepEqual(files.sort(), ["slide-01.png", "slide-02.png", "slide-03.png"]);
  assert.equal(fs.existsSync(path.join(dir, "slide-10.png")), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a failed render leaves a pre-existing successful render untouched", async () => {
  const dir = tmpDir();
  await renderSlides(deckWithSlides(10), dir);
  const before = fs.readFileSync(path.join(dir, "slide-01.png"));

  // Force a failure: a deck whose declared slide count won't match what
  // actually gets written (renderer writes one file per cards.slides entry,
  // but validation checks against cards.slides.length — so we simulate a
  // renderer-level failure by pointing at a directory whose CSS template is
  // temporarily missing, which throws mid-render before any file is staged
  // for the swap).
  const templatePath = path.join(new URL("../templates/styles.css", import.meta.url).pathname);
  const backup = fs.readFileSync(templatePath);
  fs.renameSync(templatePath, `${templatePath}.bak`);
  try {
    await assert.rejects(() => renderSlides(deckWithSlides(10), dir));
  } finally {
    fs.renameSync(`${templatePath}.bak`, templatePath);
  }

  const after = fs.readFileSync(path.join(dir, "slide-01.png"));
  assert.deepEqual(before, after, "prior successful render must be untouched after a failed re-render");
  fs.rmSync(dir, { recursive: true, force: true });
});
