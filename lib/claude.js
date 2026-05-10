import Anthropic from "@anthropic-ai/sdk";
import { ARTISTS, ARTIST_KEYS } from "./wordbanks.js";
import { resolveScheme, DEFAULT_SCHEME } from "./schemes.js";

const MODEL = process.env.LYRIC_MODEL || "claude-haiku-4-5-20251001";

// Per-artist style notes used in the system prompt. We describe themes,
// register, and aesthetic — not literal lyrics.
const STYLE_NOTES = {
	drake:
		"Drake's emotional, melodic late-night register: Toronto / 'the 6' setting, ex-relationships, " +
		"phone calls and voicemails, vulnerability under the boasting, real-ones-versus-fakes, the come-up.",
	jcole:
		"J. Cole's storytelling and introspection: Fayetteville / Carolina roots, family and faith, " +
		"the tension between street life and success, fatherhood, conversational cadence.",
	kendrick:
		"Kendrick Lamar's poetic, layered style: Compton, generational and racial weight, " +
		"faith versus mortality, internal conflict, biblical imagery, urgent flow shifts.",
};

export function isClaudeAvailable() {
	return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Ask Claude to write lyrics inspired by the requested artists. Output is
 * original; the prompt forbids quoting actual lyrics or copyrighted lines.
 *
 * @param {object} opts
 * @param {string[]} opts.artists
 * @param {string} [opts.theme]
 * @param {string} [opts.scheme] — rhyme scheme key
 */
export async function generateWithClaude({ artists, theme = "", scheme }) {
	if (!isClaudeAvailable()) {
		throw new Error("ANTHROPIC_API_KEY is not set");
	}
	const list = (Array.isArray(artists) ? artists : [artists]).map((a) =>
		String(a || "").toLowerCase().trim()
	);
	for (const a of list) {
		if (!ARTIST_KEYS.includes(a)) {
			throw new Error(`Unknown artist "${a}". Valid: ${ARTIST_KEYS.join(", ")}`);
		}
	}
	if (list.length === 0) {
		throw new Error(`At least one artist must be selected.`);
	}

	const resolvedScheme = resolveScheme(scheme ?? DEFAULT_SCHEME);
	const schemeNote =
		resolvedScheme.pattern === "FFFF"
			? "Use natural rhymes where they fit — no forced scheme."
			: `Each verse and chorus should follow the ${resolvedScheme.name} rhyme scheme (${resolvedScheme.description}). Lines that share a letter must rhyme. The bridge can use the first two characters of the scheme.`;

	const styleSummary = list.map((a) => `- ${ARTISTS[a].display}: ${STYLE_NOTES[a]}`).join("\n");
	const themeLine = theme ? `Weave the theme word "${theme}" through several lines naturally.\n` : "";
	const blendNote =
		list.length > 1
			? `Blend the styles thoughtfully — alternate between voices across verses, or fuse the perspectives.\n`
			: "";

	const client = new Anthropic({
		defaultHeaders: { "anthropic-beta": "prompt-caching-2024-07-31" },
	});

	const message = await client.messages.create({
		model: MODEL,
		max_tokens: 900,
		system: [
			{
				type: "text",
				text:
					"You are a songwriter writing ORIGINAL lyrics inspired by the thematic style of " +
					"specific hip-hop artists. Capture their settings, emotional register, and aesthetic " +
					"vocabulary — never quote, paraphrase, or closely mimic actual lyrics from real songs. " +
					"Output ONLY the lyrics, structured with section headers in square brackets like " +
					"[Verse 1], [Chorus], [Bridge]. Use natural line breaks within sections. " +
					"Aim for: Verse 1, Chorus, Verse 2, Chorus, Bridge, Chorus. Avoid clichés. " +
					"Avoid profanity and explicit content; the output should be PG-13 at most. " +
					"Use AABB or ABAB rhyme schemes where natural.",
				cache_control: { type: "ephemeral" },
			},
		],
		messages: [
			{
				role: "user",
				content: `Write a song in the style of:\n${styleSummary}\n\n${blendNote}${themeLine}${schemeNote}\n\nKeep verses around 4 lines and choruses around 4 lines.`,
			},
		],
	});

	const text = message.content
		.filter((b) => b.type === "text")
		.map((b) => b.text)
		.join("\n")
		.trim();

	return {
		artists: list,
		display: list.map((a) => ARTISTS[a].display).join(" × "),
		theme: theme || null,
		scheme: resolvedScheme.name,
		schemePattern: resolvedScheme.pattern,
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
