// Keyless search sources with fallbacks. Bing is primary (several market variants raced); Mojeek/SearXNG/Wikipedia as fallbacks.
const { fetchText, fetchJSON, firstGood, withTimeout } = require('./http');
const enc = encodeURIComponent;
const ent = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;|&ensp;|&#183;/g, ' ').replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
const strip = (s) => ent(String(s).replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const MKT = { NG: 'en-NG', GH: 'en-GB', KE: 'en-GB', ZA: 'en-ZA', GB: 'en-GB', IN: 'en-IN', CA: 'en-CA', AU: 'en-AU', US: 'en-US' };
const mktFor = (cc) => MKT[cc] || 'en-US';
const VARIANT = { us: '&setlang=en&cc=US&mkt=en-US', plain: '', gb: '&mkt=en-GB&cc=GB', user: (cc) => `&setlang=en&cc=${cc}&mkt=${mktFor(cc)}` };

// Decode Bing redirect wrappers (bing.com/ck/a?...&u=a1<base64>, news apiclick ?url=...) to the real destination
function unwrap(h) {
  h = ent(String(h || '').trim());
  try {
    const u = new URL(h, 'https://www.bing.com');
    if (/(^|\.)bing\.com$/.test(u.hostname)) {
      const a = u.searchParams.get('u');
      if (a && /^a1/.test(a)) { const d = Buffer.from(a.slice(2).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); if (/^https?:\/\//i.test(d)) return d; }
      const b = u.searchParams.get('url') || u.searchParams.get('r');
      if (b && /^https?:\/\//i.test(b)) return b;
    }
    return /^https?:$/.test(u.protocol) ? u.href : '';
  } catch { return ''; }
}
const cleanSnippet = (s) => s.replace(/^Web\s*/, '').replace(/(\S)\s*…?\s*Read more\s*…?$/i, (m, c) => (/[.!?]/.test(c) ? c : c + '…')).trim();
function parseBingHtml(html) {
  const out = [];
  for (const blk of html.split(/<li class="b_algo[" ]/).slice(1)) {
    const h = blk.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/); if (!h) continue;
    const p = blk.match(/<p[^>]*>([\s\S]*?)<\/p>/) || blk.match(/class="b_lineclamp\d"[^>]*>([\s\S]*?)<\/div>/);
    const url = unwrap(h[1]); if (!url) continue;
    out.push({ title: strip(h[2]), url, snippet: p ? cleanSnippet(strip(p[1])) : '' });
  }
  return out;
}
function parseRss(xml) {
  return xml.split('<item>').slice(1).map((i) => {
    const g = (t) => { const m = i.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)); return m ? strip(m[1]) : ''; };
    const rawImg = g('News:Image');
    return { title: g('title'), url: unwrap(g('link')) || '', snippet: g('description'), date: g('pubDate'), source: g('News:Source'), image: rawImg ? rawImg.replace(/^http:/, 'https:') + '&w=800&h=450&c=7' : '' };
  }).filter((x) => x.url && x.title);
}
const okHtml = (h) => /<li class="b_algo[" ]/.test(h);
const okRss = (v) => v.startsWith('<?xml') && v.includes('<item>');
const bingHtml = (q, page, v) => fetchText(`https://www.bing.com/search?q=${enc(q)}&first=${(page - 1) * 10 + 1}${v}`, { ok: okHtml, timeout: 5500 }).then(parseBingHtml);
const bingRssWeb = (q, page, mk) => fetchText(`https://www.bing.com/search?q=${enc(q)}&format=rss&first=${(page - 1) * 10 + 1}&mkt=${mk}`, { ok: okRss, timeout: 5500 }).then((x) => parseRss(x).map(({ title, url, snippet }) => ({ title, url, snippet })));

async function bingWeb(q, page, cc) {
  if (process.env.ORVIA_DISABLE_BING) return { results: [], source: null }; // test/ops switch to exercise the fallback path
  const userV = cc && cc !== 'US' ? VARIANT.user(cc) : null;
  const first = userV ? [bingHtml(q, page, userV), bingHtml(q, page, VARIANT.us)] : [bingHtml(q, page, VARIANT.us), bingHtml(q, page, VARIANT.plain)];
  const [a, b] = await Promise.allSettled(first).then((r) => r.map((x) => (x.status === 'fulfilled' ? x.value : [])));
  let res = a.length >= 6 ? a : mergeUniq(a, b);
  if (res.length) return { results: res, source: 'bing' };
  // both HTML variants empty -> other markets and Bing's RSS web feed
  const more = await firstGood([bingHtml(q, page, VARIANT.gb), bingRssWeb(q, page, 'en-US'), bingRssWeb(q, page, 'en-GB'), bingHtml(q, page, VARIANT.plain)]);
  return more ? { results: more, source: 'bing' } : { results: [], source: null };
}
const mergeUniq = (...lists) => { const seen = new Set(), out = []; for (const l of lists) for (const r of l) { const k = r.url.replace(/[#?].*$/, '').replace(/\/$/, ''); if (!seen.has(k)) { seen.add(k); out.push(r); } } return out; };

// ---- fallbacks ----
async function mojeek(q, page) {
  const h = await fetchText(`https://www.mojeek.com/search?q=${enc(q)}&s=${(page - 1) * 10 + 1}`, { timeout: 5000, ok: (v) => /class="title"|class="ob"/.test(v) });
  const out = [];
  for (const li of h.split(/<li[^>]*>/).slice(1)) {
    const a = li.match(/<a[^>]*class="title"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/) || li.match(/<a[^>]*href="([^"]+)"[^>]*class="title"[^>]*>([\s\S]*?)<\/a>/); if (!a) continue;
    const p = li.match(/<p class="s">([\s\S]*?)<\/p>/);
    out.push({ title: strip(a[2]), url: ent(a[1]), snippet: p ? strip(p[1]) : '' });
  }
  return out.filter((r) => /^https?:/.test(r.url));
}
const SEARX = ['https://searx.be', 'https://search.ononoki.org', 'https://searx.tiekoetter.com', 'https://priv.au', 'https://paulgo.io'];
const searx = (q, page) => firstGood(SEARX.map((b) => fetchJSON(`${b}/search?q=${enc(q)}&format=json&pageno=${page}`, { timeout: 4500 }).then((j) => (j.results || []).slice(0, 10).map((r) => ({ title: strip(r.title || ''), url: r.url, snippet: strip(r.content || '') })).filter((r) => /^https?:/.test(r.url || '')))));
async function wikiSearch(q, page) {
  const j = await fetchJSON(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${enc(q)}&srlimit=10&sroffset=${(page - 1) * 10}&srinfo=suggestion&format=json&origin=*`, { timeout: 5000 });
  return { results: (j.query?.search || []).map((s) => ({ title: s.title + ' – Wikipedia', url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(s.title.replace(/ /g, '_')), snippet: strip(s.snippet) + '…' })), suggestion: j.query?.searchinfo?.suggestion || '' };
}
async function fallbackWeb(q, page) {
  const [mj, sx, wk] = await Promise.all([mojeek(q, page).catch(() => []), searx(q, page).catch(() => null), wikiSearch(q, page).catch(() => ({ results: [] }))]);
  if (mj.length) return { results: mj, source: 'mojeek' };
  if (sx && sx.length) return { results: sx, source: 'searxng' };
  if (wk.results.length) return { results: wk.results, source: 'wikipedia' };
  return { results: [], source: null };
}

// ---- news / images / suggestions ----
async function news(q, first = 0, cc = '') {
  const u = (m) => `https://www.bing.com/news/search?q=${enc(q)}&format=rss${first ? '&first=' + first : ''}${m}`;
  const userM = cc && cc !== 'US' ? `&mkt=${mktFor(cc)}` : '';
  const get = (m) => fetchText(u(m), { ok: okRss, timeout: 5500 }).then(parseRss);
  const a = await firstGood([get(userM || '&mkt=en-US'), get('&mkt=en-US')]);
  if (a) return a;
  return (await firstGood([get(''), get('&mkt=en-GB'), get('&mkt=en-US&setlang=en')])) || [];
}
async function images(q, page, cc = '') {
  const u = (m) => `https://www.bing.com/images/async?q=${enc(q)}&first=${(page - 1) * 35}&count=35${m}`;
  const parse = (h) => [...h.matchAll(/m="(\{[^"]+\})"/g)].map((m) => { try { const j = JSON.parse(ent(m[1])); return { thumb: j.turl, img: j.murl, url: j.purl, title: j.t || '' }; } catch { return null; } }).filter((x) => x && x.thumb && /^https?:/.test(x.url || x.img || ''));
  const get = (m) => fetchText(u(m), { ok: (h) => h.includes('murl'), timeout: 5500 }).then(parse);
  const r = await firstGood([get(cc && cc !== 'US' ? `&mkt=${mktFor(cc)}` : '&mkt=en-US'), get('&mkt=en-US'), get('')]);
  if (r) return { results: r, source: 'bing' };
  try { // Wikimedia Commons fallback
    const j = await fetchJSON(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${enc(q)}&gsrlimit=30&gsroffset=${(page - 1) * 30}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=360&format=json&origin=*`, { timeout: 5000 });
    return { results: Object.values(j.query?.pages || {}).map((p) => { const i = p.imageinfo?.[0]; return i ? { thumb: i.thumburl, img: i.url, url: i.descriptionurl, title: p.title.replace(/^File:/, '') } : null; }).filter(Boolean), source: 'commons' };
  } catch { return { results: [], source: null }; }
}
async function suggest(q) {
  const tries = [
    () => fetchJSON(`https://api.bing.com/osjson.aspx?query=${enc(q)}`, { timeout: 3500, ttl: 600e3 }).then((j) => j[1] || []),
    () => fetchJSON(`https://duckduckgo.com/ac/?q=${enc(q)}&type=list`, { timeout: 3000, ttl: 600e3 }).then((j) => j[1] || []),
    () => fetchJSON(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${enc(q)}&limit=8&format=json&origin=*`, { timeout: 3500, ttl: 600e3 }).then((j) => j[1] || []),
  ];
  for (const t of tries) { try { const r = await t(); if (r.length) return r.map(String); } catch {} }
  return [];
}
module.exports = { bingWeb, fallbackWeb, wikiSearch, news, images, suggest, mergeUniq, unwrap, parseBingHtml, parseRss, mktFor, strip, ent };
