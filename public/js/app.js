import { generateLyrics, lyricsToText, MIN_ORDER, MAX_ORDER, DEFAULT_ORDER } from "../lib/generate.js";
import { ARTISTS, ARTIST_KEYS } from "../lib/wordbanks.js";
import { SCHEMES, SCHEME_KEYS, DEFAULT_SCHEME } from "../lib/schemes.js";

const $ = (sel) => document.querySelector(sel);

const els = {
	form: $("#form"),
	artistGrid: $("#artist-grid"),
	orderGrid: $("#order-grid"),
	orderHint: $("#order-hint"),
	schemeGrid: $("#scheme-grid"),
	schemeHint: $("#scheme-hint"),
	theme: $("#theme"),
	output: $("#output-host"),
	modePill: $("#mode-pill"),
	generateBtn: $("#generate-btn"),
	generateLabel: $("#generate-label"),
	reroll: $("#reroll"),
	toastHost: $("#toast-host"),
};

const ORDER_HINTS = {
	1: "1 — chaotic, near word salad",
	2: "2 — balanced (default)",
	3: "3 — coherent, leans on corpus",
	4: "4 — mostly memorized",
	5: "5 — verbatim corpus echoes",
};

let selectedOrder = DEFAULT_ORDER;
let selectedScheme = DEFAULT_SCHEME;
let schemesMeta = [];

const SUBLINES = {
	drake: "Late nights, the 6, real ones",
	jcole: "Storytelling, faith, the Ville",
	kendrick: "Compton, layers, the throne",
};

const selectedArtists = new Set();

function toast(message, kind = "ok") {
	const el = document.createElement("div");
	el.className = `toast toast--${kind}`;
	el.textContent = message;
	els.toastHost.appendChild(el);
	setTimeout(() => {
		el.classList.add("is-leaving");
		el.addEventListener("animationend", () => el.remove(), { once: true });
	}, 2500);
}

function escapeHtml(s) {
	return String(s ?? "").replace(/[&<>"']/g, (c) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#39;",
	})[c]);
}

function renderArtists(artists) {
	els.artistGrid.innerHTML = artists
		.map(
			(a) => `
		<button type="button" class="artist-pill" data-key="${escapeHtml(a.key)}" style="--col: ${a.color}">
			<span class="artist-pill__check" aria-hidden="true">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
			</span>
			<span class="artist-pill__name">${escapeHtml(a.display)}</span>
			<span class="artist-pill__sub">${escapeHtml(SUBLINES[a.key] || "")}</span>
		</button>
	`
		)
		.join("");

	toggleArtist("drake");

	els.artistGrid.addEventListener("click", (e) => {
		const btn = e.target.closest(".artist-pill");
		if (!btn) return;
		toggleArtist(btn.dataset.key);
	});
}

function toggleArtist(key) {
	const btn = els.artistGrid.querySelector(`[data-key="${key}"]`);
	if (!btn) return;
	if (selectedArtists.has(key)) {
		if (selectedArtists.size === 1) return;
		selectedArtists.delete(key);
		btn.classList.remove("is-active");
	} else {
		selectedArtists.add(key);
		btn.classList.add("is-active");
	}
	updateGenerateLabel();
}

function updateGenerateLabel() {
	const count = selectedArtists.size;
	if (count === 0) {
		els.generateLabel.textContent = "Pick an artist";
		els.generateBtn.disabled = true;
	} else if (count === 1) {
		els.generateLabel.textContent = "Generate the verse";
		els.generateBtn.disabled = false;
	} else {
		els.generateLabel.textContent = `Blend ${count} voices`;
		els.generateBtn.disabled = false;
	}
}

function renderLoading() {
	els.output.innerHTML = `
		<div class="loading">
			<div>Writing the verse…</div>
			<div class="loading__bar"></div>
		</div>
	`;
}

function renderResult(result) {
	const meta = [];
	if (result.theme) meta.push(`Theme: ${escapeHtml(result.theme)}`);
	if (result.scheme) meta.push(`Scheme: ${escapeHtml(result.scheme)}`);
	if (result.order != null) meta.push(`Order: ${result.order}`);
	if (result.seed != null) meta.push(`Seed: ${result.seed}`);

	let lineDelay = 0;
	const sections = result.sections
		.map(
			(s) => `
		<div class="song__section">
			<div class="song__label">${escapeHtml(s.label)}</div>
			${s.lines
				.map((line) => {
					lineDelay += 60;
					return `<span class="song__line" style="animation-delay: ${lineDelay}ms">${escapeHtml(line)}</span>`;
				})
				.join("")}
		</div>
	`
		)
		.join("");

	els.output.innerHTML = `
		<article class="song">
			<header class="song__head">
				<div>
					<h2 class="song__title">${escapeHtml(result.display || result.artists.join(" × "))}</h2>
					<div class="song__meta">${meta.join(" · ")}</div>
				</div>
				<div class="song__actions">
					<button type="button" class="icon-btn" id="copy-btn" aria-label="Copy lyrics" title="Copy">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
					</button>
				</div>
			</header>
			${sections}
		</article>
	`;

	$("#copy-btn")?.addEventListener("click", () => {
		const text = result.text || sectionsToText(result.sections);
		navigator.clipboard.writeText(text).then(
			() => toast("Lyrics copied"),
			() => toast("Couldn't copy", "err")
		);
	});

	els.reroll.hidden = false;
}

function sectionsToText(sections) {
	return sections.map((s) => `[${s.label}]\n${s.lines.join("\n")}`).join("\n\n");
}

async function handleSubmit() {
	const artists = [...selectedArtists];
	if (artists.length === 0) {
		toast("Pick at least one artist", "err");
		return;
	}
	const theme = els.theme.value.trim();
	const order = selectedOrder;
	const scheme = selectedScheme;

	els.generateBtn.disabled = true;
	els.generateLabel.textContent = "Generating…";
	renderLoading();

	try {
		// Yield to the browser so the loading state paints before chain build.
		await new Promise((r) => setTimeout(r, 0));
		const result = generateLyrics({ artists, theme, order, scheme });
		result.text = lyricsToText(result);
		renderResult(result);
		els.generateLabel.textContent = "Generate again";
	} catch (err) {
		console.error(err);
		els.output.innerHTML = "";
		toast(err.message || "Generation failed", "err");
		els.generateLabel.textContent = "Try again";
	} finally {
		els.generateBtn.disabled = false;
	}
}

function setOrder(n) {
	selectedOrder = n;
	els.orderGrid.querySelectorAll(".order-pill").forEach((p) => {
		p.classList.toggle("is-active", Number(p.dataset.order) === n);
	});
	if (els.orderHint) els.orderHint.textContent = ORDER_HINTS[n] || `${n}`;
}

els.orderGrid?.addEventListener("click", (e) => {
	const btn = e.target.closest(".order-pill");
	if (!btn) return;
	const n = Number(btn.dataset.order);
	if (Number.isFinite(n)) setOrder(n);
});

function renderSchemes(schemes, defaultKey) {
	if (!els.schemeGrid) return;
	schemesMeta = schemes;
	els.schemeGrid.innerHTML = schemes
		.map(
			(s) => `
		<button type="button" class="scheme-pill ${s.key === defaultKey ? "is-active" : ""}" data-scheme="${escapeHtml(s.key)}" title="${escapeHtml(s.description)}">
			<span class="scheme-pill__name">${escapeHtml(s.name)}</span>
			<span class="scheme-pill__visual">${escapeHtml(s.visual || s.pattern)}</span>
		</button>
	`
		)
		.join("");
	setScheme(defaultKey);
}

function setScheme(key) {
	selectedScheme = key;
	const meta = schemesMeta.find((s) => s.key === key);
	els.schemeGrid.querySelectorAll(".scheme-pill").forEach((p) => {
		p.classList.toggle("is-active", p.dataset.scheme === key);
	});
	if (els.schemeHint && meta) {
		els.schemeHint.textContent = `${meta.name} — ${meta.description.split(" —")[0].split(" - ")[0].split(".")[0]}`;
	}
}

els.schemeGrid?.addEventListener("click", (e) => {
	const btn = e.target.closest(".scheme-pill");
	if (!btn) return;
	setScheme(btn.dataset.scheme);
});

function init() {
	const artists = ARTIST_KEYS.map((k) => ({
		key: k,
		display: ARTISTS[k].display,
		color: ARTISTS[k].color,
	}));
	const schemes = SCHEME_KEYS.map((k) => ({
		key: k,
		name: SCHEMES[k].name,
		pattern: SCHEMES[k].pattern,
		description: SCHEMES[k].description,
		visual: SCHEMES[k].visual,
	}));
	renderArtists(artists);
	renderSchemes(schemes, DEFAULT_SCHEME);
	els.modePill.textContent = "Offline mode";
}

els.form.addEventListener("submit", (e) => {
	e.preventDefault();
	handleSubmit();
});

els.reroll.addEventListener("click", () => {
	handleSubmit();
});

init();
