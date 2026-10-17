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

function evtFixtureTime(iso){
  try{
    const d = new Date(iso);
    const dd = d.toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit'});
    const hh = d.toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'});
    return dd+', '+hh;
  }catch(e){ return ''; }
}

// Carrega os jogos de uma data (com cache do dia no navegador para poupar o limite gratuito da API)
async function evtLoadDate(date){
  if(EVT_FIX[date]) return EVT_FIX[date];
  const key = evtGetKey();
  if(!key) return [];
  const cacheKey = 'bw_fix_'+date;
  try{
    const c = JSON.parse(localStorage.getItem(cacheKey)||'null');
    if(c && Date.now()-c.at < 3*3600*1000){ EVT_FIX[date] = c.list; return c.list; }
  }catch(e){}
  const resp = await fetch('https://v3.football.api-sports.io/fixtures?date='+date+'&timezone=America/Sao_Paulo', {headers:{'x-apisports-key':key}});
  const json = await resp.json();
  const errs = json && json.errors;
  const errTxt = Array.isArray(errs) ? errs.join(' ') : (errs ? Object.values(errs).join(' ') : '');
  if(errTxt) throw new Error(errTxt);
  const list = (json.response||[]).map(f=>({
    home: f.teams.home.name, away: f.teams.away.name, league: f.league.name, when: evtFixtureTime(f.fixture.date)
  }));
  EVT_FIX[date] = list;
  try{ localStorage.setItem(cacheKey, JSON.stringify({at:Date.now(), list})); }catch(e){}
  return list;
}
async function evtPrefetch(){
  if(!evtGetKey()){ EVT_STATUS = 'Busca online desligada — usando seu histórico (ative em Configurações).'; evtShowStatus(); return; }
  const base = (DRAFT && DRAFT.date) || todaySP();
  const d2 = new Date(base+'T12:00:00'); d2.setDate(d2.getDate()+1);
  const next = d2.toISOString().slice(0,10);
  EVT_STATUS = 'Carregando jogos…'; evtShowStatus();
  try{
    const a = await evtLoadDate(base), b = await evtLoadDate(next);
    EVT_STATUS = (a.length+b.length)+' jogos online carregados ('+fmtDate(base)+' e '+fmtDate(next)+').';
  }catch(e){
    EVT_STATUS = 'Busca online indisponível: '+e.message+' — usando só o histórico.';
  }
  evtShowStatus();
}
function evtShowStatus(){
  const el = document.getElementById('evt-status');
  if(el) el.textContent = EVT_STATUS;
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
  Object.values(EVT_FIX).forEach(list=>list.forEach(f=>{ if(matchEvent(f.home,f.away)) push({kind:'event', home:f.home, away:f.away, sub:f.league+' · '+f.when}); }));
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
