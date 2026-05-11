// Rhyme scheme catalog.
//
// Each scheme is a 4-character string where each character represents a
// rhyme group: lines with the same character must rhyme. Use "F" or any
// "free" marker for lines that should not rhyme with any other.
//
// For sections shorter than 4 lines (e.g. the 2-line bridge), the
// generator slices off the first N characters of the scheme.

export const SCHEMES = {
	AABB: {
		name: "AABB",
		description: "Couplets — line 1 with 2, line 3 with 4.",
		pattern: "AABB",
		visual: "A┐ A┘ B┐ B┘",
	},
	ABAB: {
		name: "ABAB",
		description: "Alternating — line 1 with 3, line 2 with 4.",
		pattern: "ABAB",
		visual: "A┐ B┐ A┘ B┘",
	},
	AAAA: {
		name: "AAAA",
		description: "Monorhyme — every line rhymes.",
		pattern: "AAAA",
		visual: "A┐ A│ A│ A┘",
	},
	ABBA: {
		name: "ABBA",
		description: "Enclosed — outer pair rhymes, inner pair rhymes.",
		pattern: "ABBA",
		visual: "A┐ B┐ B┘ A┘",
	},
	AABA: {
		name: "AABA",
		description: "Blues / Drake — three rhymes around a free middle.",
		pattern: "AABA",
		visual: "A┐ A┘ B  A┘",
	},
	FREE: {
		name: "Free",
		description: "No rhyme enforced. Chain freestyles.",
		pattern: "FFFF",
		visual: "─ ─ ─ ─",
	},
};

export const SCHEME_KEYS = Object.keys(SCHEMES);
export const DEFAULT_SCHEME = "AABB";

export function resolveScheme(input) {
	if (!input) return SCHEMES[DEFAULT_SCHEME];
	const upper = String(input).toUpperCase().trim();
	if (SCHEMES[upper]) return SCHEMES[upper];
	// Allow callers to pass the raw pattern, e.g. "AABB"
	for (const key of SCHEME_KEYS) {
		if (SCHEMES[key].pattern === upper) return SCHEMES[key];
	}
	throw new Error(
		`Unknown rhyme scheme "${input}". Valid: ${SCHEME_KEYS.join(", ")}`
	);
}
