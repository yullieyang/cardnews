#!/usr/bin/env node

import fs from "fs";
import path from "path";
import {
  InvalidJSONError,
  ProviderError,
  SchemaValidationError,
  generateCardNews,
  MODEL,
} from "./generator.js";
import { RenderValidationError, renderSlides } from "./renderer.js";
import { validateDeck } from "./schema.js";
import { parseArgs, slugify } from "./cli-utils.js";

const REVIEW_CHECKLIST = `
Before publishing this deck, review:
  [ ] Every factual claim is source-checked against an authoritative reference
  [ ] Tone and framing are appropriate for the intended audience
  [ ] No confidential or non-public information appears in the topic or slides
  [ ] The visual output has been inspected slide by slide
  [ ] The deck is labeled as AI-assisted with a named human reviewer
This deck is a draft. Nothing above has been verified automatically.`;

function usage() {
  console.error(`Usage:
  npm start -- "<topic>" [options]              generate content and render
  npm start -- --generate-only "<topic>" [opts] generate JSON only, no render
  npm start -- --render <path/to/cards.json>    render an existing JSON file

Options:
  --audience=<text>       intended audience for the deck
  --tone=<text>           desired tone (e.g. "playful", "formal")
  --language=<text>       output language (default: same language as topic)
  --key-points=<a;b;c>    semicolon-separated points to make sure are covered
  --output-dir=<path>     output directory (default: output/<topic-slug>/)

Example:
  npm start -- "인공지능의 미래"`);
}

function writeMetadata(outputDir, metadata) {
  fs.writeFileSync(
    path.join(outputDir, "run-metadata.json"),
    JSON.stringify(metadata, null, 2)
  );
}

async function runGenerateAndRender({ topic, options, generateOnly }) {
  const startedAt = new Date().toISOString();
  const start = Date.now();
  const slug = options["output-dir"] ? null : slugify(topic);
  const outputDir = options["output-dir"]
    ? path.resolve(options["output-dir"])
    : path.join(process.cwd(), "output", slug);
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`\n▶ Generating card news: "${topic}"\n`);
  console.log("[1/2] Generating content...");

  const genOptions = {
    audience: options.audience,
    tone: options.tone,
    language: options.language,
    keyPoints: options["key-points"] ? options["key-points"].split(";").map((s) => s.trim()) : undefined,
  };

  let deck, retries;
  try {
    ({ deck, retries } = await generateCardNews(topic, genOptions));
  } catch (err) {
    if (err instanceof ProviderError) {
      console.error(`\n✗ Claude API call failed: ${err.cause?.message ?? err.message}`);
      console.error("  Check ANTHROPIC_API_KEY and network connectivity. No files were written.");
      process.exit(2);
    }
    if (err instanceof InvalidJSONError) {
      console.error(`\n✗ Model response was not valid JSON. No files were written.`);
      console.error(`  Raw response saved for debugging: ${outputDir}/invalid-response.txt`);
      fs.writeFileSync(path.join(outputDir, "invalid-response.txt"), err.rawText);
      process.exit(3);
    }
    if (err instanceof SchemaValidationError) {
      console.error(`\n✗ Model response did not match the required schema after 1 correction attempt:`);
      for (const e of err.errors) console.error(`  - ${e}`);
      console.error(`  Raw response saved for debugging: ${outputDir}/invalid-response.txt`);
      fs.writeFileSync(path.join(outputDir, "invalid-response.txt"), err.rawText);
      process.exit(4);
    }
    throw err;
  }

  console.log(`  → cards.json validated (${retries} correction ${retries === 1 ? "retry" : "retries"})\n`);
  fs.writeFileSync(path.join(outputDir, "cards.json"), JSON.stringify(deck, null, 2));

  let renderingStatus = "skipped";
  if (!generateOnly) {
    console.log("[2/2] Rendering slides...");
    try {
      await renderSlides(deck, outputDir);
      renderingStatus = "ok";
    } catch (err) {
      if (err instanceof RenderValidationError) {
        console.error(`\n✗ Rendering validation failed:`);
        for (const p of err.problems) console.error(`  - ${p}`);
        console.error(`  cards.json was saved; the previous rendered output (if any) was left untouched.`);
        writeMetadata(outputDir, buildMetadata("failed"));
        process.exit(5);
      }
      throw err;
    }
  }

  function buildMetadata(status = renderingStatus) {
    return {
      topic,
      timestamp: startedAt,
      provider: "anthropic",
      model: MODEL,
      options: genOptions,
      slide_count: deck.slides.length,
      dimensions: "1080x1080",
      generation_status: "ok",
      rendering_status: status,
      retries,
      runtime_ms: Date.now() - start,
    };
  }

  writeMetadata(outputDir, buildMetadata());

  if (generateOnly) {
    console.log(`\n✓ Done! cards.json → ${outputDir}\n`);
  } else {
    console.log(`\n✓ Done! ${deck.slides.length} slides → ${outputDir}`);
    console.log(REVIEW_CHECKLIST);
  }
}

async function runRenderExisting({ jsonPath, options }) {
  const resolvedPath = path.resolve(jsonPath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`\n✗ File not found: ${resolvedPath}`);
    process.exit(1);
  }
  let deck;
  try {
    deck = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
  } catch (err) {
    console.error(`\n✗ ${resolvedPath} is not valid JSON: ${err.message}`);
    process.exit(3);
  }
  const { valid, errors } = validateDeck(deck);
  if (!valid) {
    console.error(`\n✗ ${resolvedPath} does not match the required deck schema:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(4);
  }

  const outputDir = options["output-dir"]
    ? path.resolve(options["output-dir"])
    : path.dirname(resolvedPath);
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`\n▶ Rendering existing JSON: ${resolvedPath}\n`);
  const start = Date.now();
  try {
    await renderSlides(deck, outputDir);
  } catch (err) {
    if (err instanceof RenderValidationError) {
      console.error(`\n✗ Rendering validation failed:`);
      for (const p of err.problems) console.error(`  - ${p}`);
      console.error(`  The previous rendered output (if any) in ${outputDir} was left untouched.`);
      process.exit(5);
    }
    throw err;
  }

  writeMetadata(outputDir, {
    topic: deck.title,
    timestamp: new Date().toISOString(),
    provider: "none (rendered from an existing JSON file, no Claude call)",
    model: null,
    slide_count: deck.slides.length,
    dimensions: "1080x1080",
    generation_status: "skipped",
    rendering_status: "ok",
    retries: 0,
    runtime_ms: Date.now() - start,
    source_json: resolvedPath,
  });

  console.log(`\n✓ Done! ${deck.slides.length} slides → ${outputDir}`);
  console.log(REVIEW_CHECKLIST);
}

async function main() {
  const { options, positional } = parseArgs(process.argv.slice(2));

  if (options._renderFlag) {
    const jsonPath = positional[0];
    if (!jsonPath) {
      usage();
      process.exit(1);
    }
    await runRenderExisting({ jsonPath, options });
    return;
  }

  const topic = positional.join(" ");
  if (!topic) {
    usage();
    process.exit(1);
  }
  await runGenerateAndRender({ topic, options, generateOnly: Boolean(options["generate-only"]) });
}

main().catch((err) => {
  console.error(`\n✗ Unexpected error: ${err.message}`);
  process.exit(1);
});
