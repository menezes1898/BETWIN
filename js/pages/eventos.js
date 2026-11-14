// ===== Aba "Eventos": um cartão por jogo; ao abrir, todas as apostas daquele jogo numa página só =====
let EV_OPEN = null;          // chave do evento aberto (null = lista)
let EV_FILTER = 'pendentes'; // pendentes | hoje | proximos | finalizados | todos
let EV_SEARCH = '';
let EV_BUSY = false;
const EV_SCORE = {};         // chave do evento -> {fh,fa,hh,ha} digitado
const EV_API = {};           // chave do evento -> {S, sp, ref, texto}

// ---- bandeiras (seleções) e inicial colorida (clubes) ----
const EV_FLAGS = {
  'brasil':'🇧🇷','brazil':'🇧🇷','argentina':'🇦🇷','uruguai':'🇺🇾','uruguay':'🇺🇾','paraguai':'🇵🇾','paraguay':'🇵🇾','chile':'🇨🇱','colombia':'🇨🇴','colômbia':'🇨🇴','peru':'🇵🇪','equador':'🇪🇨','ecuador':'🇪🇨','bolivia':'🇧🇴','bolívia':'🇧🇴','venezuela':'🇻🇪',
  'japao':'🇯🇵','japão':'🇯🇵','japan':'🇯🇵','coreia do sul':'🇰🇷','south korea':'🇰🇷','korea republic':'🇰🇷','china':'🇨🇳','australia':'🇦🇺','austrália':'🇦🇺','ira':'🇮🇷','irã':'🇮🇷','iran':'🇮🇷','arabia saudita':'🇸🇦','arábia saudita':'🇸🇦','saudi arabia':'🇸🇦','catar':'🇶🇦','qatar':'🇶🇦','uzbequistao':'🇺🇿','uzbekistan':'🇺🇿','iraque':'🇮🇶','iraq':'🇮🇶','jordania':'🇯🇴','jordan':'🇯🇴',
  'estados unidos':'🇺🇸','usa':'🇺🇸','united states':'🇺🇸','mexico':'🇲🇽','méxico':'🇲🇽','canada':'🇨🇦','canadá':'🇨🇦','costa rica':'🇨🇷','panama':'🇵🇦','panamá':'🇵🇦','jamaica':'🇯🇲','honduras':'🇭🇳','haiti':'🇭🇹','haiti ':'🇭🇹',
  'franca':'🇫🇷','frança':'🇫🇷','france':'🇫🇷','alemanha':'🇩🇪','germany':'🇩🇪','espanha':'🇪🇸','spain':'🇪🇸','portugal':'🇵🇹','italia':'🇮🇹','itália':'🇮🇹','italy':'🇮🇹','holanda':'🇳🇱','paises baixos':'🇳🇱','netherlands':'🇳🇱','belgica':'🇧🇪','bélgica':'🇧🇪','belgium':'🇧🇪','croacia':'🇭🇷','croácia':'🇭🇷','croatia':'🇭🇷','suica':'🇨🇭','suíça':'🇨🇭','switzerland':'🇨🇭','austria':'🇦🇹','áustria':'🇦🇹','dinamarca':'🇩🇰','denmark':'🇩🇰','suecia':'🇸🇪','suécia':'🇸🇪','sweden':'🇸🇪','noruega':'🇳🇴','norway':'🇳🇴','polonia':'🇵🇱','polônia':'🇵🇱','poland':'🇵🇱','servia':'🇷🇸','sérvia':'🇷🇸','serbia':'🇷🇸','ucrania':'🇺🇦','ucrânia':'🇺🇦','ukraine':'🇺🇦','turquia':'🇹🇷','turkey':'🇹🇷','grecia':'🇬🇷','grécia':'🇬🇷','greece':'🇬🇷','republica tcheca':'🇨🇿','república tcheca':'🇨🇿','czech republic':'🇨🇿','hungria':'🇭🇺','hungary':'🇭🇺','romenia':'🇷🇴','romênia':'🇷🇴','romania':'🇷🇴','eslovaquia':'🇸🇰','eslováquia':'🇸🇰','slovakia':'🇸🇰','eslovenia':'🇸🇮','eslovênia':'🇸🇮','slovenia':'🇸🇮','escocia':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','escócia':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','inglaterra':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','england':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','gales':'🏴󠁧󠁢󠁷󠁬󠁳󠁿','wales':'🏴󠁧󠁢󠁷󠁬󠁳󠁿','irlanda':'🇮🇪','ireland':'🇮🇪','finlandia':'🇫🇮','finlândia':'🇫🇮','finland':'🇫🇮','islandia':'🇮🇸','islândia':'🇮🇸','iceland':'🇮🇸','albania':'🇦🇱','albânia':'🇦🇱','georgia':'🇬🇪','geórgia':'🇬🇪','russia':'🇷🇺','rússia':'🇷🇺',
  'marrocos':'🇲🇦','morocco':'🇲🇦','senegal':'🇸🇳','tunisia':'🇹🇳','tunísia':'🇹🇳','egito':'🇪🇬','egypt':'🇪🇬','nigeria':'🇳🇬','nigéria':'🇳🇬','camaroes':'🇨🇲','camarões':'🇨🇲','cameroon':'🇨🇲','gana':'🇬🇭','ghana':'🇬🇭','argelia':'🇩🇿','argélia':'🇩🇿','algeria':'🇩🇿','costa do marfim':'🇨🇮','ivory coast':'🇨🇮','africa do sul':'🇿🇦','áfrica do sul':'🇿🇦','south africa':'🇿🇦','mali':'🇲🇱','cabo verde':'🇨🇻','cape verde':'🇨🇻','nova zelandia':'🇳🇿','nova zelândia':'🇳🇿','new zealand':'🇳🇿'
};
function evFlag(name){
  const k = String(name||'').trim().toLowerCase();
  if(EV_FLAGS[k]) return EV_FLAGS[k];
  const n = k.normalize('NFD').replace(/[̀-ͯ]/g,'');
  return EV_FLAGS[n] || '';
}
function evBadge(name, big){
  const f = evFlag(name);
  const sz = big ? 'ev-badge-lg' : '';
  if(f) return `<span class="ev-badge ev-flag ${sz}">${f}</span>`;
  const s = String(name||'?').trim();
  let h = 0; for(let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i)) % 360;
  const ini = (s.replace(/[^A-Za-zÀ-ÿ0-9 ]/g,'').split(/\s+/).filter(Boolean)[0]||'?').charAt(0).toUpperCase();
  return `<span class="ev-badge ${sz}" style="background:hsl(${h} 55% 38%);color:#fff">${evtEsc(ini)}</span>`;
}

// ---- agrupamento: TODAS as seleções de cada jogo (pendentes e já resolvidas) ----
function evGroups(){
  const evs = new Map(), alias = new Map();
  const find = k=>{ while(alias.has(k) && alias.get(k)!==k) k = alias.get(k); return k; };
  const hoje = todaySP(), limite = shiftWeek(hoje, -2);
  STATE.tickets.forEach(t=>{
    const temPend = t.matches.some(m=>m.result==='pending');
    if(!temPend && (t.date||'') < limite) return;               // histórico antigo fica de fora
    t.matches.forEach(m=>{
      if(!m.home) return;
      const refKey = m.ref && m.ref.sport && m.ref.id!=null ? 'r:'+m.ref.sport+':'+m.ref.id : '';
      const nameKey = 'n:'+[evtNorm(m.home||''), evtNorm(m.away||'')].sort().join('|');
      const ks = [refKey, nameKey].filter(Boolean).map(find);
      const key = ks[0];
      ks.forEach(k=>{ if(k!==key){ alias.set(k, key); const old = evs.get(k); if(old){ const dst = evs.get(key); if(dst){ dst.rows.push(...old.rows); if(!dst.ref && old.ref) dst.ref = old.ref; evs.delete(k); } else { evs.set(key, old); old.key = key; evs.delete(k); } } } });
      alias.set(refKey||nameKey, key); alias.set(nameKey, key); if(refKey) alias.set(refKey, key);
      let ev = evs.get(key);
      if(!ev){ ev = {key, home:m.home||'', away:m.away||'', date:'', time:'', ref:null, rows:[]}; evs.set(key, ev); }
      if(m.ref && m.ref.sport && !ev.ref) ev.ref = m.ref;
      const d = m.date || t.date || '';
      if(d && (!ev.date || d<ev.date)){ ev.date = d; ev.time = m.time ? String(m.time).slice(0,5) : ev.time; }
      else if(m.time && !ev.time && d===ev.date) ev.time = String(m.time).slice(0,5);
      ev.rows.push({t, m});
    });
  });
  return Array.from(evs.values()).map(ev=>{
    ev.tickets = new Set(ev.rows.map(r=>r.t.id));
    ev.pend = ev.rows.filter(r=>r.m.result==='pending').length;
    ev.stake = Array.from(ev.tickets).reduce((s,id)=>{ const t = STATE.tickets.find(x=>x.id===id); return s + (t?t.stake:0); }, 0);
    return ev;
  });
}
function evFiltered(all){
  const hoje = todaySP(), q = EV_SEARCH.trim().toLowerCase();
  let list = all.filter(ev=>{
    if(EV_FILTER==='pendentes') return ev.pend>0;
    if(EV_FILTER==='finalizados') return ev.pend===0;
    if(EV_FILTER==='hoje') return ev.date===hoje;
    if(EV_FILTER==='proximos') return ev.date>hoje;
    return true;
  });
  if(q) list = list.filter(ev=>(ev.home+' '+ev.away).toLowerCase().includes(q) || ev.rows.some(r=>String(r.t.ticketNumber||'').includes(q) || apClientName(r.t).toLowerCase().includes(q)));
  list.sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999') || (a.time||'').localeCompare(b.time||'') || b.tickets.size-a.tickets.size);
  return list;
}
function evSetFilter(f){ EV_FILTER = f; render(); }
function evSetSearch(v){ EV_SEARCH = v; const p = document.getElementById('ev-list'); if(p){ p.innerHTML = evListHtml(); } }
function evAbrir(i){ const l = window.__evKeys||[]; EV_OPEN = l[i]||null; render(); window.scrollTo(0,0); }
function evVoltar(){ EV_OPEN = null; render(); }

function evDateLabel(ev){
  const d = ev.date; if(!d) return '';
  const hoje = todaySP();
  const lb = d===hoje ? 'Hoje' : d===shiftWeek(hoje,-1) ? 'Ontem' : d===shiftWeek(hoje,1) ? 'Amanhã' : fmtDate(d);
  return lb + (ev.time ? ' · '+ev.time : '');
}
function evStatusChip(ev){
  if(ev.pend===0) return '<span class="chip chip-green">FINALIZADO</span>';
  if(ev.pend<ev.rows.length) return '<span class="chip chip-pending">PARCIAL</span>';
  return '<span class="chip chip-pending">PENDENTE</span>';
}
function evListHtml(){
  const all = evGroups();
  const list = evFiltered(all);
  window.__evKeys = list.map(e=>e.key);
  if(!list.length) return '<div class="ev-empty">Nenhum evento neste filtro.</div>';
  return `<div class="ev-grid">` + list.map((ev,i)=>`
    <div class="ev-card" onclick="evAbrir(${i})">
      <div class="ev-card-top"><span class="ev-when">${evtEsc(evDateLabel(ev))}</span>${evStatusChip(ev)}</div>
      <div class="ev-teams">
        <div class="ev-team">${evBadge(ev.home)}<span>${evtEsc(ev.home)}</span></div>
        ${ev.away ? `<div class="ev-vs">x</div><div class="ev-team">${evBadge(ev.away)}<span>${evtEsc(ev.away)}</span></div>` : ''}
      </div>
      <div class="ev-card-foot">
        <span><b>${ev.tickets.size}</b> aposta${ev.tickets.size===1?'':'s'}</span>
        <span><b>${ev.rows.length}</b> seleç${ev.rows.length===1?'ão':'ões'}</span>
        <span class="ev-stake">${fmtBRL(ev.stake)}</span>
      </div>
    </div>`).join('') + `</div>`;
}
function renderEventosTab(){
  if(EV_OPEN) return renderEventoPagina();
  const all = evGroups();
  const cnt = f=>{ const s = EV_FILTER; EV_FILTER = f; const n = evFiltered(all).length; EV_FILTER = s; return n; };
  const tabs = [['pendentes','Pendentes'],['hoje','Hoje'],['proximos','Próximos'],['finalizados','Finalizados'],['todos','Todos']];
  const pendTotal = all.filter(e=>e.pend>0).length;
  const tk = new Set(); all.filter(e=>e.pend>0).forEach(e=>e.tickets.forEach(id=>tk.add(id)));
  return `
    <div class="ap-kpis">${apKpi('Eventos com pendência', pendTotal, '')}${apKpi('Apostas em jogo', tk.size, '')}${apKpi('Eventos de hoje', cnt('hoje'), '')}${apKpi('Finalizados (recentes)', cnt('finalizados'), '')}</div>
    <div class="ev-bar">
      <div class="ev-tabs">${tabs.map(([k,l])=>`<button class="ev-tab ${EV_FILTER===k?'on':''}" onclick="evSetFilter('${k}')">${l} <i>${cnt(k)}</i></button>`).join('')}</div>
      <input class="ev-search" placeholder="Buscar time, cliente ou nº…" value="${evtEsc(EV_SEARCH)}" oninput="evSetSearch(this.value)">
    </div>
    <div id="ev-list">${evListHtml()}</div>`;
}

// ---- página do evento ----
function evCurrent(){ return evGroups().find(e=>e.key===EV_OPEN); }
function evResChip(r){
  const map = {green:['GREEN','chip-green'], red:['RED','chip-red'], void:['ANULADA','chip-void'], half_green:['½ GREEN','chip-green half'], half_red:['½ RED','chip-red half'], pending:['PENDENTE','chip-pending']};
  const [l,c] = map[r]||map.pending; return `<span class="chip ${c}">${l}</span>`;
}
function evGanho(t){
  const r = ticketResult(t);
  if(r==='pending') return fmtBRL(t.stake*(t.odds>0?t.odds:ticketOddTotal(t))) ;
  const p = ticketProfit(t); return (p>0?'+':'')+fmtBRL(p);
}
function renderEventoPagina(){
  const ev = evCurrent();
  if(!ev){ EV_OPEN = null; return renderEventosTab(); }
  const sc = EV_SCORE[ev.key] || {};
  const api = EV_API[ev.key];
  const v = x=> (x===undefined||x===null) ? '' : x;
  const rows = ev.rows.slice().sort((a,b)=>(a.t.ticketNumber||0)-(b.t.ticketNumber||0));
  window.__evRows = rows;
  return `
    <button class="btn-ghost btn-sm" onclick="evVoltar()">‹ Eventos</button>
    <div class="ev-hero">
      <div class="ev-hero-when">${evtEsc(evDateLabel(ev))} ${evStatusChip(ev)}</div>
      <div class="ev-hero-teams">
        <div class="ev-hero-team">${evBadge(ev.home,true)}<b>${evtEsc(ev.home)}</b></div>
        ${ev.away ? `<div class="ev-hero-x">x</div><div class="ev-hero-team">${evBadge(ev.away,true)}<b>${evtEsc(ev.away)}</b></div>` : ''}
      </div>
      <div class="ev-hero-sum">${ev.tickets.size} aposta${ev.tickets.size===1?'':'s'} · ${ev.rows.length} seleç${ev.rows.length===1?'ão':'ões'} · ${fmtBRL(ev.stake)} em jogo · ${ev.pend} pendente${ev.pend===1?'':'s'}</div>
    </div>
    ${ev.away ? `
    <div class="ev-score">
      <div class="ev-score-l"><b>Placar</b><span>Informe o resultado e processe todas as apostas pendentes de uma vez.</span></div>
      <div class="ev-score-in">
        <label>Final <input id="ev-fh" type="number" min="0" value="${v(sc.fh)}" oninput="evStoreScore()"> x <input id="ev-fa" type="number" min="0" value="${v(sc.fa)}" oninput="evStoreScore()"></label>
        <label>1º tempo <input id="ev-hh" type="number" min="0" value="${v(sc.hh)}" oninput="evStoreScore()"> x <input id="ev-ha" type="number" min="0" value="${v(sc.ha)}" oninput="evStoreScore()"></label>
      </div>
      <div class="ev-score-btns">
        ${ev.ref ? `<button class="btn-ghost btn-sm" ${EV_BUSY?'disabled':''} onclick="evBuscarApi()">${EV_BUSY?'Buscando…':'Buscar placar na API'}</button>` : ''}
        <button class="btn-primary btn-sm" ${EV_BUSY?'disabled':''} onclick="evProcessar()">Processar tudo</button>
      </div>
      ${api && api.texto ? `<div class="ev-api-note">${evtEsc(api.texto)}</div>` : ''}
    </div>` : ''}
    <div class="ev-table-wrap"><table class="ev-table">
      <thead><tr><th>#</th><th>Cliente</th><th>Aposta</th><th class="r">Valor</th><th class="r">Ganho</th><th class="r">Odd</th><th>Resultado</th><th>Ações</th></tr></thead>
      <tbody>${rows.map((r,i)=>{
        const t = r.t, m = r.m, multi = t.matches.length>1;
        return `<tr class="${m.result!=='pending'?'done':''}">
          <td><a class="ev-num" onclick="abrirDetalheAposta('${t.id}')">#${t.ticketNumber||'—'}</a></td>
          <td>${evtEsc(apClientName(t))}</td>
          <td><div class="ev-sel">${evtEsc(ouToPt(m.selection||''))}</div><div class="ev-mk">${evtEsc(marketLabelOf(m.market)||'')}${multi?` · <span class="pe-multi">Múltipla ${t.matches.length}</span>`:''}</div>${m.autoNote?`<div class="ev-note">${evtEsc(m.autoNote)}</div>`:''}</td>
          <td class="r">${fmtBRL(t.stake)}</td>
          <td class="r">${evGanho(t)}</td>
          <td class="r">${Number(m.odd)?Number(m.odd).toFixed(2):'—'}</td>
          <td>${evResChip(m.result)}</td>
          <td class="ev-acts">
            <button class="ev-b g ${m.result==='green'?'on':''}" title="Green" onclick="evMarcar(${i},'green')">G</button>
            <button class="ev-b r ${m.result==='red'?'on':''}" title="Red" onclick="evMarcar(${i},'red')">R</button>
            <button class="ev-b v ${m.result==='void'?'on':''}" title="Anulada" onclick="evMarcar(${i},'void')">A</button>
            ${m.result!=='pending'?`<button class="ev-b u" title="Desfazer resultado" onclick="evMarcar(${i},'pending')">↺</button>`:''}
          </td></tr>`;
      }).join('')}</tbody></table></div>`;
}
function evStoreScore(){
  const g = id=>{ const e = document.getElementById(id); return e && e.value!=='' ? Number(e.value) : undefined; };
  EV_SCORE[EV_OPEN] = {fh:g('ev-fh'), fa:g('ev-fa'), hh:g('ev-hh'), ha:g('ev-ha')};
}
async function evSalvarTickets(ids){
  const res = await Promise.all(ids.map(async id=>({id, error: await apSaveMatches(id)})));
  return res.filter(x=>x.error);
}
async function evMarcar(i, result){
  const r = (window.__evRows||[])[i]; if(!r) return;
  const old = r.m.result, oldNote = r.m.autoNote, oldAt = r.m.autoAt;
  if(old===result) return;
  r.m.result = result; apKeep(r.t.id);
  if(result==='pending'){ delete r.m.autoNote; delete r.m.autoAt; }
  const y = window.scrollY;
  const error = await apSaveMatches(r.t.id);
  if(error){ r.m.result = old; r.m.autoNote = oldNote; r.m.autoAt = oldAt; showToast('Erro ao salvar: '+error.message,'error'); }
  render(); window.scrollTo(0,y);
}
function evMontarS(sc){
  const S = {st:'MANUAL', finished:true, void:false, postponed:false, ft:{h:sc.fh, a:sc.fa}, ht:null};
  if(sc.hh!==undefined && sc.ha!==undefined) S.ht = {h:sc.hh, a:sc.ha};
  return S;
}
async function evProcessar(){
  const ev = evCurrent(); if(!ev || EV_BUSY) return;
  evStoreScore();
  const sc = EV_SCORE[ev.key] || {};
  const api = EV_API[ev.key];
  if(sc.fh===undefined || sc.fa===undefined){ showToast('Informe o placar final primeiro.'); return; }
  const S = evMontarS(sc);
  if(api && api.S && api.S.finished && api.S.ft && api.S.ft.h===sc.fh && api.S.ft.a===sc.fa) S.teamIds = api.S.teamIds;
  const pend = ev.rows.filter(r=>r.m.result==='pending');
  if(!pend.length){ showToast('Não há apostas pendentes neste evento.'); return; }
  EV_BUSY = true; render();
  const aplicar = [], manual = [];
  const ctx = { events:()=>Promise.resolve(null), stats:()=>Promise.resolve(null) };
  if(api && api.sp && api.sp.id==='football' && api.S && api.S.ft && api.S.ft.h===sc.fh && api.S.ft.a===sc.fa && ev.ref){
    ctx.events = ()=>resApi(api.sp,'fixtures/events','fixture='+ev.ref.id).catch(()=>null);
    ctx.stats = ()=>resApi(api.sp,'fixtures/statistics','fixture='+ev.ref.id).catch(()=>null);
  }
  for(const r of pend){
    // o placar é digitado na ordem do cabeçalho; apostas cadastradas com os times invertidos recebem o placar espelhado
    const inv = evtNorm(r.m.home||'')!==evtNorm(ev.home||'') && evtNorm(r.m.home||'')===evtNorm(ev.away||'');
    const Sr = inv ? {...S, ft:{h:S.ft.a, a:S.ft.h}, ht:S.ht?{h:S.ht.a, a:S.ht.h}:null, teamIds:undefined} : S;
    let out; try{ out = await resEvalLeg(r.m, Sr, ctx); }catch(e){ out = {r:'manual', note:e.message}; }
    if(['green','red','void','half_green','half_red'].includes(out.r)) aplicar.push({r, res:out.r, note:out.note});
    else manual.push({r, note:out.note});
  }
  const backup = aplicar.map(a=>({a, res:a.r.m.result, note:a.r.m.autoNote, at:a.r.m.autoAt}));
  const stamp = new Date().toISOString();
  aplicar.forEach(a=>{ a.r.m.result = a.res; a.r.m.autoNote = 'Placar '+sc.fh+'x'+sc.fa+(a.note?' · '+a.note:''); a.r.m.autoAt = stamp; apKeep(a.r.t.id); });
  const ids = [...new Set(aplicar.map(a=>a.r.t.id))];
  const falhas = await evSalvarTickets(ids);
  if(falhas.length){
    const fx = new Set(falhas.map(f=>f.id));
    backup.forEach(b=>{ if(fx.has(b.a.r.t.id)){ b.a.r.m.result = b.res; b.a.r.m.autoNote = b.note; b.a.r.m.autoAt = b.at; } });
    showToast('Erro ao salvar '+falhas.length+' aposta(s): '+falhas[0].error.message,'error');
  } else {
    showToast(aplicar.length+' seleç'+(aplicar.length===1?'ão':'ões')+' resolvida'+(aplicar.length===1?'':'s')+(manual.length?' · '+manual.length+' para marcar à mão (mercado que precisa de mais dados)':'')+'.','success');
  }
  EV_BUSY = false; render();
}
async function evBuscarApi(){
  const ev = evCurrent(); if(!ev || !ev.ref || EV_BUSY) return;
  if(!evtGetKey()){ showToast('Cadastre a chave da API em Configurações.'); return; }
  const sp = EVT_SPORTS.find(s=>s.id===ev.ref.sport);
  if(!sp){ showToast('Esporte não suportado pela API.'); return; }
  EV_BUSY = true; render();
  try{
    const list = await resLoadDay(sp, ev.ref.qd);
    const it = Array.isArray(list) ? list.find(x=>String(sp.itemId(x))===String(ev.ref.id)) : null;
    if(!it){ EV_API[ev.key] = {texto:'Jogo não veio na consulta da API (a API gratuita só traz ontem, hoje e amanhã).'}; }
    else {
      const S = sp.score(it);
      if(!S || !S.ft){ EV_API[ev.key] = {S, sp, texto:'A API ainda não tem placar para este jogo (status: '+((S&&S.st)||'—')+').'}; }
      else {
        EV_SCORE[ev.key] = {fh:S.ft.h, fa:S.ft.a, hh:S.ht?S.ht.h:undefined, ha:S.ht?S.ht.a:undefined};
        EV_API[ev.key] = {S, sp, texto: S.finished ? 'Placar da API: '+S.ft.h+' x '+S.ft.a+' (jogo encerrado). Confira e clique em "Processar tudo".' : 'Jogo ainda não terminou (status '+S.st+'). Placar parcial: '+S.ft.h+' x '+S.ft.a+'.'};
      }
    }
  }catch(e){ EV_API[ev.key] = {texto:'Erro na API: '+e.message}; }
  EV_BUSY = false; render();
}
