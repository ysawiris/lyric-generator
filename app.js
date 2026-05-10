import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { generateLyrics, lyricsToText } from "./lib/generate.js";
import { ARTIST_KEYS, ARTISTS } from "./lib/wordbanks.js";
import { generateWithClaude, isClaudeAvailable } from "./lib/claude.js";
import { SCHEMES, SCHEME_KEYS, DEFAULT_SCHEME } from "./lib/schemes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/artists", (_req, res) => {
	const artists = ARTIST_KEYS.map((k) => ({
		key: k,
		display: ARTISTS[k].display,
		color: ARTISTS[k].color,
	}));
	const schemes = SCHEME_KEYS.map((k) => ({
		key: k,
		name: SCHEMES[k].name,
		pattern: SCHEMES[k].pattern,
		description: SCHEMES[k].description,
		visual: SCHEMES[k].visual,
	}));
	res.json({
		artists,
		schemes,
		defaultScheme: DEFAULT_SCHEME,
		claudeAvailable: isClaudeAvailable(),
		orders: { min: 1, max: 5, default: 2 },
	});
});

app.post("/api/generate", async (req, res) => {
	const { artists, theme = "", seed, order, scheme, useClaude = false } = req.body || {};

	try {
		if (useClaude && isClaudeAvailable()) {
			const result = await generateWithClaude({ artists, theme, scheme });
			return res.json({ ...result, mode: "claude" });
		}

		const seedNum = seed === undefined || seed === null || seed === "" ? undefined : Number(seed);
		const orderNum = order === undefined || order === null || order === "" ? undefined : Number(order);
		const result = generateLyrics({ artists, theme, seed: seedNum, order: orderNum, scheme });
		return res.json({ ...result, text: lyricsToText(result), mode: "offline" });
	} catch (err) {
		console.error("generate failed:", err.message);
		const status = /unknown|at least one/i.test(err.message) ? 400 : 500;
		return res.status(status).json({ error: err.message });
	}
});

app.get("/healthcheck", (_req, res) => res.json({ status: "UP" }));

app.use((_req, res) => {
	res.status(404).sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
	console.log(`Lyric generator listening on http://localhost:${PORT}`);
	if (!isClaudeAvailable()) {
		console.log("(offline mode only — set ANTHROPIC_API_KEY to enable Claude generation)");
	}
});
