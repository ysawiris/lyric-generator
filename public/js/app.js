const $ = (sel) => document.querySelector(sel);

const els = {
	form: $("#form"),
	artistGrid: $("#artist-grid"),
	theme: $("#theme"),
	useClaude: $("#useClaude"),
	claudeWrap: $("#claude-toggle-wrap"),
	output: $("#output-host"),
	modePill: $("#mode-pill"),
	generateBtn: $("#generate-btn"),
	generateLabel: $("#generate-label"),
	reroll: $("#reroll"),
	toastHost: $("#toast-host"),
};

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

	// Default: pre-select Drake
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
		// Don't let user de-select the last one
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
	if (result.mode === "offline" && result.seed != null) meta.push(`Seed: ${result.seed}`);
	if (result.mode === "claude") meta.push(`Mode: Claude`);

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

async function generate({ artists, theme, useClaude }) {
	const res = await fetch("/api/generate", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ artists, theme, useClaude }),
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err.error || `HTTP ${res.status}`);
	}
	return res.json();
}

async function handleSubmit() {
	const artists = [...selectedArtists];
	if (artists.length === 0) {
		toast("Pick at least one artist", "err");
		return;
	}
	const theme = els.theme.value.trim();
	const useClaude = els.useClaude?.checked || false;

	els.generateBtn.disabled = true;
	els.generateLabel.textContent = "Generating…";
	renderLoading();

	try {
		const result = await generate({ artists, theme, useClaude });
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

async function init() {
	try {
		const res = await fetch("/api/artists");
		const { artists, claudeAvailable } = await res.json();
		renderArtists(artists);
		if (claudeAvailable) {
			els.claudeWrap.hidden = false;
			els.modePill.textContent = "Claude available";
		} else {
			els.modePill.textContent = "Offline mode";
		}
	} catch (err) {
		console.error(err);
		toast("Couldn't load artists", "err");
	}
}

els.form.addEventListener("submit", (e) => {
	e.preventDefault();
	handleSubmit();
});

els.reroll.addEventListener("click", () => {
	handleSubmit();
});

init();
