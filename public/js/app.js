const $ = (sel) => document.querySelector(sel);

const els = {
	form: $("#form"),
	vibeGrid: $("#vibe-grid"),
	vibeInput: $("#vibe"),
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

let lastResult = null;

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

function renderVibes(vibes) {
	els.vibeGrid.innerHTML = vibes
		.map(
			(v, i) => `
		<button type="button" class="vibe-pill ${i === 0 ? "is-active" : ""}" data-vibe="${escapeHtml(v)}">${escapeHtml(v)}</button>
	`
		)
		.join("");
	els.vibeInput.value = vibes[0];

	els.vibeGrid.addEventListener("click", (e) => {
		const btn = e.target.closest("[data-vibe]");
		if (!btn) return;
		els.vibeGrid.querySelectorAll(".vibe-pill").forEach((p) => p.classList.remove("is-active"));
		btn.classList.add("is-active");
		els.vibeInput.value = btn.dataset.vibe;
	});
}

function renderLoading() {
	els.output.innerHTML = `
		<div class="loading">
			<div>Writing your song…</div>
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
					<h2 class="song__title">${escapeHtml(capitalize(result.vibe))}</h2>
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

function capitalize(s) {
	return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function sectionsToText(sections) {
	return sections.map((s) => `[${s.label}]\n${s.lines.join("\n")}`).join("\n\n");
}

async function generate({ vibe, theme, useClaude }) {
	const res = await fetch("/api/generate", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ vibe, theme, useClaude }),
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err.error || `HTTP ${res.status}`);
	}
	return res.json();
}

async function handleSubmit() {
	const vibe = els.vibeInput.value;
	const theme = els.theme.value.trim();
	const useClaude = els.useClaude?.checked || false;

	els.generateBtn.disabled = true;
	els.generateLabel.textContent = "Generating…";
	renderLoading();

	try {
		const result = await generate({ vibe, theme, useClaude });
		lastResult = result;
		renderResult(result);
	} catch (err) {
		console.error(err);
		els.output.innerHTML = "";
		toast(err.message || "Generation failed", "err");
	} finally {
		els.generateBtn.disabled = false;
		els.generateLabel.textContent = "Generate again";
	}
}

async function init() {
	try {
		const res = await fetch("/api/vibes");
		const { vibes, claudeAvailable } = await res.json();
		renderVibes(vibes);
		if (claudeAvailable) {
			els.claudeWrap.hidden = false;
			els.modePill.textContent = "Claude available";
		} else {
			els.modePill.textContent = "Offline mode";
		}
	} catch (err) {
		console.error(err);
		toast("Couldn't load vibes", "err");
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
