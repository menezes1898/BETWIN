// ==================== ABA CONFERÊNCIA ====================
// Serve pra você revisar com facilidade as apostas digitadas por outra pessoa (ex: a
// funcionária da digitação), filtrando por quem lançou e marcando cada uma como conferida.
// Não mexe em nenhum cálculo financeiro — é só uma camada de revisão/auditoria em cima
// das apostas que já existem.

function conferenciaPendingCount(){
  return STATE.tickets.filter(t=>!t.conferido && t.createdBy).length;
}

function computeConferenciaAuthors(){
  const ids = new Set(STATE.tickets.filter(t=>t.createdBy).map(t=>t.createdBy));
  return Array.from(ids).map(id=>({id, name: authorName(id)})).sort((a,b)=>a.name.localeCompare(b.name));
}

function computeFilteredConferenciaTickets(){
  let list = STATE.tickets.filter(t=>t.createdBy || CONFERENCIA_INCLUIR_ANTIGAS);
  if(CONFERENCIA_FILTER_USER !== 'todos') list = list.filter(t=>t.createdBy===CONFERENCIA_FILTER_USER);
  if(!CONFERENCIA_SHOW_ALL) list = list.filter(t=>!t.conferido);
  list.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  return list;
}

function renderConferenciaTab(){
  const authors = computeConferenciaAuthors();
  const list = computeFilteredConferenciaTickets();
  const pendingTotal = conferenciaPendingCount();

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <h3 style="margin:0">Conferência de apostas</h3>
        <span style="font-family:var(--font-mono);font-size:13px;color:var(--gold)">${pendingTotal} pendente${pendingTotal===1?'':'s'}</span>
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin:6px 0 14px">Confira aqui as apostas digitadas por cada pessoa e marque como conferida depois de checar se está tudo certo.</p>
      <label>Digitado por</label>
      <select id="conferencia-user-select" onchange="setConferenciaFilterUser(this.value)">
        <option value="todos" ${CONFERENCIA_FILTER_USER==='todos'?'selected':''}>Todos</option>
        ${authors.map(a=>`<option value="${a.id}" ${CONFERENCIA_FILTER_USER===a.id?'selected':''}>${a.name}</option>`).join('')}
      </select>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin:0;text-transform:none;font-size:13px">
          <input type="checkbox" style="width:auto" ${CONFERENCIA_SHOW_ALL?'checked':''} onchange="CONFERENCIA_SHOW_ALL=this.checked;render()"> Mostrar também as já conferidas
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin:0;text-transform:none;font-size:13px">
          <input type="checkbox" style="width:auto" ${CONFERENCIA_INCLUIR_ANTIGAS?'checked':''} onchange="CONFERENCIA_INCLUIR_ANTIGAS=this.checked;render()"> Incluir apostas antigas sem autor registrado
        </label>
      </div>
    </div>
    <div class="card">
      ${list.length===0 ? '<div class="empty">Nenhuma aposta encontrada com esse filtro.</div>' : list.map(renderConferenciaTicketCard).join('')}
    </div>
  `;
}

function renderConferenciaTicketCard(ticket){
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
        ${resultChip(m.result)}
      </div>
    `;
  }).join('');

  const autor = ticket.createdBy ? authorName(ticket.createdBy) : 'sem autor registrado';
  const conferidoInfo = ticket.conferido
    ? `<span style="color:var(--green)">✓ Conferido${ticket.conferidoBy?' por '+authorName(ticket.conferidoBy):''}${ticket.conferidoAt?' em '+new Date(ticket.conferidoAt).toLocaleDateString('pt-BR'):''}</span>`
    : '';

  return `
    <div class="ticket ticket-compact">
      <div class="ticket-top">
        <div>
          <div class="ticket-client"><span style="font-family:var(--font-mono);font-weight:400;font-size:11px;color:var(--text-muted)">#${ticket.ticketNumber||'—'}</span> ${cl?cl.name:'Cliente removido'}</div>
          <div class="ticket-meta">${fmtDate(ticket.date)}${ticket.time?' '+ticket.time:''} · stake ${fmtBRL(ticket.stake)} · digitado por <strong>${autor}</strong></div>
          ${conferidoInfo ? `<div class="ticket-meta" style="margin-top:2px">${conferidoInfo}</div>` : ''}
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
        ${ticket.conferido
          ? `<button class="btn-ghost btn-sm" onclick="desfazerConferencia('${ticket.id}')">Desfazer conferência</button>`
          : `<button class="btn-primary btn-sm" onclick="marcarConferido('${ticket.id}')">✓ Marcar como conferido</button>`}
      </div>
    </div>
  `;
}

function setConferenciaFilterUser(v){
  CONFERENCIA_FILTER_USER = v;
  render();
}

async function marcarConferido(ticketId){
  const ticket = STATE.tickets.find(t=>t.id===ticketId);
  if(!ticket) return;
  const now = new Date().toISOString();
  const {error} = await supabaseClient.from('tickets').update({conferido:true, conferido_at: now, conferido_by: currentUserId()}).eq('id', ticketId);
  if(error){ showToast('Erro ao marcar como conferido: '+error.message); return; }
  ticket.conferido = true;
  ticket.conferidoAt = now;
  ticket.conferidoBy = currentUserId();
  showToast('Aposta marcada como conferida!');
  render();
}
async function desfazerConferencia(ticketId){
  const ticket = STATE.tickets.find(t=>t.id===ticketId);
  if(!ticket) return;
  const {error} = await supabaseClient.from('tickets').update({conferido:false, conferido_at:null, conferido_by:null}).eq('id', ticketId);
  if(error){ showToast('Erro ao desfazer conferência: '+error.message); return; }
  ticket.conferido = false;
  ticket.conferidoAt = null;
  ticket.conferidoBy = null;
  render();
}
