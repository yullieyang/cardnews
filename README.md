# cardnews

AI-powered **card-news generator** — turn any topic into a 10-slide social-media-ready visual deck (1080×1080 PNGs).

Built as a small Claude-Code-driven content automation tool: the Claude API produces structured content, Puppeteer + HTML/CSS templates render each slide.

## Quick start

```bash
npm install
export ANTHROPIC_API_KEY=...
npm start -- "<topic>"
```

Each run writes a directory under `output/<topic-slug>/`:

```
cards.json          # structured content from Claude
slide-01.png ...    # 10 individual slides
diary-shot.png      # 5×2 thumbnail grid of the full deck
```

## Architecture

- **`scripts/index.js`** — CLI entry point. Parses the topic, sets up the output directory, orchestrates generation → rendering.
- **`scripts/generator.js`** — calls Claude (`claude-sonnet-4-6`) to produce a 10-slide JSON structure: title slide, 8 content slides, closing slide. Each slide has `heading`, `body`, and a `type` (`title` / `content` / `closing`).
- **`scripts/renderer.js`** — loads `templates/styles.css`, builds full HTML per slide with CSS custom properties for theming, renders each to PNG via Puppeteer, then composes a thumbnail grid.
- **`templates/styles.css`** — visual design. Three layout modes selected by body class: `.title` (gradient background, centered white text), `.content` (light background, white card with accent strip), `.closing` (gradient background, summary text).

## Requirements

- Node.js (ESM)
- An Anthropic API key in `ANTHROPIC_API_KEY`

## Stack

`Node.js` · `@anthropic-ai/sdk` · `Puppeteer` · `HTML/CSS templates`

## Responsible use

This is an applied LLM tooling demo, not an authoring tool. A few rules of
thumb apply to anything generated with it:

- **Drafts only.** Slide copy produced by the Claude API is a starting point
  for a human author to edit. Do not publish a deck without reading every
  line.
- **No proprietary or confidential topics.** The topic you pass becomes part
  of the prompt sent to the API. Do not pass non-public material.
- **Source-check every factual claim.** The model can produce confident,
  plausible, and incorrect statements. Verify dates, statistics, and names
  against authoritative sources before publishing.
- **Be explicit that AI was used.** When publishing a deck, label it as
  AI-assisted and credit the human author who reviewed and edited it.
- **Rate limits and cost.** Each run makes one API call to a chat model
  plus 10 Puppeteer renders. Keep an eye on usage if running in batch.

## Skills demonstrated

- **API integration** — typed request/response handling against the Claude
  API with structured JSON output.
- **Prompt design for structured outputs** — schema-constrained slide JSON
  (`title` / `content` / `closing` types with `heading` and `body`) so the
  renderer can rely on a stable shape.
- **Headless browser rendering** — Puppeteer + HTML/CSS templating with CSS
  custom properties for per-deck theming.
- **CLI ergonomics** — single-command workflow, slugged output directories,
  reproducible per-topic artifacts.

## Connects to research-support workflows

This project is not a research tool. It sits in the portfolio alongside the
research-support repos because the same engineering muscles — structured
LLM output, schema discipline, deterministic per-run artifacts, and clear
human-review boundaries — show up in any responsible AI workflow. The
research-support version of these patterns lives in
[llm-research-workflow-assistant](https://github.com/yullieyang/llm-research-workflow-assistant).
