// Reverse Nth-order Markov chain.
//
// For an Nth-order REVERSE chain, the model predicts a word given the
// N words that follow it in forward order:
//
//   chain[forward-context-of-N-tokens] → predecessor
//
// Generation walks backward from a chosen end word: pick a seed of N
// trailing tokens from the corpus, look up the predecessor of the seed's
// first token, prepend, slide the window, repeat — until the chain runs
// out of state or we hit a length cap. Reverse the result to read forward.
//
// Order tradeoff:
//   N=1: very chaotic. The previous word doesn't constrain much, so the
//        chain produces lots of word-salad. Useful as a creativity dial.
//   N=2: balanced. Enough context to read as a sentence, enough variety
//        to feel original. Default.
//   N=3: strongly resembles the corpus. With small corpora, 3rd-order
//        chains often have only one valid choice at each step and end up
//        echoing source lines.
//   N≥4: with a corpus of a few hundred lines, mostly memorization.

import { rhymeKey } from "./rhyme.js";

const PUNCT = /[.,!?;:"()\[\]]/g;

export class ReverseMarkov {
	constructor(lines = [], order = 2) {
		this.order = Math.max(1, Math.floor(order));
		// Forward-order N-token context (joined by `|`) → Map<predecessor, count>
		this.chain = new Map();
		// last word → Set<seed string> where seed = last N tokens joined by `|`
		this.lineEnders = new Map();
		// rhyme key → Set<last word>
		this.rhymeIndex = new Map();
		for (const line of lines) this.ingest(line);
	}

	tokenize(line) {
		return line
			.replace(PUNCT, "")
			.trim()
			.split(/\s+/)
			.filter(Boolean)
			.map((t) => t.toLowerCase());
	}

	ingest(line) {
		const tokens = this.tokenize(line);
		if (tokens.length < this.order + 1) return;
		const last = tokens[tokens.length - 1];

		// Ender seed = last N tokens (forward order, joined by `|`).
		const seed = tokens.slice(-this.order).join("|");
		if (!this.lineEnders.has(last)) this.lineEnders.set(last, new Set());
		this.lineEnders.get(last).add(seed);

		const rk = rhymeKey(last);
		if (rk) {
			if (!this.rhymeIndex.has(rk)) this.rhymeIndex.set(rk, new Set());
			this.rhymeIndex.get(rk).add(last);
		}

		// For each position i where there are at least N tokens after it,
		// store: chain[forward-context-of-tokens[i+1..i+N]] → tokens[i].
		for (let i = 0; i + this.order < tokens.length; i++) {
			const contextTokens = tokens.slice(i + 1, i + 1 + this.order);
			const key = contextTokens.join("|");
			const pred = tokens[i];
			if (!this.chain.has(key)) this.chain.set(key, new Map());
			const m = this.chain.get(key);
			m.set(pred, (m.get(pred) || 0) + 1);
		}
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

	wordsRhymingWith(target) {
		const rk = rhymeKey(target);
		const set = this.rhymeIndex.get(rk);
		if (!set) return [];
		return [...set].filter((w) => w !== target.toLowerCase());
	}

	/**
	 * Build a line ending in `endWord` by walking the reverse chain backward.
	 * Returns a string of forward-order tokens, or null if generation fails.
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
		const seedKey = enderArr[Math.floor(rand() * enderArr.length)];
		const seedTokens = seedKey.split("|");

		// revTokens: the line under construction, stored in REVERSE order.
		// revTokens[len-1] is the leftmost-known forward token.
		const revTokens = [...seedTokens].reverse();

		while (revTokens.length < maxLen) {
			// Lookup key: forward-order context of N tokens starting at the
			// current leftmost forward position. That's the last N elements of
			// revTokens, reversed (since revTokens is reverse-order).
			const lookupKey = revTokens
				.slice(-this.order)
				.slice()
				.reverse()
				.join("|");
			const m = this.chain.get(lookupKey);
			if (!m || m.size === 0) break;
			const next = this.weightedPick(m, rand);
			if (!next) break;
			revTokens.push(next);
			if (revTokens.length >= minLen && rand() < stopChance) break;
		}

		if (revTokens.length < 3) return null;
		return revTokens.reverse().join(" ");
	}

	// Diagnostic — number of unique contexts and total observations.
	stats() {
		let observations = 0;
		for (const m of this.chain.values()) {
			for (const v of m.values()) observations += v;
		}
		return {
			order: this.order,
			contexts: this.chain.size,
			observations,
			distinctEndWords: this.lineEnders.size,
			rhymeBuckets: this.rhymeIndex.size,
		};
	}
}
