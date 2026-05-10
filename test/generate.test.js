import { test } from "node:test";
import assert from "node:assert/strict";
import { generateLyrics, lyricsToText } from "../lib/generate.js";
import { VIBE_KEYS } from "../lib/wordbanks.js";
import { rhymes, rhymeKey, findRhymingLine, lastWord } from "../lib/rhyme.js";
import { parseSections } from "../lib/claude.js";

test("rhymeKey extracts trailing vowel cluster + consonants", () => {
	assert.equal(rhymeKey("midnight"), "ight");
	assert.equal(rhymeKey("spotlight"), "ight");
	assert.equal(rhymeKey("rolling"), "ing");
	assert.equal(rhymeKey("fire"), "ire");
});

test("rhymes() handles exact matches and equivalence groups", () => {
	assert.equal(rhymes("light", "night"), true);
	assert.equal(rhymes("fly", "high"), true); // y/igh equivalence
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

test("generateLyrics produces 6 sections with non-empty lines", () => {
	const out = generateLyrics({ vibe: "heartbroken", seed: 1 });
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

test("generateLyrics is deterministic given a seed", () => {
	const a = generateLyrics({ vibe: "summer", theme: "ocean", seed: 42 });
	const b = generateLyrics({ vibe: "summer", theme: "ocean", seed: 42 });
	assert.deepEqual(a, b);
});

test("generateLyrics differs across seeds", () => {
	const a = generateLyrics({ vibe: "hype", seed: 1 });
	const b = generateLyrics({ vibe: "hype", seed: 2 });
	assert.notDeepEqual(a.sections, b.sections);
});

test("generateLyrics weaves theme word into lyrics", () => {
	// Ten different seeds; theme should appear in at least one.
	let foundTheme = false;
	for (let seed = 1; seed <= 10; seed++) {
		const out = generateLyrics({ vibe: "summer", theme: "ocean", seed });
		const text = lyricsToText(out).toLowerCase();
		if (text.includes("ocean")) {
			foundTheme = true;
			break;
		}
	}
	assert.ok(foundTheme, "theme word should appear across multiple seeds");
});

test("generateLyrics rejects unknown vibe", () => {
	assert.throws(() => generateLyrics({ vibe: "nonsense" }), /Unknown vibe/);
});

test("generateLyrics rejects missing vibe", () => {
	assert.throws(() => generateLyrics({}), /Unknown vibe/);
});

test("every vibe in VIBE_KEYS produces valid output", () => {
	for (const vibe of VIBE_KEYS) {
		const out = generateLyrics({ vibe, seed: 7 });
		assert.equal(out.vibe, vibe);
		assert.ok(out.sections.length > 0);
	}
});

test("lyricsToText produces a labeled, line-broken string", () => {
	const out = generateLyrics({ vibe: "nostalgic", seed: 100 });
	const text = lyricsToText(out);
	assert.match(text, /\[Verse 1\]/);
	assert.match(text, /\[Chorus\]/);
	assert.match(text, /\[Bridge\]/);
});

test("lyricsToText: every section appears with its lines", () => {
	const out = generateLyrics({ vibe: "heartbroken", seed: 5 });
	const text = lyricsToText(out);
	for (const section of out.sections) {
		assert.ok(text.includes(`[${section.label}]`));
		for (const line of section.lines) {
			assert.ok(text.includes(line), `line "${line}" should appear in output`);
		}
	}
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

test("parseSections groups orphan lines under default 'Verse' label", () => {
	const text = "first\nsecond\n\n[Chorus]\nchorus";
	const parsed = parseSections(text);
	assert.equal(parsed.length, 2);
	assert.equal(parsed[0].label, "Verse");
});

test("seeds are echoed back in the result for reproducibility links", () => {
	const out = generateLyrics({ vibe: "heartbroken", seed: 12345 });
	assert.equal(out.seed, 12345);
});

test("rhyme density: at least one couplet per verse rhymes (smoke test)", () => {
	let totalCouplets = 0;
	let rhymingCouplets = 0;
	for (let seed = 1; seed <= 20; seed++) {
		const out = generateLyrics({ vibe: "heartbroken", seed });
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
	assert.ok(ratio > 0.4, `rhyme ratio should be > 40%, got ${(ratio * 100).toFixed(1)}%`);
});
