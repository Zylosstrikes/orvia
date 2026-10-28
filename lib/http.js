// Tiny fetch helper: timeout, in-memory cache, in-flight de-dupe, stale-if-error, per-host health stats.
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const WIKI_UA = 'OrviaSearch/2.0 (https://github.com/Zylosstrikes/orvia; keyless search app) node-fetch';
const isWiki = (u) => /(^|\.)(wikipedia|wikimedia|wikidata|wiktionary)\.org\//.test(u.replace(/^https?:\/\//, ''));
const cache = new Map(), inflight = new Map(), health = {};
const note = (url, ok, err) => { try { const h = new URL(url).hostname; (health[h] ||= { ok: 0, fail: 0 }); health[h][ok ? 'ok' : 'fail']++; health[h].last = new Date().toISOString(); if (!ok) health[h].err = String(err).slice(0, 80); } catch {} };
async function fetchText(url, { ttl = 300e3, timeout = 6000, ok = () => true, headers = {}, stale = 3600e3 } = {}) {
  const c = cache.get(url);
  if (c && Date.now() - c.t < ttl) return c.v;
  if (inflight.has(url)) return inflight.get(url);
  const p = (async () => {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': isWiki(url) ? WIKI_UA : UA, 'Accept-Language': 'en-US,en;q=0.9', ...headers }, signal: AbortSignal.timeout(timeout), redirect: 'follow' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const v = await r.text();
      if (!ok(v)) throw new Error('unusable body');
      cache.set(url, { v, t: Date.now() });
      if (cache.size > 800) cache.delete(cache.keys().next().value);
      note(url, true);
      return v;
    } catch (e) {
      note(url, false, e.message || e);
      if (c && Date.now() - c.t < stale) return c.v;
      throw e;
    } finally { inflight.delete(url); }
  })();
  inflight.set(url, p);
  return p;
}
const fetchJSON = async (url, o) => JSON.parse(await fetchText(url, { ...o, ok: (v) => { try { JSON.parse(v); return true; } catch { return false; } } }));
const withTimeout = (p, ms, fallback = null) => Promise.race([Promise.resolve(p).catch(() => fallback), new Promise((r) => setTimeout(() => r(fallback), ms))]);
// first promise (in array order of completion) whose value passes `good`; resolves null if none
function firstGood(promises, good = (v) => v && v.length) {
  return new Promise((resolve) => {
    let left = promises.length; if (!left) return resolve(null);
    promises.forEach((p) => Promise.resolve(p).then((v) => { if (good(v)) resolve(v); else if (!--left) resolve(null); }, () => { if (!--left) resolve(null); }));
  });
}
module.exports = { UA, fetchText, fetchJSON, withTimeout, firstGood, health };
