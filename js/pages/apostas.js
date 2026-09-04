function renderPendentesTab(){
  const pendentes = STATE.tickets.filter(t=>ticketResult(t)==='pending').sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  const pendentesValor = pendentes.reduce((s,t)=>s+t.stake,0);
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h3 style="margin:0">Apostas pendentes</h3>
        <span style="font-family:var(--font-mono);font-size:14px;color:var(--gold)">${fmtBRL(pendentesValor)}</span>
      </div>
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
    <button class="btn-primary btn-full" onclick="startNewTicket()">+ Nova Aposta</button>
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

function renderTicketCard(ticket){
  const cl = STATE.clients.find(c=>c.id===ticket.clientId);
  const r = ticketResult(ticket);
  const profit = ticketProfit(ticket);
  const matchesHtml = ticket.matches.map(m=>{
    const marketLabel = MARKETS.find(x=>x.v===m.market)?.l || m.market;
    const teamsLabel = m.away ? `${m.home} x ${m.away}` : m.home;
    return `
      <div class="match-row">
        <div class="match-desc">
          <span class="teams">${teamsLabel}</span>
          <span class="meta">${marketLabel}: ${m.selection} · odd ${m.odd.toFixed(2)}</span>
        </div>
        <div class="match-actions">
          ${resultChip(m.result)}
          ${m.result==='pending' ? `
            <button class="btn-ghost btn-sm" onclick="setMatchResult('${ticket.id}','${m.id}','green')">Green</button>
            <button class="btn-ghost btn-sm" onclick="setMatchResult('${ticket.id}','${m.id}','red')">Red</button>
            <button class="btn-ghost btn-sm" onclick="setMatchResult('${ticket.id}','${m.id}','void')">Anular</button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="ticket ticket-compact">
      <div class="ticket-top">
        <div>
          <div class="ticket-client"><span style="font-family:var(--font-mono);font-weight:400;font-size:11px;color:var(--text-muted)">#${ticket.ticketNumber||'—'}</span> ${cl?cl.name:'Cliente removido'}</div>
          <div class="ticket-meta">${fmtDate(ticket.date)}${ticket.time?' '+ticket.time:''} · stake ${fmtBRL(ticket.stake)} · odd ${ticketOddTotal(ticket)>0?effectiveOdds(ticket).toFixed(2):'—'}</div>
        </div>
        ${resultChip(r)}
      </div>
      <div class="match-list">${matchesHtml}</div>
      <div class="ticket-footer">
        <span>Resultado</span>
        <span class="${profit>=0?'profit-pos':'profit-neg'}">${r==='pending'?'—':(profit>=0?'+':'')+fmtBRL(profit)}</span>
      </div>
      <div class="ticket-actions">
        <button class="btn-ghost btn-sm" onclick="editTicket('${ticket.id}')">Editar</button>
        <button class="btn-ghost btn-sm" onclick="duplicateTicket('${ticket.id}')">Duplicar</button>
        <button class="btn-danger-ghost btn-sm" onclick="deleteTicket('${ticket.id}')">Excluir</button>
      </div>
    </div>
  `;
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
  ADMIN_SUBVIEW='wizard';
  render();
}
async function duplicateTicket(ticketId){
  const ticket = STATE.tickets.find(t=>t.id===ticketId);
  if(!ticket) return;
  const newMatches = ticket.matches.map(m=>({...m, id:uid(), result:'pending'}));
  const {data, error} = await supabaseClient.from('tickets').insert({
    client_id: ticket.clientId, date: ticket.date, time: ticket.time, stake: ticket.stake, odds: ticket.odds, matches: newMatches
  }).select().single();
  if(error){ showToast('Erro ao duplicar aposta: '+error.message); return; }
  STATE.tickets.push({
    id:data.id, clientId:data.client_id, date:data.date, time: data.time ? data.time.slice(0,5) : null,
    stake:parseFloat(data.stake), odds: data.odds!=null ? parseFloat(data.odds) : null, matches:data.matches||[],
    createdAt: data.created_at, ticketNumber: data.ticket_number
  });
  render();
}
function cancelWizard(){
  if(DRAFT.matches.length && !confirm('Descartar esta aposta em edição?')) return;
  DRAFT=null; EDITING_TICKET_ID=null; ADMIN_SUBVIEW='list'; render();
}
function draftMatchesOddTotal(){
  return DRAFT.matches.filter(m=>m.result!=='void').reduce((p,m)=>p*m.odd,1);
}
function updateWizardTotals(){
  const stake = parseFloat(DRAFT.stake) || 0;
  const odds = parseFloat(DRAFT.odds) || draftMatchesOddTotal();
  const display = document.getElementById('ticket-retorno-display');
  if(display) display.value = (stake>0 && odds>0) ? fmtBRL(stake*odds - stake) : '';
}

async function saveTicket(){
  const clientId = document.getElementById('new-client-id').value;
  const date = document.getElementById('ticket-date').value;
  const time = document.getElementById('ticket-time').value;
  const stake = parseFloat(document.getElementById('ticket-stake').value);
  const oddsRaw = document.getElementById('ticket-odds').value;
  const odds = oddsRaw ? parseFloat(oddsRaw) : null;
  if(!clientId){ showToast('Digite e selecione o cliente na lista.'); return; }
  if(!date || !time){ showToast('Informe a data e o horário do bilhete.'); return; }
  if(!stake || stake<=0){ showToast('Informe o valor da aposta.'); return; }
  if(odds!==null && isNaN(odds)){ showToast('Odd inválida.'); return; }
  if(!DRAFT.matches.length){ showToast('Adicione ao menos uma partida.'); return; }

  if(EDITING_TICKET_ID){
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
    if(idx>=0) STATE.tickets[idx] = updated; else STATE.tickets.push(updated);
  } else {
    const {data, error} = await supabaseClient.from('tickets').insert({
      client_id: clientId, date, time, stake, odds, matches: DRAFT.matches
    }).select().single();
    if(error){ showToast('Erro ao salvar aposta: '+error.message); return; }
    STATE.tickets.push({
      id:data.id, clientId:data.client_id, date:data.date, time: data.time ? data.time.slice(0,5) : null,
      stake:parseFloat(data.stake), odds: data.odds!=null ? parseFloat(data.odds) : null, matches:data.matches||[],
      createdAt: data.created_at, ticketNumber: data.ticket_number
    });
  }
  DRAFT=null; EDITING_TICKET_ID=null; ADMIN_SUBVIEW='list';
  render();
}

function renderWizard(){
  const oddTotal = DRAFT.matches.reduce((p,m)=>p*m.odd,1);
  const stakeNum = parseFloat(DRAFT.stake)||0;
  const marketOptions = MARKETS.map(m=>`<option value="${m.v}">${m.l}</option>`).join('');

  const draftList = DRAFT.matches.map(m=>{
    const marketLabel = MARKETS.find(x=>x.v===m.market)?.l || m.market;
    const teamsLabel = m.away ? `${m.home} x ${m.away}` : m.home;
    return `
      <div class="draft-match" style="flex-direction:column;align-items:stretch;gap:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div>
            <strong>${teamsLabel}</strong> — ${marketLabel}: ${m.selection}
            <div style="color:var(--text-muted);font-family:var(--font-mono);font-size:11.5px">${m.away ? fmtDate(m.date)+(m.time?' '+m.time:'')+' · ' : ''}odd ${m.odd.toFixed(2)}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn-ghost btn-sm" onclick="editDraftMatch('${m.id}')">Editar</button>
            <button class="btn-ghost btn-sm" onclick="removeDraftMatch('${m.id}')">Remover</button>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          ${resultChip(m.result)}
          <button class="btn-ghost btn-sm" onclick="setDraftMatchResult('${m.id}','pending')">Pendente</button>
          <button class="btn-ghost btn-sm" onclick="setDraftMatchResult('${m.id}','green')">Green</button>
          <button class="btn-ghost btn-sm" onclick="setDraftMatchResult('${m.id}','red')">Red</button>
          <button class="btn-ghost btn-sm" onclick="setDraftMatchResult('${m.id}','void')">Anular</button>
        </div>
      </div>
    `;
  }).join('') || '<div class="empty">Nenhuma partida adicionada ainda.</div>';

  return `
    <div class="card">
      <h3>${EDITING_TICKET_ID ? 'Editar Aposta' : 'Nova Aposta'} — dados do bilhete</h3>
      <label>Cliente</label>
      <div class="autocomplete-wrap">
        <input type="text" id="new-client-search" value="${DRAFT.clientName||''}" placeholder="Buscar cliente…" autocomplete="off"
          oninput="filterClientOptions()" onfocus="filterClientOptions()" onkeydown="handleAutocompleteKeydown(event,'client-options')"
          onblur="setTimeout(()=>{const b=document.getElementById('client-options'); if(b) b.style.display='none';},150)">
        <input type="hidden" id="new-client-id" value="${DRAFT.clientId||''}">
        <div id="client-options" class="autocomplete-list"></div>
      </div>
      <div class="row">
        <div><label>Data</label><input type="date" id="ticket-date" value="${DRAFT.date||''}" onchange="DRAFT.date=this.value"></div>
        <div><label>Hora</label><input type="time" id="ticket-time" value="${DRAFT.time||''}" onchange="DRAFT.time=this.value"></div>
      </div>
      <label>Valor</label>
      <input type="number" id="ticket-stake" step="0.01" value="${DRAFT.stake||''}" oninput="DRAFT.stake=this.value;updateWizardTotals()" placeholder="Valor (ex: 100,00 ou 100.00)">
      <div class="row">
        <div><label>Odds (opcional)</label><input type="number" id="ticket-odds" step="0.01" value="${DRAFT.odds||''}" oninput="DRAFT.odds=this.value;updateWizardTotals()" placeholder="Em branco = multiplica as odds dos jogos"></div>
        <div><label>Retorno (lucro)</label><input type="text" id="ticket-retorno-display" value="${(parseFloat(DRAFT.stake)>0 && (parseFloat(DRAFT.odds)>0 || draftMatchesOddTotal()>0)) ? fmtBRL(parseFloat(DRAFT.stake)*(parseFloat(DRAFT.odds)||draftMatchesOddTotal())-parseFloat(DRAFT.stake)) : ''}" placeholder="Calculado automaticamente" disabled></div>
      </div>
    </div>

    <div class="card draft-card">
      <h3>Adicionar partida</h3>
      <div class="row" style="align-items:center;gap:10px;margin-top:0">
        <span style="font-size:13px;font-weight:600">Com Evento</span>
        <input type="checkbox" id="match-sem-evento" onchange="toggleEventoFields()" style="width:auto">
        <span style="font-size:13px;font-weight:600">Sem Evento (Longo Prazo)</span>
      </div>
      <div id="evento-fields">
        <div class="row">
          <div><label>Time da casa</label><input type="text" id="match-home" placeholder="Ex: Flamengo"></div>
          <div><label>Time visitante</label><input type="text" id="match-away" placeholder="Ex: Palmeiras"></div>
        </div>
      </div>
      <div id="sem-evento-fields" style="display:none">
        <label>Descrição (longo prazo)</label>
        <input type="text" id="match-manual-desc" placeholder="Ex: Campeão Brasileiro 2026 — Flamengo">
      </div>
      <label>Mercados rápidos</label>
      <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:0">
        <button type="button" class="btn-ghost btn-sm" onclick="quickMarket('Resultado Final','Casa')">RF 1</button>
        <button type="button" class="btn-ghost btn-sm" onclick="quickMarket('Resultado Final','Empate')">RF X</button>
        <button type="button" class="btn-ghost btn-sm" onclick="quickMarket('Resultado Final','Fora')">RF 2</button>
        <button type="button" class="btn-ghost btn-sm" onclick="quickMarket('Dupla Chance','Casa ou Empate')">DP 1X</button>
        <button type="button" class="btn-ghost btn-sm" onclick="quickMarket('Dupla Chance','Empate ou Fora')">DP X2</button>
        <button type="button" class="btn-ghost btn-sm" onclick="quickMarket('Dupla Chance','Casa ou Fora')">DP 12</button>
        <button type="button" class="btn-ghost btn-sm" onclick="quickMarket('Total de Gols','Over 2.5')">GOL +</button>
        <button type="button" class="btn-ghost btn-sm" onclick="quickMarket('Total de Gols','Under 2.5')">GOL -</button>
        <button type="button" class="btn-ghost btn-sm" onclick="quickMarket('Handicap Asiatico','Casa -1')">AH1</button>
        <button type="button" class="btn-ghost btn-sm" onclick="quickMarket('Handicap Asiatico','Fora -1')">AH2</button>
        <button type="button" class="btn-ghost btn-sm" onclick="quickMarket('Ambas Marcam','Sim')">BTTS Sim</button>
        <button type="button" class="btn-ghost btn-sm" onclick="quickMarket('Ambas Marcam','Não')">BTTS Não</button>
        <button type="button" class="btn-ghost btn-sm" onclick="quickMarket('Resultado Final HT','Casa')">RF HT 1</button>
        <button type="button" class="btn-ghost btn-sm" onclick="quickMarket('Resultado Final HT','Empate')">RF HT X</button>
        <button type="button" class="btn-ghost btn-sm" onclick="quickMarket('Resultado Final HT','Fora')">RF HT 2</button>
        <button type="button" class="btn-ghost btn-sm" onclick="quickMarket('Total de Escanteios HT','Over')">ESC HT +</button>
        <button type="button" class="btn-ghost btn-sm" onclick="quickMarket('Total de Escanteios HT','Under')">ESC HT -</button>
        <button type="button" class="btn-ghost btn-sm" onclick="quickMarket('Handicap Asiatico HT','Casa -1')">AH1 HT</button>
        <button type="button" class="btn-ghost btn-sm" onclick="quickMarket('Handicap Asiatico HT','Fora -1')">AH2 HT</button>
      </div>
      <div class="row">
        <div><label>Mercado</label><select id="match-market">${marketOptions}</select></div>
        <div><label>Seleção</label><input type="text" id="match-selection" placeholder="Ex: Casa, Over 2.5, Sim"></div>
        <div><label>Odds da seleção</label><input type="number" id="match-odd" step="0.01" placeholder="1.85"></div>
      </div>
      <div style="margin-top:14px"><button class="btn-ghost" onclick="addDraftMatch()">Adicionar partida ao bilhete</button></div>
    </div>

    <div class="card">
      <h3>Partidas do bilhete</h3>
      ${draftList}
      ${DRAFT.matches.length>0 ? `<div style="margin-top:10px" class="odd-total">Soma das odds das partidas (informativo): ${oddTotal.toFixed(2)}</div>` : ''}
    </div>

    <div class="row">
      <div><button class="btn-ghost btn-full" onclick="cancelWizard()">Cancelar</button></div>
      <div><button class="btn-primary btn-full" onclick="saveTicket()">${EDITING_TICKET_ID ? 'Salvar alterações' : 'Salvar aposta'}</button></div>
    </div>
  `;
}

function toggleEventoFields(){
  const semEvento = document.getElementById('match-sem-evento').checked;
  document.getElementById('evento-fields').style.display = semEvento ? 'none' : 'block';
  document.getElementById('sem-evento-fields').style.display = semEvento ? 'block' : 'none';
}
function quickMarket(market, selection){
  document.getElementById('match-market').value = market;
  document.getElementById('match-selection').value = selection;
  const oddField = document.getElementById('match-odd');
  oddField.focus();
  oddField.select();
}

function addDraftMatch(){
  const semEvento = document.getElementById('match-sem-evento').checked;
  const market = document.getElementById('match-market').value;
  const selection = document.getElementById('match-selection').value.trim();
  const odd = parseFloat(document.getElementById('match-odd').value);
  if(!selection){ showToast('Informe a seleção (ex: Casa, Over 2.5, Sim).'); return; }
  if(!odd && odd!==0 || isNaN(odd)){ showToast('Informe a odd da seleção.'); return; }

  let home, away, date, time;
  if(semEvento){
    const desc = document.getElementById('match-manual-desc').value.trim();
    if(!desc){ showToast('Informe a descrição da aposta de longo prazo.'); return; }
    home = desc; away = '';
  } else {
    home = document.getElementById('match-home').value.trim();
    away = document.getElementById('match-away').value.trim();
    if(!home || !away){ showToast('Informe os dois times.'); return; }
  }
  date = DRAFT.date || todaySP();
  time = DRAFT.time || null;
  DRAFT.matches.push({id:uid(), home, away, date, time, market, selection, odd, result:'pending'});
  render();
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
  render();
  const semEvento = !m.away;
  document.getElementById('match-sem-evento').checked = semEvento;
  toggleEventoFields();
  if(semEvento){
    document.getElementById('match-manual-desc').value = m.home;
  } else {
    document.getElementById('match-home').value = m.home;
    document.getElementById('match-away').value = m.away;
  }
  document.getElementById('match-market').value = m.market;
  document.getElementById('match-selection').value = m.selection;
  document.getElementById('match-odd').value = m.odd;
  (semEvento ? document.getElementById('match-manual-desc') : document.getElementById('match-home'))?.scrollIntoView({behavior:'smooth', block:'center'});
}

// ---------- CLIENTES TAB ----------
