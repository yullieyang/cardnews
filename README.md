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
