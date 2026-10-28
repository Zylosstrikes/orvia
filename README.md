# Orvia — keyless search PWA
`node server.js` → http://localhost:3000 (PORT env). Node 18+, zero npm deps. Deployed on Render (autodeploy from `main`).

**Backend (`server.js`, `lib/`)**
- `lib/sources.js` – Bing HTML/RSS (several market variants raced, redirect URLs decoded server-side), fallbacks: Mojeek, public SearXNG, Wikipedia; news (Bing RSS), images (Bing → Wikimedia Commons), suggestions (Bing osjson → DDG → Wikipedia).
- `lib/query.js` – operators (`site:`, `filetype:`, quotes, `-term`), conversational-filler removal, edit distance, ranking (domain dedupe, authority boost, junk penalty, term coverage).
- `lib/answers.js` – calculator, unit/currency conversion (open.er-api.com), definitions (dictionaryapi.dev), time in city, weather (Open-Meteo), Wikipedia knowledge panel + Wikidata facts.
- `/api/search|images|news|feed|suggest|ping|health`. In-memory cache, 5–8 s upstream timeouts, stale-if-error, per-IP rate limit. API responses are `no-store`.

**Frontend (`public/`)** – SPA (Explore, Search, Pulse, Trail, Signals). All external links are real `<a target=_blank rel="noopener noreferrer">`; inside an installed PWA they use `window.open` with a same-tab fallback. Service worker (`orvia-v3`) never caches `/api/*` or cross-origin requests. Cold start shows a "Waking up Orvia…" banner.

`/api/health` shows per-upstream ok/fail counters (useful to see whether Bing is limiting the host).
