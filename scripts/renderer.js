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
    .replace(/"/g, "&quot;");
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

function buildSlideHTML(slide, themeColor, totalSlides, css) {
  const dark = darken(themeColor);
  const light = lighten(themeColor);
  const num = String(slide.slide_number).padStart(2, "0");
  const total = String(totalSlides).padStart(2, "0");
  const heading = escapeHTML(slide.heading);
  const body = escapeHTML(slide.body);

  const vars = `:root {
    --theme: ${themeColor};
    --theme-dark: ${dark};
    --theme-light: ${light};
  }`;

  let content;

  if (slide.type === "title") {
    content = `
      <div class="title-slide">
        <div class="accent-line"></div>
        <h1>${heading}</h1>
        <p>${body}</p>
        <div class="indicator">${num} / ${total}</div>
      </div>`;
  } else if (slide.type === "closing") {
    content = `
      <div class="closing-slide">
        <h1>${heading}</h1>
        <p>${body}</p>
        <div class="indicator">${num} / ${total}</div>
      </div>`;
  } else {
    content = `
      <div class="content-slide">
        <div class="card">
          <span class="label">${num}</span>
          <h1>${heading}</h1>
          <p>${body}</p>
        </div>
        <div class="indicator">${num} / ${total}</div>
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
  const cell = 200;
  const gap = 8;
  const rows = Math.ceil(totalSlides / cols);
  const gridW = cols * cell + (cols - 1) * gap;
  const gridH = rows * cell + (rows - 1) * gap;
  const pad = 40;

  const items = images
    .map(
      (src) =>
        `<div style="width:${cell}px;height:${cell}px;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.12);">
        <img src="${src}" style="width:100%;height:100%;object-fit:cover;"></div>`
    )
    .join("");

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body { margin:0; width:${gridW + pad * 2}px; height:${gridH + pad * 2}px;
           display:flex; align-items:center; justify-content:center; background:#f5f5f5; }
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

export async function renderSlides(cards, outputDir) {
  const css = readCSS();
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1080 });

  const total = cards.slides.length;

  for (const slide of cards.slides) {
    const html = buildSlideHTML(slide, cards.theme_color, total, css);
    await page.setContent(html, { waitUntil: "load" });
    const num = String(slide.slide_number).padStart(2, "0");
    await page.screenshot({
      path: path.join(outputDir, `slide-${num}.png`),
      type: "png",
    });
    console.log(`  Rendered slide-${num}.png`);
  }

  await renderDiaryShot(outputDir, total, page);
  await browser.close();
}
