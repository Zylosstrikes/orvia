const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const { health, withTimeout } = require('./lib/http');
const S = require('./lib/sources');
const { parseQuery, cleanQuery, keywordQuery, rankResults, applyOps, lev, coverage } = require('./lib/query');
const { instantAnswers, weatherQuery } = require('./lib/answers');
const PORT = process.env.PORT || 3000, HOST = '0.0.0.0', PUB = path.join(__dirname, 'public'), VERSION = '2.0.0', STARTED = Date.now();

// ---------- helpers ----------
const STOP = new Set(['the', 'and', 'for', 'news', 'new', 'latest', 'price', 'best', 'what', 'how', 'today', '2026', 'releases', 'update', 'updates']);
function relevant(t, r) {
  const kw = t.toLowerCase().split(/\W+/).filter((w) => w.length > 2 && !STOP.has(w)), txt = (a) => (a.title + ' ' + a.snippet).toLowerCase(), img = r.filter((a) => a.image);
  if (!kw.length) return img; const all = img.filter((a) => kw.every((k) => txt(a).includes(k)));
  return all.length >= 2 ? all : img.filter((a) => kw.some((k) => txt(a).includes(k)));
}
function summarize(q, res, wikiText) {
  const terms = q.toLowerCase().split(/\W+/).filter((w) => w.length > 2), sents = [];
  const add = (text, i, bonus) => text.split(/(?<=[.!?])\s+/).forEach((s) => {
    s = s.trim().replace(/\s*(?:…|\.\.\.)$/, '').replace(/^[a-z]/, (c) => c.toUpperCase());
    if (s.length < 40 || /[|»]/.test(s) || (!/[.!?]$/.test(s) && s.length < 70)) return;
    if (!/[.!?]$/.test(s)) s += '…'; s = s.replace(/([a-z])\.([A-Z])/g, '$1. $2');
    const l = s.toLowerCase(); sents.push({ s, i, score: terms.reduce((a, t) => a + (l.includes(t) ? 1 : 0), 0) + (8 - i) * 0.1 + bonus });
  });
  if (wikiText) add(wikiText.split(/(?<=[.!?])\s+/).slice(0, 2).join(' '), -1, 2);
  res.slice(0, 8).forEach((r, i) => add(r.snippet.replace(/^(?:[A-Z][a-z]{2,8}\.? \d{1,2},? \d{4}|\d{1,2} [A-Z][a-z]+ \d{4}|\d+ (?:days?|hours?) ago)\s*[·\-—]\s*/, '').replace(/\s*(?:…|\.\.\.)\s*$/, ''), i, 0));
  const seen = new Set();
  return sents.sort((a, b) => b.score - a.score).filter((x) => { const k = x.s.slice(0, 30).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 5).map((x) => ({ text: x.s, ref: x.i + 1 })).filter((x) => x.ref >= 1 || true);
}
const NEWSY = /\b(news|latest|today|live|score|scores|results?|vs\.?|versus|match|fixtures?|election|breaking|update|updates|headlines|transfer|price of|stock|crash|fire|accident|strike|protest)\b/i;

// ---------- the search pipeline ----------
async function search(q, page, cc, nc) {
  const t0 = Date.now(), pq = parseQuery(q), plain = pq.plain || q, cleaned = cleanQuery(plain);
  const first = page === 1;
  const instP = first ? instantAnswers(q, plain, pq.hasOps).catch(() => ({ answers: [], suggestion: '' })) : Promise.resolve({ answers: [], suggestion: '' });
  const suggP = first ? withTimeout(S.suggest(plain), 3800, []) : Promise.resolve([]);
  const wq = first ? await withTimeout(weatherQuery(q), 2500, null) : null;
  let { results, source } = await S.bingWeb(wq ? wq.query : q, page, cc);
  let used = q, corrected = null;
  const relevantCount = (l) => l.filter((r) => coverage(pq, r) >= 0.5).length;
  // poor / off-topic results -> retry with conversational filler removed, then with content words only
  if (!wq) for (const alt of [cleaned, keywordQuery(plain)]) {
    if (results.length >= 4 && relevantCount(results) >= 3) break;
    if (!alt || alt.toLowerCase() === plain.toLowerCase() || alt === used) continue;
    const altQ = pq.raw.replace(plain, alt), r2 = await S.bingWeb(altQ, page, cc);
    if (r2.results.length && relevantCount(r2.results) >= relevantCount(results)) { results = S.mergeUniq(r2.results, results); source = source || r2.source; used = altQ; }
  }
  const [inst, sugg] = await Promise.all([instP, suggP]);
  // spelling: wikipedia suggestion or a close edit-distance bing suggestion
  let dym = '';
  const cand = [...sugg.slice(0, 4), inst.suggestion].filter(Boolean);
  const hasLetters = /[a-z]{3}/i.test(plain), pl = plain.toLowerCase();
  if (hasLetters && !inst.answers.some((a) => ['calc', 'convert'].includes(a.type))) {
    let best = null;
    for (const c of cand) { const d = lev(plain, c), cl = c.toLowerCase(); if (cl !== pl && !cl.startsWith(pl) && !pl.startsWith(cl) && d >= 1 && d <= Math.max(2, Math.floor(plain.length * 0.3)) && (!best || d < best.d)) best = { c, d }; }
    if (best) dym = best.c;
  }
  if (results.length < 3 && dym && first && !nc) { const r3 = await S.bingWeb(dym, 1, cc); if (r3.results.length) { corrected = { from: q, to: dym }; results = S.mergeUniq(r3.results, results); source = source || r3.source; dym = ''; } }
  // all Bing variants failed (e.g. datacentre IP limited) -> other keyless sources
  let degraded = false, message = '';
  if (results.length < 3) {
    const fb = await S.fallbackWeb(cleaned || plain, page);
    if (fb.results.length) { degraded = true; results = S.mergeUniq(results, fb.results); source = results.length === fb.results.length ? fb.source : (source || fb.source); message = source === 'wikipedia' ? 'Web search sources are limited right now, so these results come from Wikipedia only. Please try again in a moment.' : `Primary search source was unavailable; showing results from ${source}.`; }
  }
  if (source !== 'bing' || degraded) results = applyOps(pq, results); // honour site:/-term/filetype: when the upstream didn't
  if (wq) { // keep weather results about the requested place; add a reliable forecast link
    const pl = wq.place.toLowerCase(); const hit = results.filter((r) => (r.title + ' ' + r.snippet + ' ' + r.url).toLowerCase().includes(pl) && /weather|forecast|temperature|climate/i.test(r.title + ' ' + r.snippet + ' ' + r.url));
    results = hit;
    if (wq.id) results.unshift({ title: `${wq.full} – BBC Weather`, url: `https://www.bbc.com/weather/${wq.id}`, snippet: `Hourly and 14-day forecast for ${wq.full} from BBC Weather.` });
  }
  results = rankResults(pq, results).slice(0, 14);
  const ans = inst.answers.slice(), mathy = ans.some((a) => ['calc', 'convert', 'time', 'weather'].includes(a.type));
  const wikiPanel = ans.find((a) => a.type === 'wiki');
  const topStories = (first && NEWSY.test(q)) ? await withTimeout(S.news(plain, 0, cc).then((r) => { const im = r.filter((a) => a.image); return (im.length >= 2 ? im : r).slice(0, 4); }), 4500, []) : [];
  // related searches & "people also ask"-style questions from suggestion APIs
  let related = sugg.filter((s) => s.toLowerCase() !== plain.toLowerCase()).slice(0, 8), paa = [];
  if (first && !mathy && plain.split(/\s+/).length <= 6) {
    const base = cleaned.replace(/^how to /i, '');
    const qs = await withTimeout(Promise.all(['how to ' + base, 'what is ' + base, 'why ' + base, base + ' vs'].map((p) => S.suggest(p))), 3500, []);
    const bw = base.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
    paa = [...new Set(qs.flat().filter((s) => /^(how|what|why|is|are|can|does|do|when|which|who)\b/i.test(s) && bw.some((w) => s.toLowerCase().includes(w)) && s.toLowerCase() !== plain.toLowerCase()))].slice(0, 5);
    related = related.concat(qs[3] || []).filter((s, i, a) => a.indexOf(s) === i && !paa.includes(s)).slice(0, 8);
  }
  if (!results.length) message = message || 'No results found. The search sources may be busy — try again, or rephrase your query.';
  return { query: q, usedQuery: used !== q ? used : undefined, corrected, didYouMean: dym || undefined, page, results, answers: ans.filter((a) => a.type !== 'wiki'), wiki: wikiPanel || null, topStories, related, paa,
    summary: summarize(plain, results, wikiPanel?.extract), meta: { source, degraded, message, ms: Date.now() - t0 } };
}

// ---------- http ----------
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
const hits = new Map(); setInterval(() => hits.clear(), 60e3).unref();
const SEC = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' };
function send(req, res, code, body, headers = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body); const ct = headers['Content-Type'] || '';
  const h = { ...SEC, ...headers };
  if (/json|text|javascript|svg|xml/.test(ct) && buf.length > 800 && /gzip/.test(req.headers['accept-encoding'] || '')) { h['Content-Encoding'] = 'gzip'; h['Vary'] = 'Accept-Encoding'; res.writeHead(code, h); return res.end(zlib.gzipSync(buf)); }
  res.writeHead(code, h); res.end(buf);
}
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), q = (u.searchParams.get('q') || '').trim(), page = Math.min(50, Math.max(1, parseInt(u.searchParams.get('page')) || 1));
  const cc = (u.searchParams.get('cc') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  const json = (d, c = 200) => send(req, res, c, JSON.stringify(d), { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  try {
    if (u.pathname.startsWith('/api/')) {
      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(); const n = (hits.get(ip) || 0) + 1; hits.set(ip, n);
      if (n > 240) return json({ error: 'Too many requests, slow down for a moment.' }, 429);
      if (u.pathname === '/api/ping') return json({ ok: true, v: VERSION, t: Date.now() });
      if (u.pathname === '/api/health') return json({ ok: true, v: VERSION, uptime: Math.round((Date.now() - STARTED) / 1000), upstream: health });
      if (u.pathname === '/api/search') { if (!q) return json({ results: [], answers: [], meta: {} }); if (q.length > 300) return json({ error: 'Query too long' }, 400); return json(await search(q, page, cc, u.searchParams.get('nc') === '1')); }
      if (u.pathname === '/api/images') { if (!q) return json({ results: [] }); const r = await S.images(q, page, cc); return json({ ...r, meta: { source: r.source, degraded: r.source === 'commons', message: r.source === 'commons' ? 'Image search is limited right now — showing Wikimedia Commons images.' : (r.results.length ? '' : 'No images found. Try again in a moment.') } }); }
      if (u.pathname === '/api/news') { if (!q) return json({ results: [] }); const r = await S.news(q, 0, cc); return json({ results: r, meta: { message: r.length ? '' : 'No news found right now. Try again in a moment.' } }); }
      if (u.pathname === '/api/feed') {
        let topics = (u.searchParams.get('topics') || '').split('|').map((t) => t.trim()).filter(Boolean).slice(0, 6); const first = +u.searchParams.get('first') || 0;
        const run = (tp) => Promise.all(tp.map((t) => S.news(t, first, cc).then((r) => relevant(t, r).map((a) => ({ ...a, topic: t }))).catch(() => [])));
        let lists = await run(topics);
        if (!lists.some((l) => l.length)) { const fb = ['world news', 'technology', 'sports'].filter((t) => !topics.includes(t)); lists = lists.concat(await run(fb)); }
        const out = [], seen = new Set(); for (let i = 0; i < 12; i++) for (const l of lists) { const a = l[i]; if (a && !seen.has(a.title)) { seen.add(a.title); out.push(a); } }
        return json({ results: out });
      }
      if (u.pathname === '/api/suggest') return json(q ? await S.suggest(q) : []);
      return json({ error: 'Not found' }, 404);
    }
    // static files (+ SPA fallback only for extension-less routes)
    let rel = decodeURIComponent(u.pathname); if (rel === '/' || !path.extname(rel)) rel = '/index.html';
    const f = path.normalize(path.join(PUB, rel));
    if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return send(req, res, 404, 'Not found', { 'Content-Type': 'text/plain' });
    const st = fs.statSync(f), etag = `"${st.size}-${Math.round(st.mtimeMs)}"`;
    const h = { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': /\.(png|svg)$/.test(f) ? 'public, max-age=86400' : 'no-cache', ETag: etag };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ...SEC, ETag: etag }); return res.end(); }
    send(req, res, 200, fs.readFileSync(f), h);
  } catch (e) { console.error(new Date().toISOString(), req.url, e && e.message); json({ error: 'Something went wrong on the server. Please retry.' }, 502); }
}).listen(PORT, HOST, () => console.log('Orvia ' + VERSION + ' listening on http://' + HOST + ':' + PORT));
process.on('unhandledRejection', (e) => console.error('unhandledRejection', e && e.message));
