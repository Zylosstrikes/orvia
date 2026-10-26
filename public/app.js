const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const su=u=>/^https?:\/\//i.test(String(u||''))?esc(u):'#';
const host=u=>{try{return new URL(u).hostname.replace(/^www\./,'')}catch{return''}};
const fav=u=>!host(u)?'<span class="fav"></span>':`<img class="fav" src="https://icons.duckduckgo.com/ip3/${host(u)}.ico" onerror="this.style.visibility='hidden'">`;
const S={get:(k,d=[])=>{try{const v=JSON.parse(localStorage['orvia_'+k]);if(v==null||(Array.isArray(d)&&!Array.isArray(v))||typeof v!==typeof d)return d;return Array.isArray(v)?v.filter(x=>x!=null):v}catch{return d}},set:(k,v)=>{try{localStorage['orvia_'+k]=JSON.stringify(v)}catch{}}};
const CC=(()=>{const l=(navigator.language||'').split('-')[1]||'';return S.get('cc','')||l.toUpperCase()||(Intl.DateTimeFormat().resolvedOptions().timeZone==='Africa/Lagos'?'NG':'')})();const ccq='&cc='+CC;
const NAME='Orvia',app=$('#app');
const fmt=t=>new Date(t).toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).replace(',','');
const ago=d=>{const m=(Date.now()-new Date(d))/6e4;return m<60?Math.max(1,m|0)+'m':m<1440?(m/60|0)+'h':(m/1440|0)+'d'};
const errBox=m=>`<div class="panel" style="text-align:center"><p style="margin:0 0 12px">${esc(m)}</p><button class="btn p press" onclick="route()">Retry</button></div>`;
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(t._);t._=setTimeout(()=>t.classList.remove('show'),1800)};
const buzz=()=>navigator.vibrate&&navigator.vibrate(8);
document.addEventListener('pointerdown',e=>{if(e.target.closest('.press,button'))buzz()});
// ---------- data ----------
function addHist(q,ai=false){q=q.trim();if(!q)return;S.set('hist',[{q,ai,t:Date.now()},...S.get('hist').filter(h=>!(h.q===q&&h.ai===ai))].slice(0,100))}
function addVisit(url,title){S.set('visits',[{url,title,t:Date.now()},...S.get('visits').filter(v=>v.url!==url)].slice(0,100))}
document.addEventListener('click',e=>{const a=e.target.closest('a[data-visit]');if(a)addVisit(a.href,a.dataset.visit)},true);
// ---------- router ----------
let feedTimer;
function nav(path,push=true){if(push)history.pushState({},'',path);route()}
document.addEventListener('click',e=>{const a=e.target.closest('a[href^="/"]');if(!a||a.target||e.ctrlKey||e.metaKey)return;e.preventDefault();closeAll();nav(a.getAttribute('href'))});
onpopstate=()=>{if($('.open')){closeAll(false);}route()};
function route(){clearTimeout(feedTimer);const p=location.pathname,q=new URLSearchParams(location.search);window.scrollTo(0,0);
 const tab=p==='/ai'?'ai':p==='/'?'home':p.startsWith('/search')||p==='/results'?'search':p.slice(1);$$('.bnav a').forEach(a=>a.classList.toggle('on',a.dataset.nav===tab||false));
 ({'/':Home,'/search':SearchScreen,'/results':Results,'/ai':AI,'/activity':Activity,'/notifications':Notifs}[p]||Home)(q);
 $('#ndot').classList.toggle('show',!S.get('notifSeen',false));}
// ---------- shared ----------
function voice(inp,btn,cb){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return toast('Voice search not supported in this browser');
 const r=new SR();r.lang=navigator.language||'en-US';r.interimResults=true;btn.classList.add('on');
 r.onresult=e=>{inp.value=[...e.results].map(x=>x[0].transcript).join('');if(e.results[e.results.length-1].isFinal)cb(inp.value)};r.onend=()=>btn.classList.remove('on');r.start()}
function lens(){const i=document.createElement('input');i.type='file';i.accept='image/*';i.capture='environment';i.onchange=()=>{const n=(i.files[0]?.name||'').replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ');toast('Searching images by the file’s name (no image recognition)');if(n)nav('/results?q='+encodeURIComponent(n)+'&tab=images')};i.click()}
function closeAll(back=true){$$('.open').forEach(x=>x.classList.remove('open'))}
function sheet(items){const p=$('#sheet .spanel');p.innerHTML='<div style="width:40px;height:4px;background:var(--s3);border-radius:4px;margin:4px auto 10px"></div>'+items.map((it,i)=>`<button data-i="${i}">${it[0]}</button>`).join('');
 $('#sheet').classList.add('open');$$('button',p).forEach(b=>b.onclick=()=>{closeAll();items[b.dataset.i][1]()})}
$$('[data-close]').forEach(s=>s.onclick=()=>closeAll());
// ---------- drawer ----------
function openDrawer(){const th=S.get('threads');const d=$('#drawer .dpanel');
 d.innerHTML=`<div style="display:flex;gap:8px;align-items:center"><div class="sbar" style="flex:1;margin:0"><span class="iconbtn" style="width:36px;height:36px">⌕</span><input id="tq" placeholder="Find a Pulse"></div><button class="iconbtn press" id="gear" title="Settings">⚙</button></div>
 <button class="newt press" id="newt">✎ &nbsp;Start a Pulse</button><div class="sec" style="margin:14px 6px 6px"><h2 style="font-size:14px;color:var(--m)">Your Pulses</h2></div><div id="tl"></div>`;
 const draw=f=>$('#tl').innerHTML=th.filter(t=>t.title.toLowerCase().includes(f)).map(t=>`<a class="row press" href="/ai?t=${t.id}"><span class="ri">✦</span><div class="rt"><div>${esc(t.title)}</div><small>${fmt(t.t)}</small></div></a>`).join('')||'<p style="color:var(--m);padding:10px">No Pulses yet. Ask something to start one.</p>';
 draw('');$('#tq').oninput=e=>draw(e.target.value.toLowerCase());$('#newt').onclick=()=>{closeAll();nav('/ai')};
 $('#gear').onclick=()=>sheet([['🗑 &nbsp;Clear all history',()=>{['hist','visits'].forEach(k=>S.set(k,[]));toast('History cleared');route()}],['✦ &nbsp;Clear AI threads',()=>{S.set('threads',[]);toast('Threads cleared')}],['↺ &nbsp;Reset hidden topics',()=>{S.set('blocked',[]);toast('Topics restored')}]]);
 $('#drawer').classList.add('open')}
// ---------- HOME ----------
const wi=c=>c===0?'☀️':c<3?'🌤️':c<4?'☁️':c<50?'🌫️':c<70?'🌧️':c<80?'❄️':c<90?'🌦️':'⛈️';
function Home(){app.innerHTML=`<div class="screen"><div class="topbar"><div class="avatar press">Z</div><span class="greet" id="greet"></span><button class="iconbtn press" id="menu" aria-label="Menu">⋯</button></div>
 <div class="wm"><img src="/icon.svg" alt=""><b>orvia</b></div>
 <div class="pillsearch press" id="fake"><span style="color:var(--m);font-size:20px">⌕</span><span class="ph">What are you curious about?</span><button class="iconbtn mic" id="hmic">🎙︎</button><button class="iconbtn lens" id="hlens" title="Search by image file name" aria-label="Search by image file name">◎</button></div>
 <div class="actions"><a href="/ai" class="aimode press">✦ Pulse</a><button class="circ press" id="himg" title="Images">🖼︎</button><button class="circ press" id="htr" title="Trending">↗</button></div>
 <div class="cards" id="cards">${'<div class="icard sk" style="height:66px;min-width:150px"></div>'.repeat(3)}</div>
 <div class="sec"><h2>Your orbit</h2><span class="m" id="fstat"></span><button class="iconbtn press" id="refresh" title="Refresh">⟳</button></div>
 <div class="feed" id="feed">${'<div class="sk" style="height:320px"></div>'.repeat(2)}</div><div class="more" id="more">Loading more…</div></div>`;
 $('#menu').onclick=openDrawer;$('#fake').onclick=e=>{if(!e.target.closest('button'))nav('/search')};
 $('#hmic').onclick=()=>{nav('/search');setTimeout(()=>$('#smic')?.click(),50)};$('#hlens').onclick=lens;
 $('#himg').onclick=()=>nav('/results?q='+encodeURIComponent((S.get('hist')[0]||{q:'space'}).q)+'&tab=images');$('#htr').onclick=()=>nav('/results?q=trending news today&tab=news');
 infoCards();feed.reset();const hr=new Date().getHours();$('#greet').textContent=hr<12?'Good morning':hr<17?'Good afternoon':'Good evening';$('#refresh').onclick=()=>{$('#refresh').style.transform=`rotate(${(feed.rot=(feed.rot||0)+360)}deg)`;$('#refresh').style.transition='.5s';feed.reset()};
 new IntersectionObserver(es=>{if(es[0].isIntersecting&&$('#feed .fc'))feed.load(false)},{rootMargin:'500px'}).observe($('#more'));}
async function infoCards(){const go=async(lat,lon,name)=>{try{const w=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m,uv_index&daily=sunset,sunrise,precipitation_probability_max,temperature_2m_max,temperature_2m_min&hourly=precipitation_probability&timezone=auto&forecast_days=1`).then(r=>r.json());
  const c=w.current,d=w.daily,h=new Date(w.current.time).getHours();const now=w.current.time.slice(11,16),ss=d.sunset[0].slice(11,16),sr=d.sunrise[0].slice(11,16),after=now>ss;
  if(!$('#cards'))return;$('#cards').innerHTML=`<div class="icard press"><small>📍 ${esc(name)}</small><div class="v">${wi(c.weather_code)} ${Math.round(c.temperature_2m)}° <small style="display:inline">💧${w.hourly.precipitation_probability[h]??d.precipitation_probability_max[0]}%</small></div></div>
  <div class="icard press"><small>${after?'Sunrise':'Sunset'}</small><div class="v">${after?'🌅 '+sr:'🌇 '+ss}</div></div>
  <div class="icard press"><small>Today</small><div class="v">↑${Math.round(d.temperature_2m_max[0])}° ↓${Math.round(d.temperature_2m_min[0])}°</div></div>
  <div class="icard press"><small>Humidity · Wind</small><div class="v">${c.relative_humidity_2m}% · ${Math.round(c.wind_speed_10m)}<small style="display:inline">km/h</small></div></div>
  <div class="icard press"><small>UV index</small><div class="v">☀ ${Math.round(c.uv_index??0)}</div></div>`;}catch{}};
 const fb=()=>go(6.4541,3.3947,'Lagos');if(!navigator.geolocation)return fb();
 navigator.geolocation.getCurrentPosition(async p=>{let n='Near you';try{const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&lat=${p.coords.latitude}&lon=${p.coords.longitude}`).then(r=>r.json());n=r.address.city||r.address.town||r.address.state||n}catch{}go(p.coords.latitude,p.coords.longitude,n)},fb,{timeout:4000})}
const TREND=['world news','technology','science','football','business','music','AI','space','health','Nigeria'];
function pickTopics(n){const bl=S.get('blocked'),h=S.get('hist').filter(x=>!bl.includes(x.q.toLowerCase())),w={};
 h.slice(0,40).forEach((x,i)=>{const k=x.q.toLowerCase();w[k]=(w[k]||0)+Math.max(1,40-i)/4+2});const out=[],pool={...w};
 while(out.length<Math.min(n-1,Object.keys(pool).length)){let r=Math.random()*Object.values(pool).reduce((a,b)=>a+b,0);for(const k in pool){r-=pool[k];if(r<=0){out.push(k);delete pool[k];break}}}
 const tr=TREND.filter(t=>!bl.includes(t.toLowerCase())).sort(()=>Math.random()-.5);while(out.length<n&&tr.length)out.push(tr.pop());return out.map(t=>({t,mine:!!w[t]}))}
const feed={shown:new Set(),busy:false,
 reset(){this.shown=new Set();this.load(true);clearTimeout(feedTimer);feedTimer=setTimeout(()=>location.pathname==='/'&&this.reset(),45e3+Math.random()*75e3)},
 async load(reset){if(this.busy||!$('#feed'))return;this.busy=true;const tp=pickTopics(reset?4:3);
  try{const d=await fetch('/api/feed?'+ccq.slice(1)+'&first='+(reset?0:1+(Math.random()*3|0)*10)+'&topics='+encodeURIComponent(tp.map(x=>x.t).join('|'))).then(r=>r.json());
   const mine=Object.fromEntries(tp.map(x=>[x.t,x.mine])),likes=S.get('likes');const items=d.results.filter(a=>!this.shown.has(a.title)).sort(()=>Math.random()-.3);S.set('lastFeed',items.slice(0,30));
   const html=items.map((a,i)=>{this.shown.add(a.title);return`<article class="fc" style="animation-delay:${i*70}ms" data-topic="${esc(a.topic)}" data-url="${esc(a.url)}" data-title="${esc(a.title)}">
    <a href="${su(a.url)}" target="_blank" rel="noopener" data-visit="${esc(a.title)}"><div class="im"><img loading="lazy" src="${su(a.image)}" alt="" onerror="this.closest('.fc').remove()"><span class="why">${mine[a.topic]?'Because you searched “'+esc(a.topic)+'”':'Trending · '+esc(a.topic)}</span></div><h3>${esc(a.title)}</h3></a>
    <div class="ft">${fav(a.url)}<span>${esc((a.source||host(a.url)).replace(/ on MSN$/,''))} · ${ago(a.date)}</span><span class="sp"></span><button class="iconbtn press like ${likes.includes(a.url)?'liked':''}" aria-label="Like">♥</button><button class="iconbtn press share" aria-label="Share">⤴</button><button class="iconbtn press dots" aria-label="More">⋮</button></div></article>`}).join('');
   const f=$('#feed');if(!f)return;if(reset){$$('.fc,.sk',f).forEach(c=>c.classList.add('out'));await new Promise(r=>setTimeout(r,$('.fc',f)?350:0));f.innerHTML=html}else f.insertAdjacentHTML('beforeend',html);
   $('#fstat').textContent='Updated '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  }catch{$('#fstat')&&($('#fstat').textContent='Feed offline');reset&&$('#feed')&&($('#feed').innerHTML=errBox('Couldn’t load your feed.'))}this.busy=false}};
document.addEventListener('click',async e=>{const c=e.target.closest('.fc');if(!c||!e.target.closest('button'))return;const b=e.target.closest('button'),url=c.dataset.url,t=c.dataset.topic;
 if(b.classList.contains('like')){let l=S.get('likes');l=l.includes(url)?l.filter(x=>x!==url):[url,...l];S.set('likes',l);b.classList.toggle('liked');if(b.classList.contains('liked'))addHist(t)}
 if(b.classList.contains('share')){if(navigator.share)navigator.share({title:c.dataset.title,url}).catch(()=>{});else{navigator.clipboard?.writeText(url);toast('Link copied')}}
 if(b.classList.contains('dots'))sheet([[`🚫 &nbsp;Not interested in “${esc(t)}”`,()=>{S.set('blocked',[...new Set([...S.get('blocked'),t.toLowerCase()])]);$$('.fc').filter(x=>x.dataset.topic===t).forEach(x=>{x.classList.add('out');setTimeout(()=>x.remove(),350)});toast('You’ll see less of this')}],
  [`➕ &nbsp;Follow “${esc(t)}”`,()=>{S.set('follow',[...new Set([t,...S.get('follow')])]);toast('Following '+t)}],['🔗 &nbsp;Copy link',()=>{navigator.clipboard?.writeText(url);toast('Link copied')}]])});
let y0=null;addEventListener('touchstart',e=>{y0=location.pathname==='/'&&scrollY===0?e.touches[0].clientY:null},{passive:true});
addEventListener('touchend',e=>{if(y0!=null&&e.changedTouches[0].clientY-y0>140){toast('Refreshing feed…');feed.reset()}y0=null});
// ---------- SEARCH ----------
function SearchScreen(){const h=S.get('hist');app.innerHTML=`<div class="screen"><div class="sbar"><button class="iconbtn press" id="plus" title="Ask in Pulse">＋</button><input id="sq" placeholder="Ask Orvia anything…" autocomplete="off" enterkeyhint="search"><button class="iconbtn mic press" id="smic">🎙︎</button><button class="iconbtn lens press" id="slens" title="Search by image file name" aria-label="Search by image file name">◎</button></div>
 <div class="list" id="sl"></div></div>`;const inp=$('#sq');inp.focus();
 const recent=()=>{const seen=new Set();$('#sl').innerHTML=h.filter(x=>{const k=x.q+x.ai;if(seen.has(k))return false;seen.add(k);return true}).slice(0,15).map((x,i)=>`<div class="row press" data-q="${esc(x.q)}" data-ai="${x.ai?1:''}"><span class="ri">◷</span><div class="rt"><div>${esc(x.q)}${x.ai?'<span class="tag">Pulse</span>':''}</div></div><button class="iconbtn fill" style="color:var(--m)" title="Edit">↖</button></div>`).join('')||'<p style="color:var(--m);padding:12px">No recent searches</p>'};
 const submit=q=>{q=q.trim();if(q)nav('/results?q='+encodeURIComponent(q))};recent();let tm;
 inp.oninput=()=>{clearTimeout(tm);const v=inp.value.trim();if(!v)return recent();tm=setTimeout(async()=>{const s=await fetch('/api/suggest?q='+encodeURIComponent(v)).then(r=>r.json()).catch(()=>[]);if(inp.value.trim()!==v)return;
  $('#sl').innerHTML=s.slice(0,8).map(x=>`<div class="row press" data-q="${esc(x)}"><span class="ri">⌕</span><div class="rt"><div>${esc(x).replace(esc(v.toLowerCase()),'<span style="color:var(--m)">$&</span>')}</div></div><button class="iconbtn fill" style="color:var(--m)">↖</button></div>`).join('')+`<div class="row press" data-q="${esc(v)}" data-ai="1"><span class="ri" style="color:var(--a)">✦</span><div class="rt"><div>Ask Pulse: “${esc(v)}”</div></div></div>`},120)};
 inp.onkeydown=e=>{if(e.key==='Enter')submit(inp.value)};
 $('#sl').onclick=e=>{const r=e.target.closest('.row');if(!r)return;if(e.target.closest('.fill')){inp.value=r.dataset.q;inp.focus();inp.oninput();return}r.dataset.ai?nav('/ai?q='+encodeURIComponent(r.dataset.q)):submit(r.dataset.q)};
 $('#plus').onclick=()=>nav('/ai'+(inp.value.trim()?'?q='+encodeURIComponent(inp.value.trim()):''));$('#smic').onclick=()=>voice(inp,$('#smic'),submit);$('#slens').onclick=lens}
async function Results(p){const q=p.get('q')||'',tab=p.get('tab')||'web',page=+p.get('page')||1;addHist(q);document.title=q+' · '+NAME;
 const u=(t,pg=1)=>`/results?q=${encodeURIComponent(q)}&tab=${t}&page=${pg}`;
 app.innerHTML=`<div class="screen"><div class="sbar"><a class="iconbtn press" href="/">‹</a><input id="rq" value="${esc(q)}" enterkeyhint="search"><button class="iconbtn mic press" id="rmic">🎙︎</button><a class="iconbtn press" style="color:var(--a)" href="/ai?q=${encodeURIComponent(q)}" title="Pulse">✦</a></div>
 <div class="tabs">${['web','images','news'].map(t=>`<a href="${u(t)}"><button class="${t===tab?'on':''}">${t[0].toUpperCase()+t.slice(1)}</button></a>`).join('')}<a href="/ai?q=${encodeURIComponent(q)}"><button>✦ Pulse</button></a></div><div id="rs">${'<div class="sk" style="height:90px;margin:12px 0;border-radius:18px"></div>'.repeat(5)}</div><div class="pager" id="pg"></div></div>`;
 $('#rq').onkeydown=e=>{if(e.key==='Enter'&&e.target.value.trim())nav('/results?q='+encodeURIComponent(e.target.value.trim()))};$('#rmic').onclick=()=>voice($('#rq'),$('#rmic'),v=>nav('/results?q='+encodeURIComponent(v)));
 try{const d=await fetch(`/api/${tab==='web'?'search':tab}?q=${encodeURIComponent(q)}&page=${page}${ccq}`).then(r=>{if(!r.ok)throw 0;return r.json()});if(!$('#rs'))return;let h='';
  if(tab==='images')h=`<div class="imgs">${d.results.map(r=>`<a href="${su(r.url||r.img)}" target="_blank" data-visit="${esc(r.title||q)}"><img loading="lazy" src="${su(r.thumb)}"></a>`).join('')}</div>`;
  else{if(d.weather){const w=d.weather,c=w.current;h+=`<div class="panel"><h4>Weather · ${esc(w.place)}</h4><div style="font-size:40px">${wi(c.weather_code)} ${Math.round(c.temperature_2m)}°C</div><small style="color:var(--m)">Humidity ${c.relative_humidity_2m}% · Wind ${c.wind_speed_10m} km/h · Open-Meteo</small></div>`}
   if(d.instant)h+=`<div class="panel"><h4>${esc(d.instant.source)}</h4><b>${esc(d.instant.heading)}</b><p style="margin:6px 0;color:#c8cbd2">${esc(d.instant.text)}</p><a href="${su(d.instant.url)}" target="_blank" style="color:var(--a);font-size:13px">Read more ↗</a></div>`;
   if(d.summary?.length&&tab==='web')h+=`<a href="/ai?q=${encodeURIComponent(q)}" class="panel press" style="display:block"><h4>✦ Pulse overview</h4><p style="margin:0;color:#c8cbd2">${esc(d.summary[0].text)}</p><small style="color:var(--a)">Dive deeper in Pulse ›</small></a>`;
   h+=d.results.map(r=>`<div class="res"><a href="${su(r.url)}" target="_blank" rel="noopener" data-visit="${esc(r.title)}"><div class="u">${fav(r.url)}${esc(host(r.url))}${r.source?' · '+esc(r.source):''}${r.date?' · '+ago(r.date):''}</div><h3>${esc(r.title)}</h3></a><p>${esc(r.snippet)}</p></div>`).join('')||'<p>No results.</p>'}
  $('#rs').innerHTML=h;if(tab!=='news'&&d.results.length){const s=Math.max(1,page-2);$('#pg').innerHTML=[...Array(5)].map((_,i)=>`<a href="${u(tab,s+i)}"><button class="${s+i===page?'on':''}">${s+i}</button></a>`).join('')}
 }catch(e){if($('#rs'))$('#rs').innerHTML=errBox('Couldn’t load results. The search source may be busy.')}}
// ---------- AI MODE ----------
async function answer(q){const d=await fetch('/api/search?q='+encodeURIComponent(q)+ccq).then(r=>{if(!r.ok)throw 0;return r.json()});const src=d.results.slice(0,8);
 return{q,instant:d.instant,weather:d.weather,sum:(d.summary||[]),src:src.map(r=>({title:r.title,url:r.url,snippet:r.snippet}))}}
function renderAns(a){const parts=[];if(a.weather){const c=a.weather.current;parts.push(`<p><b>Right now in ${esc(a.weather.place)}:</b> ${wi(c.weather_code)} ${Math.round(c.temperature_2m)}°C, humidity ${c.relative_humidity_2m}%, wind ${c.wind_speed_10m} km/h <span class="cite">Open-Meteo</span></p>`)}
 if(a.instant)parts.push(`<p><b>${esc(a.instant.heading)}</b> — ${esc(a.instant.text.split(/(?<=\.)\s/).slice(0,3).join(' '))} <span class="cite">${esc(a.instant.source)}</span></p>`);
 if(a.sum.length)parts.push('<p>'+a.sum.map(s=>`${esc(s.text)}<a class="cite" href="${su(a.src[s.ref-1]?.url)}" target="_blank">${s.ref}</a>`).join(' ')+'</p>');
 if(!parts.length)parts.push('<p>I couldn’t find enough in the results to summarise. Try rephrasing.</p>');
 return`<div class="msg-q">${esc(a.q)}</div><div class="ans"><div class="lbl">✦ Pulse · summary of web results</div>${parts.join('')}
 <div class="srcs">${a.src.map((s,i)=>`<a class="src press" href="${su(s.url)}" target="_blank" data-visit="${esc(s.title)}"><span style="display:flex;gap:6px;align-items:center;color:var(--m)">${fav(s.url)}${i+1} · ${esc(host(s.url))}</span><b>${esc(s.title)}</b></a>`).join('')}</div>
 <div class="disc">Extractive summary: sentences are quoted from the linked search results. No generative AI is used, so check sources.</div></div>`}
async function AI(p){let id=p.get('t'),th=S.get('threads').find(t=>t.id===id);const q0=p.get('q');
 app.innerHTML=`<div class="screen"><div class="topbar"><button class="iconbtn press" id="menu">⋯</button><b style="font-weight:500">✦ Pulse</b><a class="iconbtn press" href="/ai" title="Start a Pulse">✎</a></div><div id="chat">${th?th.msgs.map(renderAns).join(''):`<div style="text-align:center;margin-top:18vh;color:var(--m)"><div class="wm" style="margin:0 0 10px"><img src="/icon.svg"></div>Ask anything. ${NAME} reads the web and gives you a summary with sources.</div>`}</div><div style="height:90px"></div>
 <div class="composer"><div class="sbar"><span class="iconbtn" style="color:var(--a)">✦</span><input id="aq" placeholder="Keep the Pulse going…" enterkeyhint="send"><button class="iconbtn mic press" id="amic">🎙︎</button><button class="iconbtn press" id="send" style="background:var(--a);color:#111">↑</button></div></div></div>`;
 $('#menu').onclick=openDrawer;
 let asking=false;const ask=async q=>{q=q.trim();if(!q||asking)return;asking=true;$('#send').disabled=true;$('#aq').value='';if(!th){if(!$('.ans'))$('#chat').innerHTML='';th={id:Date.now().toString(36),title:q,t:Date.now(),msgs:[]};history.replaceState({},'','/ai?t='+th.id)}
  addHist(q,true);$('#chat').insertAdjacentHTML('beforeend',`<div class="msg-q">${esc(q)}</div><div class="ans" id="pend"><div class="lbl">✦ Scanning the web <span class="typing"><span></span><span></span><span></span></span></div><div class="sk" style="height:14px;margin:8px 0;border-radius:7px"></div><div class="sk" style="height:14px;width:80%;border-radius:7px"></div></div>`);scrollTo({top:1e6,behavior:'smooth'});
  try{const a=await answer(q);th.msgs.push(a);th.t=Date.now();S.set('threads',[th,...S.get('threads').filter(t=>t.id!==th.id)].slice(0,50));$('#pend')?.previousElementSibling.remove();$('#pend')&&($('#pend').outerHTML=renderAns(a))}catch{$('#pend')&&($('#pend').outerHTML=errBox('Couldn’t reach the web.'))}finally{asking=false;$('#send')&&($('#send').disabled=false)}};
 $('#aq').onkeydown=e=>{if(e.key==='Enter')ask(e.target.value)};$('#send').onclick=()=>ask($('#aq').value);$('#amic').onclick=()=>voice($('#aq'),$('#amic'),ask);
 if(q0&&!th)ask(q0);}
// ---------- ACTIVITY ----------
function Activity(p){const all=p.get('all');const th=S.get('threads'),h=S.get('hist').filter(x=>!x.ai),v=S.get('visits');
 const items=[...h.map(x=>({k:'q',t:x.t,q:x.q})),...v.map(x=>({k:'v',t:x.t,url:x.url,title:x.title}))].sort((a,b)=>b.t-a.t);
 const lim=all?999:5;
 app.innerHTML=`<div class="screen"><div class="topbar"><div class="avatar">Z</div><b style="font-weight:500">Trail</b><button class="iconbtn press" id="menu">⋯</button></div>
 ${all!=='hist'?`<a class="sec press" href="/activity?all=ai"><h2>Pulse history</h2><span>›</span></a><div class="list">${th.slice(0,all==='ai'?999:4).map(t=>`<div class="row" data-k="t" data-id="${t.id}"><span class="ri" style="color:var(--a)">✦</span><a class="rt" href="/ai?t=${t.id}"><div>${esc(t.title)}</div><small>${fmt(t.t)} · ${t.msgs.length} answer${t.msgs.length===1?'':'s'}</small></a><button class="iconbtn dots" style="color:var(--m)">⋮</button></div>`).join('')||'<p style="color:var(--m)">No Pulses yet</p>'}</div>`:''}
 ${all!=='ai'?`<a class="sec press" href="/activity?all=hist"><h2>Searches &amp; visits</h2><span>›</span></a><div class="list">${items.slice(0,all==='hist'?999:8).map(x=>x.k==='q'?`<div class="row" data-k="q" data-t="${x.t}"><span class="ri">⌕</span><a class="rt" href="/results?q=${encodeURIComponent(x.q)}"><div>Searched for ${esc(x.q)}</div><small>${fmt(x.t)}</small></a><button class="iconbtn dots" style="color:var(--m)">⋮</button></div>`
  :`<div class="row" data-k="v" data-t="${x.t}"><span class="ri">${fav(x.url)}</span><a class="rt" href="${su(x.url)}" target="_blank"><div>${esc(x.title||x.url)}</div><small>${esc(host(x.url))} · ${fmt(x.t)}</small></a><button class="iconbtn dots" style="color:var(--m)">⋮</button></div>`).join('')||'<p style="color:var(--m)">No history yet</p>'}</div>`:''}</div>`;
 $('#menu').onclick=openDrawer;
 $('.screen').onclick=e=>{const b=e.target.closest('.dots');if(!b)return;const r=b.closest('.row');sheet([['🗑 &nbsp;Delete',()=>{const k=r.dataset.k;
  if(k==='t')S.set('threads',S.get('threads').filter(t=>t.id!==r.dataset.id));if(k==='q')S.set('hist',S.get('hist').filter(x=>String(x.t)!==r.dataset.t));if(k==='v')S.set('visits',S.get('visits').filter(x=>String(x.t)!==r.dataset.t));
  r.style.transition='.3s';r.style.opacity=0;r.style.transform='translateX(40px)';setTimeout(()=>r.remove(),300);toast('Deleted')}]])}}
// ---------- NOTIFICATIONS ----------
async function Notifs(){S.set('notifSeen',true);const perm=window.Notification?Notification.permission:'unsupported',dis=S.get('notifNo',false);
 const topics=[...new Set([...S.get('follow'),...S.get('hist').map(x=>x.q.toLowerCase())])].filter(t=>!S.get('blocked').includes(t)).slice(0,6);
 app.innerHTML=`<div class="screen"><div class="topbar"><div class="avatar">Z</div><b style="font-weight:500">Signals</b><button class="iconbtn press" id="menu">⋯</button></div>
 ${perm==='default'&&!dis?`<div class="ncard" id="nc"><div style="font-size:30px">🔔</div><div class="h1" style="margin:6px 0">Stay in the loop with Signals</div><p style="color:var(--m);margin:0 0 14px">Orvia can ping you when there’s fresh news on ${esc(topics.slice(0,2).join(' and ')||'breaking news')}.</p><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn o press" id="nno">Maybe later</button><button class="btn p press" id="nyes">Enable Signals</button></div></div>`:''}
 <div class="sec"><h2>Fresh Signals</h2><span class="m">${perm==='granted'?'🔔 On':''}</span></div><div class="list" id="nl">${'<div class="sk" style="height:76px;margin:10px 0;border-radius:18px"></div>'.repeat(4)}</div></div>`;
 $('#menu').onclick=openDrawer;$('#nno')&&($('#nno').onclick=()=>{S.set('notifNo',true);$('#nc').remove()});
 $('#nyes')&&($('#nyes').onclick=async()=>{const r=await Notification.requestPermission();if(r==='granted'){navigator.serviceWorker?.ready.then(s=>s.showNotification(NAME,{body:'Signals are on. We’ll keep you posted.',icon:'/icon-192.png'})).catch(()=>new Notification(NAME,{body:'Signals are on.'}))}$('#nc')?.remove();toast(r==='granted'?'Signals on':'Permission '+r)});
 const tp=(topics.length?topics:['world news','technology','football']).slice(0,5);
 try{const d=await fetch('/api/feed?topics='+encodeURIComponent(tp.join('|'))+ccq).then(r=>{if(!r.ok)throw 0;return r.json()});const by={};d.results.forEach(a=>{by[a.topic]=by[a.topic]||a});
  if(!$('#nl'))return;$('#nl').innerHTML=Object.values(by).map(a=>`<a class="row press" href="${su(a.url)}" target="_blank" data-visit="${esc(a.title)}"><img class="thumb" src="${su(a.image)}" alt=""><div class="rt"><small style="color:var(--a)">${esc(a.topic)} · ${ago(a.date)}</small><div style="white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(a.title)}</div><small>${esc((a.source||'').replace(/ on MSN$/,''))}</small></div></a>`).join('')||'<p style="color:var(--m)">No Signals yet</p>';
 }catch{$('#nl')&&($('#nl').innerHTML=errBox('Couldn’t load Signals.'))}}
// ---------- boot ----------
(()=>{const q=new URLSearchParams(location.search);if(q.get('seed')){const n=Date.now(),H=36e5;
 S.set('hist',[['SpaceX Starship',0],['Afrobeats new releases',1],['Lagos traffic',3],['what is quantum computing',4,1],['weather Lagos',6],['Nigeria football',26],['bitcoin price',30],['best phones 2026',50,1]].map(([q,h,ai])=>({q,ai:!!ai,t:n-h*H})));
 S.set('visits',[{url:'https://www.space.com/spacex-starship',title:'SpaceX Starship launch updates – Space.com',t:n-.5*H},{url:'https://en.wikipedia.org/wiki/Lagos',title:'Lagos – Wikipedia',t:n-3.2*H},{url:'https://www.billboard.com/c/music/afrobeats/',title:'Afrobeats – Billboard',t:n-27*H}]);
 S.set('notifSeen',false);
 q.delete('seed');const go=q.get('go')||'/';q.delete('go');const dr=q.get('drawer');q.delete('drawer');history.replaceState({},'',go+(q.toString()?'?'+q:''));route();if(dr)openDrawer();return}route()})();
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
addEventListener('keydown',e=>{if(/INPUT/.test(document.activeElement.tagName))return;if(e.key==='/'){e.preventDefault();nav('/search')}if(e.key==='a'&&!e.ctrlKey)nav('/ai');if(e.key==='Escape')closeAll()});
