// Busca de jogos para o cadastro de apostas.
// 1) Histórico: times/jogos já lançados antes (funciona para qualquer esporte, sem custo).
// 2) Online (opcional): API-Football (api-sports.io) — só futebol, precisa de uma chave gratuita
//    cadastrada em Configurações. A chave fica salva só neste navegador.
const EVT_KEY_STORAGE = 'bw_apifootball_key';
let EVT_FIX = {};          // data (YYYY-MM-DD) -> lista de jogos
let EVT_STATUS = '';       // texto de status mostrado no cadastro
let EVT_SUGG = [];         // sugestões atualmente exibidas

function evtNorm(s){
  return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
}
function evtEsc(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function evtGetKey(){ try{ return localStorage.getItem(EVT_KEY_STORAGE) || ''; }catch(e){ return ''; } }

// "Flamengo x Palmeiras", "Flamengo vs Palmeiras", "Flamengo - Palmeiras" -> {home, away}
function evtParse(text){
  const t = String(text||'').trim();
  const m = t.split(/\s+(?:x|vs\.?|v|×|-|–)\s+/i);
  if(m.length>=2 && m[0].trim() && m.slice(1).join(' ').trim()) return {home:m[0].trim(), away:m.slice(1).join(' ').trim(), hasSep:true, partial:''};
  const m2 = t.match(/^(.*?)\s+(?:x|vs\.?|v|×|-|–)\s*$/i);
  if(m2) return {home:m2[1].trim(), away:'', hasSep:true, partial:''};
  return {home:t, away:'', hasSep:false, partial:t};
}

// Jogos e times já usados em apostas anteriores (mais recentes primeiro)
function evtHistory(){
  const events = new Map(), teams = new Map();
  const list = (STATE.tickets||[]).slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  list.forEach(t=>(t.matches||[]).forEach(m=>{
    if(!m.home) return;
    teams.set(evtNorm(m.home), m.home);
    if(m.away){
      teams.set(evtNorm(m.away), m.away);
      const k = evtNorm(m.home)+'|'+evtNorm(m.away);
      if(!events.has(k)) events.set(k, {home:m.home, away:m.away});
    }
  }));
  return {events:[...events.values()], teams:[...teams.values()]};
}

// ---- Esportes disponíveis na API-Sports (a mesma chave vale para todos) ----
const EVT_SPORTS_KEY = 'bw_evt_sports';
const _evtNm = (t)=> (t && t.name) ? String(t.name) : '';
const _evtGen = (it)=>({home:_evtNm(it.teams&&it.teams.home), away:_evtNm(it.teams&&it.teams.away), league:(it.league&&it.league.name)||'',
  ts: it.timestamp ? it.timestamp*1000 : Date.parse(it.date)});
const _num = (v)=> (v===null || v===undefined || v==='' || isNaN(Number(v))) ? null : Number(v);
const _pair = (h,a)=> (_num(h)===null || _num(a)===null) ? null : {h:_num(h), a:_num(a)};
const _sum2 = (o)=> (o && _num(o.quarter_1)!==null && _num(o.quarter_2)!==null) ? _num(o.quarter_1)+_num(o.quarter_2) : null;
const _v1Score = (finishedShort)=> (it)=>{
  const st = (it.status && it.status.short) || '';
  const sh = it.scores && it.scores.home, sa = it.scores && it.scores.away;
  const hh = _sum2(sh), ha = _sum2(sa);
  return {st, finished: finishedShort.includes(st), void: ['CANC','ABD','AWD','WO'].includes(st), postponed: ['PST','SUSP','INT'].includes(st),
    ft: _pair(sh && sh.total, sa && sa.total), ht: (hh===null||ha===null) ? null : {h:hh, a:ha}};
};
// extrai { id, home, away, league, ts } e o placar normalizado (score) de cada esporte
const EVT_SPORTS = [
  {id:'football', label:'Futebol', host:'v3.football.api-sports.io', path:'fixtures', tz:true,
    itemId:it=>it.fixture&&it.fixture.id,
    parse:it=>({home:_evtNm(it.teams&&it.teams.home), away:_evtNm(it.teams&&it.teams.away), league:(it.league&&it.league.name)||'', ts:Date.parse(it.fixture&&it.fixture.date)}),
    score:it=>{
      const st = (it.fixture && it.fixture.status && it.fixture.status.short) || '';
      const sc = it.score || {};
      const ft = _pair(sc.fulltime&&sc.fulltime.home, sc.fulltime&&sc.fulltime.away) || _pair(it.goals&&it.goals.home, it.goals&&it.goals.away);
      return {st, finished:['FT','AET','PEN'].includes(st), void:['CANC','ABD','AWD','WO'].includes(st), postponed:['PST','SUSP','INT'].includes(st),
        ft, ht:_pair(sc.halftime&&sc.halftime.home, sc.halftime&&sc.halftime.away), teamIds:{h:it.teams&&it.teams.home&&it.teams.home.id, a:it.teams&&it.teams.away&&it.teams.away.id}};
    }},
  {id:'basketball', label:'Basquete', host:'v1.basketball.api-sports.io', path:'games', tz:true, itemId:it=>it.id, parse:_evtGen, score:_v1Score(['FT','AOT'])},
  {id:'nba', label:'NBA', host:'v2.nba.api-sports.io', path:'games', tz:false, itemId:it=>it.id,
    parse:it=>({home:_evtNm(it.teams&&it.teams.home), away:_evtNm(it.teams&&it.teams.visitors), league:'NBA', ts:Date.parse(it.date&&it.date.start)}),
    score:it=>{
      const stl = String((it.status && (it.status.long||it.status.short)) || '');
      const sh = it.scores && it.scores.home, sv = it.scores && it.scores.visitors;
      const ls = (o)=> (o && Array.isArray(o.linescore) && o.linescore.length>=2 && _num(o.linescore[0])!==null && _num(o.linescore[1])!==null) ? _num(o.linescore[0])+_num(o.linescore[1]) : null;
      const hh = ls(sh), ha = ls(sv);
      return {st:stl, finished:/finish/i.test(stl) || (it.status && it.status.short===3), void:/cancel/i.test(stl), postponed:/postpon|suspend/i.test(stl),
        ft:_pair(sh&&sh.points, sv&&sv.points), ht:(hh===null||ha===null)?null:{h:hh,a:ha}};
    }},
  {id:'nfl', label:'NFL', host:'v1.american-football.api-sports.io', path:'games', tz:false, itemId:it=>it.game&&it.game.id,
    parse:it=>({home:_evtNm(it.teams&&it.teams.home), away:_evtNm(it.teams&&it.teams.away), league:(it.league&&it.league.name)||'NFL',
      ts: it.game&&it.game.date&&it.game.date.timestamp ? it.game.date.timestamp*1000 : NaN}),
    score:it=>{
      const st = (it.game && it.game.status && it.game.status.short) || '';
      const sh = it.scores && it.scores.home, sa = it.scores && it.scores.away;
      const hh = _sum2(sh), ha = _sum2(sa);
      return {st, finished:['FT','AOT','OT'].includes(st), void:['CANC','ABD'].includes(st), postponed:['PST','SUSP'].includes(st),
        ft:_pair(sh&&sh.total, sa&&sa.total), ht:(hh===null||ha===null)?null:{h:hh,a:ha}};
    }},
  {id:'mma', label:'MMA', host:'v1.mma.api-sports.io', path:'fights', tz:false, itemId:it=>it.id,
    parse:it=>({home:_evtNm(it.fighters&&it.fighters.first), away:_evtNm(it.fighters&&it.fighters.second), league:it.slug||it.category||'MMA',
      ts: it.timestamp ? it.timestamp*1000 : Date.parse(it.date)}),
    score:it=>{
      const st = (it.status && it.status.short) || '';
      const f = it.fighters || {};
      const w1 = f.first && f.first.winner, w2 = f.second && f.second.winner;
      const winner = w1===true ? 'H' : (w2===true ? 'A' : null);
      return {st, finished: winner!==null || ['FT','EOF'].includes(st), void:['CANC','ABD'].includes(st), postponed:['PST'].includes(st), ft:null, ht:null, winner,
        draw: (['FT','EOF'].includes(st) && winner===null)};
    }}
];
function evtSelectedSports(){
  try{
    const v = JSON.parse(localStorage.getItem(EVT_SPORTS_KEY)||'null');
    if(Array.isArray(v)) return EVT_SPORTS.filter(sp=>v.includes(sp.id));
  }catch(e){}
  return EVT_SPORTS.slice();   // padrão: todos
}
function evtSetSelectedSports(ids){ try{ localStorage.setItem(EVT_SPORTS_KEY, JSON.stringify(ids)); }catch(e){} }

// Carrega os jogos de um esporte em uma data (com cache no navegador para poupar o limite gratuito)
async function evtLoadSportDate(sport, date){
  const mk = sport.id+'|'+date;
  if(EVT_FIX[mk]) return EVT_FIX[mk];
  const key = evtGetKey();
  if(!key) return [];
  const cacheKey = 'bw_fix2_'+sport.id+'_'+date;
  try{
    const c = JSON.parse(localStorage.getItem(cacheKey)||'null');
    // jogos de dias já passados não mudam: ficam guardados 24h (assim dá para lançar manualmente um jogo de ontem);
    // hoje/amanhã são renovados a cada 3h (horário e times podem mudar)
    const ttl = date < todaySP() ? 24*3600*1000 : 3*3600*1000;
    if(c && Date.now()-c.at < ttl){ EVT_FIX[mk] = c.list; return c.list; }
  }catch(e){}
  const url = 'https://'+sport.host+'/'+sport.path+'?date='+date+(sport.tz?'&timezone=America/Sao_Paulo':'');
  const resp = await fetch(url, {headers:{'x-apisports-key':key}});
  const json = await resp.json();
  const errs = json && json.errors;
  const errTxt = Array.isArray(errs) ? errs.join(' ') : (errs ? Object.values(errs).join(' ') : '');
  if(errTxt) throw new Error(errTxt);
  const list = [];
  (json.response||[]).forEach(it=>{
    let g; try{ g = sport.parse(it); }catch(e){ return; }
    if(!g || !g.home || !g.away) return;
    list.push({home:g.home, away:g.away, league:g.league||'', sport:sport.label, sid:sport.id, qd:date, id: sport.itemId ? sport.itemId(it) : null, when: isNaN(g.ts) ? '' : evtFixtureTime(g.ts)});
  });
  EVT_FIX[mk] = list;
  try{ localStorage.setItem(cacheKey, JSON.stringify({at:Date.now(), list})); }catch(e){}
  return list;
}
async function evtPrefetch(){
  if(!evtGetKey()){ EVT_STATUS = 'Busca online desligada — usando seu histórico (ative em Configurações).'; evtShowStatus(); return; }
  const base = (DRAFT && DRAFT.date) || todaySP();
  const d2 = new Date(base+'T12:00:00'); d2.setDate(d2.getDate()+1);
  const next = d2.toISOString().slice(0,10);
  const d0 = new Date(base+'T12:00:00'); d0.setDate(d0.getDate()-1);
  const prev = d0.toISOString().slice(0,10);      // ontem: para lançar à mão um jogo que já aconteceu
  const sports = evtSelectedSports();
  EVT_STATUS = 'Carregando jogos…'; evtShowStatus();
  const jobs = [];
  sports.forEach(sp=>[prev,base,next].forEach(d=>jobs.push(evtLoadSportDate(sp,d).then(l=>({ok:true,n:l.length}),e=>({ok:false,sp:sp.label,msg:e.message})))));
  const res = await Promise.all(jobs);
  const n = res.reduce((t,r)=>t+(r.ok?r.n:0),0);
  const bad = res.filter(r=>!r.ok);
  EVT_STATUS = n+' jogos online carregados ('+fmtDate(prev)+' a '+fmtDate(next)+')'+(bad.length ? ' · falhou: '+[...new Set(bad.map(b=>b.sp))].join(', ')+' ('+bad[0].msg+')' : '')+'.';
  evtShowStatus();
}
function evtShowStatus(){
  const el = document.getElementById('evt-status');
  if(el) el.textContent = EVT_STATUS;
}
function evtFixtureTime(ts){
  try{
    const d = new Date(ts);
    return d.toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit'})+', '+
      d.toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'});
  }catch(e){ return ''; }
}

// Sugestões para o texto digitado no campo Evento
function evtSuggest(text){
  const out = [];
  const raw = String(text||'').trim();
  if(raw.length < 2) return out;
  const p = evtParse(raw);
  const tokens = p.hasSep ? [p.home, p.away].filter(Boolean) : [p.home];
  const nt = tokens.map(evtNorm).filter(Boolean);
  const matchEvent = (h,a)=>{
    const hay = [evtNorm(h), evtNorm(a)];
    if(!p.hasSep){ const q = nt[0]; return hay.some(x=>x.includes(q)); }
    if(nt.length===1) return hay[0].includes(nt[0]);
    return (hay[0].includes(nt[0]) && hay[1].includes(nt[1])) || (hay[0].includes(nt[1]) && hay[1].includes(nt[0]));
  };
  const seen = new Set();
  const push = (s)=>{ const k = evtNorm(s.home)+'|'+evtNorm(s.away); if(seen.has(k)) return; seen.add(k); out.push(s); };
  Object.values(EVT_FIX).forEach(list=>list.forEach(f=>{ if(matchEvent(f.home,f.away)) push({kind:'event', home:f.home, away:f.away, sub:[f.sport, (f.league && f.league!==f.sport ? f.league : ''), f.when].filter(Boolean).join(' · ')}); }));
  evtHistory().events.forEach(e=>{ if(matchEvent(e.home,e.away)) push({kind:'event', home:e.home, away:e.away, sub:'já lançado antes'}); });
  // completar nome do time que está sendo digitado
  const last = p.hasSep ? (p.away || '') : p.home;
  const nl = evtNorm(last);
  if(nl.length>=2){
    const allTeams = new Map();
    evtHistory().teams.forEach(t=>allTeams.set(evtNorm(t), t));
    Object.values(EVT_FIX).forEach(list=>list.forEach(f=>{ allTeams.set(evtNorm(f.home), f.home); allTeams.set(evtNorm(f.away), f.away); }));
    [...allTeams.entries()].filter(([k])=>k.includes(nl) && k!==nl).slice(0,6).forEach(([,name])=>{
      const s = p.hasSep ? {kind:'team', home:p.home, away:name} : {kind:'team', home:name, away:''};
      out.push({...s, sub: p.hasSep ? '' : 'continuar…'});
    });
  }
  return out.slice(0,10);
}

// Procura, nos jogos já carregados da API, o jogo com exatamente esses dois times -> referência para buscar o resultado depois
function evtFindRef(home, away){
  const h = evtNorm(home), a = evtNorm(away);
  if(!h || !a) return null;
  for(const list of Object.values(EVT_FIX)){
    for(const f of list){
      if(f.id!=null && evtNorm(f.home)===h && evtNorm(f.away)===a) return {sport:f.sid, id:f.id, qd:f.qd};
    }
  }
  return null;
}
