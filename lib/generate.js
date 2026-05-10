import { ARTISTS, ARTIST_KEYS, mergeArtists, shortPlace } from "./wordbanks.js";
import { findRhymingLine, rhymes, rhymeKey, lastWord } from "./rhyme.js";
import { ReverseMarkov } from "./markov.js";
import { CORPORA } from "./corpora.js";

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

// Past-tense for {verb_ed} slot in some templates. Fall back to "{base}ed"
// if we can't form a clean past tense.
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

function generateTemplatedLine(palette, theme, rand) {
	return capitalize(fixArticles(fillTemplate(pick(palette.templates, rand), palette, theme, rand)));
}

// Build a per-artist reverse Markov chain at module load.
// Corpus = handwritten originals + bootstrap lines from the templates.
const MARKOV = (() => {
	const out = {};
	const bootstrapRand = rng(0xb007); // fixed seed so corpus is reproducible
	for (const key of ARTIST_KEYS) {
		const palette = ARTISTS[key];
		const lines = [...(CORPORA[key] || [])];
		// Add 240 templated lines to flesh out the chain's transitions.
		for (let i = 0; i < 240; i++) {
			lines.push(generateTemplatedLine(palette, null, bootstrapRand));
		}
		out[key] = new ReverseMarkov(lines);
	}
	return out;
})();

// Combine the per-artist chains for a multi-artist palette by taking the
// union of all their corpora. Cached so repeated requests share the chain.
const COMBO_CACHE = new Map();
function chainForArtists(artistKeys) {
	if (artistKeys.length === 1) return MARKOV[artistKeys[0]];
	const cacheKey = [...artistKeys].sort().join("|");
	if (COMBO_CACHE.has(cacheKey)) return COMBO_CACHE.get(cacheKey);
	const lines = [];
	for (const k of artistKeys) {
		lines.push(...(CORPORA[k] || []));
	}
	const palette = mergeArtists(artistKeys);
	const bootstrapRand = rng(0xc0de + artistKeys.length);
	for (let i = 0; i < 320; i++) {
		lines.push(generateTemplatedLine(palette, null, bootstrapRand));
	}
	const chain = new ReverseMarkov(lines);
	COMBO_CACHE.set(cacheKey, chain);
	return chain;
}

// Try to construct a line via Markov that ends in a word rhyming with `target`.
// Returns null if no rhyming end-word is in the chain or generation fails.
function generateRhymingMarkovLine(chain, target, rand) {
	const candidates = chain.wordsRhymingWith(target);
	if (candidates.length === 0) return null;
	// Try a few candidates; the chain may not produce a long-enough line for
	// some end-words because they're only seen at the end of short lines.
	const tries = Math.min(candidates.length, 8);
	const order = candidates.slice().sort(() => rand() - 0.5);
	for (let i = 0; i < tries; i++) {
		const word = order[i];
		const line = chain.generateLineEndingWith(word, rand);
		if (line && line.split(/\s+/).length >= 4) {
			return capitalize(fixArticles(line));
		}
	}
	return null;
}

// Build a couplet of two lines that rhyme. Line A is templated; line B is
// constructed via reverse Markov targeting a rhyme. Falls back to template
// search if Markov can't find a rhyming completion.
function generateCouplet(chain, palette, theme, rand) {
	const a = generateTemplatedLine(palette, theme, rand);
	const targetWord = lastWord(a);

	// Try Markov-driven rhyme first.
	const markovLine = generateRhymingMarkovLine(chain, targetWord, rand);
	if (markovLine) return [a, markovLine];

	// Fallback: brute-force templated candidates and pick a rhyming one.
	const MAX_TRIES = 40;
	const candidates = [];
	for (let i = 0; i < MAX_TRIES; i++) candidates.push(generateTemplatedLine(palette, theme, rand));
	const b = findRhymingLine(a, candidates) || candidates[0];
	return [a, b];
}

function generateVerse(chain, palette, theme, rand, lines = 4) {
	const out = [];
	for (let i = 0; i < lines / 2; i++) {
		out.push(...generateCouplet(chain, palette, theme, rand));
	}
	return out;
}

function generateChorus(chain, palette, theme, rand) {
	return generateVerse(chain, palette, theme, rand, 4);
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
 */
export function generateLyrics({ artists, theme = "", seed } = {}) {
	const artistKeys = normalizeArtists(artists);
	const palette = mergeArtists(artistKeys);
	const chain = chainForArtists(artistKeys);
	const finalSeed = Number.isFinite(seed) ? seed : Math.floor(Math.random() * 2 ** 31);
	const rand = rng(finalSeed);
	const cleanTheme = String(theme || "").trim().toLowerCase().split(/\s+/)[0] || null;

	const sections = [
		{ label: "Verse 1", lines: generateVerse(chain, palette, cleanTheme, rand) },
		{ label: "Chorus", lines: generateChorus(chain, palette, cleanTheme, rand) },
		{ label: "Verse 2", lines: generateVerse(chain, palette, cleanTheme, rand) },
		{ label: "Chorus", lines: generateChorus(chain, palette, cleanTheme, rand) },
		{ label: "Bridge", lines: generateVerse(chain, palette, cleanTheme, rand, 2) },
		{ label: "Chorus", lines: generateChorus(chain, palette, cleanTheme, rand) },
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
