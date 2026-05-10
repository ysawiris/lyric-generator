// Vibe word banks. Each entry has lexical pools and a list of templates with
// `{slot}` placeholders. The generator picks templates per line, fills slots,
// and pairs lines into AABB couplets via the rhyme module.
//
// Verbs are stored as [base, gerund] pairs so the generator can use either
// form precisely — no heuristic stem-stripping. Adding new verbs is just
// adding another pair.

export const VIBES = {
	heartbroken: {
		nouns: ["shadow", "letter", "photograph", "memory", "midnight", "winter", "echo", "silence"],
		verbs: [
			["fade", "fading"],
			["drift", "drifting"],
			["burn", "burning"],
			["break", "breaking"],
			["call", "calling"],
			["leave", "leaving"],
			["fall", "falling"],
			["wait", "waiting"],
		],
		places: ["empty room", "rainy street", "broken city", "hollow town", "midnight bar"],
		feelings: ["lonely", "hollow", "tired", "frozen", "fragile", "silent", "weary"],
		colors: ["blue", "grey", "navy", "ashen", "silver"],
		time: ["midnight", "morning", "yesterday", "winter", "december", "sundown"],
		templates: [
			"I keep your {noun} in my {place_short}",
			"The {color} of you still holds my {noun}",
			"{verb_ing} through the {time}",
			"There's nothing left to {verb_base}",
			"All I have is {feeling}",
			"Nothing here but {feeling}",
			"I'm still {verb_ing}",
			"Tell me how to {verb_base}",
			"I still hear your {noun}",
			"I'm a {color} {noun}",
		],
	},

	hype: {
		nouns: ["fire", "thunder", "diamond", "engine", "spotlight", "city", "anthem", "rocket"],
		verbs: [
			["run", "running"],
			["burn", "burning"],
			["roll", "rolling"],
			["climb", "climbing"],
			["rise", "rising"],
			["move", "moving"],
			["shine", "shining"],
			["win", "winning"],
		],
		places: ["city street", "neon sky", "empty stage", "open road", "concrete jungle"],
		feelings: ["alive", "ready", "wired", "golden", "electric", "fearless", "untouchable"],
		colors: ["gold", "neon", "silver", "platinum", "chrome"],
		time: ["tonight", "right now", "this moment", "all night", "forever"],
		templates: [
			"We're {verb_ing} through the {time}",
			"Got that {color} on my {noun}",
			"Nothing's gonna stop us {time}",
			"I was born to {verb_base}",
			"Feel the {noun}, feel the heat",
			"I'm {feeling}",
			"We're {feeling}",
			"Turn it up and let it {verb_base}",
			"Light it up like {noun}",
			"Wide awake and {feeling}",
		],
	},

	summer: {
		nouns: ["sunlight", "ocean", "highway", "sundress", "porchlight", "ice cream", "freeway", "tan line"],
		verbs: [
			["dance", "dancing"],
			["run", "running"],
			["swim", "swimming"],
			["drift", "drifting"],
			["float", "floating"],
			["spin", "spinning"],
			["laugh", "laughing"],
			["shine", "shining"],
		],
		places: ["sandy beach", "open window", "front porch", "two-lane road", "back yard"],
		feelings: ["easy", "lazy", "golden", "sunlit", "alive", "free", "warm"],
		colors: ["gold", "amber", "honey", "rose", "peach"],
		time: ["july", "august", "weekend", "afternoon", "sundown", "summer"],
		templates: [
			"{time} on the {place_short}",
			"{verb_ing} in the {color} light",
			"Tan lines and {noun}",
			"You and me and the {noun}",
			"It's a {feeling} kind of day",
			"All I want is to {verb_base}",
			"{color} skin and salty hair",
			"Top down on the {place_short}",
			"Nothing but {noun} and you",
			"{feeling} and {feeling}",
		],
	},

	nostalgic: {
		nouns: ["polaroid", "cassette", "yearbook", "childhood", "porch swing", "old town", "August", "letter"],
		verbs: [
			["remember", "remembering"],
			["miss", "missing"],
			["hold", "holding"],
			["keep", "keeping"],
			["hum", "humming"],
			["fade", "fading"],
			["save", "saving"],
			["wish", "wishing"],
		],
		places: ["old neighborhood", "back road", "small town", "front porch", "school parking lot"],
		feelings: ["young", "bittersweet", "wistful", "tender", "open", "soft", "easy"],
		colors: ["faded", "sepia", "amber", "golden", "dusty"],
		time: ["1999", "high school", "back then", "those days", "the summer of '02"],
		templates: [
			"Back when we were {feeling}",
			"{time} in the {place_short}",
			"I keep your {noun}",
			"Still {verb_ing} the {noun}",
			"That {color} kind of love",
			"You and me and the {noun}",
			"We were so {feeling}",
			"Remember when we'd {verb_base}",
			"There's a {noun} in my drawer",
			"Songs that we used to {verb_base}",
		],
	},
};

export const VIBE_KEYS = Object.keys(VIBES);

// Strip leading articles for short-form embedding ("on the {place_short}").
export function shortPlace(place) {
	return place.replace(/^(the |an |a )/, "");
}

// Use proper "a" / "an" depending on the next word's first letter sound. We
// don't need full phonetic awareness — vowel letters are the common case.
export function indefiniteArticle(nextWord) {
	if (!nextWord) return "a";
	return /^[aeiou]/i.test(nextWord) ? "an" : "a";
}
