import Anthropic from "@anthropic-ai/sdk";
import { VIBE_KEYS } from "./wordbanks.js";

const MODEL = process.env.LYRIC_MODEL || "claude-haiku-4-5-20251001";

export function isClaudeAvailable() {
	return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Ask Claude to write lyrics. Falls back to throwing if the key is missing —
 * caller should check `isClaudeAvailable()` first.
 *
 * @param {object} opts
 * @param {string} opts.vibe
 * @param {string} [opts.theme]
 * @returns {Promise<{vibe: string, theme: string|null, model: string, sections: Array<{label: string, lines: string[]}>, raw: string}>}
 */
export async function generateWithClaude({ vibe, theme = "" }) {
	if (!isClaudeAvailable()) {
		throw new Error("ANTHROPIC_API_KEY is not set");
	}
	if (!VIBE_KEYS.includes(vibe)) {
		throw new Error(`Unknown vibe "${vibe}"`);
	}

	const client = new Anthropic({
		defaultHeaders: { "anthropic-beta": "prompt-caching-2024-07-31" },
	});

	const themeLine = theme ? `Weave the theme word "${theme}" through several lines.\n` : "";

	const message = await client.messages.create({
		model: MODEL,
		max_tokens: 800,
		system: [
			{
				type: "text",
				text:
					"You are a songwriter. Produce original lyrics in the style requested. " +
					"Output ONLY the lyrics, structured with section headers in square brackets " +
					"like [Verse 1], [Chorus], [Bridge]. Use natural line breaks within sections. " +
					"Do not include any commentary, intro, or outro. " +
					"Aim for: Verse 1, Chorus, Verse 2, Chorus, Bridge, Chorus. " +
					"Use AABB or ABAB rhyme schemes where natural. Avoid clichés.",
				cache_control: { type: "ephemeral" },
			},
		],
		messages: [
			{
				role: "user",
				content: `Write a song with a "${vibe}" vibe.\n${themeLine}Keep it to about 4 lines per verse and 4 lines per chorus.`,
			},
		],
	});

	const text = message.content
		.filter((b) => b.type === "text")
		.map((b) => b.text)
		.join("\n")
		.trim();

	return {
		vibe,
		theme: theme || null,
		model: MODEL,
		sections: parseSections(text),
		raw: text,
	};
}

export function parseSections(text) {
	const sections = [];
	let current = null;
	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line) continue;
		const header = line.match(/^\[([^\]]+)\]$/);
		if (header) {
			if (current) sections.push(current);
			current = { label: header[1], lines: [] };
			continue;
		}
		if (!current) {
			current = { label: "Verse", lines: [] };
		}
		current.lines.push(line);
	}
	if (current) sections.push(current);
	return sections;
}
