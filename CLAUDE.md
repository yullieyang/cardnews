# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Card news generator. Takes a topic, uses the Claude API to generate a
schema-validated 10-slide JSON structure, then renders each slide as a
1080x1080 PNG image via Puppeteer with HTML/CSS templates. See README.md
for the full architecture, error-handling, and testing documentation.

## Commands

```bash
npm install
export ANTHROPIC_API_KEY=...
npm test                                 # 33 tests, no API key needed
npm start -- "<topic>"                   # generate + render
npm start -- "<topic>" --generate-only   # generate JSON only
npm start -- --render <path/to/cards.json>  # render existing JSON, no API call
```

## Architecture

- **scripts/index.js** — CLI entry point and subcommand dispatch (generate+render, generate-only, render-existing).
- **scripts/generator.js** — Calls Claude (`claude-sonnet-4-6`), validates the response against `scripts/schema.js`, and performs one bounded correction retry on schema-invalid output. Distinguishes `ProviderError` / `InvalidJSONError` / `SchemaValidationError`.
- **scripts/schema.js** — Deck schema validation (exact slide count, slide types by position, required fields, length limits).
- **scripts/renderer.js** — Renders a validated deck to PNGs via Puppeteer. Stages the render in a temp directory and validates it before swapping into the real output directory, so a failed render never corrupts a prior successful one.
- **scripts/cli-utils.js** — Pure argument-parsing and slug helpers (testable without invoking the CLI).
- **templates/styles.css** — Slide visual design. Three layout modes by body class: `.title` and `.content` (solid white background), `.closing` (solid theme-color background, white text).

## Output Structure

Each run creates `output/<topic-slug>/` containing:
- `cards.json` — generated content from Claude
- `slide-01.png` through `slide-10.png` — individual slides
- `diary-shot.png` — overview grid of all slides
- `run-metadata.json` — timestamp, provider, model, retries, status

## Tests

`npm test` runs 33 tests via Node's built-in test runner (`node --test`).
The generation tests use an injectable fake Anthropic client — no API key
or network access is required for the default test suite.
