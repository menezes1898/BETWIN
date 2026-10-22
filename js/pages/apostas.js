function renderPendentesTab(){
  const pendentes = STATE.tickets.filter(t=>ticketResult(t)==='pending').sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  const pendentesValor = pendentes.reduce((s,t)=>s+t.stake,0);
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h3 style="margin:0">Apostas pendentes</h3>
        <span style="display:flex;align-items:center;gap:12px"><button class="btn-primary btn-sm btn-buscar-res" onclick="buscarResultados()">🔄 Buscar resultados</button><span style="font-family:var(--font-mono);font-size:14px;color:var(--gold)">${fmtBRL(pendentesValor)}</span></span>
      </div>
      <p style="font-size:12.5px;color:var(--text-muted);margin:10px 0 0">Consulta a API pelos jogos já encerrados e marca Green, Red ou Anulada nas partidas que tiverem resultado seguro. O que não der fica pendente, com o motivo no relatório.</p>
    </div>
    <div class="card">
      ${pendentes.length===0 ? '<div class="empty">Nenhuma aposta pendente no momento.</div>' : pendentes.map(renderTicketCard).join('')}
    </div>
  `;
}

// ---------- APOSTAS TAB ----------
const TICKETS_PAGE_SIZE = 15;

function computeFilteredTickets(){
  let list = [...STATE.tickets];
  if(TICKET_FILTER !== 'todas') list = list.filter(t=>ticketResult(t)===TICKET_FILTER);
  const searchEl = document.getElementById('ticket-search-input');
  const val = searchEl ? searchEl.value.trim().toLowerCase() : '';
  if(val){
    list = list.filter(t=>{
      const cl = STATE.clients.find(c=>c.id===t.clientId);
      const clientName = cl ? cl.name.toLowerCase() : '';
      const num = String(t.ticketNumber||'');
      return num.includes(val) || clientName.includes(val);
    });
  }
  if(TICKET_SORT==='recentes') list.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  else if(TICKET_SORT==='antigas') list.sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));
  else if(TICKET_SORT==='maior_valor') list.sort((a,b)=>b.stake-a.stake);
  else if(TICKET_SORT==='menor_valor') list.sort((a,b)=>a.stake-b.stake);
  return list;
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
    </div>
  `;
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
}
function goToTicketPage(p){
  TICKET_PAGE = p;
  refreshTicketList(false);
  document.getElementById('ticket-list-container')?.scrollIntoView({behavior:'smooth', block:'start'});
}
function setTicketFilter(f){
  TICKET_FILTER = f;
  TICKET_PAGE = 1;
  render();
}
function setTicketSort(s){
  TICKET_SORT = s;
  TICKET_PAGE = 1;
  render();
}

function renderApostasTab(){
  if(ADMIN_SUBVIEW==='wizard') return renderWizard();

  const pendentes = STATE.tickets.filter(t=>ticketResult(t)==='pending');
  const pendentesValor = pendentes.reduce((s,t)=>s+t.stake,0);

  const filtered = computeFilteredTickets();
  const start = (TICKET_PAGE-1)*TICKETS_PAGE_SIZE;
  const pageItems = filtered.slice(start, start+TICKETS_PAGE_SIZE);

  const filterChips = [
    ['todas','Todas'], ['green','Green'], ['red','Red'], ['pending','Pendente'], ['void','Anulada']
  ];

  return `
    <div style="display:flex;gap:10px"><button class="btn-primary btn-full" onclick="startNewTicket()">+ Nova Aposta</button><button class="btn-ghost btn-buscar-res" style="white-space:nowrap" onclick="buscarResultados()">🔄 Buscar resultados</button></div>
    <div style="height:16px"></div>
    <div class="card" style="cursor:pointer" onclick="SHOW_PENDENTES=!SHOW_PENDENTES;render()">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="chip chip-pending">PENDENTES (${pendentes.length})</span>
        <span style="font-family:var(--font-mono);font-size:14px;color:var(--gold)">${fmtBRL(pendentesValor)}</span>
      </div>
      ${SHOW_PENDENTES ? (pendentes.length===0 ? '<div class="empty">Nenhuma aposta pendente.</div>' : `
        <div style="margin-top:12px;border-top:1px solid var(--line)">
          ${pendentes.map(t=>{
            const cl = STATE.clients.find(c=>c.id===t.clientId);
            return `
              <div class="match-row">
                <div class="match-desc">
                  <span class="teams">${cl?cl.name:'Cliente removido'}</span>
                  <span class="meta">${fmtDate(t.date)}${t.time?' '+t.time:''} · ${ticketDetailsShort(t)}</span>
                </div>
                <span style="font-family:var(--font-mono);font-size:13px">${fmtBRL(t.stake)}</span>
              </div>
            `;
          }).join('')}
        </div>
      `) : ''}
    </div>
    <div style="height:16px"></div>
    <div class="card">
      <label>Buscar aposta (nº ou nome do cliente)</label>
      <input type="text" id="ticket-search-input" placeholder="Ex: 42 ou nome do cliente" oninput="updateTicketSearch()">
      <label>Filtrar por resultado</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${filterChips.map(([val,label])=>`
          <button class="btn-ghost btn-sm" style="${TICKET_FILTER===val?'background:var(--gold-soft);color:var(--gold);border-color:var(--gold-dim)':''}" onclick="setTicketFilter('${val}')">${label}</button>
        `).join('')}
      </div>
      <label>Ordenar por</label>
      <select id="ticket-sort-select" onchange="setTicketSort(this.value)">
        <option value="recentes" ${TICKET_SORT==='recentes'?'selected':''}>Mais recentes</option>
        <option value="antigas" ${TICKET_SORT==='antigas'?'selected':''}>Mais antigas</option>
        <option value="maior_valor" ${TICKET_SORT==='maior_valor'?'selected':''}>Maior valor</option>
        <option value="menor_valor" ${TICKET_SORT==='menor_valor'?'selected':''}>Menor valor</option>
      </select>
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <h3 style="margin:0">Apostas cadastradas</h3>
        <span id="ticket-count-label" style="font-size:12px;color:var(--text-muted)">${filtered.length} ${filtered.length===1?'aposta encontrada':'apostas encontradas'}</span>
      </div>
      <div id="ticket-list-container">${renderTicketListItems(pageItems)}</div>
      <div id="ticket-pagination-container">${renderPaginationControls(filtered.length)}</div>
    </div>
  `;
}
function renderTicketListItems(list){
  return list.length===0 ? '<div class="empty">Nenhuma aposta encontrada.</div>' : list.map(renderTicketCard).join('');
}
function updateTicketSearch(){
  refreshTicketList(true);
}
function ticketDetailsShort(ticket){
  return ticket.matches.map(m=>{
    const marketLabel = MARKETS.find(x=>x.v===m.market)?.l || m.market;
    const teamsLabel = m.away ? `${m.home} x ${m.away}` : m.home;
    return `${teamsLabel} — ${marketLabel}: ${m.selection}`;
  }).join('; ');
}

// ---------- CARD DE APOSTA (layout em linha, usado em Apostas/Pendentes e Conferência) ----------
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
// opts: {showEdit, showDuplicate, showDelete, showQuickResult, showAuthor, conferenciaAction}
function renderBetCard(ticket, opts){
  opts = opts || {};
  const cl = STATE.clients.find(c=>c.id===ticket.clientId);
  const r = ticketResult(ticket);
  const profit = ticketProfit(ticket);
  const odds = ticketOddTotal(ticket)>0 ? effectiveOdds(ticket) : 0;
  const retornoMax = ticket.stake * odds;
  const pendentesNoTicket = ticket.matches.filter(m=>m.result==='pending').length;
  const weekStart = mondayOf(ticketDate(ticket));
  const expanded = !COLLAPSED_TICKETS.has(ticket.id); // aberto por padrão, pra ver jogo/mercado sem precisar clicar

  const matchesHtml = ticket.matches.map(m=>{
    const marketLabel = MARKETS.find(x=>x.v===m.market)?.l || m.market;
    return `
      <div class="bet-match-row">
        <div class="bet-match-teams">
          <div class="bet-match-team"><span class="side-badge side-home">${initialsBadge(m.home)}</span>${m.home}</div>
          ${m.away ? `<div class="bet-match-team"><span class="side-badge side-away">${initialsBadge(m.away)}</span>${m.away}</div>` : ''}
        </div>
        <div class="bet-match-market">
          ${resultIconSmall(m.result)} ${marketLabel} · ${m.selection}
          ${(opts.showQuickResult && m.result==='pending') ? `
            <span style="margin-left:8px;display:inline-flex;gap:4px;vertical-align:middle">
              <button class="btn-ghost btn-sm" onclick="setMatchResult('${ticket.id}','${m.id}','green')">Green</button>
              <button class="btn-ghost btn-sm" onclick="setMatchResult('${ticket.id}','${m.id}','red')">Red</button>
              <button class="btn-ghost btn-sm" onclick="setMatchResult('${ticket.id}','${m.id}','void')">Anular</button>
            </span>
          ` : ''}
        </div>
        <div class="bet-match-odd">@${m.odd.toFixed(2)}</div>
      </div>
    `;
  }).join('');

  const showAuthor = opts.showAuthor && ticket.createdBy && STATE.profiles.length>0;
  const authorStat = showAuthor ? `<div class="bet-stat"><span class="bet-stat-label">Digitado por</span><span class="bet-stat-value">${authorName(ticket.createdBy)}</span></div>` : '';
  const conferidoStat = (opts.showAuthor && ticket.conferido) ? `<div class="bet-stat"><span class="bet-stat-label">Conferência</span><span class="bet-stat-value" style="color:var(--green)">✓ Conferido</span></div>` : '';

  return `
    <div class="bet-card">
      <div class="bet-card-top">
        <div class="bet-card-title">
          <span class="bet-number">#${ticket.ticketNumber||'—'}</span>
          <span class="bet-client">${cl?cl.name:'Cliente removido'}</span>
        </div>
        <div class="bet-card-icons">
          ${ticket.printPath ? `<button class="icon-btn" title="Ver print do bilhete" onclick="verPrint('${ticket.id}')">📎</button>` : ''}
          ${opts.showEdit!==false ? `<button class="icon-btn" title="Editar" onclick="editTicket('${ticket.id}')">✎</button>` : ''}
          ${opts.showDuplicate ? `<button class="icon-btn" title="Duplicar" onclick="duplicateTicket('${ticket.id}')">⧉</button>` : ''}
          ${opts.showDelete ? `<button class="icon-btn icon-danger" title="Excluir" onclick="deleteTicket('${ticket.id}')">🗑</button>` : ''}
          ${opts.conferenciaAction || ''}
        </div>
      </div>
      <div class="bet-stats-row">
        <div class="bet-stat"><span class="bet-stat-label">Data</span><span class="bet-stat-value">${fmtDate(ticket.date)}${ticket.time?' '+ticket.time:''}</span></div>
        <div class="bet-stat"><span class="bet-stat-label">Semana</span><span class="bet-stat-value">${weekRangeShortLabel(weekStart)}</span></div>
        <div class="bet-stat bet-stat-toggle" onclick="toggleTicketDetails('${ticket.id}')" title="${expanded?'Recolher':'Ver'} partidas do bilhete"><span class="bet-stat-label">Detalhes</span><span class="bet-stat-value">☰ ${ticket.matches.length} ${expanded?'⌃':'⌄'}</span></div>
        <div class="bet-stat"><span class="bet-stat-label">Conf.</span><span class="bet-stat-value">⏱ ${pendentesNoTicket}</span></div>
        <div class="bet-stat"><span class="bet-stat-label">Valor</span><span class="bet-stat-value">${fmtBRL(ticket.stake)}</span></div>
        <div class="bet-stat"><span class="bet-stat-label">Odds</span><span class="bet-stat-value">${odds>0?odds.toFixed(2):'—'}</span></div>
        <div class="bet-stat"><span class="bet-stat-label">Retorno Máx.</span><span class="bet-stat-value" style="color:var(--gold)">${fmtBRL(retornoMax)}</span></div>
        <div class="bet-stat"><span class="bet-stat-label">Resultado</span><span class="bet-stat-value ${r==='pending'?'':(profit>=0?'profit-pos':'profit-neg')}">${r==='pending'?'—':fmtBRL(profit)}</span></div>
        <div class="bet-stat"><span class="bet-stat-label">Status</span>${resultChip(r)}</div>
        ${authorStat}
        ${conferidoStat}
        ${opts.extraStats || ''}
      </div>
      ${expanded ? `<div class="bet-matches">${matchesHtml}</div>` : ''}
    </div>
  `;
}
function renderTicketCard(ticket){
  return renderBetCard(ticket, {showEdit:true, showDuplicate:true, showDelete:true, showQuickResult:true, showAuthor:true});
}

async function setMatchResult(ticketId, matchId, result){
  const ticket = STATE.tickets.find(t=>t.id===ticketId);
  const match = ticket.matches.find(m=>m.id===matchId);
  if(!match || match.result!=='pending'){ showToast('Esse resultado já foi definido. Para alterar, use Editar aposta.'); render(); return; }
  match.result = result;
  const {error} = await supabaseClient.from('tickets').update({matches: ticket.matches}).eq('id', ticketId);
  if(error){ showToast('Erro ao salvar resultado: '+error.message); match.result='pending'; return; }
  render();
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
  render();
}

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
  if(DRAFT.matches.some(m=>m.result==='void')) return draftMatchesOddTotal();
  return parseNum(DRAFT.odds) || draftMatchesOddTotal();
}
function draftMatchesOddTotal(){
  return DRAFT.matches.filter(m=>m.result!=='void').reduce((p,m)=>p*m.odd,1);
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
          <button class="btn-ghost btn-sm" tabindex="-1" onclick="setDraftMatchResult('${m.id}','red')">Red</button>
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
