// ==================== ABA CONFERÊNCIA ====================
// Serve pra você revisar com facilidade as apostas digitadas por outra pessoa (ex: a
// funcionária da digitação), filtrando por quem lançou, cliente e período, e marcando
// cada uma (ou um grupo inteiro de uma vez) como conferida.
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
  if(CONFERENCIA_FILTER_CLIENT_ID) list = list.filter(t=>t.clientId===CONFERENCIA_FILTER_CLIENT_ID);
  if(CONFERENCIA_DATE_FROM) list = list.filter(t=>ticketDate(t) >= CONFERENCIA_DATE_FROM);
  if(CONFERENCIA_DATE_TO) list = list.filter(t=>ticketDate(t) <= CONFERENCIA_DATE_TO);
  if(!CONFERENCIA_SHOW_ALL) list = list.filter(t=>!t.conferido);
  list.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  return list;
}

function renderConferenciaTab(){
  const authors = computeConferenciaAuthors();
  const list = computeFilteredConferenciaTickets();
  const pendingTotal = conferenciaPendingCount();
  const pendingInFilter = list.filter(t=>!t.conferido).length;
  const filtrosAtivos = CONFERENCIA_FILTER_USER!=='todos' || CONFERENCIA_FILTER_CLIENT_ID || CONFERENCIA_DATE_FROM || CONFERENCIA_DATE_TO;

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <h3 style="margin:0">Conferência de apostas</h3>
        <span style="font-family:var(--font-mono);font-size:13px;color:var(--gold)">${pendingTotal} pendente${pendingTotal===1?'':'s'}</span>
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin:6px 0 14px">Filtre por cliente, período e quem digitou pra conferir um grupo de apostas de uma vez só.</p>

      <label>Cliente</label>
      <div class="autocomplete-wrap">
        <input type="text" id="conferencia-client-search" value="${CONFERENCIA_FILTER_CLIENT_NAME||''}" placeholder="Buscar cliente… (deixe em branco = todos)" autocomplete="off"
          oninput="filterConferenciaClientOptions()" onfocus="filterConferenciaClientOptions()" onkeydown="handleAutocompleteKeydown(event,'conferencia-client-options')"
          onblur="setTimeout(()=>{const b=document.getElementById('conferencia-client-options'); if(b) b.style.display='none';},150)">
        <input type="hidden" id="conferencia-client-id" value="${CONFERENCIA_FILTER_CLIENT_ID||''}">
        <div id="conferencia-client-options" class="autocomplete-list"></div>
      </div>

      <div class="row">
        <div><label>De</label><input type="date" id="conferencia-date-from" value="${CONFERENCIA_DATE_FROM||''}" onchange="CONFERENCIA_DATE_FROM=this.value;render()"></div>
        <div><label>Até</label><input type="date" id="conferencia-date-to" value="${CONFERENCIA_DATE_TO||''}" onchange="CONFERENCIA_DATE_TO=this.value;render()"></div>
      </div>

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

      ${filtrosAtivos ? `<div style="margin-top:10px"><button class="btn-ghost btn-sm" onclick="limparFiltrosConferencia()">✕ Limpar filtros</button></div>` : ''}

      ${pendingInFilter>0 ? `
        <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--line-soft);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <span style="font-size:12.5px;color:var(--text-muted)">${pendingInFilter} pendente${pendingInFilter===1?'':'s'} nesse filtro</span>
          <button class="btn-primary btn-sm" onclick="marcarTodosConferidos()">✓ Marcar esse grupo todo como conferido</button>
        </div>
      ` : ''}
    </div>
    <div class="card">
      ${list.length===0 ? '<div class="empty">Nenhuma aposta encontrada com esse filtro.</div>' : list.map(renderConferenciaTicketCard).join('')}
    </div>
  `;
}

function renderConferenciaTicketCard(ticket){
  // Na Conferência, "digitado por" e o status da conferência sempre aparecem — mesmo pra
  // apostas antigas sem autor registrado — ao contrário do card padrão de Apostas.
  const autor = ticket.createdBy ? authorName(ticket.createdBy) : 'sem autor registrado';
  const autorStat = `<div class="bet-stat"><span class="bet-stat-label">Digitado por</span><span class="bet-stat-value">${autor}</span></div>`;
  const conferidoInfo = ticket.conferido
    ? `<div class="bet-stat"><span class="bet-stat-label">Conferência</span><span class="bet-stat-value" style="color:var(--green)">✓ ${ticket.conferidoBy?'por '+authorName(ticket.conferidoBy):'Conferido'}${ticket.conferidoAt?' em '+new Date(ticket.conferidoAt).toLocaleDateString('pt-BR'):''}</span></div>`
    : '';

  const conferenciaAction = ticket.conferido
    ? `<button class="icon-btn" title="Desfazer conferência" onclick="desfazerConferencia('${ticket.id}')">↺</button>`
    : `<button onclick="marcarConferido('${ticket.id}')" title="Marcar como conferido" style="width:28px;height:28px;border-radius:50%;border:none;background:var(--green);color:#fff;font-size:15px;font-weight:700;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0">✓</button>`;

  return renderBetCard(ticket, {
    showEdit: true, showDuplicate: false, showDelete: false, showQuickResult: false,
    showAuthor: false, conferenciaAction, extraStats: autorStat + conferidoInfo
  });
}

function setConferenciaFilterUser(v){
  CONFERENCIA_FILTER_USER = v;
  render();
}

// Só mexe na caixinha de sugestões (sem re-render da aba inteira a cada tecla) — o filtro
// de cliente só é realmente aplicado quando a pessoa clica numa sugestão, ou removido pelo
// "Limpar filtros". Assim, focar de novo no campo não derruba o cliente já selecionado.
function filterConferenciaClientOptions(){
  const input = document.getElementById('conferencia-client-search');
  const box = document.getElementById('conferencia-client-options');
  const val = input.value.trim().toLowerCase();
  if(val.length < 1){ box.style.display='none'; box.innerHTML=''; return; }
  const matches = STATE.clients.filter(c=>c.name.toLowerCase().includes(val));
  if(matches.length===0){
    box.innerHTML = '<div class="autocomplete-item" style="cursor:default;color:var(--text-muted)">Nenhum cliente encontrado</div>';
  } else {
    box.innerHTML = matches.map(c=>`<div class="autocomplete-item" onmousedown="selectConferenciaClientOption('${c.id}')">${c.name}</div>`).join('');
  }
  box.style.display='block';
}
function selectConferenciaClientOption(id){
  const cl = STATE.clients.find(c=>c.id===id);
  if(!cl) return;
  CONFERENCIA_FILTER_CLIENT_ID = id;
  CONFERENCIA_FILTER_CLIENT_NAME = cl.name;
  const box = document.getElementById('conferencia-client-options');
  box.style.display='none'; box.innerHTML='';
  render();
}
function limparFiltrosConferencia(){
  CONFERENCIA_FILTER_USER = 'todos';
  CONFERENCIA_FILTER_CLIENT_ID = '';
  CONFERENCIA_FILTER_CLIENT_NAME = '';
  CONFERENCIA_DATE_FROM = '';
  CONFERENCIA_DATE_TO = '';
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
// Marca de uma vez só todas as apostas que estão dentro do filtro atual (cliente + período +
// digitado por) e ainda não foram conferidas — pra revisar um grupo inteiro sem clicar aposta
// por aposta.
async function marcarTodosConferidos(){
  const list = computeFilteredConferenciaTickets().filter(t=>!t.conferido);
  if(list.length===0){ showToast('Nenhuma aposta pendente nesse filtro.'); return; }
  if(!confirm(`Marcar ${list.length} aposta(s) como conferida(s)?`)) return;
  const now = new Date().toISOString();
  const uid = currentUserId();
  let okCount = 0, failCount = 0;
  for(const t of list){
    const {error} = await supabaseClient.from('tickets').update({conferido:true, conferido_at: now, conferido_by: uid}).eq('id', t.id);
    if(error){ failCount++; continue; }
    t.conferido = true;
    t.conferidoAt = now;
    t.conferidoBy = uid;
    okCount++;
  }
  showToast(failCount>0 ? `${okCount} marcada(s), ${failCount} falharam.` : `${okCount} aposta(s) marcada(s) como conferida(s)!`);
  render();
}
