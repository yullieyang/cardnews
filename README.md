# cardnews

A Claude-powered CLI workflow that turns a topic into a schema-validated
10-slide visual briefing, rendered by a deterministic Puppeteer pipeline into
a reviewable 1080×1080 PNG deck.

```bash
npm install
export ANTHROPIC_API_KEY=...
npm start -- "how vertical farms are feeding cities"
```

## 1. Project overview

CardNews is a working CLI prototype: give it a topic, and it produces a
10-slide "card news" deck — one title slide, eight content slides, one
closing slide — as both an inspectable JSON artifact and a rendered PNG
deck with a thumbnail grid. Claude drafts the slide content; everything
downstream of that (validation, rendering, file output) is deterministic
code with no model involved.

## 2. Intended user

Designed for someone who needs to turn a topic into a consistent visual
briefing without manually drafting, structuring, formatting, and rendering
every slide from scratch. No real team has adopted this tool — it is a
working demonstration of the pipeline. The repository includes an archive
of generated example decks from repeated runs of this pipeline over time;
the workflow documentation below highlights one representative sample for
walkthrough purposes (see §13).

## 3. Problem

Producing a visual briefing from a topic normally means doing every step by
hand: researching, structuring the narrative into a slide sequence, drafting
copy for each slide, formatting consistently, rendering to images, and
reviewing the result — one slide at a time, repeated for every deck.

## 4. Workflow before the tool

No measured time savings are claimed. Qualitatively: a user would research a
topic, draft ten slides of copy, decide on sequencing and emphasis, format
each slide (by hand or in a design tool), export each one, and assemble a
set for review — all separate manual steps with no shared structure between
runs.

## 5. What the project supports

- A CLI that accepts a topic (plus optional audience/tone/language/key-point
  controls) and produces a validated `cards.json` and a rendered PNG deck.
- Explicit schema validation of the generated deck (exact slide count,
  supported slide types, required fields, length limits) — see §10.
- One bounded correction retry when Claude's output is schema-invalid, with
  the validation errors fed back as a targeted correction prompt — see §18.
- Clear, distinguishable failure modes: a Claude API error, unparseable
  JSON, and a schema-invalid deck all produce a specific, human-readable
  error and a specific exit code, rather than an uncaught crash.
- A `--render` command that re-renders an existing, valid `cards.json`
  without calling Claude again — see §16.
- A `--generate-only` command that produces just the JSON artifact.
- Deterministic rendering safety: a render is staged in a temporary
  directory and validated before it replaces any existing output, so a
  failed or partial render can never corrupt a prior successful one — see
  §17.
- Run metadata (`run-metadata.json`) recording topic, provider, model,
  timestamps, retry count, and generation/rendering status for every run.
- A human-review checklist printed after every successful run.
- 33 automated tests covering schema validation, generation error handling,
  CLI argument parsing, and real Puppeteer rendering — all offline, no API
  key required.

## 6. Architecture

```
Topic
  │
  ▼
Claude API (claude-sonnet-4-6)
  │  one bounded correction retry on schema-invalid output
  ▼
Structured slide JSON  ──────►  cards.json (saved artifact)
  │
  ▼
Deterministic HTML/CSS + Puppeteer rendering
(staged, validated, then swapped into place)
  │
  ▼
10 PNG slides + thumbnail grid + run-metadata.json
  │
  ▼
Human editorial review
```

`scripts/index.js` is the CLI entry point. `scripts/generator.js` calls
Claude and validates its response. `scripts/schema.js` defines and checks
the deck schema. `scripts/renderer.js` turns a validated deck into PNGs via
Puppeteer. `scripts/cli-utils.js` holds pure argument/filename helpers.

## 7. Why Claude is used

Drafting slide copy — a title, a structured sequence of key points, and a
closing summary — is the part of this workflow that benefits from
generative reasoning: turning an open-ended topic into a specific,
well-sequenced narrative. Claude is used for exactly that step and nothing
downstream of it.

## 8. Why rendering is deterministic

Once the slide content exists as structured JSON, turning it into images is
a fixed, repeatable transformation — the same JSON should always produce
the same PNGs. Keeping that step in plain HTML/CSS/Puppeteer code (no model
call) makes the visual output reproducible, debuggable, and re-renderable
without any API cost.

## 9. Input

A free-text topic (any language — the renderer and prompt both handle
non-English text; the CLI's own usage example is Korean), plus optional
flags: `--audience=`, `--tone=`, `--language=`, `--key-points=a;b;c`,
`--output-dir=`. Default behavior needs only the topic.

## 10. Structured output schema

Defined and enforced in `scripts/schema.js` (`validateDeck`), against the
actual fields the renderer reads:

```
{
  title: string,
  theme_color: "#rrggbb",
  slides: [
    { slide_number: 1,  type: "title",   heading: string, body: string },
    { slide_number: 2..9, type: "content", heading: string, body: string },
    { slide_number: 10, type: "closing", heading: string, body: string }
  ]
}
```

Validation rejects: any other top-level or slide-level field, a slide count
other than exactly 10, an unsupported `type` value, a `type` that doesn't
match its expected position, a missing/empty `heading` or `body`, headings
over 200 characters, bodies over 800 characters, and a `theme_color` that
isn't a `#rrggbb` hex string. This replaces the previous README's claim of
"schema-constrained... typed request/response handling" — there was no
validation code before this pass; the shape was only a prompt instruction
and a bare `JSON.parse`.

## 11. Example JSON

Real generated content (`output/microplastics-everywhere-what-we-know/cards.json`,
first two of ten slides):

```json
{
  "title": "Microplastics Are Everywhere",
  "theme_color": "#1A6B8A",
  "slides": [
    {
      "slide_number": 1,
      "type": "title",
      "heading": "Microplastics Are Everywhere",
      "body": "From the deep ocean to human blood — what science knows, what it fears, and what comes next"
    },
    {
      "slide_number": 2,
      "type": "content",
      "heading": "What Are Microplastics?",
      "body": "Microplastics are plastic fragments smaller than 5mm. They come from degrading larger plastics, synthetic fibers in laundry, and microbeads in cosmetics."
    }
  ]
}
```

## 12. Rendering workflow

`scripts/renderer.js` builds one full HTML document per slide (CSS custom
properties carry the deck's `theme_color` into the shared stylesheet),
screenshots each to a 1080×1080 PNG via Puppeteer, and composes a 5×2
thumbnail grid (`diary-shot.png`) from the ten rendered images. The render
happens in a temporary staging directory first; only after every file is
confirmed present and non-empty does it get moved into the real output
directory (see §17).

**Visual design, corrected:** the previous README described the templates
as "gradient background, centered white text" for the title/closing
layouts. That predates a redesign and is no longer accurate. The templates
actually in `templates/styles.css` — confirmed by reading the file and the
rendered slides — use a solid white background with near-black heading text
for the title/content slides, and a solid theme-color background (white
text) for the closing slide only.

## 13. Tangible outputs

`output/microplastics-everywhere-what-we-know/` is the representative
example used for the walkthrough in this README: `cards.json`, ten
1080×1080 PNG slides, and `diary-shot.png` — a real, unedited output of
this pipeline, not a hand-assembled sample.

The repository also includes an archive of additional generated example
decks under `output/` from repeated runs of this pipeline over time on a
range of topics. These are historical artifacts, not curated or
individually reviewed for this README, and some were generated by an
automated process independent of this repository's documented CLI
workflow. They are kept for reference but are not the basis for any claim
in this document — only the representative sample above is described and
verified here.

## 14. Quick start

```bash
npm install
export ANTHROPIC_API_KEY=...
npm test              # 33 tests, no API key needed for this
npm start -- "<topic>"
```

## 15. Generate-and-render command

```bash
npm start -- "how vertical farms are feeding cities"
npm start -- "a topic" --audience="general readers" --tone="playful"
npm start -- "a topic" --generate-only     # cards.json only, no render
```

## 16. Render-existing-JSON command

```bash
npm start -- --render output/microplastics-everywhere-what-we-know/cards.json
```

Re-renders a previously saved, schema-valid `cards.json` without calling
Claude again — useful for iterating on the visual templates, or for
re-rendering after a manual edit to the JSON, at no API cost. Verified in
this pass: run against the committed example deck, producing 10 fresh
PNGs and a diary shot, with `run-metadata.json` correctly recording
`"provider": "none (rendered from an existing JSON file, no Claude call)"`.

## 17. Output directory structure

```
output/<topic-slug>/
├── cards.json           # structured content (from Claude, or hand-edited)
├── slide-01.png ...     # 10 individual 1080x1080 slides
├── diary-shot.png       # 5x2 thumbnail grid
└── run-metadata.json    # timestamp, provider, model, retries, status
```

**Rerun behavior:** re-running the same topic renders into a temporary
staging directory, validates the complete result there, and only then
replaces the files in the real output directory. A render that fails
outright — a Puppeteer crash, a missing template — never touches a
pre-existing successful render; this was verified directly by a test that
forces a mid-render failure and confirms the prior slide-01.png is
byte-identical afterward (`tests/renderer.test.js`). A shorter re-render
(fewer slides than before) also can't leave stale slide files from a
longer prior run mixed into the new deck.

**Path safety:** the topic-to-folder-name slug strips filesystem-unsafe
characters and leading dots and falls back to a timestamp-based name if a
topic sanitizes to an empty string — previously that case resolved to the
`output/` directory itself.

## 18. Error handling and retry behavior

Three distinct failure modes, each with its own exception type, error
message, and exit code:

| Failure | Exception | Exit code | Retry? |
|---|---|---|---|
| Claude API call fails (auth, network, rate limit) | `ProviderError` | 2 | No |
| Model response isn't parseable JSON | `InvalidJSONError` | 3 | No |
| Valid JSON but fails deck schema | `SchemaValidationError` | 4 | One correction retry, then fails |
| Rendering validation fails | `RenderValidationError` | 5 | No |

A schema-invalid response gets exactly one correction turn — the model is
shown only the specific validation errors and asked to fix them — never an
unbounded retry loop. The raw invalid response is saved locally
(`invalid-response.txt`) for debugging in the failed run's output
directory; it is never printed to a shared log or included in any committed
artifact. Puppeteer's browser is always closed in a `finally` block, even
if a screenshot call throws mid-render — previously an error partway
through the render loop skipped `browser.close()` entirely.

## 19. Tests

33 tests, entirely offline (`npm test`, Node's built-in test runner — no
new dependency added):

- `tests/schema.test.js` (12) — valid deck, wrong slide count, missing
  field, unsupported type, wrong type for position, invalid color format,
  unexpected fields, length limits, non-object/null input.
- `tests/generator.test.js` (7) — valid response, markdown-fenced response,
  provider-error path, invalid-JSON path (no retry consumed), schema-invalid
  path (exactly one retry then success or failure), content-controls
  pass-through. Uses an injectable fake Anthropic client — no network call,
  no API key.
- `tests/cli-utils.test.js` (10) — slug sanitization including the
  empty-after-sanitization fallback, argument parsing for all flags.
- `tests/renderer.test.js` (4) — real Puppeteer rendering: exact file set
  and non-empty PNGs, no leftover staging directory, safe re-render with
  fewer slides, and a failed render leaving a prior successful render
  byte-identical.

## 20. Human review

Every successful run prints a review checklist (also shown below). Slide
copy from Claude is a draft in every case — nothing in this pipeline
verifies factual claims, checks tone, or confirms appropriateness for an
audience.

```
Before publishing this deck, review:
  [ ] Every factual claim is source-checked against an authoritative reference
  [ ] Tone and framing are appropriate for the intended audience
  [ ] No confidential or non-public information appears in the topic or slides
  [ ] The visual output has been inspected slide by slide
  [ ] The deck is labeled as AI-assisted with a named human reviewer
```

## 21. Responsible use

- **Drafts only.** Slide copy is a starting point for a human author to
  edit, not publish-ready content.
- **No proprietary or confidential topics.** The topic becomes part of the
  prompt sent to the API.
- **No fabricated sources.** The generation prompt explicitly instructs
  Claude not to fabricate citations or claim factual verification — but
  nothing downstream checks this; it depends on the model following the
  instruction and on human review afterward.
- **Disclose AI use.** Label a published deck as AI-assisted and name the
  human who reviewed it.

## 22. Security and privacy assumptions

- No API keys are committed; the topic and generated content are the only
  data sent to the Anthropic API.
- The invalid-response debug file (`invalid-response.txt`) is written only
  to a local, gitignored-by-convention output folder — never logged
  elsewhere or included in a committed example.
- No authentication, access control, or multi-user concerns apply — this is
  a local CLI tool with no server component.
- This project does not implement production security or compliance
  controls of any kind.

## 23. Limitations

- No automated fact-checking or source verification of any kind — every
  factual claim depends entirely on human review.
- Only three fixed visual layouts (title/content/closing); customization
  requires editing `templates/styles.css` directly.
- Requires an Anthropic API key and incurs API + Puppeteer rendering cost
  per generation run (the `--render` command has no API cost).
- The correction retry is bounded to one attempt; a model response that's
  schema-invalid twice in a row fails the run rather than retrying further.
- No CI configuration exists; tests are run manually.
- **The live Claude generation path was not executed against the real API
  during this development pass** — no `ANTHROPIC_API_KEY` was available in
  this environment. Verification instead used: (1) the real rendering
  pipeline exercised against the previously-committed, real
  Claude-generated example JSON (§13, §16), and (2) 33 automated tests
  using an injectable fake Anthropic client for the generation path and a
  real headless Puppeteer for the rendering path. A rendering-fixture pass
  is not the same as a live Claude generation run, and this README does not
  claim the generation path was live-tested in this environment.

## 24. Design decisions and iteration

- **Why model output is constrained to JSON, not free text:** the renderer
  needs a stable shape to build HTML from; free text can't be validated or
  rendered deterministically.
- **Why JSON is saved before rendering:** so a deck is inspectable and
  re-renderable (`--render`) without a Claude call, and so a rendering
  failure never loses the generated content.
- **Why generation and rendering are separated into distinct modules:** to
  keep the model-dependent step and the deterministic step independently
  testable, debuggable, and re-runnable.
- **Why one bounded retry rather than an unlimited loop:** to reduce
  malformed output from transient model mistakes while keeping failure
  predictable and cheap — an open-ended retry loop trades a clear failure
  for an unclear one.
- **Why rendering stages to a temp directory before swapping in:** during
  implementation, a render failing partway through would leave a directory
  with fewer files than a previous successful run, silently corrupting it.
  Staging and validating before the swap was added to prevent that.
- **Why the default test suite requires no API key:** to keep the test
  suite runnable by anyone, including in CI, without a paid credential —
  the generation tests use an injectable fake client instead.
- **Why the README walkthrough highlights one sample rather than the full
  archive:** the repository accumulates additional example decks over time
  from repeated pipeline runs; calling out one specific, verified example
  keeps the documentation concrete and reviewable without asking a reader
  to inspect dozens of historical folders individually.
- **Why factual verification is out of scope:** automated fact-checking is
  a materially different, much harder problem than structured content
  generation and deterministic rendering; this project doesn't attempt it,
  and the responsible-use documentation says so explicitly rather than
  implying otherwise.

## 25. Future work

- Citation or source-linking support, so factual claims are easier for a
  human reviewer to verify.
- Additional visual templates beyond the current three layouts.
- An editable export format (e.g. layered assets) instead of flattened
  PNGs only.
- A CI configuration to run the test suite automatically.
- Execute a live generation run against the real Claude API once a key is
  available, and commit that run's artifacts labeled explicitly as a live
  sample (distinct from the fixture-based verification in this pass).
