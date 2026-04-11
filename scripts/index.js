#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { generateCardNews } from "./generator.js";
import { renderSlides } from "./renderer.js";

const topic = process.argv.slice(2).join(" ");

if (!topic) {
  console.error("Usage: npm start -- <topic>");
  console.error('  e.g. npm start -- "인공지능의 미래"');
  process.exit(1);
}

// Build output folder name from topic
const slug = topic
  .trim()
  .replace(/[/\\:*?"<>|]/g, "")
  .replace(/\s+/g, "-")
  .slice(0, 50);
const outputDir = path.join(process.cwd(), "output", slug);
fs.mkdirSync(outputDir, { recursive: true });

console.log(`\n▶ Generating card news: "${topic}"\n`);

// Step 1 — Generate content with Claude
console.log("[1/2] Generating content...");
const cards = await generateCardNews(topic);
fs.writeFileSync(path.join(outputDir, "cards.json"), JSON.stringify(cards, null, 2));
console.log("  → cards.json saved\n");

// Step 2 — Render slides as PNG
console.log("[2/2] Rendering slides...");
await renderSlides(cards, outputDir);

console.log(`\n✓ Done! ${cards.slides.length} slides → ${outputDir}\n`);
