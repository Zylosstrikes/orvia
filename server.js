const http=require('http'),fs=require('fs'),path=require('path');
const PORT=process.env.PORT||3000,HOST='0.0.0.0';
const UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const cache=new Map();const TTL=5*60e3;
async function get(u,{ttl=TTL,ok=()=>true}={}){const c=cache.get(u);if(c&&Date.now()-c.t<ttl)return c.v;
  const v=await fetch(u,{headers:{'User-Agent':UA,'Accept-Language':'en-US,en;q=0.9'},signal:AbortSignal.timeout(8000)}).then(r=>{if(!r.ok)throw new Error('upstream '+r.status);return r.text()});
  if(ok(v)){cache.set(u,{v,t:Date.now()});if(cache.size>500)cache.delete(cache.keys().next().value)}return v}
const mktFor=cc=>({NG:'en-NG',GH:'en-GH',KE:'en-KE',ZA:'en-ZA',GB:'en-GB',IN:'en-IN',CA:'en-CA',AU:'en-AU'})[cc]||'en-US';
const ent=s=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&#0?39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;|&ensp;|&#183;/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(n));
const strip=s=>ent(s.replace(/<[^>]+>/g,'')).replace(/\s+/g,' ').trim();
function unwrap(h){h=ent(h);const m=h.match(/[?&]u=a1([^&]+)/);if(m){try{return Buffer.from(m[1].replace(/-/g,'+').replace(/_/g,'/'),'base64').toString()}catch{}}return h}
async function web(q,page,cc){let r=await web1(q,page,cc);
  const miss=q.split(/\s+/).filter(w=>w.length>3&&!w.startsWith('"')&&!r.some(x=>(x.title+' '+x.snippet+' '+x.url).toLowerCase().includes(w.toLowerCase())));
  if(miss.length&&r.length){const q2=q.split(/\s+/).map(w=>miss.includes(w)?'"'+w+'"':w).join(' ');const r2=await web1(q2,page,cc).catch(()=>[]);if(r2.length)r=r2}
  return r}
async function web1(q,page,cc){
  const html=await get(`https://www.bing.com/search?q=${encodeURIComponent(q)}&first=${(page-1)*10+1}&setlang=en&cc=${cc||'US'}&mkt=${mktFor(cc)}`,{ok:h=>h.includes('b_algo')});
  const out=[];for(const blk of html.split('<li class="b_algo"').slice(1)){
    const h=blk.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);if(!h)continue;
    const p=blk.match(/<p[^>]*>([\s\S]*?)<\/p>/)||blk.match(/class="b_lineclamp\d"[^>]*>([\s\S]*?)<\/div>/);
    const url=unwrap(h[1]);if(!/^https?:/.test(url))continue;
    out.push({title:strip(h[2]),url,snippet:p?strip(p[1]).replace(/^Web\s*/,'').replace(/\s*…?\s*Read more\s*…?$/i,'…'):''});}
  return out;}
const STOP=new Set(['the','and','for','news','new','latest','price','best','what','how','today','2026','releases','update','updates']);
function relevant(t,r){const kw=t.toLowerCase().split(/\W+/).filter(w=>w.length>2&&!STOP.has(w));const txt=a=>(a.title+' '+a.snippet).toLowerCase();
  const img=r.filter(a=>a.image);if(!kw.length)return img;const all=img.filter(a=>kw.every(k=>txt(a).includes(k)));return all.length>=2?all:img.filter(a=>kw.some(k=>txt(a).includes(k)))}
async function images(q,page){const h=await get(`https://www.bing.com/images/async?q=${encodeURIComponent(q)}&first=${(page-1)*35}&count=35`);
  return [...h.matchAll(/m="(\{[^"]+\})"/g)].map(m=>{try{const j=JSON.parse(ent(m[1]));return{thumb:j.turl,img:j.murl,url:j.purl,title:j.t||''}}catch{return null}}).filter(x=>x&&x.thumb);}
async function news(q,first=0,cc){let x='';const ok=v=>v.startsWith('<?xml')&&v.includes('<item>');
  const urls=[`https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss${first?'&first='+first:''}&mkt=${mktFor(cc)}`,`https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss${first?'&first='+first:''}`];
  for(let t=0;t<4&&!ok(x);t++){try{x=await get(urls[t%2]+(t>1?'&_r='+t:''),{ok})}catch{x=''}if(!ok(x))await new Promise(r=>setTimeout(r,250*(t+1)))}
  if(!ok(x))return [];
  return x.split('<item>').slice(1).map(i=>{const g=t=>{const m=i.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`));return m?strip(m[1]):''};
  let url=g('link');const u=url.match(/[?&]url=([^&]+)/);if(u)url=decodeURIComponent(u[1]);
  return{title:g('title'),url,snippet:g('description'),date:g('pubDate'),source:g('News:Source'),image:(g('News:Image')?g('News:Image').replace(/^http:/,'https:')+'&w=800&h=450&c=7':'')}});}
async function instant(q){try{const j=JSON.parse(await get(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`));
  if(j.AbstractText||j.Answer||j.Definition)return{heading:j.Heading,text:j.AbstractText||j.Answer||j.Definition,source:j.AbstractSource||j.DefinitionSource,url:j.AbstractURL||j.DefinitionURL,image:j.Image?('https://duckduckgo.com'+j.Image):''};}catch{}return null}
async function weather(q){const m=q.match(/^(?:weather|forecast)\s+(?:in\s+)?(.+)$|^(.+?)\s+(?:weather|forecast)$/i);if(!m)return null;
  try{const city=(m[1]||m[2]).trim();const g=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`).then(r=>r.json());const p=g.results&&g.results[0];if(!p)return null;
  const w=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=5`).then(r=>r.json());
  return{place:`${p.name}, ${p.country}`,current:w.current,daily:w.daily};}catch{return null}}
async function suggest(q){try{return JSON.parse(await get(`https://duckduckgo.com/ac/?q=${encodeURIComponent(q)}&type=list`))[1]||[]}catch{return[]}}
function summarize(q,res){const terms=q.toLowerCase().split(/\W+/).filter(w=>w.length>2);
  const sents=[];res.slice(0,8).forEach((r,i)=>r.snippet.replace(/^(?:[A-Z][a-z]{2,8}\.? \d{1,2},? \d{4}|\d{1,2} [A-Z][a-z]+ \d{4}|\d+ (?:days?|hours?) ago)\s*[·\-—]\s*/,'').replace(/\s*(?:…|\.\.\.)\s*$/,'').split(/(?<=[.!?])\s+/).forEach(s=>{s=s.trim().replace(/\s*(?:…|\.\.\.)$/,'').replace(/^[a-z]/,c=>c.toUpperCase());if(s.length<40||/[|»]/.test(s)||!/[.!?]$/.test(s)&&s.length<70)return;if(!/[.!?]$/.test(s))s+='…';const l=s.toLowerCase();
    sents.push({s,i,score:terms.reduce((a,t)=>a+(l.includes(t)?1:0),0)+(8-i)*0.1})}));
  const seen=new Set();return sents.sort((a,b)=>b.score-a.score).filter(x=>{const k=x.s.slice(0,30);if(seen.has(k))return false;seen.add(k);return true}).slice(0,5).map(x=>({text:x.s,ref:x.i+1}));}
const types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
http.createServer(async(req,res)=>{const u=new URL(req.url,'http://x');const q=(u.searchParams.get('q')||'').trim();const page=Math.min(50,Math.max(1,parseInt(u.searchParams.get('page'))||1));const cc=(u.searchParams.get('cc')||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,2);
  const json=(d,c=200)=>{res.writeHead(c,{'Content-Type':'application/json'});res.end(JSON.stringify(d))};
  try{
    if(u.pathname==='/api/search'){if(!q)return json({results:[]});if(q.length>300)return json({error:'Query too long'},400);const t=Date.now();
      const [results,ia,wx]=await Promise.all([web(q,page,cc),page===1?instant(q):null,page===1?weather(q):null]);
      return json({query:q,page,results,instant:ia,weather:wx,summary:summarize(q,results),ms:Date.now()-t});}
    if(u.pathname==='/api/images')return json({results:q?await images(q,page):[]});
    if(u.pathname==='/api/news')return json({results:q?await news(q,0,cc):[]});
    if(u.pathname==='/api/feed'){const topics=(u.searchParams.get('topics')||'').split('|').map(t=>t.trim()).filter(Boolean).slice(0,6);const first=+u.searchParams.get('first')||0;
      const lists=await Promise.all(topics.map(t=>news(t,first,cc).then(r=>relevant(t,r).map(a=>({...a,topic:t}))).catch(()=>[])));
      const out=[],seen=new Set();for(let i=0;i<12;i++)for(const l of lists){const a=l[i];if(a&&!seen.has(a.title)){seen.add(a.title);out.push(a)}}return json({results:out});}
    if(u.pathname==='/api/suggest')return json(q?await suggest(q):[]);
    let f=path.join(__dirname,'public',u.pathname==='/'||u.pathname==='/search'?'index.html':path.normalize(u.pathname).replace(/^(\.\.[\/\\])+/,''));
    if(!f.startsWith(path.join(__dirname,'public'))||!fs.existsSync(f))f=path.join(__dirname,'public','index.html');
    res.writeHead(200,{'Content-Type':types[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(res);
  }catch(e){console.error(e);json({error:'Search source unavailable, please retry.'},502)}
}).listen(PORT,HOST,()=>console.log('Orvia listening on http://'+HOST+':'+PORT));
