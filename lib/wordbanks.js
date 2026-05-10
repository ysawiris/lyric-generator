// Artist palettes — each is a thematic word bank and template set inspired
// by an artist's signature vocabulary, settings, and emotional register.
// Output is generated original work; nothing here is copied from songs.
//
// Verbs are stored as [base, gerund] pairs so the generator can use either
// form precisely.

export const ARTISTS = {
	drake: {
		display: "Drake",
		color: "hsl(20 70% 60%)", // peach (matches his side of the Big Three art)
		nouns: ["six", "summer", "phone call", "voicemail", "real one", "OG", "city", "skyline"],
		verbs: [
			["call", "calling"],
			["miss", "missing"],
			["text", "texting"],
			["change", "changing"],
			["love", "loving"],
			["start", "starting"],
			["forget", "forgetting"],
			["hold", "holding"],
		],
		places: ["the six", "Toronto", "the studio", "Hyde Park", "the suite", "the party"],
		feelings: ["lonely", "real", "tired of pretending", "in my feelings", "low", "alone at the top", "different"],
		colors: ["gold", "diamond", "platinum", "neon"],
		time: ["late night", "4 a.m.", "tonight", "when the lights down", "Sunday morning"],
		templates: [
			"Late night in {place}, just me and the {noun}",
			"You been gone too long, baby, where you {verb_ing}",
			"Started from the bottom, now we {verb_ing} the room",
			"Real ones in my circle, can't tell {feeling}",
			"I been {feeling}, but I never said it loud",
			"Tell me how to forget you when you {verb_ing} my mind",
			"{time}, thinking 'bout the way you used to {verb_base}",
			"Champagne and {color} lights, I'm {feeling} again",
			"Said I wouldn't text you but I'm still in my phone",
			"Where you at right now? Tell me you alone",
			"They don't know me like the {noun} knows me",
			"You was here when nobody knew my {noun}",
		],
	},

	jcole: {
		display: "J. Cole",
		color: "hsl(80 30% 55%)", // sage (his middle position in the art)
		nouns: ["block", "porch", "old man", "mama", "mirror", "letter", "preacher", "young one"],
		verbs: [
			["grow", "growing"],
			["write", "writing"],
			["learn", "learning"],
			["pray", "praying"],
			["chase", "chasing"],
			["build", "building"],
			["watch", "watching"],
			["work", "working"],
		],
		places: ["the Ville", "Fayetteville", "Carolina", "the trap", "the studio", "the church", "the school"],
		feelings: ["broke", "blessed", "honest", "patient", "humble", "guilty", "free", "tired"],
		colors: ["faded", "concrete", "amber", "dusty"],
		time: ["growing up", "when I was nineteen", "back home", "Sunday service", "after the funeral"],
		templates: [
			"Born in {place}, raised on the gospel and rent",
			"My mama said {feeling}, but I had to learn alone",
			"Been chasing this dream since I was {time}",
			"Watched my brother turn into a man too soon",
			"Out here {verb_ing} 'bout my {feeling} for the world",
			"They want a star but I'm just a kid from {place}",
			"Real ones know the road I had to take",
			"Had to {verb_base} or starve, no in-between for me",
			"Cole world, but the {color} world ain't always kind",
			"Looking back at where I came from, I see God",
			"Wrote my whole life in a verse you might {verb_base}",
			"Mama still {verb_ing} for the boys she raised",
		],
	},

	kendrick: {
		display: "Kendrick",
		color: "hsl(210 35% 55%)", // muted blue (matches his right side)
		nouns: ["king", "throne", "city", "psalm", "blood", "loyalty", "mirror", "name"],
		verbs: [
			["pray", "praying"],
			["bleed", "bleeding"],
			["preach", "preaching"],
			["rise", "rising"],
			["humble", "humbling"],
			["seek", "seeking"],
			["mourn", "mourning"],
			["count", "counting"],
		],
		places: ["Compton", "the temple", "the throne", "the city", "the corner", "the cell"],
		feelings: ["mortal", "holy", "tired of the lies", "ready", "burning", "alright", "ungodly", "free"],
		colors: ["royal", "blood", "midnight", "golden", "ash"],
		time: ["judgment day", "the morning", "after the war", "the seventh hour", "every Sunday"],
		templates: [
			"I am every soul I ever wronged, every name I {verb_ed}",
			"Pray for me {time} when the {noun} starts to fall",
			"From genesis to revelation, watch me {verb_base}",
			"King of {place}, the weight of the world is mine",
			"Loyalty is a {noun} we don't forget",
			"Sit with the {feeling}, learn what the silence teaches",
			"Mortal but I'm {feeling}, holy but I {verb_base}",
			"{place} don't sleep, and neither do I",
			"Show me a {feeling} that turn into power",
			"Every {noun} is a sermon to my soul",
			"They asked the king if he {feeling}; the king just smiled",
			"My city {verb_ing} in the {color} of its sins",
		],
	},
};

export const ARTIST_KEYS = Object.keys(ARTISTS);

// Strip leading articles for short-form embedding ("on the {place}").
export function shortPlace(place) {
	return place.replace(/^(the |an |a )/, "");
}

// Merge multiple artist palettes into one combined palette. Templates are
// the union; lexical pools are the union (with deduplication). The display
// label is the artists joined with ×.
export function mergeArtists(keys) {
	const list = keys.map((k) => ARTISTS[k]).filter(Boolean);
	if (list.length === 1) return list[0];
	const dedupe = (arr) => [...new Set(arr)];
	const dedupeVerbs = (verbs) => {
		const seen = new Set();
		const out = [];
		for (const v of verbs) {
			const key = v[1]; // gerund as identity
			if (seen.has(key)) continue;
			seen.add(key);
			out.push(v);
		}
		return out;
	};
	return {
		display: list.map((a) => a.display).join(" × "),
		color: list[0].color,
		nouns: dedupe(list.flatMap((a) => a.nouns)),
		verbs: dedupeVerbs(list.flatMap((a) => a.verbs)),
		places: dedupe(list.flatMap((a) => a.places)),
		feelings: dedupe(list.flatMap((a) => a.feelings)),
		colors: dedupe(list.flatMap((a) => a.colors)),
		time: dedupe(list.flatMap((a) => a.time)),
		templates: dedupe(list.flatMap((a) => a.templates)),
	};
}
