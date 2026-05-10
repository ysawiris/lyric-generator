import { ARTISTS, ARTIST_KEYS, mergeArtists, shortPlace } from "./wordbanks.js";
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

// Fix "a" → "an" before vowel-initial words.
function fixArticles(line) {
	return line.replace(/\b([Aa]) ([aeiouAEIOU])/g, (_, art, vowel) => {
		const an = art === "A" ? "An" : "an";
		return `${an} ${vowel}`;
	});
}

// Past-tense for {verb_ed} slot in some templates. Fall back to "did
// {base}" if we can't form a clean past tense — we only use this slot
// occasionally so a small irregular table covers the cases we ship.
const IRREGULAR_PAST = {
	hold: "held",
	leave: "left",
	break: "broke",
	build: "built",
	hum: "hummed",
	miss: "missed",
	keep: "kept",
	swim: "swam",
	run: "ran",
	bleed: "bled",
	rise: "rose",
	seek: "sought",
	mourn: "mourned",
	pray: "prayed",
	preach: "preached",
	forget: "forgot",
	start: "started",
	change: "changed",
	text: "texted",
	call: "called",
	love: "loved",
	grow: "grew",
	write: "wrote",
	learn: "learned",
	chase: "chased",
	build: "built",
	watch: "watched",
	work: "worked",
	humble: "humbled",
	count: "counted",
};

function pastTense(base) {
	if (IRREGULAR_PAST[base]) return IRREGULAR_PAST[base];
	if (/[^aeiou]y$/.test(base)) return base.slice(0, -1) + "ied";
	if (base.endsWith("e")) return base + "d";
	return base + "ed";
}

function fillTemplate(template, palette, theme, rand) {
	// Don't inject theme as a noun if the theme word already appears in the
	// template literally (avoids "Loyalty is a loyalty we don't forget").
	const themeAlreadyPresent =
		theme && new RegExp(`\\b${theme}\\b`, "i").test(template);
	return template.replace(/\{(\w+)\}/g, (_, slot) => {
		switch (slot) {
			case "noun":
				if (theme && !themeAlreadyPresent && rand() < 0.35) return theme;
				return pick(palette.nouns, rand);
			case "verb_ing":
				return pick(palette.verbs, rand)[1];
			case "verb_base":
				return pick(palette.verbs, rand)[0];
			case "verb_ed":
				return pastTense(pick(palette.verbs, rand)[0]);
			case "place":
				return pick(palette.places, rand);
			case "place_short":
				return shortPlace(pick(palette.places, rand));
			case "feeling":
				return pick(palette.feelings, rand);
			case "color":
				return pick(palette.colors, rand);
			case "time":
				return pick(palette.time, rand);
			default:
				return slot;
		}
	});
}

function generateLine(palette, theme, rand) {
	return capitalize(fixArticles(fillTemplate(pick(palette.templates, rand), palette, theme, rand)));
}

// Build a couplet of two lines that rhyme. Generates many candidate B lines
// and picks the first that rhymes with A; falls back to the first candidate
// if no rhyme is found.
function generateCouplet(palette, theme, rand) {
	const MAX_TRIES = 40;
	const a = generateLine(palette, theme, rand);
	const candidates = [];
	for (let i = 0; i < MAX_TRIES; i++) candidates.push(generateLine(palette, theme, rand));
	const b = findRhymingLine(a, candidates) || candidates[0];
	return [a, b];
}

function generateVerse(palette, theme, rand, lines = 4) {
	const out = [];
	for (let i = 0; i < lines / 2; i++) {
		out.push(...generateCouplet(palette, theme, rand));
	}
	return out;
}

function generateChorus(palette, theme, rand) {
	return generateVerse(palette, theme, rand, 4);
}

function normalizeArtists(artists) {
	const arr = artists == null ? [] : Array.isArray(artists) ? artists : [artists];
	const seen = new Set();
	const out = [];
	for (const a of arr) {
		const lower = String(a || "").toLowerCase().trim();
		if (!lower) continue;
		if (!ARTISTS[lower]) {
			throw new Error(`Unknown artist "${lower}". Valid: ${ARTIST_KEYS.join(", ")}`);
		}
		if (seen.has(lower)) continue;
		seen.add(lower);
		out.push(lower);
	}
	if (out.length === 0) {
		throw new Error(`At least one artist must be selected. Valid: ${ARTIST_KEYS.join(", ")}`);
	}
	return out;
}

/**
 * Generate offline lyrics in the style of one or more artists.
 *
 * @param {object} opts
 * @param {string|string[]} opts.artists — one or more of ARTIST_KEYS
 * @param {string} [opts.theme] — optional theme word to weave through
 * @param {number} [opts.seed] — optional seed for reproducibility
 * @returns {{ artists: string[], display: string, theme: string|null, seed: number, sections: Array<{label: string, lines: string[]}>}}
 */
export function generateLyrics({ artists, theme = "", seed } = {}) {
	const artistKeys = normalizeArtists(artists);
	const palette = mergeArtists(artistKeys);
	const finalSeed = Number.isFinite(seed) ? seed : Math.floor(Math.random() * 2 ** 31);
	const rand = rng(finalSeed);
	const cleanTheme = String(theme || "").trim().toLowerCase().split(/\s+/)[0] || null;

	const sections = [
		{ label: "Verse 1", lines: generateVerse(palette, cleanTheme, rand) },
		{ label: "Chorus", lines: generateChorus(palette, cleanTheme, rand) },
		{ label: "Verse 2", lines: generateVerse(palette, cleanTheme, rand) },
		{ label: "Chorus", lines: generateChorus(palette, cleanTheme, rand) },
		{ label: "Bridge", lines: generateVerse(palette, cleanTheme, rand, 2) },
		{ label: "Chorus", lines: generateChorus(palette, cleanTheme, rand) },
	];

	return {
		artists: artistKeys,
		display: palette.display,
		theme: cleanTheme,
		seed: finalSeed,
		sections,
	};
}

export function lyricsToText(result) {
	return result.sections
		.map((s) => `[${s.label}]\n${s.lines.join("\n")}`)
		.join("\n\n");
}
