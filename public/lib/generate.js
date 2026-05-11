import { ARTISTS, ARTIST_KEYS, mergeArtists, shortPlace } from "./wordbanks.js";
import { findRhymingLine, rhymes, rhymeKey, lastWord } from "./rhyme.js";
import { ReverseMarkov } from "./markov.js";
import { CORPORA } from "./corpora.js";
import { resolveScheme, DEFAULT_SCHEME, SCHEME_KEYS } from "./schemes.js";

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

export const MIN_ORDER = 1;
export const MAX_ORDER = 5;
export const DEFAULT_ORDER = 2;

// Cache: "artists-sorted|order" → ReverseMarkov. Built lazily.
const CHAIN_CACHE = new Map();

function buildCorpusFor(artistKeys, bootstrapCount) {
	const lines = [];
	for (const k of artistKeys) lines.push(...(CORPORA[k] || []));
	const palette = mergeArtists(artistKeys);
	const bootstrapRand = rng(0xb007 + artistKeys.length);
	for (let i = 0; i < bootstrapCount; i++) {
		lines.push(generateTemplatedLine(palette, null, bootstrapRand));
	}
	return lines;
}

function chainForArtists(artistKeys, order) {
	const sortedKeys = [...artistKeys].sort();
	const cacheKey = `${sortedKeys.join("|")}#${order}`;
	const cached = CHAIN_CACHE.get(cacheKey);
	if (cached) return cached;
	const bootstrap = sortedKeys.length === 1 ? 240 : 320;
	const lines = buildCorpusFor(sortedKeys, bootstrap);
	const chain = new ReverseMarkov(lines, order);
	CHAIN_CACHE.set(cacheKey, chain);
	return chain;
}

function clampOrder(order) {
	if (!Number.isFinite(order)) return DEFAULT_ORDER;
	const n = Math.floor(order);
	if (n < MIN_ORDER) return MIN_ORDER;
	if (n > MAX_ORDER) return MAX_ORDER;
	return n;
}

function normalizeLineKey(line) {
	return line.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

// Try to construct a line via Markov that ends in a word rhyming with
// `target` and isn't a duplicate of any line in `seen`. Returns null if
// no rhyming end-word in the chain produces a fresh, long-enough line.
function generateRhymingMarkovLine(chain, target, rand, seen) {
	const candidates = chain.wordsRhymingWith(target);
	if (candidates.length === 0) return null;
	const tries = Math.min(candidates.length * 2, 16);
	const shuffled = candidates.slice().sort(() => rand() - 0.5);
	for (let i = 0; i < tries; i++) {
		const word = shuffled[i % shuffled.length];
		const line = chain.generateLineEndingWith(word, rand);
		if (!line) continue;
		if (line.split(/\s+/).length < 4) continue;
		const formatted = capitalize(fixArticles(line));
		const key = normalizeLineKey(formatted);
		if (seen.has(key)) continue;
		return formatted;
	}
	return null;
}

// Generate one line that rhymes with `anchorWord` and isn't a duplicate of
// any already-emitted line. Tries Markov first, then templated candidates.
// Final fallback is a fresh templated line (accepts a rhyme miss).
function generateRhymingLine(chain, palette, theme, rand, anchorWord, seen) {
	const markovLine = generateRhymingMarkovLine(chain, anchorWord, rand, seen);
	if (markovLine) return markovLine;

	// Fallback: brute-force templated candidates and pick a rhyming one
	// that isn't already in the block.
	const MAX_TRIES = 60;
	const candidates = [];
	for (let i = 0; i < MAX_TRIES; i++) {
		candidates.push(generateTemplatedLine(palette, theme, rand));
	}
	for (const cand of candidates) {
		if (seen.has(normalizeLineKey(cand))) continue;
		if (rhymes(lastWord(cand), anchorWord)) return cand;
	}
	// No rhyming, non-duplicate candidate: pick first non-duplicate.
	for (const cand of candidates) {
		if (!seen.has(normalizeLineKey(cand))) return cand;
	}
	return candidates[0];
}

// Build a block of lines following a rhyme-scheme pattern. Each character
// in the pattern is a rhyme group: lines that share a character must end
// in rhyming words. "F" (free) lines have no constraint.
function generateBlock(chain, palette, theme, rand, pattern) {
	const anchors = {}; // char → anchor word for that group
	const seen = new Set();
	const lines = [];

	const pushFreshLine = () => {
		const MAX_TRIES = 16;
		for (let i = 0; i < MAX_TRIES; i++) {
			const cand = generateTemplatedLine(palette, theme, rand);
			const key = normalizeLineKey(cand);
			if (!seen.has(key)) {
				seen.add(key);
				lines.push(cand);
				return cand;
			}
		}
		const cand = generateTemplatedLine(palette, theme, rand);
		seen.add(normalizeLineKey(cand));
		lines.push(cand);
		return cand;
	};

	for (const ch of pattern) {
		if (ch === "F") {
			pushFreshLine();
			continue;
		}

		if (anchors[ch] != null) {
			const cand = generateRhymingLine(chain, palette, theme, rand, anchors[ch], seen);
			seen.add(normalizeLineKey(cand));
			lines.push(cand);
		} else {
			const fresh = pushFreshLine();
			anchors[ch] = lastWord(fresh);
		}
	}

	return lines;
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
 * @param {number} [opts.order] — Markov chain order (1..5; default 2)
 * @param {string} [opts.scheme] — rhyme scheme key (AABB / ABAB / AAAA / ABBA / AABA / FREE)
 */
export function generateLyrics({ artists, theme = "", seed, order, scheme } = {}) {
	const artistKeys = normalizeArtists(artists);
	const palette = mergeArtists(artistKeys);
	const finalOrder = clampOrder(order ?? DEFAULT_ORDER);
	const resolvedScheme = resolveScheme(scheme ?? DEFAULT_SCHEME);
	const chain = chainForArtists(artistKeys, finalOrder);
	const finalSeed = Number.isFinite(seed) ? seed : Math.floor(Math.random() * 2 ** 31);
	const rand = rng(finalSeed);
	const cleanTheme = String(theme || "").trim().toLowerCase().split(/\s+/)[0] || null;

	const fullPattern = resolvedScheme.pattern;
	const bridgePattern = fullPattern.slice(0, 2);

	const sections = [
		{ label: "Verse 1", lines: generateBlock(chain, palette, cleanTheme, rand, fullPattern) },
		{ label: "Chorus", lines: generateBlock(chain, palette, cleanTheme, rand, fullPattern) },
		{ label: "Verse 2", lines: generateBlock(chain, palette, cleanTheme, rand, fullPattern) },
		{ label: "Chorus", lines: generateBlock(chain, palette, cleanTheme, rand, fullPattern) },
		{ label: "Bridge", lines: generateBlock(chain, palette, cleanTheme, rand, bridgePattern) },
		{ label: "Chorus", lines: generateBlock(chain, palette, cleanTheme, rand, fullPattern) },
	];

	return {
		artists: artistKeys,
		display: palette.display,
		theme: cleanTheme,
		seed: finalSeed,
		order: finalOrder,
		scheme: resolvedScheme.name,
		schemePattern: fullPattern,
		sections,
	};
}

export function lyricsToText(result) {
	return result.sections
		.map((s) => `[${s.label}]\n${s.lines.join("\n")}`)
		.join("\n\n");
}
