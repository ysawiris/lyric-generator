# Lyric Generator

Generate song lyrics by vibe. Works offline by default; optionally enhances with Claude when you have an API key.

## Quick start

```bash
npm install
npm test          # runs the test suite (no API key needed)
npm run dev       # starts the server on http://localhost:3000
```

For Claude-enhanced output:

```bash
cp .env.example .env
# fill in ANTHROPIC_API_KEY
npm run dev
```

## How it works

**Offline mode (default).** Each "vibe" (heartbroken, hype, summer, nostalgic) has a curated word bank (nouns, verbs, places, feelings) and a set of templated lines with `{slot}` placeholders. The generator:

1. Fills templates with vibe-appropriate words
2. Pairs lines into AABB couplets via a vowel-cluster rhyme matcher
3. Assembles a verse → chorus → verse → chorus → bridge → chorus structure
4. Echoes the seed back so any output is reproducible

**Claude mode.** If you've set `ANTHROPIC_API_KEY`, the UI shows a checkbox that routes generation through `claude-haiku-4-5-20251001` with a system prompt that enforces structure and style.

## Hosting

The static UI runs fully in the browser (offline mode only) and deploys to GitHub Pages from `public/` via `.github/workflows/pages.yml`. The Express server is only needed locally for the Claude-enhanced path.

## API (local server only)

```
GET  /api/artists      → { artists, schemes, defaultScheme, claudeAvailable, orders }
POST /api/generate     → { artists, theme, seed?, sections, text, mode }
GET  /healthcheck      → { status: "UP" }
```

POST body:

```json
{
  "artists": ["drake", "kendrick"],
  "theme": "the city",
  "seed": 42,
  "order": 2,
  "scheme": "AABB",
  "useClaude": false
}
```

## Project layout

```
app.js                       — Express server (local dev / Claude path)
lib/claude.js                — optional Claude API path (server-only)
public/index.html            — UI entry
public/js/app.js             — browser bootstrap (imports generator directly)
public/lib/wordbanks.js      — artists, lexical pools, templates
public/lib/rhyme.js          — pseudo-rhyme matcher
public/lib/markov.js         — Nth-order reverse Markov chain
public/lib/schemes.js        — rhyme scheme catalog
public/lib/generate.js       — offline generation
public/lib/corpora.js        — per-artist seed lines
test/generate.test.js        — node:test suite
.github/workflows/pages.yml  — GitHub Pages deploy
```

## Adding a new artist

Edit `public/lib/wordbanks.js`, add a new entry under `ARTISTS` with `display`, `color`, `nouns`, `verbs`, `places`, `feelings`, `colors`, `time`, and `templates`. Add seed lines under the same key in `public/lib/corpora.js`. Re-run `npm test`.

## License

MIT
