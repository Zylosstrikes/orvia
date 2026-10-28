// Query understanding: operators, conversational filler, edit distance, ranking.
const lev = (a, b) => { a = a.toLowerCase(); b = b.toLowerCase(); const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let p = Array.from({ length: n + 1 }, (_, i) => i); for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[n]; };
function parseQuery(raw) {
  const ops = { sites: [], filetypes: [], neg: [], phrases: [] };
  let rest = raw.replace(/\bsite:(\S+)/gi, (_, s) => (ops.sites.push(s.toLowerCase().replace(/^www\./, '').replace(/\/.*$/, '')), ''))
    .replace(/\b(?:filetype|ext):(\w+)/gi, (_, s) => (ops.filetypes.push(s.toLowerCase()), ''))
    .replace(/(^|\s)-"([^"]+)"/g, (_, sp, s) => (ops.neg.push(s.toLowerCase()), ' '))
    .replace(/(^|\s)-([\w][\w-]*)/g, (_, sp, s) => (ops.neg.push(s.toLowerCase()), ' '))
    .replace(/"([^"]+)"/g, (_, s) => (ops.phrases.push(s.toLowerCase()), s));
  const plain = rest.replace(/\s+/g, ' ').trim();
  return { raw, ops, plain, hasOps: !!(ops.sites.length || ops.filetypes.length || ops.neg.length || ops.phrases.length) };
}
const FILL = [
  [/^(?:hey|ok|okay|hi|please|pls|kindly)[, ]+/i, ''],
  [/^(?:can|could|would|will) you (?:please )?(?:tell|show|give|find|help)(?: me)?(?: with| about)?\s+/i, ''],
  [/^(?:i (?:want|need|would like|'d like) to (?:know|find|learn)(?: about)?|i'm looking for|i am looking for|looking for)\s+/i, ''],
  [/^(?:tell me about|tell me|show me|give me|find me|search for|search|look up|google)\s+/i, ''],
  [/^how (?:do|can|should|would) (?:i|you|we|one)\s+/i, 'how to '],
  [/^what(?:'s| is| are| was| were)\s+(?:the\s+|a\s+|an\s+)?/i, ''],
  [/^(?:who|where|when) (?:is|are|was|were)\s+(?:the\s+)?/i, ''],
  [/\s*(?:please|pls|thanks|thank you)\s*[?.!]*$/i, ''],
];
const KW_STOP = new Set(['how', 'to', 'do', 'does', 'did', 'i', 'my', 'me', 'we', 'you', 'your', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'can', 'could', 'should', 'would', 'what', 'whats', "what's", 'which', 'who', 'where', 'when', 'why', 'of', 'in', 'on', 'for', 'about', 'please', 'get', 'with', 'there', 'it', 'that', 'this', 'be']);
// content words only, e.g. "how do I reset my gmail password" -> "reset gmail password" (retrieval fallback)
function keywordQuery(q) { const w = q.replace(/[?!.,]/g, ' ').split(/\s+/).filter((x) => x && !KW_STOP.has(x.toLowerCase())); return w.length >= 2 ? w.join(' ') : q.trim(); }
function cleanQuery(q) { let s = q.trim(); for (let i = 0; i < 3; i++) for (const [re, rep] of FILL) s = s.replace(re, rep); s = s.replace(/[?!.]+$/, '').trim(); return s.split(/\s+/).filter(Boolean).length ? s : q.trim(); }
const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } };
const regDomain = (h) => { const p = h.split('.'); if (p.length <= 2) return h; const t = p.slice(-2); return (t[0].length <= 3 && ['co', 'com', 'org', 'gov', 'edu', 'ac', 'net'].includes(t[0]) && t[1].length === 2) ? p.slice(-3).join('.') : t.join('.'); };
const FOREIGN = /^(de|fr|es|it|pt|nl|ru|ja|zh|ko|pl|tr|sv|ar|id|vi|th|cs)\.|\.(de|fr|es|it|nl|ru|pl|jp|cn|at|ch)$|(^|\.)(leo\.org|dict\.cc|langenscheidt\.com|pons\.com|linguee\.[a-z]+|reverso\.net|dwds\.de|duden\.de)$/;
const AUTH = /(^|\.)(wikipedia\.org|britannica\.com|nih\.gov|who\.int|bbc\.(com|co\.uk)|reuters\.com|apnews\.com|nature\.com|github\.com|mozilla\.org|python\.org|developer\.mozilla\.org|docs\.[a-z0-9-]+\.[a-z]+|stackoverflow\.com|nasa\.gov|arxiv\.org|mayoclinic\.org|cdc\.gov)$/;
const AUTH_TLD = /\.(gov|edu|gov\.ng|edu\.ng|gov\.uk|ac\.uk|gov\.za|int)$/;
const JUNK_HOST = /(^|\.)(pinterest\.[a-z.]+|quora\.com|facebook\.com|instagram\.com|tiktok\.com|ask\.com|answers\.com|ehow\.com|wikihow\.life|slideshare\.net|scribd\.com|coursehero\.com|chegg\.com|brainly\.com|dailymotion\.com)$/;
const JUNK_TXT = /(coupon|promo code|free download|crack(ed)?\b|keygen|click here|buy now|casino|essay writing|login\s*-|sign in\s*-)/i;
const toks = (s) => (s.toLowerCase().match(/[a-z0-9\u00c0-\u024f]+/g) || []).filter((w) => w.length > 1);
const STOPW = new Set(['the', 'and', 'for', 'with', 'what', 'how', 'is', 'are', 'of', 'in', 'to', 'a', 'an', 'on', 'at', 'do', 'does', 'me', 'my', 'define', 'definition', 'meaning']);
function coverage(pq, r) { const qt = toks(pq.plain).filter((w) => !STOPW.has(w)); if (!qt.length) return 1; const text = (r.title + ' ' + r.snippet + ' ' + r.url).toLowerCase(); return qt.filter((w) => text.includes(w)).length / qt.length; }
function rankResults(pq, results, { perHost = 2 } = {}) {
  const qt = toks(pq.plain).filter((w) => !STOPW.has(w)), n = results.length;
  const scored = results.map((r, i) => {
    const h = hostOf(r.url), text = (r.title + ' ' + r.snippet + ' ' + r.url).toLowerCase(), tt = toks(text);
    const cov = qt.length ? qt.filter((w) => text.includes(w)).length / qt.length : 1;
    let s = (n - i) * 1.0 + cov * 4;
    if (cov < 0.34 && qt.length > 1) s -= 4;
    if (FOREIGN.test(h) && !/[^\x00-\x7f]/.test(pq.plain)) s -= 8; // upstream sometimes localises to the host's country; keep English results first
    if (AUTH.test(h) || AUTH_TLD.test(h)) s += 3.5;
    const label = regDomain(h).split('.')[0];
    if (label.length > 3 && qt.some((w) => w === label || (w.length > 4 && label.includes(w)))) s += 4.5; // likely the official site
    if (JUNK_HOST.test(h)) s -= 5;
    if (JUNK_TXT.test(r.title)) s -= 4;
    if (!r.snippet) s -= 1.5;
    if ((r.url.split('?')[1] || '').length > 80) s -= 1;
    if (pq.ops.phrases.length && !pq.ops.phrases.every((p) => text.includes(p))) s -= 3;
    return { r, s, h: regDomain(h) };
  }).sort((a, b) => b.s - a.s);
  const out = [], over = [], seen = {}, urls = new Set();
  for (const x of scored) {
    const key = x.r.url.replace(/[#?].*$/, '').replace(/\/$/, '');
    if (urls.has(key)) continue; urls.add(key);
    seen[x.h] = (seen[x.h] || 0) + 1;
    (seen[x.h] <= perHost ? out : over).push(x.r);
  }
  return out.concat(over);
}
function applyOps(pq, results) {
  const { sites, filetypes, neg } = pq.ops;
  return results.filter((r) => {
    const h = hostOf(r.url), t = (r.title + ' ' + r.snippet).toLowerCase();
    if (sites.length && !sites.some((s) => h === s || h.endsWith('.' + s))) return false;
    if (filetypes.length && !filetypes.some((f) => new RegExp('\\.' + f + '($|[?#])', 'i').test(r.url))) return false;
    if (neg.some((w) => t.includes(w) || h.includes(w))) return false;
    return true;
  });
}
module.exports = { keywordQuery, coverage, lev, parseQuery, cleanQuery, hostOf, regDomain, rankResults, applyOps, toks };
