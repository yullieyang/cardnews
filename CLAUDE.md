# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Card news generator agent. Takes a topic, uses the Claude API to generate structured 10-slide content, then renders each slide as a 1080x1080 PNG image using Puppeteer with HTML/CSS templates.

## Commands

```bash
npm install              # install dependencies
npm start -- "<topic>"   # generate card news for a topic
```

Requires `ANTHROPIC_API_KEY` environment variable.

## Architecture

- **scripts/index.js** — CLI entry point. Parses the topic arg, creates an `output/<topic-slug>/` folder, orchestrates generation then rendering.
- **scripts/generator.js** — Calls Claude API (`claude-sonnet-4-6`) to produce a JSON structure with 10 slides (title, 8 content, closing), each containing heading, body, and slide type. Saves as `cards.json`.
- **scripts/renderer.js** — Reads `templates/styles.css`, builds full HTML per slide with CSS custom properties for theming, renders to PNG via Puppeteer. Also generates `diary-shot.png` (5x2 thumbnail grid of all slides).
- **templates/styles.css** — Slide visual design. Three layout modes selected by body class: `.title` (gradient bg, centered white text), `.content` (light bg, white card with accent strip), `.closing` (gradient bg, summary text).

## Output Structure

Each run creates `output/<topic-slug>/` containing:
- `cards.json` — generated content from Claude
- `slide-01.png` through `slide-10.png` — individual slides
- `diary-shot.png` — overview grid of all slides
