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

## API

```
GET  /api/vibes        → { vibes: ["heartbroken", ...], claudeAvailable: bool }
POST /api/generate     → { vibe, theme, seed?, sections, text, mode }
GET  /healthcheck      → { status: "UP" }
```

POST body:

```json
{
  "vibe": "summer",
  "theme": "ocean",
  "seed": 42,
  "useClaude": false
}
```

## Project layout

```
app.js                 — Express server
lib/wordbanks.js       — vibes, lexical pools, templates
lib/rhyme.js           — pseudo-rhyme matcher (vowel-cluster + equivalence groups)
lib/generate.js        — offline generation
lib/claude.js          — optional Claude API path
public/                — UI (vanilla HTML/CSS/JS)
test/generate.test.js  — node:test suite
```

## Adding a new vibe

Edit `lib/wordbanks.js`, add a new entry under `VIBES` with `nouns`, `verbs`, `places`, `feelings`, `colors`, `time`, and `templates`. Re-run `npm test`. The UI picks up new vibes automatically via `/api/vibes`.

## License

MIT
