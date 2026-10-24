// ============================================================================
//  APOSTAS e PENDENTES — lista profissional, janela de detalhe e resultado com meia ganha / meia perdida
// ============================================================================
const TICKETS_PAGE_SIZE = 15;
let PEND_SEARCH = '';
let PEND_SORT = 'recentes';
let DETAIL_ID = null;                 // aposta aberta na janela de detalhe

const RES_BTNS = [                    // resultado por seleção (ordem dos botões)
  ['green',      '✓ Verde',       'ap-r-green'],
  ['half_green', '½ Verde',       'ap-r-hgreen'],
  ['red',        '✗ Vermelha',    'ap-r-red'],
  ['half_red',   '½ Vermelha',    'ap-r-hred'],
  ['void',       '⊘ Anulada',     'ap-r-void'],
  ['pending',    '⏱ Pendente',    'ap-r-pend']
];
const RES_QUICK = [                   // botões pequenos dentro do cartão
  ['green','✓ Green','Verde (ganhou)','ap-r-green'], ['half_green','½ Green','Meia verde (metade ganha, metade devolvida)','ap-r-hgreen'],
  ['red','✗ Red','Vermelha (perdeu)','ap-r-red'], ['half_red','½ Red','Meia vermelha (metade perdida, metade devolvida)','ap-r-hred'],
  ['void','Anul.','Anulada','ap-r-void']
];

function apFmtDateTime(iso){
  if(!iso) return '—';
  try{ return new Date(iso).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); }catch(e){ return '—'; }
}
function apClientName(ticket){ const cl = STATE.clients.find(c=>c.id===ticket.clientId); return cl ? cl.name : 'Cliente removido'; }
function apPotential(ticket){ const o = ticketOddTotal(ticket)>0 ? effectiveOdds(ticket) : 0; return ticket.stake*o; }
function apKpi(label, value, sub, tone){
  return `<div class="ap-kpi"><div class="ap-kpi-l">${label}</div><div class="ap-kpi-v ${tone||''}">${value}</div>${sub?`<div class="ap-kpi-s">${sub}</div>`:''}</div>`;
}
function apSortList(list, sort){
  if(sort==='recentes') list.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  else if(sort==='antigas') list.sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));
  else if(sort==='maior_valor') list.sort((a,b)=>b.stake-a.stake);
  else if(sort==='menor_valor') list.sort((a,b)=>a.stake-b.stake);
  return list;
}
function apSearchMatch(t, val){
  if(!val) return true;
  const v = val.toLowerCase();
  return String(t.ticketNumber||'').includes(v) || apClientName(t).toLowerCase().includes(v)
    || t.matches.some(m=>(String(m.home||'')+' '+String(m.away||'')).toLowerCase().includes(v));
}

// ---------- PENDENTES (por evento ou por aposta) ----------
let PEND_VIEW = 'evento';              // 'evento' | 'aposta'
let PEND_EV_SORT = 'antigos';          // antigos | apostas | valor
const PEND_EV_CLOSED = new Set();      // eventos recolhidos

function pendFiltered(){
  return apSortList(STATE.tickets.filter(t=>ticketResult(t)==='pending' && apSearchMatch(t, PEND_SEARCH.trim())), PEND_SORT);
}
function pendKpis(list){
  const valor = list.reduce((s,t)=>s+t.stake,0);
  const pot = list.reduce((s,t)=>s+apPotential(t),0);
  const legs = list.reduce((s,t)=>s+t.matches.filter(m=>m.result==='pending').length,0);
  return apKpi('Apostas pendentes', list.length, '') + apKpi('Valor em jogo', fmtBRL(valor), '', 'gold') + apKpi('Retorno potencial', fmtBRL(pot), '', 'green') + apKpi('Seleções a conferir', legs, '');
}

// Agrupa as seleções pendentes por EVENTO (jogo) e, dentro do evento, por mercado + escolha.
function pendEventGroups(){
  const q = PEND_SEARCH.trim().toLowerCase();
  const evs = new Map();
  // Um mesmo jogo pode chegar com identificação diferente (uma aposta com a busca de eventos, outra só com os nomes,
  // ou com os times na ordem invertida). Juntamos tudo que compartilhar a identificação OU o par de times.
  const alias = new Map();                              // chave -> chave principal do evento
  const find = k=>{ while(alias.has(k) && alias.get(k)!==k) k = alias.get(k); return k; };
  STATE.tickets.forEach(t=>{
    if(ticketResult(t)!=='pending') return;
    t.matches.forEach(m=>{
      if(m.result!=='pending') return;
      const refKey = m.ref && m.ref.sport && m.ref.id!=null ? 'r:'+m.ref.sport+':'+m.ref.id : '';
      const nameKey = 'n:'+[evtNorm(m.home||''), evtNorm(m.away||'')].sort().join('|');
      const ks = [refKey, nameKey].filter(Boolean).map(find);
      const key = ks[0];
      ks.forEach(k=>{ if(k!==key){ alias.set(k, key); const old = evs.get(k); if(old){ const dst = evs.get(key); if(dst){ old.markets.forEach((mg,mk)=>{ const d = dst.markets.get(mk); if(d) d.rows.push(...mg.rows); else dst.markets.set(mk, mg); }); old.tickets.forEach(id=>{ if(!dst.tickets.has(id)){ dst.tickets.add(id); const tt = STATE.tickets.find(x=>x.id===id); if(tt) dst.stake += tt.stake; } }); if(old.date && (!dst.date || old.date<dst.date)) dst.date = old.date; evs.delete(k); } else { evs.set(key, old); old.key = key; evs.delete(k); } } } });
      alias.set(refKey||nameKey, key); alias.set(nameKey, key); if(refKey) alias.set(refKey, key);
      let ev = evs.get(key);
      if(!ev){ ev = {key, home:m.home||'', away:m.away||'', sport:(m.ref&&m.ref.sport)||'', date:t.date||'', markets:new Map(), tickets:new Set(), stake:0}; evs.set(key, ev); }
      if(!ev.sport && m.ref && m.ref.sport) ev.sport = m.ref.sport;
      if(t.date && (!ev.date || t.date<ev.date)) ev.date = t.date;
      const mk = evtNorm(m.market||'')+'|'+evtNorm(ouToPt(m.selection||''));
      let mg = ev.markets.get(mk);
      if(!mg){ mg = {key:mk, market:m.market, selection:ouToPt(m.selection||''), rows:[]}; ev.markets.set(mk, mg); }
      mg.rows.push({t, m});
      if(!ev.tickets.has(t.id)){ ev.tickets.add(t.id); ev.stake += t.stake; }
    });
  });
  let list = Array.from(evs.values());
  if(q){
    list = list.filter(ev=>(ev.home+' '+ev.away).toLowerCase().includes(q)
      || Array.from(ev.markets.values()).some(mg=>mg.rows.some(r=>String(r.t.ticketNumber||'').includes(q) || apClientName(r.t).toLowerCase().includes(q))));
  }
  list.forEach(ev=>{ ev.markets = Array.from(ev.markets.values()).sort((x,y)=>y.rows.length-x.rows.length); });
  if(PEND_EV_SORT==='apostas') list.sort((x,y)=>y.tickets.size-x.tickets.size || (x.date||'').localeCompare(y.date||''));
  else if(PEND_EV_SORT==='valor') list.sort((x,y)=>y.stake-x.stake);
  else list.sort((x,y)=>(x.date||'9999').localeCompare(y.date||'9999') || y.tickets.size-x.tickets.size);
  return list;
}
function pendEventKpis(evs){
  const tk = new Set(); let legs = 0, valor = 0;
  evs.forEach(ev=>{ ev.markets.forEach(mg=>{ legs += mg.rows.length; }); ev.tickets.forEach(id=>{ if(!tk.has(id)){ tk.add(id); const t = STATE.tickets.find(x=>x.id===id); if(t) valor += t.stake; } }); });
  return apKpi('Eventos pendentes', evs.length, '') + apKpi('Apostas pendentes', tk.size, '') + apKpi('Valor em jogo', fmtBRL(valor), '', 'gold') + apKpi('Seleções a conferir', legs, '');
}
function pendEvDateLabel(d){
  if(!d) return '';
  const today = todaySP();
  if(d===today) return 'Hoje';
  if(d===shiftWeek(today,-1)) return 'Ontem';
  return fmtDate(d);
}
function renderPendEventRow(r){
  const t = r.t, id = t.id;
  const others = t.matches.filter(x=>x.id!==r.m.id);
  const odds = Number(r.m.odd);
  const multi = others.length ? `<span class="pe-multi" title="${evtEsc('Múltipla — depende também de: '+others.map(x=>(x.home||'')+(x.away?' x '+x.away:'')+' · '+ouToPt(x.selection||'')+' ('+(x.result==='pending'?'pendente':x.result)+')').join(' | '))}">Múltipla · ${t.matches.length}</span>` : '';
  return `
    <div class="pe-row">
      <div class="pe-who" onclick="abrirDetalheAposta('${id}')" title="Abrir detalhe da aposta">
        <span class="pe-num">#${t.ticketNumber||'—'}</span>
        <span class="pe-client">${evtEsc(apClientName(t))}</span>
        ${multi}
      </div>
      <div class="pe-vals"><span>${fmtBRL(t.stake)}</span><span class="pe-odd">@${isFinite(odds)?odds.toFixed(2):'—'}</span></div>
      <div class="bc-quick pe-quick">${RES_QUICK.map(([v,l,tt,c])=>`<button type="button" class="ap-q ${c}" title="${tt}" onclick="setMatchResult('${id}','${r.m.id}','${v}')">${l}</button>`).join('')}</div>
    </div>`;
}
function renderPendEvent(ev){
  const closed = PEND_EV_CLOSED.has(ev.key);
  const k = evtEsc(ev.key).replace(/'/g,'&#39;');
  const teams = ev.away ? `${evtEsc(ev.home)} <span class="bc-x">x</span> ${evtEsc(ev.away)}` : evtEsc(ev.home);
  const sport = ev.sport ? (EVT_SPORTS.find(s=>s.id===ev.sport)||{}).label : '';
  const marketsHtml = ev.markets.map((mg,i)=>{
    const label = MARKETS.find(x=>x.v===mg.market)?.l || mg.market;
    const mkId = ev.key+'||'+mg.key;
    return `
      <div class="pe-market">
        <div class="pe-mk-head">
          <div class="pe-mk-t"><span class="pe-mk-name">${evtEsc(label)}</span><b>${evtEsc(mg.selection)}</b><span class="pe-count">${mg.rows.length} aposta${mg.rows.length===1?'':'s'}</span></div>
          <div class="pe-mk-act"><span class="pe-all">Marcar todas:</span>${RES_QUICK.map(([v,l,tt,c])=>`<button type="button" class="ap-q ${c}" title="${tt} — aplica nas ${mg.rows.length} apostas deste mercado" onclick="setMarketResult(${PEND_MKS.push({ev:ev.key,mk:mg.key})-1},'${v}')">${l}</button>`).join('')}</div>
        </div>
        ${mg.rows.map(renderPendEventRow).join('')}
      </div>`;
  }).join('');
  return `
    <div class="pe-card ${closed?'pe-closed':''}">
      <div class="pe-head" onclick="togglePendEvent(${PEND_EVS.push(ev.key)-1})" role="button" tabindex="0">
        <span class="pe-chev">${closed?'▸':'▾'}</span>
        <div class="pe-title"><div class="pe-teams">${teams}</div><div class="pe-meta">${[pendEvDateLabel(ev.date), sport].filter(Boolean).join(' · ')}</div></div>
        <div class="pe-sum"><span><b>${ev.tickets.size}</b> aposta${ev.tickets.size===1?'':'s'}</span><span><b>${fmtBRL(ev.stake)}</b></span></div>
      </div>
      ${closed ? '' : `<div class="pe-body">${marketsHtml}</div>`}
    </div>`;
}
// índices de apoio (evitam colocar texto livre dentro do onclick)
let PEND_EVS = [], PEND_MKS = [];
function renderPendEventList(){
  PEND_EVS = []; PEND_MKS = [];
  const evs = pendEventGroups();
  if(!evs.length) return `<div class="card"><div class="empty-cta"><span>${PEND_SEARCH.trim() ? 'Nenhum evento encontrado nessa busca.' : 'Tudo conferido! Não há eventos com apostas pendentes.'}</span></div></div>`;
  return evs.map(renderPendEvent).join('');
}
function togglePendEvent(i){
  const key = PEND_EVS[i]; if(key==null) return;
  if(PEND_EV_CLOSED.has(key)) PEND_EV_CLOSED.delete(key); else PEND_EV_CLOSED.add(key);
  refreshPendList();
}
function setPendEvAll(open){
  if(open) PEND_EV_CLOSED.clear(); else pendEventGroups().forEach(ev=>PEND_EV_CLOSED.add(ev.key));
  refreshPendList();
}
// Marca o mesmo resultado em todas as apostas de um mercado do evento
async function setMarketResult(i, result){
  const ref = PEND_MKS[i]; if(!ref) return;
  const ev = pendEventGroups().find(e=>e.key===ref.ev);
  const mg = ev && ev.markets.find(x=>x.key===ref.mk);
  if(!mg) return;
  const label = {green:'GREEN',half_green:'½ GREEN',red:'RED',half_red:'½ RED',void:'ANULADA'}[result] || result;
  if(mg.rows.length>1 && !confirm(`Marcar ${label} em ${mg.rows.length} apostas?\n\n${ev.home}${ev.away?' x '+ev.away:''}\n${(MARKETS.find(x=>x.v===mg.market)?.l||mg.market)} · ${mg.selection}`)) return;
  const y = window.scrollY;
  const byTicket = new Map();
  mg.rows.forEach(r=>{ if(r.m.result==='pending'){ r.m.result = result; byTicket.set(r.t.id, r); } });
  const results = await Promise.all(Array.from(byTicket.keys()).map(async id=>({id, error: await apSaveMatches(id)})));
  const failed = results.filter(x=>x.error);
  if(failed.length){
    mg.rows.forEach(r=>{ if(failed.some(f=>f.id===r.t.id)) r.m.result = 'pending'; });
    showToast('Erro ao salvar '+failed.length+' aposta(s): '+failed[0].error.message, 'error');
  } else {
    showToast(mg.rows.length+' aposta'+(mg.rows.length===1?'':'s')+' marcada'+(mg.rows.length===1?'':'s')+' como '+label+'.', 'success');
  }
  render(); window.scrollTo(0, y);
}

function renderPendentesTab(){
  const evento = PEND_VIEW==='evento';
  const list = evento ? null : pendFiltered();
  return `
    <div class="ap-head">
      <div><h2 class="ap-title">Apostas pendentes</h2><div class="ap-sub">${evento ? 'Agrupadas por jogo: marque o resultado uma vez e vale para todas as apostas daquele mercado.' : 'Marque o resultado de cada seleção. Clique no cartão para ver o detalhe.'}</div></div>
      <button class="btn-primary btn-sm btn-buscar-res" onclick="buscarResultados()">🔄 Buscar resultados</button>
    </div>
    <div class="ap-kpis" id="pend-kpis">${evento ? pendEventKpis(pendEventGroups()) : pendKpis(list)}</div>
    <div class="ap-toolbar">
      <div class="ap-seg">
        <button class="ap-seg-b ${evento?'on':''}" onclick="setPendView('evento')">Por evento</button>
        <button class="ap-seg-b ${!evento?'on':''}" onclick="setPendView('aposta')">Por aposta</button>
      </div>
      <input type="text" id="pend-search-input" class="ap-search" placeholder="${evento?'Buscar por time, cliente ou nº':'Buscar por nº, cliente ou time'}" value="${evtEsc(PEND_SEARCH)}" oninput="updatePendSearch(this.value)">
      ${evento ? `
        <select id="pend-sort-select" class="ap-select" onchange="setPendEvSort(this.value)">
          ${[['antigos','Jogos mais antigos primeiro'],['apostas','Mais apostas'],['valor','Maior valor']].map(([v,l])=>`<option value="${v}" ${PEND_EV_SORT===v?'selected':''}>${l}</option>`).join('')}
        </select>
        <button class="btn-ghost btn-sm" onclick="setPendEvAll(false)">Recolher todos</button>
        <button class="btn-ghost btn-sm" onclick="setPendEvAll(true)">Expandir todos</button>` : `
        <select id="pend-sort-select" class="ap-select" onchange="setPendSort(this.value)">
          ${[['recentes','Mais recentes'],['antigas','Mais antigas'],['maior_valor','Maior valor'],['menor_valor','Menor valor']].map(([v,l])=>`<option value="${v}" ${PEND_SORT===v?'selected':''}>${l}</option>`).join('')}
        </select>`}
    </div>
    <div id="pend-list">${evento ? renderPendEventList() : renderPendList(list)}</div>
  `;
}
function renderPendList(list){
  return list.length===0 ? '<div class="card"><div class="empty">Nenhuma aposta pendente no momento.</div></div>' : list.map(t=>renderBetCard(t, {showEdit:true, showDuplicate:false, showDelete:false, showQuickResult:true, showAuthor:true})).join('');
}
function setPendView(v){ PEND_VIEW = v; render(); }
function setPendEvSort(v){ PEND_EV_SORT = v; refreshPendList(); }
function updatePendSearch(v){ PEND_SEARCH = v; refreshPendList(); }
function setPendSort(v){ PEND_SORT = v; refreshPendList(); }
function refreshPendList(){
  const a = document.getElementById('pend-kpis'), b = document.getElementById('pend-list');
  if(PEND_VIEW==='evento'){
    if(a) a.innerHTML = pendEventKpis(pendEventGroups());
    if(b) b.innerHTML = renderPendEventList();
  } else {
    const list = pendFiltered();
    if(a) a.innerHTML = pendKpis(list);
    if(b) b.innerHTML = renderPendList(list);
  }
}

// ---------- APOSTAS ----------
function computeFilteredTickets(){
  let list = [...STATE.tickets];
  if(TICKET_FILTER !== 'todas') list = list.filter(t=>ticketResult(t)===TICKET_FILTER);
  const searchEl = document.getElementById('ticket-search-input');
  const val = searchEl ? searchEl.value.trim() : '';
  if(val) list = list.filter(t=>apSearchMatch(t, val));
  return apSortList(list, TICKET_SORT);
}
function apostasKpis(list){
  const abertas = list.filter(t=>ticketResult(t)==='pending');
  const resolvidas = list.filter(t=>{ const r = ticketResult(t); return r!=='pending' && r!=='void'; });
  const volume = list.filter(t=>ticketResult(t)!=='void').reduce((s,t)=>s+t.stake,0);
  const res = resolvidas.reduce((s,t)=>s+ticketProfit(t),0);
  const greens = resolvidas.filter(t=>ticketResult(t)==='green').length;
  const taxa = resolvidas.length ? Math.round(greens/resolvidas.length*100)+'% de acerto' : '';
  return apKpi('Apostas', list.length, abertas.length+' em aberto')
    + apKpi('Valor apostado', fmtBRL(volume), '')
    + apKpi('Em aberto', fmtBRL(abertas.reduce((s,t)=>s+t.stake,0)), abertas.length+' aposta'+(abertas.length===1?'':'s'), 'gold')
    + apKpi('Resultado', (res>0?'+':'')+fmtBRL(res), taxa, res>=0?'green':'red');
}
function renderPaginationControls(totalItems){
  const totalPages = Math.max(1, Math.ceil(totalItems/TICKETS_PAGE_SIZE));
  if(TICKET_PAGE > totalPages) TICKET_PAGE = totalPages;
  if(totalPages<=1) return '';
  return `
    <div style="display:flex;justify-content:center;align-items:center;gap:10px;margin-top:14px">
      <button class="btn-ghost btn-sm" ${TICKET_PAGE<=1?'disabled':''} onclick="goToTicketPage(${TICKET_PAGE-1})">‹ Anterior</button>
      <span style="font-family:var(--font-mono);font-size:12px;color:var(--text-muted)">Página ${TICKET_PAGE} de ${totalPages}</span>
      <button class="btn-ghost btn-sm" ${TICKET_PAGE>=totalPages?'disabled':''} onclick="goToTicketPage(${TICKET_PAGE+1})">Próxima ›</button>
    </div>`;
}
function refreshTicketList(resetPage){
  if(resetPage) TICKET_PAGE = 1;
  const filtered = computeFilteredTickets();
  const start = (TICKET_PAGE-1)*TICKETS_PAGE_SIZE;
  const pageItems = filtered.slice(start, start+TICKETS_PAGE_SIZE);
  const container = document.getElementById('ticket-list-container');
  if(container) container.innerHTML = renderTicketListItems(pageItems);
  const countEl = document.getElementById('ticket-count-label');
  if(countEl) countEl.textContent = filtered.length + (filtered.length===1 ? ' aposta encontrada' : ' apostas encontradas');
  const pagContainer = document.getElementById('ticket-pagination-container');
  if(pagContainer) pagContainer.innerHTML = renderPaginationControls(filtered.length);
  const k = document.getElementById('ap-kpis'); if(k) k.innerHTML = apostasKpis(filtered);
}
function goToTicketPage(p){
  TICKET_PAGE = p;
  refreshTicketList(false);
  document.getElementById('ticket-list-container')?.scrollIntoView({behavior:'smooth', block:'start'});
}
function setTicketFilter(f){ TICKET_FILTER = f; TICKET_PAGE = 1; render(); }
function setTicketSort(s){ TICKET_SORT = s; TICKET_PAGE = 1; render(); }

function renderApostasTab(){
  if(ADMIN_SUBVIEW==='wizard') return renderWizard();
  const filtered = computeFilteredTickets();
  const start = (TICKET_PAGE-1)*TICKETS_PAGE_SIZE;
  const pageItems = filtered.slice(start, start+TICKETS_PAGE_SIZE);
  const counts = {todas: STATE.tickets.length};
  STATE.tickets.forEach(t=>{ const r = ticketResult(t); counts[r] = (counts[r]||0)+1; });
  const chips = [['todas','Todas'],['pending','Pendente'],['green','Green'],['red','Red'],['void','Anulada']];
  return `
    <div class="ap-head">
      <div><h2 class="ap-title">Apostas</h2><div class="ap-sub">Todas as apostas lançadas. Clique em um cartão para abrir o detalhe e marcar resultado.</div></div>
      <div class="ap-head-btns"><button class="btn-ghost btn-buscar-res" onclick="buscarResultados()">🔄 Buscar resultados</button><button class="btn-primary" onclick="startNewTicket()">+ Nova Aposta</button></div>
    </div>
    <div class="ap-kpis" id="ap-kpis">${apostasKpis(filtered)}</div>
    <div class="ap-toolbar">
      <input type="text" id="ticket-search-input" class="ap-search" placeholder="Buscar por nº, cliente ou time" oninput="updateTicketSearch()">
      <div class="ap-seg">
        ${chips.map(([v,l])=>`<button class="ap-seg-b ${TICKET_FILTER===v?'on':''}" onclick="setTicketFilter('${v}')">${l}<span>${counts[v]||0}</span></button>`).join('')}
      </div>
      <select id="ticket-sort-select" class="ap-select" onchange="setTicketSort(this.value)">
        <option value="recentes" ${TICKET_SORT==='recentes'?'selected':''}>Mais recentes</option>
        <option value="antigas" ${TICKET_SORT==='antigas'?'selected':''}>Mais antigas</option>
        <option value="maior_valor" ${TICKET_SORT==='maior_valor'?'selected':''}>Maior valor</option>
        <option value="menor_valor" ${TICKET_SORT==='menor_valor'?'selected':''}>Menor valor</option>
      </select>
    </div>
    <div class="ap-count"><span id="ticket-count-label">${filtered.length} ${filtered.length===1?'aposta encontrada':'apostas encontradas'}</span></div>
    <div id="ticket-list-container">${renderTicketListItems(pageItems)}</div>
    <div id="ticket-pagination-container">${renderPaginationControls(filtered.length)}</div>
  `;
}
function renderTicketListItems(list){
  return list.length===0 ? '<div class="card"><div class="empty">Nenhuma aposta encontrada.</div></div>' : list.map(renderTicketCard).join('');
}
function updateTicketSearch(){ refreshTicketList(true); }
function ticketDetailsShort(ticket){
  return ticket.matches.map(m=>{
    const marketLabel = MARKETS.find(x=>x.v===m.market)?.l || m.market;
    const teamsLabel = m.away ? `${m.home} x ${m.away}` : m.home;
    return `${teamsLabel} — ${marketLabel}: ${m.selection}`;
  }).join('; ');
}

// ---------- CARTÃO DE APOSTA (Apostas, Pendentes e Conferência) ----------
function toggleTicketDetails(ticketId){
  if(COLLAPSED_TICKETS.has(ticketId)) COLLAPSED_TICKETS.delete(ticketId); else COLLAPSED_TICKETS.add(ticketId);
  render();
}
function weekRangeShortLabel(weekStart){
  const d = new Date(weekStart+'T00:00:00');
  const sun = new Date(d); sun.setDate(d.getDate()+6);
  const f = x=>x.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
  return `${f(d)} a ${f(sun)}`;
}
function initialsBadge(name){
  const c = (name||'?').trim().charAt(0).toUpperCase();
  return c || '?';
}
function apLegClass(r){ return {green:'ok', half_green:'hok', red:'no', half_red:'hno', void:'vo'}[r] || 'pe'; }
// opts: {showEdit, showDuplicate, showDelete, showQuickResult, showAuthor, conferenciaAction, extraStats}
function renderBetCard(ticket, opts){
  opts = opts || {};
  const r = ticketResult(ticket), rd = ticketResultDetail(ticket);
  const profit = ticketProfit(ticket);
  const odds = ticketOddTotal(ticket)>0 ? effectiveOdds(ticket) : 0;
  const retornoMax = ticket.stake * odds;
  const pendentesNoTicket = ticket.matches.filter(m=>m.result==='pending').length;
  const expanded = !COLLAPSED_TICKETS.has(ticket.id);
  const id = ticket.id;

  const legsHtml = ticket.matches.map(m=>{
    const marketLabel = MARKETS.find(x=>x.v===m.market)?.l || m.market;
    const teams = m.away ? `${evtEsc(m.home)} <span class="bc-x">x</span> ${evtEsc(m.away)}` : evtEsc(m.home);
    const quick = (opts.showQuickResult && m.result==='pending') ? `<span class="bc-quick">${RES_QUICK.map(([v,l,t,c])=>`<button type="button" class="ap-q ${c}" title="${t}" onclick="setMatchResult('${id}','${m.id}','${v}')">${l}</button>`).join('')}</span>` : '';
    return `
      <div class="bc-leg bc-leg-${apLegClass(m.result)}">
        <span class="bc-leg-ic">${resultIconSmall(m.result)}</span>
        <div class="bc-leg-main">
          <div class="bc-leg-teams">${teams}</div>
          <div class="bc-leg-mkt">${evtEsc(marketLabel)} · <b>${evtEsc(ouToPt(m.selection))}</b></div>
        </div>
        ${quick}
        <div class="bc-leg-odd">@${Number(m.odd).toFixed(2)}</div>
      </div>`;
  }).join('');

  const showAuthor = opts.showAuthor && ticket.createdBy && STATE.profiles.length>0;
  const stat = (l,v,cls)=>`<div class="bc-stat"><span class="bc-stat-l">${l}</span><span class="bc-stat-v ${cls||''}">${v}</span></div>`;
  const extra = (showAuthor ? stat('Digitado por', evtEsc(authorName(ticket.createdBy))) : '')
    + ((opts.showAuthor && ticket.conferido) ? stat('Conferência','✓ Conferido','profit-pos') : '')
    + (opts.extraStats || '');

  return `
    <div class="bc bc-${r}">
      <div class="bc-top" onclick="abrirDetalheAposta('${id}')" title="Abrir detalhe">
        <div class="bc-id"><span class="bc-num">#${ticket.ticketNumber||'—'}</span><span class="bc-client">${evtEsc(apClientName(ticket))}</span></div>
        <div class="bc-top-r">
          ${resultChip(rd)}
          <div class="bc-icons" onclick="event.stopPropagation()">
            ${ticket.printPath ? `<button class="icon-btn" title="Ver print do bilhete" onclick="verPrint('${id}')">📎</button>` : ''}
            ${opts.showEdit!==false ? `<button class="icon-btn" title="Editar" onclick="editTicket('${id}')">✎</button>` : ''}
            ${opts.showDuplicate ? `<button class="icon-btn" title="Duplicar" onclick="duplicateTicket('${id}')">⧉</button>` : ''}
            ${opts.showDelete ? `<button class="icon-btn icon-danger" title="Excluir" onclick="deleteTicket('${id}')">🗑</button>` : ''}
            ${opts.conferenciaAction || ''}
          </div>
        </div>
      </div>
      <div class="bc-stats" onclick="abrirDetalheAposta('${id}')">
        ${stat('Data', fmtDate(ticket.date)+(ticket.time?' '+String(ticket.time).slice(0,5):''))}
        ${stat('Valor', fmtBRL(ticket.stake))}
        ${stat('Odds', odds>0?odds.toFixed(2):'—')}
        ${stat('Retorno máx.', fmtBRL(retornoMax), 'gold')}
        ${stat('Resultado', r==='pending'?'—':((profit>=0?'+':'')+fmtBRL(profit)), r==='pending'?'':(profit>=0?'profit-pos':'profit-neg'))}
        ${stat('A conferir', pendentesNoTicket ? '⏱ '+pendentesNoTicket : '—')}
        ${extra}
        <div class="bc-stat bc-toggle" onclick="event.stopPropagation();toggleTicketDetails('${id}')" title="${expanded?'Recolher':'Mostrar'} seleções"><span class="bc-stat-l">Seleções</span><span class="bc-stat-v">${ticket.matches.length} ${expanded?'⌃':'⌄'}</span></div>
      </div>
      ${expanded ? `<div class="bc-legs">${legsHtml}</div>` : ''}
    </div>`;
}
function renderTicketCard(ticket){
  return renderBetCard(ticket, {showEdit:true, showDuplicate:true, showDelete:true, showQuickResult:true, showAuthor:true});
}

// ---------- resultado por seleção ----------
async function apSaveMatches(ticketId, extraFields){
  const ticket = STATE.tickets.find(t=>t.id===ticketId);
  const fields = {matches: ticket.matches, ...(extraFields||{})};
  const {error} = await supabaseClient.from('tickets').update(fields).eq('id', ticketId);
  return error;
}
// pelos botões do cartão: só seleções ainda pendentes (para alterar um resultado já definido, abra o detalhe)
async function setMatchResult(ticketId, matchId, result){
  const ticket = STATE.tickets.find(t=>t.id===ticketId);
  const match = ticket && ticket.matches.find(m=>m.id===matchId);
  if(!match || match.result!=='pending'){ showToast('Esse resultado já foi definido. Para alterar, abra o detalhe da aposta.'); render(); return; }
  match.result = result;
  const y = window.scrollY;
  const error = await apSaveMatches(ticketId);
  if(error){ showToast('Erro ao salvar resultado: '+error.message); match.result='pending'; return; }
  render(); window.scrollTo(0, y); if(DETAIL_ID) renderDetalhe();
}
// pela janela de detalhe: pode trocar um resultado já definido (inclusive voltar para pendente)
async function setLegResult(ticketId, matchId, result){
  const ticket = STATE.tickets.find(t=>t.id===ticketId);
  const match = ticket && ticket.matches.find(m=>m.id===matchId);
  if(!match) return;
  const old = match.result;
  if(old===result) return;
  match.result = result;
  const error = await apSaveMatches(ticketId);
  if(error){ showToast('Erro ao salvar resultado: '+error.message); match.result = old; return; }
  render(); renderDetalhe();
}
function setDraftMatchResult(matchId, result){
  const m = DRAFT.matches.find(x=>x.id===matchId);
  if(m){ m.result = result; render(); }
}
async function deleteTicket(ticketId){
  if(!confirm('Excluir esta aposta?')) return;
  const {error} = await supabaseClient.from('tickets').delete().eq('id', ticketId);
  if(error){ showToast('Erro ao excluir aposta: '+error.message); return; }
  STATE.tickets = STATE.tickets.filter(t=>t.id!==ticketId);
  fecharDetalhe(); render();
}

// ---------- JANELA "DETALHE DA APOSTA" ----------
let DETAIL_MANUAL = 'green';          // ganhou | perdeu | anulada (liquidação manual)
function fecharDetalhe(){ DETAIL_ID = null; const o = document.getElementById('detail-overlay'); if(o) o.remove(); document.body.style.overflow=''; }
function abrirDetalheAposta(ticketId){
  const t = STATE.tickets.find(x=>x.id===ticketId); if(!t) return;
  DETAIL_ID = ticketId; DETAIL_MANUAL = 'green';
  let ov = document.getElementById('detail-overlay');
  if(!ov){
    ov = document.createElement('div'); ov.id = 'detail-overlay'; ov.className = 'dt-overlay';
    ov.onclick = (e)=>{ if(e.target===ov) fecharDetalhe(); };
    document.body.appendChild(ov);
  }
  document.body.style.overflow = 'hidden';
  renderDetalhe();
  if(t.printPath) apLoadDetailPrint(t);
}
async function apLoadDetailPrint(t){
  try{
    const {data, error} = await supabaseClient.storage.from(PRINT_BUCKET).createSignedUrl(t.printPath, 600);
    const el = document.getElementById('dt-print');
    if(!el || error || !data || !data.signedUrl) return;
    el.innerHTML = `<img src="${data.signedUrl}" alt="Print do bilhete" onclick="verPrint('${t.id}')" title="Clique para ampliar">`;
  }catch(e){}
}
function setDetailManual(v){ DETAIL_MANUAL = v; renderDetalhe(); }
function renderDetalhe(){
  const ov = document.getElementById('detail-overlay'); if(!ov) return;
  const t = STATE.tickets.find(x=>x.id===DETAIL_ID);
  if(!t){ fecharDetalhe(); return; }
  const r = ticketResult(t), rd = ticketResultDetail(t), profit = ticketProfit(t);
  const odds = ticketOddTotal(t)>0 ? effectiveOdds(t) : 0;
  const pot = t.stake*odds;
  const keepPaid = document.getElementById('dt-paid') ? document.getElementById('dt-paid').value : null;
  const tile = (l,v,cls,sub)=>`<div class="dt-tile"><div class="dt-tile-l">${l}</div><div class="dt-tile-v ${cls||''}">${v}</div>${sub?`<div class="dt-tile-s">${sub}</div>`:''}</div>`;
  const legs = t.matches.map(m=>{
    const marketLabel = MARKETS.find(x=>x.v===m.market)?.l || m.market;
    const teams = m.away ? `${evtEsc(m.home)} <span class="bc-x">x</span> ${evtEsc(m.away)}` : evtEsc(m.home);
    return `
      <div class="dt-leg">
        <div class="dt-leg-top">
          <div class="dt-leg-main">
            <div class="dt-leg-teams">${teams}</div>
            <div class="dt-leg-mkt">${evtEsc(marketLabel)} · <b>${evtEsc(ouToPt(m.selection))}</b></div>
            ${m.date ? `<div class="dt-leg-when">${fmtDate(m.date)}${m.time?' '+String(m.time).slice(0,5):''}</div>`:''}
          </div>
          <div class="dt-leg-r"><div class="dt-leg-odd">@ ${Number(m.odd).toFixed(2)}</div>${resultChip(m.result)}</div>
        </div>
        <div class="dt-mark"><span class="dt-mark-l">MARCAR</span>
          ${RES_BTNS.map(([v,l,c])=>`<button type="button" class="ap-q ap-q-lg ${c} ${m.result===v?'on':''}" onclick="setLegResult('${t.id}','${m.id}','${v}')">${l}</button>`).join('')}
        </div>
      </div>`;
  }).join('');
  const manualBtn = (v,l,c)=>`<button type="button" class="dt-man ${c} ${DETAIL_MANUAL===v?'on':''}" onclick="setDetailManual('${v}')">${l}</button>`;
  ov.innerHTML = `
    <div class="dt-modal" role="dialog" aria-modal="true">
      <div class="dt-head">
        <div class="dt-head-ic">📋</div>
        <div class="dt-head-t"><div class="dt-title">Detalhe da Aposta</div><div class="dt-ref">Aposta #${t.ticketNumber||'—'} · ${evtEsc(apClientName(t))}</div></div>
        ${resultChip(rd)}
        <button type="button" class="dt-x" aria-label="Fechar" onclick="fecharDetalhe()">✕</button>
      </div>
      <div class="dt-body">
        <div class="dt-tiles">
          ${tile('Cliente', evtEsc(apClientName(t)))}
          ${tile('Valor', fmtBRL(t.stake))}
          ${tile('Odds totais', odds>0?odds.toFixed(2):'—','gold')}
          ${tile('Retorno potencial', fmtBRL(pot),'green')}
          ${tile('Registrada em', apFmtDateTime(t.createdAt), '', 'Jogo: '+fmtDate(t.date)+(t.time?' '+String(t.time).slice(0,5):''))}
          ${tile('Resultado', r==='pending'?'—':((profit>=0?'+':'')+fmtBRL(profit)), r==='pending'?'':(profit>=0?'green':'red'))}
        </div>
        ${t.printPath ? `<div class="dt-sec">📷 Print do bilhete</div><div id="dt-print" class="dt-print"><span class="dt-muted">Carregando…</span></div>` : ''}
        <div class="dt-sec">Seleções <span class="dt-muted">(${t.matches.length})</span></div>
        ${legs}
        <div class="dt-acts">
          <button class="btn-ghost" onclick="fecharDetalhe();editTicket('${t.id}')">✎ Editar</button>
          <button class="btn-ghost" onclick="fecharDetalhe();duplicateTicket('${t.id}')">⧉ Duplicar</button>
          <button class="btn-ghost dt-danger" onclick="deleteTicket('${t.id}')">🗑 Excluir</button>
        </div>
        <div class="dt-sec">Liquidar a aposta inteira de uma vez</div>
        <div class="dt-manual">
          <div class="dt-man-row">${manualBtn('green','✅ Ganhou','dt-man-green')}${manualBtn('red','✕ Perdeu','dt-man-red')}${manualBtn('void','⊘ Anulada','dt-man-void')}</div>
          ${DETAIL_MANUAL==='green' ? `
            <label class="dt-lab">Valor pago ao cliente (R$)</label>
            <div class="dt-paid-row"><input type="text" inputmode="decimal" id="dt-paid" value="${keepPaid!==null ? evtEsc(keepPaid) : String(Math.round(pot*100)/100).replace('.',',')}"><button type="button" class="btn-ghost btn-sm" onclick="document.getElementById('dt-paid').value=String(Math.round(${pot}*100)/100).replace('.',',')">Usar pot.</button></div>
            <div class="dt-hint">Se o valor for diferente do retorno potencial (ex.: cash out), o sistema ajusta a odd da aposta para bater com o valor pago.</div>` : ''}
          <button type="button" class="btn-primary btn-full dt-confirm" onclick="liquidarManual('${t.id}')">Confirmar resultado</button>
        </div>
      </div>
    </div>`;
}
// Liquidação manual da aposta inteira: Ganhou (todas verdes; valor pago ajusta a odd), Perdeu ou Anulada
async function liquidarManual(ticketId){
  const t = STATE.tickets.find(x=>x.id===ticketId); if(!t) return;
  const before = t.matches.map(m=>m.result), beforeOdds = t.odds;
  let extra = null;
  if(DETAIL_MANUAL==='green'){
    const paid = parseNum((document.getElementById('dt-paid')||{}).value);
    t.matches.forEach(m=>{ if(m.result!=='void') m.result = 'green'; });
    if(t.matches.every(m=>m.result==='void')) t.matches.forEach(m=>m.result='green');
    const natural = t.matches.filter(m=>m.result!=='void').reduce((p,m)=>p*m.odd,1);
    if(paid>0 && t.stake>0 && Math.abs(paid - t.stake*natural) > 0.005){ t.odds = Math.round(paid/t.stake*10000)/10000; extra = {odds: t.odds}; }
  } else if(DETAIL_MANUAL==='red'){
    const pend = t.matches.filter(m=>m.result==='pending');
    if(pend.length) pend.forEach(m=>m.result='red'); else if(!t.matches.some(m=>m.result==='red')) t.matches[t.matches.length-1].result='red';
  } else {
    t.matches.forEach(m=>m.result='void');
  }
  const error = await apSaveMatches(ticketId, extra);
  if(error){ showToast('Erro ao salvar resultado: '+error.message); t.matches.forEach((m,i)=>m.result=before[i]); t.odds = beforeOdds; return; }
  showToast('Resultado registrado.');
  render(); renderDetalhe();
}
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && DETAIL_ID) fecharDetalhe(); });


// ---------- WIZARD (Nova Aposta) ----------
function startNewTicket(){
  DRAFT = {clientId:'', clientName:'', date:todaySP(), time:nowTimeSP(), stake:'', matches:[]};
  EDITING_TICKET_ID = null;
  ADMIN_SUBVIEW='wizard';
  render();
  refreshSelOptions();
  focusEl('new-client-search');
  evtPrefetch();
}
function editTicket(ticketId){
  const ticket = STATE.tickets.find(t=>t.id===ticketId);
  if(!ticket) return;
  const cl = STATE.clients.find(c=>c.id===ticket.clientId);
  DRAFT = {
    clientId: ticket.clientId, clientName: cl?cl.name:'', date: ticket.date, time: ticket.time||'',
    stake: String(ticket.stake), odds: ticket.odds!=null ? String(ticket.odds) : '',
    matches: ticket.matches.map(m=>({...m}))
  };
  EDITING_TICKET_ID = ticketId;
  ADMIN_TAB = 'apostas';
  ADMIN_SUBVIEW='wizard';
  render();
  refreshSelOptions();
  focusEl('match-event');
  evtPrefetch();
}
async function duplicateTicket(ticketId){
  const ticket = STATE.tickets.find(t=>t.id===ticketId);
  if(!ticket) return;
  const newMatches = ticket.matches.map(m=>({...m, id:uid(), result:'pending'}));
  const {data, error} = await supabaseClient.from('tickets').insert({
    client_id: ticket.clientId, date: ticket.date, time: ticket.time, stake: ticket.stake, odds: ticket.odds, matches: newMatches, created_by: currentUserId()
  }).select().single();
  if(error){ showToast('Erro ao duplicar aposta: '+error.message); return; }
  STATE.tickets.push({
    id:data.id, clientId:data.client_id, date:data.date, time: data.time ? data.time.slice(0,5) : null,
    stake:parseFloat(data.stake), odds: data.odds!=null ? parseFloat(data.odds) : null, matches:data.matches||[],
    createdAt: data.created_at, ticketNumber: data.ticket_number,
    createdBy: data.created_by||null, conferido:false, conferidoAt:null, conferidoBy:null
  });
  render();
}
function cancelWizard(){
  if(DRAFT.matches.length && !confirm('Descartar esta aposta em edição?')) return;
  DRAFT=null; EDITING_TICKET_ID=null; ADMIN_SUBVIEW='list'; render();
}
function parseNum(v){ const n = parseFloat(String(v==null?'':v).trim().replace(/\./g,function(m,o,str){ return /,/.test(str)?'':'.'; }).replace(',','.')); return n; }
function draftEffectiveOdds(){
  if(DRAFT.matches.some(m=>m.result==='void' || m.result==='half_green' || m.result==='half_red')) return draftMatchesOddTotal();
  return parseNum(DRAFT.odds) || draftMatchesOddTotal();
}
function draftMatchesOddTotal(){
  return DRAFT.matches.filter(m=>m.result!=='void').reduce((p,m)=>p*((m.result==='half_green'||m.result==='half_red') ? legFactor(m) : m.odd),1);
}
function updateWizardTotals(){
  const stake = parseNum(DRAFT.stake) || 0;
  const odds = draftEffectiveOdds();
  const display = document.getElementById('ticket-retorno-display');
  if(display) display.value = (stake>0 && odds>0) ? fmtBRL(stake*odds - stake) : '';
}

async function saveTicket(){
  const clientId = document.getElementById('new-client-id').value;
  const date = document.getElementById('ticket-date').value;
  const time = document.getElementById('ticket-time').value;
  const stake = parseNum(document.getElementById('ticket-stake').value);
  const oddsRaw = document.getElementById('ticket-odds').value;
  const odds = oddsRaw ? parseNum(oddsRaw) : null;
  if(!clientId){ showToast('Digite e selecione o cliente na lista.'); return; }
  if(!date || !time){ showToast('Informe a data e o horário do bilhete.'); return; }
  if(!stake || stake<=0){ showToast('Informe o valor da aposta.'); return; }
  if(odds!==null && isNaN(odds)){ showToast('Odd inválida.'); return; }
  if(!DRAFT.matches.length){ showToast('Adicione ao menos uma partida.'); return; }

  if(EDITING_TICKET_ID){
    const antes = STATE.tickets.find(t=>t.id===EDITING_TICKET_ID);       // para o robô aprender com a sua correção
    const {data, error} = await supabaseClient.from('tickets').update({
      client_id: clientId, date, time, stake, odds, matches: DRAFT.matches
    }).eq('id', EDITING_TICKET_ID).select().single();
    if(error){ showToast('Erro ao salvar aposta: '+error.message); return; }
    const idx = STATE.tickets.findIndex(t=>t.id===EDITING_TICKET_ID);
    const updated = {
      id:data.id, clientId:data.client_id, date:data.date, time: data.time ? data.time.slice(0,5) : null,
      stake:parseFloat(data.stake), odds: data.odds!=null ? parseFloat(data.odds) : null, matches:data.matches||[],
      createdAt: data.created_at, ticketNumber: data.ticket_number
    };
    if(idx>=0){ STATE.tickets[idx] = {...STATE.tickets[idx], ...updated}; }   // mantém print, conferência etc.
    else STATE.tickets.push(updated);
    if(typeof botCaptureCorrection==='function') botCaptureCorrection(antes, DRAFT.matches, stake, odds);
  } else {
    const {data, error} = await supabaseClient.from('tickets').insert({
      client_id: clientId, date, time, stake, odds, matches: DRAFT.matches, created_by: currentUserId()
    }).select().single();
    if(error){ showToast('Erro ao salvar aposta: '+error.message); return; }
    STATE.tickets.push({
      id:data.id, clientId:data.client_id, date:data.date, time: data.time ? data.time.slice(0,5) : null,
      stake:parseFloat(data.stake), odds: data.odds!=null ? parseFloat(data.odds) : null, matches:data.matches||[],
      createdAt: data.created_at, ticketNumber: data.ticket_number,
      createdBy: data.created_by||null, conferido:false, conferidoAt:null, conferidoBy:null
    });
  }
  DRAFT=null; EDITING_TICKET_ID=null; ADMIN_SUBVIEW='list';
  render();
}

function renderWizard(){
  const oddTotal = DRAFT.matches.reduce((p,m)=>p*m.odd,1);
  const sem = !!DRAFT.semEvento;
  const lucro = (parseNum(DRAFT.stake)>0 && draftEffectiveOdds()>0) ? fmtBRL(parseNum(DRAFT.stake)*draftEffectiveOdds()-parseNum(DRAFT.stake)) : '';

  const draftList = DRAFT.matches.map(m=>{
    const marketLabel = MARKETS.find(x=>x.v===m.market)?.l || m.market;
    const teamsLabel = m.away ? `${m.home} x ${m.away}` : m.home;
    return `
      <div class="draft-match" style="flex-direction:column;align-items:stretch;gap:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div>
            <strong>${teamsLabel}</strong> — ${marketLabel}: ${m.selection}
            <div style="color:var(--text-muted);font-family:var(--font-mono);font-size:11.5px">odd ${m.odd.toFixed(2)}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn-ghost btn-sm" tabindex="-1" onclick="editDraftMatch('${m.id}')">Editar</button>
            <button class="btn-ghost btn-sm" tabindex="-1" onclick="removeDraftMatch('${m.id}')">Remover</button>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          ${resultChip(m.result)}
          <button class="btn-ghost btn-sm" tabindex="-1" onclick="setDraftMatchResult('${m.id}','pending')">Pendente</button>
          <button class="btn-ghost btn-sm" tabindex="-1" onclick="setDraftMatchResult('${m.id}','green')">Green</button>
          <button class="btn-ghost btn-sm" tabindex="-1" onclick="setDraftMatchResult('${m.id}','half_green')">½ Green</button>
          <button class="btn-ghost btn-sm" tabindex="-1" onclick="setDraftMatchResult('${m.id}','red')">Red</button>
          <button class="btn-ghost btn-sm" tabindex="-1" onclick="setDraftMatchResult('${m.id}','half_red')">½ Red</button>
          <button class="btn-ghost btn-sm" tabindex="-1" onclick="setDraftMatchResult('${m.id}','void')">Anular</button>
        </div>
      </div>
    `;
  }).join('') || '<div class="empty">Nenhuma partida adicionada ainda.</div>';

  const chip = (label, market, sel, cls, focusSel)=>`<button type="button" tabindex="-1" class="nd-chip ${cls||''}" onclick="quickMarket('${market}','${sel}',${focusSel?'true':'false'})">${label}</button>`;
  const grp = (name, chips)=>`<div class="nd-grp"><span class="nd-grp-l">${name}</span>${chips}</div>`;

  return `
    <div class="card nd-ticket">
      <h3>${EDITING_TICKET_ID ? 'Editar Aposta' : 'Nova Aposta'}</h3>
      <div class="nd-top">
        <div class="nd-f-client">
          <label>Cliente</label>
          <div class="autocomplete-wrap">
            <input type="text" id="new-client-search" value="${DRAFT.clientName||''}" placeholder="Digite o nome do cliente…" autocomplete="off"
              oninput="filterClientOptions()" onfocus="filterClientOptions()" onkeydown="clientKeydown(event)"
              onblur="setTimeout(()=>{const b=document.getElementById('client-options'); if(b) b.style.display='none';},150)">
            <input type="hidden" id="new-client-id" value="${DRAFT.clientId||''}">
            <div id="client-options" class="autocomplete-list"></div>
          </div>
        </div>
        <div class="nd-f-stake"><label>Valor</label>
          <input type="text" inputmode="decimal" id="ticket-stake" value="${DRAFT.stake||''}" oninput="DRAFT.stake=this.value;updateWizardTotals()" onkeydown="if(event.key==='Enter'){event.preventDefault();focusEl('ticket-date');}" placeholder="0,00"></div>
        <div class="nd-f-small"><label>Data</label><input type="date" id="ticket-date" value="${DRAFT.date||''}" onchange="DRAFT.date=this.value" onkeydown="if(event.key==='Enter'||event.key==='Tab'){event.preventDefault();focusEl(event.shiftKey?'ticket-stake':'ticket-time');}"></div>
        <div class="nd-f-small"><label>Hora</label><input type="time" id="ticket-time" value="${DRAFT.time||''}" onchange="DRAFT.time=this.value" onkeydown="if(event.key==='Enter'||event.key==='Tab'){event.preventDefault();focusEl(event.shiftKey?'ticket-date':'ticket-odds');}"></div>
        <div class="nd-f-small"><label>Odds (opcional)</label><input type="text" inputmode="decimal" id="ticket-odds" value="${DRAFT.odds||''}" oninput="DRAFT.odds=this.value;updateWizardTotals()" onkeydown="if(event.key==='Enter'){event.preventDefault();focusEl(DRAFT.semEvento?'match-manual-desc':'match-event');}" placeholder="auto"></div>
        <div class="nd-f-small"><label>Lucro</label><input type="text" id="ticket-retorno-display" tabindex="-1" value="${lucro}" placeholder="—" disabled></div>
      </div>
    </div>

    <div class="card nd-card">
      <div class="nd-head">
        <div>
          <div class="nd-title">Novo Detalhe</div>
          <div class="nd-sub" id="nd-sub">${sem ? 'Aposta de longo prazo' : (DRAFT.eventText ? evtEsc(DRAFT.eventText) : 'Digite o jogo ou escolha na lista')}</div>
        </div>
      </div>
      <div class="nd-toggle-row">
        <span class="nd-tl">Com Evento</span>
        <label class="nd-switch"><input type="checkbox" id="match-sem-evento" tabindex="-1" ${sem?'checked':''} onchange="toggleEventoFields()"><span></span></label>
        <span class="nd-tl">Sem Evento (Longo Prazo)</span>
        <span class="nd-status" id="evt-status">${evtEsc(EVT_STATUS)}</span>
      </div>

      <div id="evento-fields" style="${sem?'display:none':''}">
        <label>Evento <span class="nd-hint">— digite “Time A x Time B” ou escolha na lista</span></label>
        <div class="autocomplete-wrap">
          <input type="text" id="match-event" value="${evtEsc(DRAFT.eventText||'')}" placeholder="Ex: Flamengo x Palmeiras" autocomplete="off"
            oninput="onEventInput()" onfocus="onEventInput()" onkeydown="eventKeydown(event)"
            onblur="setTimeout(()=>{const b=document.getElementById('event-options'); if(b) b.style.display='none';},150)">
          <div id="event-options" class="autocomplete-list"></div>
        </div>
      </div>
      <div id="sem-evento-fields" style="${sem?'':'display:none'}">
        <label>Descrição Manual</label>
        <input type="text" id="match-manual-desc" value="${evtEsc(DRAFT.manualDesc||'')}" placeholder="Ex: Campeão Brasileiro 2026 — Flamengo" onkeydown="if(event.key==='Enter'){event.preventDefault();focusEl('match-market');}">
      </div>

      <div class="nd-chips">
        ${grp('RF', chip('1','Resultado Final','Casa','c-green')+chip('X','Resultado Final','Empate','c-amber')+chip('2','Resultado Final','Fora','c-blue'))}
        ${grp('DP', chip('1X','Dupla Possibilidade','Casa ou Empate')+chip('X2','Dupla Possibilidade','Empate ou Fora')+chip('12','Dupla Possibilidade','Casa ou Fora'))}
        ${grp('GOL', chip('+','Total de Gols','Mais de 2.5','c-purple')+chip('-','Total de Gols','Menos de 2.5','c-purple')+chip('=','Total de Gols','Exato ','c-purple',true))}
        ${grp('GOL A', chip('Mais','Total de Gols - Asiático','Mais de ','c-purple',true)+chip('Menos','Total de Gols - Asiático','Menos de ','c-purple',true))}
        ${grp('AH', chip('AH1','Handicap - Asiático','Casa -1','c-cyan')+chip('AH2','Handicap - Asiático','Fora -1','c-cyan'))}
        ${grp('BTTS', chip('Sim','Ambas Marcam','Sim','c-green')+chip('Não','Ambas Marcam','Não','c-red'))}
        ${grp('OUTROS ESPORTES', chip('ML 1','Moneyline','Casa','c-green')+chip('ML 2','Moneyline','Fora','c-blue')+chip('HC 1','Handicap - Pontos','Casa ','c-cyan',true)+chip('HC 2','Handicap - Pontos','Fora ','c-cyan',true)+chip('PTS Over','Total de Pontos','Over ','c-purple',true)+chip('PTS Under','Total de Pontos','Under ','c-purple',true))}
        ${grp('1º TEMPO', chip('1','Resultado - HT','Casa','c-green')+chip('X','Resultado - HT','Empate','c-amber')+chip('2','Resultado - HT','Fora','c-blue')+chip('AH1','Handicap - Asiático - HT','Casa -1','c-cyan')+chip('AH2','Handicap - Asiático - HT','Fora -1','c-cyan')+chip('ESC +','Escanteios - 1º Tempo','Over ','c-purple',true)+chip('ESC -','Escanteios - 1º Tempo','Under ','c-purple',true))}
      </div>

      <div class="nd-fields">
        <div><label>Tipo</label>
          <div class="autocomplete-wrap">
            <input type="text" id="match-market" placeholder="Buscar tipo… (ex: empate sem aposta, dnb)" autocomplete="off" value="${evtEsc(DRAFT.marketText||'')}"
              oninput="onMarketInput()" onfocus="onMarketInput()" onkeydown="marketKeydown(event)"
              onblur="setTimeout(()=>{const b=document.getElementById('market-options'); if(b) b.style.display='none';},150)">
            <div id="market-options" class="autocomplete-list" style="max-height:260px"></div>
          </div></div>
        <div><label>Seleção</label>
          <input type="text" id="match-selection" placeholder="Ex: Casa, Mais de 2.5, Sim" autocomplete="off" value="${evtEsc(DRAFT.selectionText||'')}" onkeydown="if(event.key==='Enter'){event.preventDefault();focusEl('match-odd');}"></div>
        <div><label>Odds</label>
          <input type="text" inputmode="decimal" id="match-odd" placeholder="Odds (ex: 2,50 ou 2.50)" autocomplete="off" value="${DRAFT.oddText||''}" onkeydown="if(event.key==='Enter'){event.preventDefault();salvarDetalhe();}"></div>
      </div>

      <div class="nd-selopts"><span class="nd-grp-l">SELEÇÃO</span><div id="sel-options" class="nd-selopts-list"></div></div>

      <div class="nd-foot">
        <div class="nd-foot-l">
          <button class="btn-ghost" type="button" tabindex="-1" onclick="limparDetalhe()">Limpar</button>
          <button class="btn-ghost" type="button" tabindex="-1" onclick="cancelWizard()">Cancelar</button>
        </div>
        <div class="nd-foot-r">
          <button class="btn-primary nd-save" type="button" onclick="salvarDetalhe()">Salvar <kbd>Enter</kbd></button>
          <button class="btn-primary nd-save" type="button" onclick="salvarDetalheESair()">Salvar e sair</button>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>Partidas do bilhete</h3>
      ${draftList}
      ${DRAFT.matches.length>0 ? `<div style="margin-top:10px" class="odd-total">Soma das odds das partidas (informativo): ${oddTotal.toFixed(2)}</div>` : ''}
    </div>
  `;
}

function focusEl(id){
  const el = document.getElementById(id);
  if(el){ el.focus(); if(el.select && el.type!=='number') try{ el.select(); }catch(e){} }
}

// ----- cliente: Enter/Tab escolhem o primeiro resultado e seguem para o Valor -----
function clientKeydown(e){
  const box = document.getElementById('client-options');
  const hasList = box && box.style.display!=='none' && box.querySelector('.autocomplete-item[onmousedown]');
  if(e.key==='Enter' || (e.key==='Tab' && !e.shiftKey)){
    const idHolder = document.getElementById('new-client-id');
    if(idHolder && !idHolder.value && hasList){
      e.preventDefault();
      const active = box.querySelector('.autocomplete-active') || box.querySelector('.autocomplete-item[onmousedown]');
      active.dispatchEvent(new MouseEvent('mousedown', {bubbles:true}));
      focusEl('ticket-stake');
      return;
    }
    if(e.key==='Enter'){ e.preventDefault(); if(idHolder && idHolder.value) focusEl('ticket-stake'); }
    return;
  }
  handleAutocompleteKeydown(e, 'client-options');
}

// ----- evento: busca automática -----
function onEventInput(){
  const input = document.getElementById('match-event');
  const box = document.getElementById('event-options');
  if(!input || !box) return;
  DRAFT.eventText = input.value;
  const sub = document.getElementById('nd-sub');
  if(sub) sub.textContent = input.value.trim() || 'Digite o jogo ou escolha na lista';
  refreshSelOptions();
  EVT_SUGG = evtSuggest(input.value);
  if(!EVT_SUGG.length){ box.style.display='none'; box.innerHTML=''; return; }
  box.innerHTML = EVT_SUGG.map((s,i)=>`<div class="autocomplete-item" data-i="${i}" onmousedown="pickEventSuggestion(${i})">
      <div>${evtEsc(s.away ? s.home+' x '+s.away : s.home+' x …')}</div>${s.sub?`<div class="nd-opt-sub">${evtEsc(s.sub)}</div>`:''}</div>`).join('');
  box.style.display='block';
}
function pickEventSuggestion(i){
  const s = EVT_SUGG[i]; if(!s) return;
  const input = document.getElementById('match-event');
  const box = document.getElementById('event-options');
  if(box){ box.style.display='none'; }
  if(!s.away){            // só o primeiro time: continua digitando o adversário
    input.value = s.home+' x ';
    DRAFT.eventText = input.value;
    input.focus();
    setTimeout(onEventInput, 0);
    return;
  }
  input.value = s.home+' x '+s.away;
  DRAFT.eventText = input.value;
  const sub = document.getElementById('nd-sub');
  if(sub) sub.textContent = input.value+(s.sub && s.sub!=='já lançado antes' ? ' · '+s.sub : '');
  refreshSelOptions();
  focusEl('match-market');
}
function eventKeydown(e){
  const box = document.getElementById('event-options');
  const open = box && box.style.display!=='none' && box.querySelector('.autocomplete-item');
  if(e.key==='ArrowDown' || e.key==='ArrowUp' || e.key==='Escape'){ handleAutocompleteKeydown(e,'event-options'); return; }
  if(e.key==='Enter' || (e.key==='Tab' && !e.shiftKey)){
    const input = e.target;
    const p = evtParse(input.value);
    const active = open && box.querySelector('.autocomplete-active');
    if(active){ e.preventDefault(); active.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); return; }
    if(p.hasSep && p.away){               // texto completo digitado: segue
      if(box) box.style.display='none';
      if(e.key==='Enter'){ e.preventDefault(); focusEl('match-market'); }
      return;
    }
    if(open){                              // só um time digitado: aceita a 1ª sugestão
      e.preventDefault();
      box.querySelector('.autocomplete-item').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
      return;
    }
    if(e.key==='Enter') e.preventDefault();
  }
}

function toggleEventoFields(){
  const semEvento = document.getElementById('match-sem-evento').checked;
  DRAFT.semEvento = semEvento;
  document.getElementById('evento-fields').style.display = semEvento ? 'none' : 'block';
  document.getElementById('sem-evento-fields').style.display = semEvento ? 'block' : 'none';
  const sub = document.getElementById('nd-sub');
  if(sub) sub.textContent = semEvento ? 'Aposta de longo prazo' : (DRAFT.eventText || 'Digite o jogo ou escolha na lista');
  focusEl(semEvento ? 'match-manual-desc' : 'match-event');
}
function marketLabelOf(v){ const m = MARKETS.find(x=>x.v===v); return m ? m.l : v; }
function resolveMarket(text){
  const t = evtNorm(text);
  if(!t) return '';
  const exact = MARKETS.find(m=>evtNorm(m.l)===t || evtNorm(m.v)===t);
  if(exact) return exact.v;
  const part = MARKETS.filter(m=>m.v!=='Outro' && !m.hidden && (evtNorm(m.l).includes(t) || evtNorm(m.v).includes(t)));
  if(part.length===1) return part[0].v;
  return String(text).trim();   // texto livre
}
function quickMarket(market, selection, focusSel){
  document.getElementById('match-market').value = marketLabelOf(market);
  document.getElementById('match-selection').value = selection;
  refreshSelOptions();
  if(focusSel){
    const f = document.getElementById('match-selection');
    f.focus(); const n = f.value.length; try{ f.setSelectionRange(n,n); }catch(e){}
  } else focusEl('match-odd');
}

// Troca as palavras genéricas "Casa"/"Fora" da seleção pelo nome de fato digitado no time da
// casa/visitante (ex: "Empate ou Fora" com os times "Aldosivi" x "Atlético Tucumán" vira
// "Empate ou Atlético Tucumán"), evitando ficar genérico e tendo que editar isso na mão toda hora.
function autoFillSelectionTeamNames(selection, home, away){
  let out = selection;
  if(home) out = out.replace(/\bcasa\b/gi, home);
  if(away) out = out.replace(/\bfora\b/gi, away);
  return out;
}



// ----- campo Tipo: lista própria de mercados (digite para filtrar) -----
let MKT_SUGG = [];
// apelidos para achar o mercado digitando do jeito que se fala (dnb, 1t, btts, corners...)
const MKT_ALIASES = [
  [/Empate sem Aposta/, 'dnb draw no bet empate anula empate anulado'],
  [/Dupla/, 'dc double chance dupla chance 1x x2 12'],
  [/Ambos Marcam/, 'btts ambas marcam ambos marcam'],
  [/Resultado Final/, '1x2 resultado final vencedor'],
  [/Handicap/, 'hc ah handicap'],
  [/Asi/, 'asiatico asian'],
  [/HT|1º Tempo/, '1t 1o tempo primeiro tempo intervalo'],
  [/2o Tempo|2º Tempo/, '2t segundo tempo'],
  [/Escanteios|Corners/, 'escanteio corner corners'],
  [/Cart|Cards/, 'cartao cartoes card cards'],
  [/Finaliza/, 'chute chutes remates shots'],
  [/Total de Gols|Goals/, 'gols over under mais menos'],
  [/Moneyline/, 'ml vencedor'],
  [/Total de Pontos/, 'pontos over under'],
  [/Placar Exato/, 'resultado exato correct score']
];
function mktSearch(text){
  const toks = evtNorm(text).split(' ').filter(Boolean);
  return MARKETS.filter(m=>{
    if(m.v==='Outro' || m.hidden) return false;
    let hay = evtNorm(m.l)+' '+evtNorm(m.v);
    MKT_ALIASES.forEach(([re,al])=>{ if(re.test(m.l)) hay += ' '+evtNorm(al); });
    return toks.every(t=>hay.includes(t));
  });
}
function onMarketInput(){
  const input = document.getElementById('match-market'), box = document.getElementById('market-options');
  if(!input || !box) return;
  DRAFT.marketText = input.value;
  refreshSelOptions();
  const q = evtNorm(input.value);
  MKT_SUGG = mktSearch(input.value);
  if(!MKT_SUGG.length || (q && MARKETS.some(m=>evtNorm(m.l)===q))){ box.style.display='none'; box.innerHTML=''; return; }
  box.innerHTML = MKT_SUGG.map((m,i)=>`<div class="autocomplete-item" data-i="${i}" onmousedown="pickMarket(${i})">${evtEsc(m.l)}</div>`).join('');
  box.style.display='block';
}
function pickMarket(i){
  const m = MKT_SUGG[i]; if(!m) return;
  const input = document.getElementById('match-market'), box = document.getElementById('market-options');
  input.value = m.l; DRAFT.marketText = m.l;
  if(box){ box.style.display='none'; }
  refreshSelOptions();
  focusEl('match-selection');
}
function marketKeydown(e){
  const box = document.getElementById('market-options');
  const open = box && box.style.display!=='none' && box.querySelector('.autocomplete-item');
  if(e.key==='ArrowDown' || e.key==='ArrowUp' || e.key==='Escape'){ handleAutocompleteKeydown(e,'market-options'); return; }
  if(e.key==='Enter' || (e.key==='Tab' && !e.shiftKey)){
    if(open){
      const active = box.querySelector('.autocomplete-active') || box.querySelector('.autocomplete-item');
      const typedExact = MARKETS.some(m=>evtNorm(m.l)===evtNorm(e.target.value));
      if(box.querySelector('.autocomplete-active') || !typedExact){ e.preventDefault(); active.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); return; }
    }
    if(e.key==='Enter'){ e.preventDefault(); focusEl('match-selection'); }
  }
}

// ----- opções de seleção com o nome dos times (conforme o tipo do mercado) -----
let SEL_OPTS = [];
function marketKindOfText(text){
  const v = resolveMarket(text);
  const m = MARKETS.find(x=>x.v===v);
  return m ? (m.k||'') : '';
}
function eventTeamsNow(){
  const ev = document.getElementById('match-event');
  const p = ev ? evtParse(ev.value) : {home:'',away:''};
  return {home: p.home || 'Casa', away: p.away || 'Fora'};
}
function selectionOptions(kind, home, away){
  const o = (t, line)=>({t, line: !!line});
  const R = [home, 'Empate', away];
  switch(kind){
    case '1x2': return R.map(t=>o(t));
    case 'dc': return [o(home+' ou Empate'), o('Empate ou '+away), o(home+' ou '+away)];
    case 'ml': case 'team': return [o(home), o(away)];
    case 'yn': return [o('Sim'), o('Não')];
    case 'ou': return [o('Mais de ',true), o('Menos de ',true)];
    case 'hcp': return [o(home+' ',true), o(away+' ',true)];
    case 'hcp3': return R.map(t=>o(t+' ',true));
    case 'htft': { const out=[]; R.forEach(a=>R.forEach(b=>out.push(o(a+' / '+b)))); return out; }
    case 'score': return ['1-0','2-0','2-1','3-0','3-1','3-2','0-0','1-1','2-2','3-3','0-1','0-2','1-2','0-3','1-3','2-3'].map(t=>o(t));
    case 'rbtts': { const out=[]; R.forEach(r=>['Sim','Não'].forEach(b=>out.push(o(r+' e '+b)))); return out; }
    case 'rbttsg': { const out=[]; R.forEach(r=>['Sim','Não'].forEach(b=>['Mais de','Menos de'].forEach(g=>out.push(o(r+' e '+b+' e '+g+' ',true))))); return out; }
    case 'rou': { const out=[]; R.forEach(r=>['Mais de','Menos de'].forEach(g=>out.push(o(r+' e '+g+' ',true)))); return out; }
    case 'oubtts': { const out=[]; ['Mais','Menos'].forEach(g=>['Sim','Não'].forEach(b=>out.push(o(g+' e '+b+' ',true)))); return out; }
  }
  return [];
}
function refreshSelOptions(){
  const box = document.getElementById('sel-options');
  if(!box) return;
  const mk = document.getElementById('match-market');
  const kind = mk ? marketKindOfText(mk.value) : '';
  const t = eventTeamsNow();
  SEL_OPTS = kind ? selectionOptions(kind, t.home, t.away) : [];
  box.innerHTML = SEL_OPTS.length
    ? SEL_OPTS.map((x,i)=>`<button type="button" tabindex="-1" class="nd-chip" onclick="pickSelection(${i})">${evtEsc(x.t.trim())}${x.line?' …':''}</button>`).join('')
    : '<span class="nd-hint">Escolha o Tipo para ver as opções com o nome dos times.</span>';
}
function pickSelection(i){
  const o = SEL_OPTS[i]; if(!o) return;
  const f = document.getElementById('match-selection');
  f.value = o.t;
  if(o.line){ f.focus(); try{ f.setSelectionRange(f.value.length, f.value.length); }catch(e){} }
  else focusEl('match-odd');
}
// atalhos de digitação: 1 / x / 2, 1x / x2 / 12, s / n, o 2.5 / u 2.5
function normalizeSelection(kind, text, home, away){
  const raw = String(text).trim(); const t = raw.toLowerCase();
  const rx = (re)=>raw.match(re);
  if(kind==='1x2' || kind==='hcp3'){
    const m = rx(/^([1x2])(?:\s+(.*))?$/i); if(m){ const n = m[1].toLowerCase()==='1'?home:(m[1].toLowerCase()==='2'?away:'Empate'); return n+(m[2]?' '+m[2]:''); }
  }
  if(kind==='dc'){ if(t==='1x') return home+' ou Empate'; if(t==='x2') return 'Empate ou '+away; if(t==='12') return home+' ou '+away; }
  if(kind==='ml' || kind==='team'){ if(t==='1') return home; if(t==='2') return away; }
  if(kind==='hcp'){ const m = rx(/^([12])(?:\s+(.*))?$/); if(m) return (m[1]==='1'?home:away)+(m[2]?' '+m[2]:''); }
  if(kind==='yn'){ if(/^(s|sim|y|yes)$/.test(t)) return 'Sim'; if(/^(n|nao|não|no)$/.test(t)) return 'Não'; }
  if(kind==='ou'){
    const m = rx(/^(over|mais|o|\+)(?:\s+de)?\s*(.*)$/i); if(m) return 'Mais de '+m[2].trim();
    const u = rx(/^(under|menos|u|-)(?:\s+de)?\s*(.*)$/i); if(u) return 'Menos de '+u[2].trim();
  }
  return raw;
}

function limparDetalhe(){
  DRAFT.eventText=''; DRAFT.manualDesc=''; DRAFT.marketText=''; DRAFT.selectionText=''; DRAFT.oddText='';
  ['match-event','match-manual-desc','match-market','match-selection','match-odd'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  const sub = document.getElementById('nd-sub'); if(sub) sub.textContent = DRAFT.semEvento ? 'Aposta de longo prazo' : 'Digite o jogo ou escolha na lista';
  const box = document.getElementById('event-options'); if(box) box.style.display='none';
  refreshSelOptions();
  focusEl(DRAFT.semEvento ? 'match-manual-desc' : 'match-event');
}

// Lê os campos do detalhe e inclui no bilhete. Retorna true se incluiu.
function addDraftMatch(opts){
  opts = opts || {};
  const semEvento = document.getElementById('match-sem-evento').checked;
  const marketText = document.getElementById('match-market').value;
  let selection = document.getElementById('match-selection').value.trim();
  const oddRaw = document.getElementById('match-odd').value;
  const odd = parseNum(oddRaw);

  let home, away;
  if(semEvento){
    const desc = document.getElementById('match-manual-desc').value.trim();
    if(!desc){ showToast('Informe a descrição da aposta de longo prazo.'); focusEl('match-manual-desc'); return false; }
    home = desc; away = '';
  } else {
    const p = evtParse(document.getElementById('match-event').value);
    if(!p.home || !p.away){ showToast('Digite os dois times (ex: Flamengo x Palmeiras) ou escolha na lista.'); focusEl('match-event'); return false; }
    home = p.home; away = p.away;
  }
  const market = resolveMarket(marketText);
  if(!market){ showToast('Informe o tipo da aposta (ex: Resultado Final).'); focusEl('match-market'); return false; }
  if(!selection){ showToast('Informe a seleção (ex: Casa, Mais de 2.5, Sim).'); focusEl('match-selection'); return false; }
  if(isNaN(odd) || odd<=0){ showToast('Informe a odd da seleção.'); focusEl('match-odd'); return false; }
  selection = normalizeSelection(marketKindOfText(marketText), selection, semEvento ? 'Casa' : home, semEvento ? 'Fora' : away);
  if(!semEvento) selection = autoFillSelectionTeamNames(selection, home, away);

  const leg = {id:uid(), home, away, date: DRAFT.date || todaySP(), time: DRAFT.time || null, market, selection, odd, result:'pending'};
  const ref = (!semEvento && evtFindRef(home, away)) || (DRAFT.editRef && DRAFT.editRefTeams===evtNorm(home)+'|'+evtNorm(away) ? DRAFT.editRef : null);
  if(ref) leg.ref = ref;
  DRAFT.editRef = null; DRAFT.editRefTeams = null;
  DRAFT.matches.push(leg);
  DRAFT.eventText=''; DRAFT.manualDesc=''; DRAFT.marketText=''; DRAFT.selectionText=''; DRAFT.oddText='';
  if(!opts.noRender){ render(); refreshSelOptions(); focusEl(semEvento ? 'match-manual-desc' : 'match-event'); }
  return true;
}
function salvarDetalhe(){ addDraftMatch(); }
async function salvarDetalheESair(){
  const filled = ['match-event','match-manual-desc','match-selection','match-odd'].some(id=>{ const el=document.getElementById(id); return el && el.offsetParent!==null && el.value.trim(); });
  if(filled){ if(!addDraftMatch({noRender:true})) return; }
  await saveTicket();
}
function removeDraftMatch(matchId){
  DRAFT.matches = DRAFT.matches.filter(m=>m.id!==matchId);
  render();
}
function editDraftMatch(matchId){
  const idx = DRAFT.matches.findIndex(m=>m.id===matchId);
  if(idx<0) return;
  const m = DRAFT.matches[idx];
  DRAFT.matches.splice(idx,1);
  DRAFT.editRef = m.ref || null; DRAFT.editRefTeams = evtNorm(m.home)+'|'+evtNorm(m.away);
  const semEvento = !m.away;
  DRAFT.semEvento = semEvento;
  DRAFT.eventText = semEvento ? '' : m.home+' x '+m.away;
  DRAFT.manualDesc = semEvento ? m.home : '';
  DRAFT.marketText = marketLabelOf(m.market);
  DRAFT.selectionText = m.selection;
  DRAFT.oddText = String(m.odd);
  render();
  refreshSelOptions();
  focusEl('match-odd');
}

// ---------- CLIENTES TAB ----------
