import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readCSS() {
  return fs.readFileSync(
    path.join(__dirname, "..", "templates", "styles.css"),
    "utf-8"
  );
}

function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")
  );
}

function darken(hex, amount = 0.25) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

function lighten(hex, amount = 0.88) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    r + (255 - r) * amount,
    g + (255 - g) * amount,
    b + (255 - b) * amount
  );
}

/** Split body copy into a lead sentence (emphasized) and the remaining
 * supporting sentence(s), purely for typographic hierarchy — this is a
 * presentation-layer split only; it doesn't change what content exists,
 * doesn't touch the deck schema, and falls back to treating the whole body
 * as the lead if no clear sentence boundary is found. */
function splitLead(text) {
  const m = text.match(/^(.*?[.!?])(\s+)([\s\S]*)$/);
  if (!m || !m[3].trim()) {
    return { lead: text, support: "" };
  }
  return { lead: m[1], support: m[3].trim() };
}

function buildSlideHTML(slide, themeColor, totalSlides, css) {
  const dark = darken(themeColor);
  const light = lighten(themeColor);
  const tint = lighten(themeColor, 0.94);
  const num = String(slide.slide_number).padStart(2, "0");
  const total = String(totalSlides).padStart(2, "0");
  const heading = escapeHTML(slide.heading);
  const body = escapeHTML(slide.body);

  const vars = `:root {
    --theme: ${themeColor};
    --theme-dark: ${dark};
    --theme-light: ${light};
    --theme-tint: ${tint};
  }`;

  let content;

  if (slide.type === "title") {
    content = `
      <div class="title-slide">
        <div class="wm" aria-hidden="true">${num}</div>
        <div class="tag">CARD NEWS</div>
        <h1>${heading}</h1>
        <div class="divider"></div>
        <p>${body}</p>
        <div class="indicator">${num} / ${total}</div>
        <div class="edge-bar"></div>
      </div>`;
  } else if (slide.type === "closing") {
    content = `
      <div class="closing-slide">
        <div class="quote-mark" aria-hidden="true">&rdquo;</div>
        <div class="tag">CARD NEWS</div>
        <h1>${heading}</h1>
        <div class="divider"></div>
        <p>${body}</p>
        <div class="indicator">${num} / ${total}</div>
        <div class="edge-bar"></div>
      </div>`;
  } else {
    const { lead, support } = splitLead(body);
    content = `
      <div class="content-slide">
        <div class="wm" aria-hidden="true">${num}</div>
        <div class="eyebrow-row">
          <div class="num-badge">${num}</div>
          <div class="tag">CARD NEWS</div>
        </div>
        <div class="content-body">
          <h1>${heading}</h1>
          <div class="divider"></div>
          <p class="lead">${lead}</p>
          ${support ? `<p class="support">${support}</p>` : ""}
        </div>
        <div class="indicator">${num} / ${total}</div>
        <div class="edge-bar"></div>
      </div>`;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>${vars}\n${css}</style>
</head><body class="${slide.type}">${content}</body></html>`;
}

async function renderDiaryShot(outputDir, totalSlides, page) {
  const images = [];
  for (let i = 1; i <= totalSlides; i++) {
    const num = String(i).padStart(2, "0");
    const imgPath = path.join(outputDir, `slide-${num}.png`);
    const data = fs.readFileSync(imgPath).toString("base64");
    images.push(`data:image/png;base64,${data}`);
  }

  const cols = 5;
  const cell = 260;
  const gap = 12;
  const rows = Math.ceil(totalSlides / cols);
  const gridW = cols * cell + (cols - 1) * gap;
  const gridH = rows * cell + (rows - 1) * gap;
  const pad = 44;

  const items = images
    .map(
      (src) =>
        `<div style="width:${cell}px;height:${cell}px;border-radius:10px;overflow:hidden;box-shadow:0 3px 10px rgba(0,0,0,0.14);">
        <img src="${src}" style="width:100%;height:100%;object-fit:cover;"></div>`
    )
    .join("");

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body { margin:0; width:${gridW + pad * 2}px; height:${gridH + pad * 2}px;
           display:flex; align-items:center; justify-content:center; background:#eef0ef; }
    .grid { display:grid; grid-template-columns:repeat(${cols},${cell}px); gap:${gap}px; }
  </style></head><body><div class="grid">${items}</div></body></html>`;

  await page.setViewport({
    width: gridW + pad * 2,
    height: gridH + pad * 2,
  });
  await page.setContent(html);
  await page.screenshot({
    path: path.join(outputDir, "diary-shot.png"),
    type: "png",
  });
  console.log("  Rendered diary-shot.png");
}

/** Raised when the renderer's own validation of its output fails (wrong file
 * count, an empty file, etc) — distinct from a Puppeteer/browser failure. */
export class RenderValidationError extends Error {
  constructor(problems) {
    super(`Rendering validation failed:\n${problems.map((p) => `- ${p}`).join("\n")}`);
    this.name = "RenderValidationError";
    this.problems = problems;
  }
}

/** Remove any slide/diary PNGs in a directory (used only on the *new*,
 * already-validated render before the atomic swap into place — see
 * ``renderSlides``). cards.json and any metadata file are left untouched. */
function clearRenderArtifacts(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (/^slide-\d+\.png$/.test(name) || name === "diary-shot.png") {
      fs.unlinkSync(path.join(dir, name));
    }
  }
}

function validateRenderedOutput(outputDir, total) {
  const problems = [];
  const seen = new Set();
  for (let i = 1; i <= total; i++) {
    const num = String(i).padStart(2, "0");
    const file = `slide-${num}.png`;
    const full = path.join(outputDir, file);
    if (!fs.existsSync(full)) {
      problems.push(`missing ${file}`);
      continue;
    }
    if (seen.has(file)) problems.push(`duplicate ${file}`);
    seen.add(file);
    if (fs.statSync(full).size === 0) problems.push(`${file} is empty`);
  }
  const diaryPath = path.join(outputDir, "diary-shot.png");
  if (!fs.existsSync(diaryPath)) problems.push("missing diary-shot.png");
  else if (fs.statSync(diaryPath).size === 0) problems.push("diary-shot.png is empty");
  return problems;
}

/**
 * Render a deck's slides + diary shot into ``outputDir``.
 *
 * Renders into a temporary staging directory first, validates the complete
 * result there, and only then moves the new files into ``outputDir`` — a
 * failed or partial render (Puppeteer crash, missing template, an empty
 * PNG) never touches a pre-existing successful render in ``outputDir``. The
 * previous version cleared old slide files *before* rendering the new ones,
 * which meant a render that failed outright left the directory with fewer
 * slides than before, or none. This is the fix for that: nothing in
 * ``outputDir`` is removed or replaced until the new render is confirmed
 * complete.
 */
export async function renderSlides(cards, outputDir) {
  const css = readCSS();
  const total = cards.slides.length;
  const stagingDir = `${outputDir}.rendering-tmp`;
  fs.rmSync(stagingDir, { recursive: true, force: true });
  fs.mkdirSync(stagingDir, { recursive: true });

  let browser;
  try {
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();
      await page.setViewport({ width: 1080, height: 1080 });

      for (const slide of cards.slides) {
        const html = buildSlideHTML(slide, cards.theme_color, total, css);
        await page.setContent(html, { waitUntil: "load" });
        const num = String(slide.slide_number).padStart(2, "0");
        await page.screenshot({
          path: path.join(stagingDir, `slide-${num}.png`),
          type: "png",
        });
        console.log(`  Rendered slide-${num}.png`);
      }

      await renderDiaryShot(stagingDir, total, page);
    } finally {
      // Always close the browser, even if a screenshot or setContent call
      // throws partway through — previously an error mid-loop skipped
      // browser.close() entirely, leaking a headless Chromium process.
      if (browser) await browser.close();
    }

    const problems = validateRenderedOutput(stagingDir, total);
    if (problems.length) throw new RenderValidationError(problems);

    // Validated — now it's safe to replace whatever was in outputDir.
    fs.mkdirSync(outputDir, { recursive: true });
    clearRenderArtifacts(outputDir);
    for (const name of fs.readdirSync(stagingDir)) {
      fs.renameSync(path.join(stagingDir, name), path.join(outputDir, name));
    }
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}
