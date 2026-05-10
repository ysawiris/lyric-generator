import { VIBES, VIBE_KEYS, shortPlace } from "./wordbanks.js";
import { findRhymingLine } from "./rhyme.js";

// Deterministic pseudo-RNG so callers can pass a seed and get reproducible
// output (handy for tests and "share this song" links). Mulberry32.
function rng(seed) {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6D2B79F5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function pick(arr, rand) {
	return arr[Math.floor(rand() * arr.length)];
}

function capitalize(line) {
	if (!line) return line;
	return line[0].toUpperCase() + line.slice(1);
}

// Fix "a" → "an" before vowel-initial words. Cheap regex pass.
function fixArticles(line) {
	return line.replace(/\b([Aa]) ([aeiouAEIOU])/g, (_, art, vowel) => {
		const an = art === "A" ? "An" : "an";
		return `${an} ${vowel}`;
	});
}

function fillTemplate(template, vibe, theme, rand) {
	const v = VIBES[vibe];
	return template.replace(/\{(\w+)\}/g, (_, slot) => {
		switch (slot) {
			case "noun":
				if (theme && rand() < 0.35) return theme;
				return pick(v.nouns, rand);
			case "verb_ing":
				return pick(v.verbs, rand)[1];
			case "verb_base":
				return pick(v.verbs, rand)[0];
			case "place":
				return pick(v.places, rand);
			case "place_short":
				return shortPlace(pick(v.places, rand));
			case "feeling":
				return pick(v.feelings, rand);
			case "color":
				return pick(v.colors, rand);
			case "time":
				return pick(v.time, rand);
			default:
				return slot;
		}
	});
}

function generateLine(vibe, theme, rand) {
	const v = VIBES[vibe];
	return capitalize(fixArticles(fillTemplate(pick(v.templates, rand), vibe, theme, rand)));
}

// Build a couplet of two lines that rhyme. Generates many candidate B lines
// and picks the first that rhymes with A; falls back to the first candidate
// if no rhyme is found.
function generateCouplet(vibe, theme, rand) {
	const MAX_TRIES = 40;
	const a = generateLine(vibe, theme, rand);
	const candidates = [];
	for (let i = 0; i < MAX_TRIES; i++) candidates.push(generateLine(vibe, theme, rand));
	const b = findRhymingLine(a, candidates) || candidates[0];
	return [a, b];
}

function generateVerse(vibe, theme, rand, lines = 4) {
	const out = [];
	for (let i = 0; i < lines / 2; i++) {
		out.push(...generateCouplet(vibe, theme, rand));
	}
	return out;
}

function generateChorus(vibe, theme, rand) {
	return generateVerse(vibe, theme, rand, 4);
}

/**
 * Generate offline lyrics.
 *
 * @param {object} opts
 * @param {string} opts.vibe — one of VIBE_KEYS
 * @param {string} [opts.theme] — optional theme word to weave through
 * @param {number} [opts.seed] — optional seed for reproducibility
 * @returns {{ vibe: string, theme: string|null, seed: number, sections: Array<{label: string, lines: string[]}>}}
 */
export function generateLyrics({ vibe, theme = "", seed } = {}) {
	if (!vibe || !VIBES[vibe]) {
		throw new Error(`Unknown vibe "${vibe}". Valid: ${VIBE_KEYS.join(", ")}`);
	}
	const finalSeed = Number.isFinite(seed) ? seed : Math.floor(Math.random() * 2 ** 31);
	const rand = rng(finalSeed);
	const cleanTheme = String(theme || "").trim().toLowerCase().split(/\s+/)[0] || null;

	const sections = [
		{ label: "Verse 1", lines: generateVerse(vibe, cleanTheme, rand) },
		{ label: "Chorus", lines: generateChorus(vibe, cleanTheme, rand) },
		{ label: "Verse 2", lines: generateVerse(vibe, cleanTheme, rand) },
		{ label: "Chorus", lines: generateChorus(vibe, cleanTheme, rand) },
		{ label: "Bridge", lines: generateVerse(vibe, cleanTheme, rand, 2) },
		{ label: "Chorus", lines: generateChorus(vibe, cleanTheme, rand) },
	];

	return { vibe, theme: cleanTheme, seed: finalSeed, sections };
}

export function lyricsToText(result) {
	return result.sections
		.map((s) => `[${s.label}]\n${s.lines.join("\n")}`)
		.join("\n\n");
}
