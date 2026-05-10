// Cheap, deterministic pseudo-rhyme matcher.
//
// Real rhyming needs a pronouncing dictionary (CMU dict). For a small
// generator we approximate with a "rhyme key" derived from the last stressed
// vowel cluster and the consonants/letters after it. Then we union loose
// equivalence groups (e.g. "ight" ~ "y" ~ "ie") to catch the common cases
// where spelling and pronunciation diverge.

const VOWELS = "aeiouy";

const EQUIVALENCE = [
	// long-i family: night, fly, high, lie, eye, sky
	["ight", "ite", "y", "ie", "igh", "ye", "i", "ye"],
	// long-e family: see, sea
	["ee", "ea"],
	// long-a: day, way, eight, weigh
	["ay", "ey", "eigh", "ae"],
	// long-o: snow, though, dough, oh
	["ow", "ough", "oh", "o", "oa"],
	// -ound / -owned
	["ound", "owned"],
	// -ain / -ane / -ein
	["ain", "ane", "ein"],
	// -ire / -yer / -ier (fire, buyer, flyer)
	["ire", "yer", "ier", "uire"],
	// love / uv
	["ove", "uv"],
	// one / own
	["one", "own"],
	// ool / ule / ewl
	["ool", "ule", "ewl", "ewel"],
	// laugh / graph / aff
	["aph", "augh", "aff"],
];

function normalize(word) {
	return word
		.toLowerCase()
		.replace(/[^a-z']/g, "")
		.replace(/'$/, "");
}

// Returns the rhyme key for a single word: the trailing chunk starting at
// the last stressed-vowel cluster.
//
// Examples:
//   fire → "ire"     (silent trailing 'e' is kept in the suffix but ignored
//                     when locating the last stressed vowel)
//   night → "ight"
//   rolling → "ing"
//   high → "igh"
//   photograph → "aph"
//   laugh → "augh"
export function rhymeKey(word) {
	const w = normalize(word);
	if (!w) return "";

	let i = w.length - 1;

	// If the last char is a silent 'e' (preceded by a consonant), skip it
	// when hunting for the stressed vowel — but the 'e' stays in the final
	// key so "fire" → "ire" not "ir".
	if (w[i] === "e" && i > 0 && !VOWELS.includes(w[i - 1])) {
		i--;
	}

	// Walk back to the last vowel from there.
	while (i >= 0 && !VOWELS.includes(w[i])) i--;
	if (i < 0) return w;

	// Walk back through any contiguous vowel cluster to find the start.
	let start = i;
	while (start > 0 && VOWELS.includes(w[start - 1])) start--;

	return w.slice(start);
}

export function rhymes(a, b) {
	if (!a || !b) return false;
	const ka = rhymeKey(a);
	const kb = rhymeKey(b);
	if (!ka || !kb) return false;
	if (ka === kb) return true;
	for (const group of EQUIVALENCE) {
		if (group.includes(ka) && group.includes(kb)) return true;
	}
	return false;
}

export function lastWord(line) {
	const tokens = line.trim().split(/\s+/);
	return tokens[tokens.length - 1] || "";
}

// Return a rhyming line from `candidates` for `target`, or null if no
// candidate rhymes. Skips candidates whose last word matches the target
// word exactly (we don't want literal repetition for the rhyme).
export function findRhymingLine(target, candidates) {
	const targetLast = normalize(lastWord(target));
	for (const candidate of candidates) {
		const cLast = normalize(lastWord(candidate));
		if (cLast === targetLast) continue;
		if (rhymes(targetLast, cLast)) return candidate;
	}
	return null;
}
