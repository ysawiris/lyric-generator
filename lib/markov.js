// Reverse 2nd-order Markov chain.
//
// Forward order example: "a b c d e"
// We store, for each (b, c) pair, the predecessor `a` and its count.
// Then to generate a line ENDING in word W, we:
//   1. Pick a (penult, last) pair `(b, W)` from lines that ended in W
//   2. Walk backward: at each step lookup chain[`${tokens[len-1]}|${tokens[len-2]}`]
//   3. Reverse the result before display
//
// This gives us rhyme-targeted line construction: pick a desired ending
// word (chosen because it rhymes with the previous line), then let the
// chain's transition probabilities reconstruct a plausible line ending
// in that word.

import { rhymeKey } from "./rhyme.js";

const PUNCT = /[.,!?;:"()\[\]]/g;

export class ReverseMarkov {
	constructor(lines = []) {
		// (b, c) → Map<predecessor a, count>
		this.chain = new Map();
		// last word → Set<"penult|last" pairs that ended a line>
		this.lineEnders = new Map();
		// rhyme key → Set<last word>
		this.rhymeIndex = new Map();
		for (const line of lines) this.ingest(line);
	}

	ingest(line) {
		const tokens = this.tokenize(line);
		if (tokens.length < 2) return;
		const last = tokens[tokens.length - 1];
		const penult = tokens[tokens.length - 2];

		// Track "this pair ended a line" so generation has a starting point.
		const enderKey = `${penult}|${last}`;
		if (!this.lineEnders.has(last)) this.lineEnders.set(last, new Set());
		this.lineEnders.get(last).add(enderKey);

		// Index by rhyme key.
		const rk = rhymeKey(last);
		if (rk) {
			if (!this.rhymeIndex.has(rk)) this.rhymeIndex.set(rk, new Set());
			this.rhymeIndex.get(rk).add(last);
		}

		// Build 2nd-order reverse chain.
		for (let i = tokens.length - 1; i >= 2; i--) {
			const c = tokens[i];
			const b = tokens[i - 1];
			const a = tokens[i - 2];
			const key = `${b}|${c}`;
			if (!this.chain.has(key)) this.chain.set(key, new Map());
			const m = this.chain.get(key);
			m.set(a, (m.get(a) || 0) + 1);
		}
	}

	tokenize(line) {
		return line
			.replace(PUNCT, "")
			.trim()
			.split(/\s+/)
			.filter(Boolean)
			.map((t) => t.toLowerCase());
	}

	weightedPick(map, rand) {
		let total = 0;
		for (const v of map.values()) total += v;
		if (total === 0) return null;
		let r = rand() * total;
		for (const [k, v] of map) {
			r -= v;
			if (r <= 0) return k;
		}
		return null;
	}

	// All last-words seen in the corpus that share the rhyme key of `target`.
	wordsRhymingWith(target) {
		const rk = rhymeKey(target);
		const set = this.rhymeIndex.get(rk);
		if (!set) return [];
		return [...set].filter((w) => w !== target.toLowerCase());
	}

	/**
	 * Build a line ending in `endWord` by walking the reverse chain backward.
	 * Returns a string of forward-order tokens, or null if generation fails
	 * (e.g. endWord wasn't seen as a line-ender, or chain runs out of state).
	 *
	 * @param {string} endWord
	 * @param {() => number} rand
	 * @param {{ minLen?: number, maxLen?: number, stopChance?: number }} [opts]
	 */
	generateLineEndingWith(endWord, rand, opts = {}) {
		const minLen = opts.minLen ?? 5;
		const maxLen = opts.maxLen ?? 11;
		const stopChance = opts.stopChance ?? 0.18;

		const word = endWord.toLowerCase();
		const enders = this.lineEnders.get(word);
		if (!enders || enders.size === 0) return null;

		const enderArr = [...enders];
		const startKey = enderArr[Math.floor(rand() * enderArr.length)];
		const [b, c] = startKey.split("|");

		// Reverse-tokens: tokens grow from end of line backward.
		// tokens[0] = last word (forward end), tokens[1] = penult, etc.
		const tokens = [c, b];

		while (tokens.length < maxLen) {
			const lookup = `${tokens[tokens.length - 1]}|${tokens[tokens.length - 2]}`;
			const m = this.chain.get(lookup);
			if (!m || m.size === 0) break;
			const next = this.weightedPick(m, rand);
			if (!next) break;
			tokens.push(next);
			if (tokens.length >= minLen && rand() < stopChance) break;
		}

		// At least 3 tokens (otherwise the line is awkwardly short).
		if (tokens.length < 3) return null;

		return tokens.reverse().join(" ");
	}
}
