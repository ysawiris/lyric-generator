import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { generateLyrics, lyricsToText } from "./lib/generate.js";
import { VIBE_KEYS } from "./lib/wordbanks.js";
import { generateWithClaude, isClaudeAvailable } from "./lib/claude.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/vibes", (_req, res) => {
	res.json({ vibes: VIBE_KEYS, claudeAvailable: isClaudeAvailable() });
});

app.post("/api/generate", async (req, res) => {
	const { vibe, theme = "", seed, useClaude = false } = req.body || {};

	if (!vibe || !VIBE_KEYS.includes(vibe)) {
		return res.status(400).json({
			error: `vibe must be one of: ${VIBE_KEYS.join(", ")}`,
		});
	}

	try {
		if (useClaude && isClaudeAvailable()) {
			const result = await generateWithClaude({ vibe, theme });
			return res.json({ ...result, mode: "claude" });
		}

		const seedNum = seed === undefined || seed === null || seed === "" ? undefined : Number(seed);
		const result = generateLyrics({ vibe, theme, seed: seedNum });
		return res.json({ ...result, text: lyricsToText(result), mode: "offline" });
	} catch (err) {
		console.error("generate failed:", err.message);
		return res.status(500).json({ error: err.message });
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
