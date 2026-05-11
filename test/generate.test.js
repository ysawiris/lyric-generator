import { test } from "node:test";
import assert from "node:assert/strict";
import { generateLyrics, lyricsToText } from "../public/lib/generate.js";
import { ARTIST_KEYS, ARTISTS, mergeArtists } from "../public/lib/wordbanks.js";
import { rhymes, rhymeKey, findRhymingLine, lastWord } from "../public/lib/rhyme.js";
import { parseSections } from "../lib/claude.js";
import { ReverseMarkov } from "../public/lib/markov.js";

test("rhymeKey extracts trailing vowel cluster + consonants", () => {
	assert.equal(rhymeKey("midnight"), "ight");
	assert.equal(rhymeKey("spotlight"), "ight");
	assert.equal(rhymeKey("rolling"), "ing");
	assert.equal(rhymeKey("fire"), "ire");
});

test("rhymes() handles exact matches and equivalence groups", () => {
	assert.equal(rhymes("light", "night"), true);
	assert.equal(rhymes("fly", "high"), true);
	assert.equal(rhymes("day", "play"), true);
	assert.equal(rhymes("cat", "dog"), false);
});

test("rhymes() rejects empty input", () => {
	assert.equal(rhymes("", "night"), false);
	assert.equal(rhymes("light", ""), false);
});

test("findRhymingLine picks the first rhyming candidate", () => {
	const target = "I keep your photograph";
	const candidates = ["The morning is cold", "I just want to laugh"];
	assert.equal(findRhymingLine(target, candidates), "I just want to laugh");
});

test("findRhymingLine skips literal repetition", () => {
	const target = "I keep your photograph";
	const candidates = ["I keep your photograph", "I just want to laugh"];
	assert.equal(findRhymingLine(target, candidates), "I just want to laugh");
});

test("lastWord trims and returns the trailing token", () => {
	assert.equal(lastWord("the rain   "), "rain");
	assert.equal(lastWord("alone"), "alone");
});

test("ARTIST_KEYS contains drake, jcole, kendrick", () => {
	assert.deepEqual(ARTIST_KEYS.sort(), ["drake", "jcole", "kendrick"].sort());
});

test("each artist has display name, color, and templates", () => {
	for (const key of ARTIST_KEYS) {
		const a = ARTISTS[key];
		assert.ok(a.display, `${key} has display`);
		assert.match(a.color, /^hsl\(/, `${key} has hsl color`);
		assert.ok(a.templates.length > 0, `${key} has templates`);
		assert.ok(a.nouns.length > 0, `${key} has nouns`);
		assert.ok(a.verbs.length > 0, `${key} has verbs`);
	}
});

test("mergeArtists with one artist returns that artist's palette", () => {
	const merged = mergeArtists(["drake"]);
	assert.equal(merged.display, "Drake");
	assert.deepEqual(merged.nouns, ARTISTS.drake.nouns);
});

test("mergeArtists with two artists unions pools and templates", () => {
	const merged = mergeArtists(["drake", "kendrick"]);
	assert.equal(merged.display, "Drake × Kendrick");
	assert.ok(
		merged.nouns.length >= ARTISTS.drake.nouns.length,
		"merged nouns includes drake's"
	);
	assert.ok(
		merged.templates.length >= ARTISTS.drake.templates.length,
		"merged templates includes drake's"
	);
	for (const t of ARTISTS.kendrick.templates) {
		assert.ok(merged.templates.includes(t), `kendrick template "${t}" should be in merged`);
	}
});

test("mergeArtists deduplicates verbs by gerund", () => {
	const merged = mergeArtists(["drake", "kendrick"]);
	const gerunds = merged.verbs.map((v) => v[1]);
	const unique = new Set(gerunds);
	assert.equal(gerunds.length, unique.size, "no duplicate gerunds in merged verbs");
});

test("generateLyrics produces 6 sections with non-empty lines (single artist)", () => {
	const out = generateLyrics({ artists: "drake", seed: 1 });
	assert.equal(out.sections.length, 6);
	for (const section of out.sections) {
		assert.ok(section.label, "section has label");
		assert.ok(section.lines.length > 0, "section has lines");
		for (const line of section.lines) {
			assert.equal(typeof line, "string");
			assert.ok(line.length > 0, "line is non-empty");
		}
	}
});

test("generateLyrics accepts artists array and returns it back", () => {
	const out = generateLyrics({ artists: ["drake", "kendrick"], seed: 1 });
	assert.deepEqual(out.artists, ["drake", "kendrick"]);
	assert.equal(out.display, "Drake × Kendrick");
});

test("generateLyrics is deterministic given a seed", () => {
	const a = generateLyrics({ artists: ["drake", "jcole"], theme: "Toronto", seed: 42 });
	const b = generateLyrics({ artists: ["drake", "jcole"], theme: "Toronto", seed: 42 });
	assert.deepEqual(a, b);
});

test("generateLyrics differs across seeds", () => {
	const a = generateLyrics({ artists: "kendrick", seed: 1 });
	const b = generateLyrics({ artists: "kendrick", seed: 2 });
	assert.notDeepEqual(a.sections, b.sections);
});

test("generateLyrics weaves theme word into lyrics", () => {
	let foundTheme = false;
	for (let seed = 1; seed <= 10; seed++) {
		const out = generateLyrics({ artists: "drake", theme: "summer", seed });
		const text = lyricsToText(out).toLowerCase();
		if (text.includes("summer")) {
			foundTheme = true;
			break;
		}
	}
	assert.ok(foundTheme, "theme word should appear across multiple seeds");
});

test("generateLyrics rejects unknown artist", () => {
	assert.throws(() => generateLyrics({ artists: "biggie" }), /Unknown artist/);
});

test("generateLyrics rejects empty artists", () => {
	assert.throws(() => generateLyrics({ artists: [] }), /At least one artist/);
	assert.throws(() => generateLyrics({}), /At least one artist|Unknown/);
});

test("generateLyrics deduplicates artists list", () => {
	const out = generateLyrics({ artists: ["drake", "drake", "kendrick"], seed: 1 });
	assert.deepEqual(out.artists, ["drake", "kendrick"]);
});

test("every single-artist call produces valid output", () => {
	for (const key of ARTIST_KEYS) {
		const out = generateLyrics({ artists: key, seed: 7 });
		assert.deepEqual(out.artists, [key]);
		assert.ok(out.sections.length > 0);
	}
});

test("all-three combination produces valid output with merged display", () => {
	const out = generateLyrics({ artists: ARTIST_KEYS, seed: 9 });
	assert.equal(out.display.split(" × ").length, 3);
	assert.equal(out.sections.length, 6);
});

test("lyricsToText produces a labeled, line-broken string", () => {
	const out = generateLyrics({ artists: "jcole", seed: 100 });
	const text = lyricsToText(out);
	assert.match(text, /\[Verse 1\]/);
	assert.match(text, /\[Chorus\]/);
	assert.match(text, /\[Bridge\]/);
});

test("parseSections (claude helper) extracts headered blocks", () => {
	const text = `[Verse 1]
line one
line two

[Chorus]
chorus line
another`;
	const parsed = parseSections(text);
	assert.equal(parsed.length, 2);
	assert.equal(parsed[0].label, "Verse 1");
	assert.deepEqual(parsed[0].lines, ["line one", "line two"]);
	assert.equal(parsed[1].label, "Chorus");
});

test("seeds are echoed back in the result for reproducibility links", () => {
	const out = generateLyrics({ artists: "drake", seed: 12345 });
	assert.equal(out.seed, 12345);
});

test("rhyme density (Markov-driven): well over 50% of couplets rhyme", () => {
	let totalCouplets = 0;
	let rhymingCouplets = 0;
	for (let seed = 1; seed <= 20; seed++) {
		const out = generateLyrics({ artists: ["drake", "jcole", "kendrick"], seed });
		for (const section of out.sections) {
			for (let i = 0; i + 1 < section.lines.length; i += 2) {
				totalCouplets++;
				if (rhymes(lastWord(section.lines[i]), lastWord(section.lines[i + 1]))) {
					rhymingCouplets++;
				}
			}
		}
	}
	const ratio = rhymingCouplets / totalCouplets;
	assert.ok(ratio > 0.5, `rhyme ratio should be > 50% with Markov, got ${(ratio * 100).toFixed(1)}%`);
});

test("ReverseMarkov ingests lines and indexes rhyme keys", () => {
	const m = new ReverseMarkov([
		"the cat sat on the mat",
		"the dog lay near the cat",
	]);
	const rhymingWithMat = m.wordsRhymingWith("hat");
	assert.ok(rhymingWithMat.includes("cat") || rhymingWithMat.includes("mat"));
});

test("ReverseMarkov generates a line ending in the requested word", () => {
	const m = new ReverseMarkov([
		"I keep walking down the road",
		"every memory took a hold",
		"never thought we would grow old",
		"every promise that we sold",
	]);
	const rand = (() => { let s = 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
	const line = m.generateLineEndingWith("old", rand);
	assert.ok(line, "generates a line");
	assert.ok(line.endsWith("old"), `line should end with 'old', got: ${line}`);
});

test("ReverseMarkov returns null for end-words not seen in corpus", () => {
	const m = new ReverseMarkov(["the cat sat on the mat"]);
	assert.equal(m.generateLineEndingWith("zebra", () => 0.5), null);
});

test("ReverseMarkov supports configurable order (1, 2, 3)", () => {
	const lines = [
		"I keep walking down the road",
		"every memory took a hold",
		"never thought we would grow old",
		"every promise that we sold",
	];
	for (const order of [1, 2, 3]) {
		const m = new ReverseMarkov(lines, order);
		const stats = m.stats();
		assert.equal(stats.order, order);
		assert.ok(stats.contexts > 0, `order ${order} has contexts`);
	}
});

test("higher order produces fewer distinct contexts (with same corpus)", () => {
	const lines = [
		"I keep walking down the long road home",
		"every memory took a hold of me",
		"never thought we would grow old together",
		"every promise that we ever sold or kept",
	];
	const m1 = new ReverseMarkov(lines, 1);
	const m3 = new ReverseMarkov(lines, 3);
	assert.ok(m1.stats().contexts >= m3.stats().contexts,
		`order 1 should have ≥ order 3 contexts: ${m1.stats().contexts} vs ${m3.stats().contexts}`);
});

test("generateLyrics accepts and echoes back an order parameter", () => {
	const out = generateLyrics({ artists: "drake", order: 1, seed: 7 });
	assert.equal(out.order, 1);
	const out3 = generateLyrics({ artists: "drake", order: 3, seed: 7 });
	assert.equal(out3.order, 3);
});

test("generateLyrics defaults to order 2 when omitted", () => {
	const out = generateLyrics({ artists: "drake", seed: 7 });
	assert.equal(out.order, 2);
});

test("generateLyrics clamps order outside [1, 5]", () => {
	const low = generateLyrics({ artists: "drake", order: 0, seed: 7 });
	assert.equal(low.order, 1);
	const high = generateLyrics({ artists: "drake", order: 999, seed: 7 });
	assert.equal(high.order, 5);
});

test("generateLyrics produces valid output at every supported order", () => {
	for (let order = 1; order <= 5; order++) {
		const out = generateLyrics({ artists: ["drake", "jcole"], order, seed: 13 });
		assert.equal(out.sections.length, 6);
		for (const s of out.sections) {
			assert.ok(s.lines.length > 0, `order ${order} ${s.label} has lines`);
			for (const line of s.lines) {
				assert.ok(line.length > 0, `non-empty line at order ${order}`);
			}
		}
	}
});

test("generateLyrics defaults to AABB scheme", () => {
	const out = generateLyrics({ artists: "drake", seed: 7 });
	assert.equal(out.scheme, "AABB");
	assert.equal(out.schemePattern, "AABB");
});

test("generateLyrics rejects unknown scheme", () => {
	assert.throws(() => generateLyrics({ artists: "drake", scheme: "bogus" }), /Unknown rhyme scheme/);
});

test("each rhyme scheme produces valid 4-line full sections", () => {
	for (const key of ["AABB", "ABAB", "AAAA", "ABBA", "AABA", "FREE"]) {
		const out = generateLyrics({ artists: ["drake", "kendrick"], scheme: key, seed: 21 });
		assert.equal(out.scheme.toUpperCase(), key);
		const verse1 = out.sections.find((s) => s.label === "Verse 1");
		assert.equal(verse1.lines.length, 4, `${key} verse has 4 lines`);
		const bridge = out.sections.find((s) => s.label === "Bridge");
		assert.equal(bridge.lines.length, 2, `${key} bridge has 2 lines`);
	}
});

// Per-scheme structural rhyme tests: lines tagged with the same character
// must rhyme with each other in the generated output.
function rhymesByPosition(lines, pattern) {
	const groups = {};
	for (let i = 0; i < pattern.length; i++) {
		const ch = pattern[i];
		if (ch === "F") continue;
		(groups[ch] ||= []).push(lines[i]);
	}
	return groups;
}

test("AABB: line 1 rhymes with line 2 most of the time", () => {
	let total = 0;
	let hits = 0;
	for (let seed = 1; seed <= 20; seed++) {
		const out = generateLyrics({ artists: "drake", scheme: "AABB", seed });
		for (const s of out.sections) {
			if (s.lines.length < 2) continue;
			total++;
			if (rhymes(lastWord(s.lines[0]), lastWord(s.lines[1]))) hits++;
		}
	}
	assert.ok(hits / total > 0.6, `AABB couplet rhyme rate should exceed 60%, got ${(hits / total * 100).toFixed(1)}%`);
});

test("ABAB: line 1 rhymes with line 3 most of the time", () => {
	let total = 0;
	let hits = 0;
	for (let seed = 1; seed <= 20; seed++) {
		const out = generateLyrics({ artists: "drake", scheme: "ABAB", seed });
		for (const s of out.sections) {
			if (s.lines.length < 4) continue;
			total++;
			if (rhymes(lastWord(s.lines[0]), lastWord(s.lines[2]))) hits++;
		}
	}
	assert.ok(hits / total > 0.6, `ABAB A-rhyme rate should exceed 60%, got ${(hits / total * 100).toFixed(1)}%`);
});

test("AAAA: line 1 rhymes with line 4 most of the time", () => {
	let total = 0;
	let hits = 0;
	for (let seed = 1; seed <= 20; seed++) {
		const out = generateLyrics({ artists: "drake", scheme: "AAAA", seed });
		for (const s of out.sections) {
			if (s.lines.length < 4) continue;
			total++;
			if (rhymes(lastWord(s.lines[0]), lastWord(s.lines[3]))) hits++;
		}
	}
	assert.ok(hits / total > 0.6, `AAAA full-block rhyme should exceed 60%, got ${(hits / total * 100).toFixed(1)}%`);
});
