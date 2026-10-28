// Instant answers: calculator, unit/currency conversion, definitions, time, weather, Wikipedia knowledge panel (all keyless).
const { fetchJSON, withTimeout } = require('./http');
const { lev, toks } = require('./query');
const enc = encodeURIComponent;

// ---------- calculator (no eval) ----------
const FN = { sqrt: Math.sqrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan, ln: Math.log, log: Math.log10, round: Math.round, floor: Math.floor, ceil: Math.ceil };
function evalExpr(s) {
  const t = s.match(/\d+\.?\d*(?:e[+-]?\d+)?|\.\d+|[a-z]+|\*\*|[-+*/%^()]/g) || []; let i = 0;
  const peek = () => t[i], next = () => t[i++];
  const prim = () => { const x = next(); if (x === undefined) throw 0; if (x === '(') { const v = add(); if (next() !== ')') throw 0; return v; } if (x === '-') return -pow(); if (x === '+') return pow();
    if (/^[a-z]+$/.test(x)) { if (x === 'pi') return Math.PI; if (x === 'e') return Math.E; if (!FN[x] || next() !== '(') throw 0; const v = add(); if (next() !== ')') throw 0; return FN[x](v); }
    const n = parseFloat(x); if (isNaN(n)) throw 0; return n; };
  const post = () => { let v = prim(); while (peek() === '%') { next(); v /= 100; } return v; };
  const pow = () => { const b = post(); if (peek() === '^' || peek() === '**') { next(); return Math.pow(b, pow()); } return b; };
  const mul = () => { let v = pow(); while (['*', '/'].includes(peek())) { const o = next(), r = pow(); v = o === '*' ? v * r : v / r; } return v; };
  const add = () => { let v = mul(); while (['+', '-'].includes(peek())) { const o = next(), r = mul(); v = o === '+' ? v + r : v - r; } return v; };
  const v = add(); if (i !== t.length) throw 0; return v;
}
function calc(q) {
  let s = q.toLowerCase().trim().replace(/^(?:calculate|calc|compute|what(?:'s| is)|solve)\s+/, '').replace(/[=?]+$/, '').trim();
  if (!s || /^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) return null;
  s = s.replace(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:[.,]\d+)*)/g, '($1/100*$2)').replace(/(\d),(?=\d{3}\b)/g, '$1').replace(/×/g, '*').replace(/÷/g, '/').replace(/(\d)\s*x\s*(?=[\d(.])/g, '$1*').replace(/\btimes\b/g, '*').replace(/\bplus\b/g, '+').replace(/\bminus\b/g, '-').replace(/\bdivided by\b/g, '/').replace(/\bmod\b/g, '%').replace(/\bto the power of\b/g, '^');
  if (!/^[\d\s+\-*/().%^a-z]+$/.test(s) || !/\d/.test(s)) return null;
  if (!/[+\-*/^%]|sqrt|sin|cos|tan|ln|log|abs|round|floor|ceil/.test(s)) return null;
  if ((s.match(/[a-z]+/g) || []).some((w) => !FN[w] && w !== 'pi' && w !== 'e')) return null;
  try { const v = evalExpr(s); if (!isFinite(v)) return null; return { type: 'calc', expr: s.replace(/\*/g, '×').replace(/\//g, '÷'), value: +v.toPrecision(12), pretty: new Intl.NumberFormat('en-US', { maximumFractionDigits: 10 }).format(+v.toPrecision(12)) }; } catch { return null; }
}

// ---------- units ----------
const U = {}; const dim = (d, list) => { for (const [names, f] of list) for (const n of names.split('|')) U[n] = { d, f }; };
dim('length', [['mm|millimeter|millimeters|millimetre|millimetres', .001], ['cm|centimeter|centimeters|centimetre|centimetres', .01], ['m|meter|meters|metre|metres', 1], ['km|kilometer|kilometers|kilometre|kilometres', 1000], ['in|inch|inches', .0254], ['ft|foot|feet', .3048], ['yd|yard|yards', .9144], ['mi|mile|miles', 1609.344], ['nmi|nautical mile|nautical miles', 1852]]);
dim('mass', [['mg|milligram|milligrams', 1e-6], ['g|gram|grams', .001], ['kg|kilogram|kilograms|kilo|kilos', 1], ['t|tonne|tonnes|metric ton', 1000], ['oz|ounce|ounces', .028349523], ['lb|lbs|pound|pounds', .45359237], ['st|stone', 6.35029318]]);
dim('volume', [['ml|milliliter|milliliters|millilitre|millilitres', .001], ['l|liter|liters|litre|litres', 1], ['gal|gallon|gallons', 3.785411784], ['qt|quart|quarts', .946352946], ['pt|pint|pints', .473176473], ['cup|cups', .2365882365], ['floz|fl oz|fluid ounce|fluid ounces', .0295735296], ['tbsp|tablespoon|tablespoons', .0147867648], ['tsp|teaspoon|teaspoons', .0049289216]]);
dim('speed', [['m/s|mps', 1], ['km/h|kmh|kph|kilometers per hour|kilometres per hour', 1 / 3.6], ['mph|miles per hour', .44704], ['kn|knot|knots', .514444], ['ft/s|fps', .3048]]);
dim('area', [['sqm|m2|m²|square meter|square meters|square metre|square metres', 1], ['sqkm|km2|km²|square kilometer|square kilometers', 1e6], ['ha|hectare|hectares', 1e4], ['acre|acres', 4046.8564224], ['sqft|ft2|ft²|square foot|square feet', .09290304], ['sqmi|mi2|mi²|square mile|square miles', 2589988.110336]]);
dim('data', [['bit|bits', .125], ['b|byte|bytes', 1], ['kb|kilobyte|kilobytes', 1e3], ['mb|megabyte|megabytes', 1e6], ['gb|gigabyte|gigabytes', 1e9], ['tb|terabyte|terabytes', 1e12], ['pb|petabyte|petabytes', 1e15]]);
dim('time', [['sec|second|seconds', 1], ['min|minute|minutes', 60], ['hr|hrs|hour|hours', 3600], ['day|days', 86400], ['week|weeks', 604800], ['month|months', 2629800], ['year|years|yr|yrs', 31557600]]);
const TEMP = { c: 'c', celsius: 'c', '°c': 'c', centigrade: 'c', f: 'f', fahrenheit: 'f', '°f': 'f', k: 'k', kelvin: 'k' };
const CUR_NAMES = { naira: 'NGN', nairas: 'NGN', dollar: 'USD', dollars: 'USD', usd: 'USD', euro: 'EUR', euros: 'EUR', pound: 'GBP', pounds: 'GBP', sterling: 'GBP', cedi: 'GHS', cedis: 'GHS', rand: 'ZAR', yen: 'JPY', rupee: 'INR', rupees: 'INR', yuan: 'CNY', rmb: 'CNY', franc: 'CHF', cad: 'CAD', aud: 'AUD' };
let rates = null, ratesAt = 0;
async function getRates() { if (rates && Date.now() - ratesAt < 3600e3) return rates; const j = await fetchJSON('https://open.er-api.com/v6/latest/USD', { ttl: 3600e3, timeout: 5000 }); rates = j.rates; ratesAt = Date.now(); return rates; }
const fmtNum = (v) => new Intl.NumberFormat('en-US', { maximumSignificantDigits: 7 }).format(v);
async function convert(q) {
  let s = q.toLowerCase().trim().replace(/\?+$/, '').replace(/^convert\s+/, '').replace(/^\$\s*(-?[\d,.]+)/, '$1 usd').replace(/^£\s*(-?[\d,.]+)/, '$1 gbp').replace(/^€\s*(-?[\d,.]+)/, '$1 eur').replace(/^₦\s*(-?[\d,.]+)/, '$1 ngn');
  const m = s.match(/^(-?[\d,]*\.?\d+)\s*([a-z°/²³ ]+?)\s+(?:to|in|into|as|=)\s+([a-z°/²³ ]+?)$/); if (!m) return null;
  const v = parseFloat(m[1].replace(/,/g, '')), a = m[2].trim(), b = m[3].trim();
  if (TEMP[a] && TEMP[b]) { const x = TEMP[a], y = TEMP[b]; const c = x === 'c' ? v : x === 'f' ? (v - 32) * 5 / 9 : v - 273.15; const r = y === 'c' ? c : y === 'f' ? c * 9 / 5 + 32 : c + 273.15; return { type: 'convert', from: `${fmtNum(v)} ${a.toUpperCase()}`, to: `${fmtNum(r)} ${b.toUpperCase()}`, value: r, kind: 'Temperature' }; }
  const ua = U[a], ub = U[b];
  if (ua && ub) { if (ua.d !== ub.d) return null; const r = v * ua.f / ub.f; return { type: 'convert', from: `${fmtNum(v)} ${a}`, to: `${fmtNum(r)} ${b}`, value: r, kind: ua.d[0].toUpperCase() + ua.d.slice(1) }; }
  const ca = CUR_NAMES[a] || (/^[a-z]{3}$/.test(a) ? a.toUpperCase() : null), cb = CUR_NAMES[b] || (/^[a-z]{3}$/.test(b) ? b.toUpperCase() : null);
  if (ca && cb) { try { const R = await getRates(); if (!R[ca] || !R[cb]) return null; const r = v / R[ca] * R[cb]; return { type: 'convert', kind: 'Currency', from: `${fmtNum(v)} ${ca}`, to: `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(r)} ${cb}`, value: r, note: `1 ${ca} = ${fmtNum(R[cb] / R[ca])} ${cb} · rates updated ${new Date(ratesAt).toUTCString().slice(5, 22)} UTC (open.er-api.com)` }; } catch { return null; } }
  return null;
}

// ---------- dictionary ----------
async function define(q) {
  const m = q.trim().match(/^(?:define|definition of|meaning of|what(?:'s| is) the meaning of|what does)\s+([a-z'-]+)(?:\s+mean)?\??$/i) || q.trim().match(/^([a-z'-]+)\s+(?:meaning|definition|define)$/i); if (!m) return null;
  const w = m[1].toLowerCase();
  try {
    const j = await fetchJSON(`https://api.dictionaryapi.dev/api/v2/entries/en/${enc(w)}`, { ttl: 86400e3, timeout: 5000 }); const e = j[0]; if (!e) throw 0;
    return { type: 'define', word: e.word, phonetic: e.phonetic || e.phonetics?.find((p) => p.text)?.text || '', meanings: (e.meanings || []).slice(0, 3).map((x) => ({ pos: x.partOfSpeech, def: x.definitions?.[0]?.definition || '', example: x.definitions?.[0]?.example || '' })).filter((x) => x.def), source: 'Free Dictionary API' };
  } catch {}
  try { // fallback: Wiktionary REST definitions
    const j = await fetchJSON(`https://en.wiktionary.org/api/rest_v1/page/definition/${enc(w)}`, { ttl: 86400e3, timeout: 5000 }); const en = j.en || []; const txt = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim();
    const meanings = en.slice(0, 3).map((x) => ({ pos: (x.partOfSpeech || '').toLowerCase(), def: txt(x.definitions?.[0]?.definition), example: txt(x.definitions?.[0]?.examples?.[0]) })).filter((x) => x.def); if (!meanings.length) return null;
    return { type: 'define', word: w, phonetic: '', meanings, source: 'Wiktionary' };
  } catch { return null; }
}

// ---------- places, time, weather ----------
async function geocode(name) { const g = await fetchJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${enc(name)}&count=1`, { ttl: 86400e3, timeout: 4500 }); return g.results?.[0] || null; }
async function timeIn(q) {
  const m = q.trim().match(/^(?:what(?:'s| is) the )?(?:current |local )?time(?: now)?(?: in| at| for)\s+(.+?)\??$/i) || q.trim().match(/^(.+?)\s+(?:time now|current time|local time|time)\??$/i); if (!m || /^(the|what|current|local|my)$/i.test(m[1])) return null;
  try { const p = await geocode(m[1]); if (!p?.timezone) return null; return { type: 'time', place: `${p.name}${p.country ? ', ' + p.country : ''}`, tz: p.timezone, epoch: Date.now() }; } catch { return null; }
}
const WX_RE = [/^(?:what(?:'s| is) the )?(?:current |today'?s? )?(?:weather|forecast|temperature)(?: like)?(?: today)?\s*(?:in|for|at)?\s+(.+?)\??$/i, /^(.+?)\s+(?:weather|forecast|temperature)(?: today| now)?\??$/i, /^(?:will it rain|is it raining)\s+in\s+(.+?)\??$/i];
// "weather Lagos" -> "Lagos, Nigeria weather forecast" so the web search isn't biased by the server's own location
async function weatherQuery(q) { for (const re of WX_RE) { const m = q.trim().match(re); if (m && !/^(the|today|now|like)$/i.test(m[1])) { try { const p = await geocode(m[1].trim()); if (p) return { query: `${p.name} ${p.admin1 && p.admin1 !== p.name ? p.admin1 + ' ' : ''}${p.country || ''} weather forecast`.replace(/\s+/g, ' ').trim(), place: p.name, full: `${p.name}, ${p.country || ''}`.replace(/, $/, ''), id: p.id }; } catch {} } } return null; }
async function weather(q) {
  const m = q.trim().match(/^(?:what(?:'s| is) the )?(?:current |today'?s? )?(?:weather|forecast|temperature)(?: like)?(?: today)?\s*(?:in|for|at)?\s+(.+?)\??$/i) || q.trim().match(/^(.+?)\s+(?:weather|forecast|temperature)(?: today| now)?\??$/i) || q.trim().match(/^(?:will it rain|is it raining)\s+in\s+(.+?)\??$/i);
  if (!m || /^(the|today|now|like)$/i.test(m[1])) return null;
  try {
    const p = await geocode(m[1].trim()); if (!p) return null;
    const place = `${p.name}, ${p.country || ''}`.replace(/, $/, '');
    try {
      const w = await fetchJSON(`https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,apparent_temperature&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&timezone=auto&forecast_days=5`, { ttl: 600e3, timeout: 5000 });
      return { type: 'weather', place, current: w.current, daily: w.daily };
    } catch { // Open-Meteo rate-limits shared hosts: fall back to wttr.in
      const j = await fetchJSON(`https://wttr.in/${p.latitude},${p.longitude}?format=j1`, { ttl: 600e3, timeout: 6000 }); const c = j.current_condition[0];
      const wmo = (n) => { n = +n; return n === 113 ? 0 : n === 116 ? 2 : (n === 119 || n === 122) ? 3 : [143, 248, 260].includes(n) ? 45 : [200, 386, 389, 392, 395].includes(n) ? 95 : [227, 230, 323, 326, 329, 332, 335, 338, 350, 368, 371, 374, 377].includes(n) ? 71 : 61; };
      return { type: 'weather', place, current: { temperature_2m: +c.temp_C, apparent_temperature: +c.FeelsLikeC, relative_humidity_2m: +c.humidity, wind_speed_10m: +c.windspeedKmph, weather_code: wmo(c.weatherCode) },
        daily: { time: j.weather.map((d) => d.date), temperature_2m_max: j.weather.map((d) => +d.maxtempC), temperature_2m_min: j.weather.map((d) => +d.mintempC), weather_code: j.weather.map((d) => wmo(d.hourly[4]?.weatherCode || 116)) } };
    }
  } catch { return null; }
}

// ---------- Wikipedia knowledge panel ----------
const norm = (s) => s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9\u00c0-\u024f ]/g, ' ').replace(/\s+/g, ' ').trim();
const WD = { P569: 'Born', P570: 'Died', P571: 'Founded', P1082: 'Population', P17: 'Country', P36: 'Capital', P159: 'Headquarters', P112: 'Founder', P106: 'Occupation', P27: 'Citizenship', P856: 'Website', P2046: 'Area (km²)', P1451: 'Motto' };
async function wikidataFacts(qid) {
  try {
    const j = await fetchJSON(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims&format=json&origin=*`, { ttl: 86400e3, timeout: 4500 });
    const claims = j.entities?.[qid]?.claims || {}, rows = [], need = new Set();
    for (const [p, label] of Object.entries(WD)) {
      const vals = (claims[p] || []).slice(0, ['P1082', 'P2046'].includes(p) ? 8 : 3).map((c) => c.mainsnak?.datavalue?.value).filter(Boolean); if (!vals.length) continue;
      const out = vals.map((v) => typeof v === 'string' ? v : v.time ? v.time.replace(/^\+?(\d{4})-(\d\d)-(\d\d).*$/, (_, y, mo, d) => (mo === '00' ? y : new Date(`${y}-${mo}-${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }))) : v.amount ? new Intl.NumberFormat('en-US').format(+v.amount) : v.id ? (need.add(v.id), v.id) : '');
      rows.push([label, ['P1082', 'P2046'].includes(p) ? [out.map((x) => [x, +String(x).replace(/,/g, '')]).sort((a, b) => b[1] - a[1])[0][0]] : out]);
    }
    let labels = {};
    if (need.size) { const l = await fetchJSON(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${[...need].join('|')}&props=labels&languages=en&format=json&origin=*`, { ttl: 86400e3, timeout: 4500 }); for (const [id, e] of Object.entries(l.entities || {})) labels[id] = e.labels?.en?.value || ''; }
    return rows.map(([k, v]) => [k, v.map((x) => labels[x] ?? x).filter(Boolean).join(', ')]).filter(([, v]) => v).slice(0, 6);
  } catch { return []; }
}
async function wiki(plain) {
  let base = plain.replace(/^(?:who|what) (?:is|was|are|were) (?:the |an? )?/i, '').replace(/^tell me about /i, '').replace(/\?+$/, '').trim();
  const words = base.split(/\s+/).filter(Boolean); if (!base || words.length > 5 || /^(how|why|when|where|which|best|top|cheap|buy|free|download)\b/i.test(base)) return null;
  try {
    const s = await fetchJSON(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${enc(base)}&srlimit=3&srinfo=suggestion&format=json&origin=*`, { ttl: 3600e3, timeout: 4500 });
    const hit = s.query?.search?.[0]; const suggestion = s.query?.searchinfo?.suggestion || '';
    if (!hit) return { suggestion };
    const nb = norm(base), nt = norm(hit.title); const bt = new Set(nb.split(' ')), tt = nt.split(' ');
    const match = nt === nb || (tt.length <= bt.size + 2 && tt.every((w) => bt.has(w) || w.length < 3) ) || lev(nt, nb) <= Math.max(1, Math.floor(nb.length * .15)) || (nb.length > 3 && nt.startsWith(nb + ' ') && tt.length <= bt.size + 1);
    if (!match) return { suggestion };
    const d = await fetchJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${enc(hit.title.replace(/ /g, '_'))}`, { ttl: 3600e3, timeout: 4500 });
    if (d.type === 'disambiguation' || !d.extract) return { suggestion };
    const facts = d.wikibase_item ? await withTimeout(wikidataFacts(d.wikibase_item), 4500, []) : [];
    return { suggestion, panel: { type: 'wiki', title: d.title, description: d.description || '', extract: d.extract, image: d.thumbnail?.source || '', url: d.content_urls?.desktop?.page || '', facts, source: 'Wikipedia' } };
  } catch { return null; }
}

async function instantAnswers(q, plain, hasOps) {
  const out = []; let suggestion = '';
  const quick = calc(q); if (quick) return { answers: [quick], suggestion };
  const [cv, df, tm, wx, wk] = await Promise.all([convert(q), define(q), timeIn(q), weather(q), (hasOps ? Promise.resolve(null) : wiki(plain))].map((p) => withTimeout(p, 4800, null)));
  for (const a of [cv, df, tm, wx]) if (a) out.push(a);
  if (wk) { suggestion = wk.suggestion || ''; if (wk.panel && !tm && !wx && !cv) out.push(wk.panel); }
  return { answers: out, suggestion };
}
module.exports = { weatherQuery, instantAnswers, calc, convert, evalExpr };
