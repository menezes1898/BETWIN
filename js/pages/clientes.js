function renderClientesTab(){
  if(CLIENT_DETAIL_ID) return renderClientDetail(CLIENT_DETAIL_ID);
  return `
    <div class="card">
      <h3>Novo cliente</h3>
      <label>Nome do cliente</label>
      <input type="text" id="new-client-name" placeholder="Ex: João Silva">
      <label>Telefone (opcional)</label>
      <input type="text" id="new-client-phone" placeholder="Ex: (11) 91234-5678">
      <label>Desconto em caso de perda (%)</label>
      <input type="number" id="new-client-discount" min="0" max="100" step="1" value="0" placeholder="Ex: 15">
      <label style="display:flex;align-items:center;gap:8px;margin-top:12px;cursor:pointer">
        <input type="checkbox" id="new-client-descarga" style="width:auto">
        <span>Conta de Descarga (parceiro) — resultado invertido, sem desconto</span>
      </label>
      <div style="margin-top:14px"><button class="btn-primary" onclick="addClient()">Cadastrar</button></div>
    </div>
    <div class="card">
      <label>Buscar cliente</label>
      <input type="text" id="client-search-input" placeholder="Digite o nome do cliente…" oninput="updateClientSearch()">
    </div>
    <div id="client-list-container">${renderClientListItems(STATE.clients)}</div>
  `;
}
function renderClientListItems(list){
  if(list.length===0) return '<div class="card"><div class="empty">Nenhum cliente encontrado.</div></div>';
  return list.map(cl=>`
    <div class="card" style="cursor:pointer" onclick="openClientDetail('${cl.id}')">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:600;font-size:15px">${cl.name} ${cl.isDescarga?'<span class="chip" style="background:var(--gold-dim);color:var(--gold);font-size:10px">DESCARGA</span>':''}</div>
          ${cl.phone ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px">${cl.phone}</div>` : ''}
        </div>
        <span style="color:var(--text-muted);font-size:18px">›</span>
      </div>
    </div>
  `).join('');
}
function updateClientSearch(){
  const val = document.getElementById('client-search-input').value.trim().toLowerCase();
  const filtered = val ? STATE.clients.filter(c=>c.name.toLowerCase().includes(val)) : STATE.clients;
  document.getElementById('client-list-container').innerHTML = renderClientListItems(filtered);
}
function openClientDetail(id){
  CLIENT_DETAIL_ID = id;
  CONFIRM_DELETE_CLIENT = false;
  CLIENT_DETAIL_SUBVIEW = 'painel';
  render();
}
function renderClientDetail(id){
  const cl = STATE.clients.find(c=>c.id===id);
  if(!cl){ CLIENT_DETAIL_ID=null; return renderClientesTab(); }
  const baseUrl = window.location.href.split('#')[0];
  const clientTickets = STATE.tickets.filter(t=>t.clientId===cl.id);
  const volumeGeral = clientTickets.reduce((s,t)=>s+t.stake,0);
  const resultadoGeral = clientTickets.reduce((s,t)=>s+ticketProfit(t),0);
  return `
    <button class="btn-ghost btn-sm" onclick="CLIENT_DETAIL_ID=null;render()">‹ Voltar</button>
    <div style="height:12px"></div>
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:14px;flex-wrap:wrap">
      <h2 style="margin:0;font-family:var(--font-display);font-weight:600;font-size:22px">${cl.name} ${cl.isDescarga?'<span class="chip" style="background:var(--gold-dim);color:var(--gold)">DESCARGA</span>':''}</h2>
      <span class="chip ${resultadoGeral>=0?'chip-green':'chip-red'}">${resultadoGeral>=0?'+':''}${fmtBRL(resultadoGeral)} no total</span>
    </div>
    <div class="tabs" style="margin-bottom:16px">
      <div class="tab ${CLIENT_DETAIL_SUBVIEW==='painel'?'active':''}" onclick="CLIENT_DETAIL_SUBVIEW='painel';render()">Painel</div>
      <div class="tab ${CLIENT_DETAIL_SUBVIEW==='semanas'?'active':''}" onclick="CLIENT_DETAIL_SUBVIEW='semanas';render()">Semanas</div>
      <div class="tab ${CLIENT_DETAIL_SUBVIEW==='info'?'active':''}" onclick="CLIENT_DETAIL_SUBVIEW='info';render()">Editar</div>
    </div>
    ${CLIENT_DETAIL_SUBVIEW==='semanas' ? renderClientWeeksList(cl) : CLIENT_DETAIL_SUBVIEW==='painel' ? renderClientPanel(cl) : `
    <div class="card" style="display:flex;padding:0">
      <div style="flex:1;text-align:center;padding:1rem 0.5rem">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Volume total (interno)</div>
        <div style="font-family:var(--font-mono);font-size:18px;margin-top:4px">${fmtBRL(volumeGeral)}</div>
      </div>
      <div style="width:1px;background:var(--line)"></div>
      <div style="flex:1;text-align:center;padding:1rem 0.5rem">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Resultado geral (interno)</div>
        <div style="font-family:var(--font-mono);font-size:18px;margin-top:4px" class="${resultadoGeral>=0?'profit-pos':'profit-neg'}">${fmtBRL(resultadoGeral)}</div>
      </div>
    </div>
    <div class="card">
      <h3>Editar cliente</h3>
      <label>Nome do cliente</label>
      <input type="text" id="detail-client-name" value="${cl.name}">
      <label>Telefone (opcional)</label>
      <input type="text" id="detail-client-phone" value="${cl.phone||''}" placeholder="Ex: (11) 91234-5678">
      <label>Desconto padrão em caso de perda (%)</label>
      <input type="number" id="detail-client-discount" min="0" max="100" step="1" value="${cl.discount||0}">
      <p style="font-size:12px;color:var(--text-muted);margin:6px 0 0">Mudar esse valor passa a valer <strong>a partir de agora</strong>, sem afetar semanas passadas. Pra mudar o desconto de uma semana específica no passado, usa a aba <strong>Semanas</strong>.</p>
      <label style="display:flex;align-items:center;gap:8px;margin-top:14px;cursor:pointer">
        <input type="checkbox" id="detail-client-descarga" style="width:auto" ${cl.isDescarga?'checked':''}>
        <span>Conta de Descarga (parceiro) — resultado invertido, sem desconto</span>
      </label>
      <label>Link de acesso do cliente</label>
      <div class="link-box">
        <code id="link-${cl.id}">${baseUrl}#cliente=${cl.code}</code>
        <button class="btn-ghost btn-sm" onclick="copyLink('${cl.id}')">Copiar link</button>
      </div>
      <div style="margin-top:14px"><button class="btn-primary btn-full" onclick="saveClientDetail('${cl.id}')">Salvar alterações</button></div>
    </div>
    ${CONFIRM_DELETE_CLIENT ? `
      <div class="card" style="border-color:var(--red)">
        <p style="margin:0 0 12px;font-size:14px">Tem certeza que quer excluir <strong>${cl.name}</strong>? Essa ação não pode ser desfeita.</p>
        <div class="row">
          <div><button class="btn-ghost btn-full" onclick="CONFIRM_DELETE_CLIENT=false;render()">Cancelar</button></div>
          <div><button class="btn-danger-ghost btn-full" onclick="deleteClient('${cl.id}')">Sim, excluir definitivamente</button></div>
        </div>
      </div>
    ` : `
      <div class="card">
        <button class="btn-danger-ghost btn-full" onclick="CONFIRM_DELETE_CLIENT=true;render()">Excluir cliente</button>
      </div>
    `}
    `}
  `;
}
function renderClientPanel(cl){
  const clientTickets = STATE.tickets.filter(t=>t.clientId===cl.id);
  const volumeGeral = clientTickets.reduce((s,t)=>s+t.stake,0);
  const resultadoGeral = clientTickets.reduce((s,t)=>s+ticketProfit(t),0);
  const pendentes = clientTickets.filter(t=>ticketResult(t)==='pending');
  const pendentesValor = pendentes.reduce((s,t)=>s+t.stake,0);
  const resolvidas = clientTickets.filter(t=>{const r=ticketResult(t); return r==='green'||r==='red';});
  const greens = resolvidas.filter(t=>ticketResult(t)==='green').length;
  const percAcerto = resolvidas.length>0 ? (greens/resolvidas.length*100) : 0;
  const saldoDevedor = computeContinuousBalance(cl.id); // positivo = cliente deve pra você
  const ordenadas = [...clientTickets].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  const ultimaAtividade = ordenadas[0] || null;
  const recentes = ordenadas.slice(0,6);

  function statCard(label, value, colorClass){
    return `
      <div class="card" style="margin-bottom:0;padding:16px">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;font-weight:600">${label}</div>
        <div style="font-family:var(--font-mono);font-size:19px;font-weight:700;margin-top:7px" class="${colorClass||''}">${value}</div>
      </div>
    `;
  }

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px">
      ${statCard('Lucro/Prejuízo', fmtBRL(resultadoGeral), resultadoGeral>=0?'profit-pos':'profit-neg')}
      ${statCard('Volume Apostado', fmtBRL(volumeGeral))}
      ${statCard('Qtd. de Apostas', clientTickets.length)}
      ${statCard('% de Acerto', percAcerto.toFixed(1)+'%')}
      ${statCard('Pendências', pendentes.length+' <span style="font-size:12px;color:var(--text-muted)">('+fmtBRL(pendentesValor)+')</span>')}
      ${statCard('Saldo Devedor Atual', fmtBRL(saldoDevedor), saldoDevedor>0.01?'profit-neg':(saldoDevedor<-0.01?'profit-pos':''))}
    </div>
    <div class="card">
      <h3>Última atividade</h3>
      ${ultimaAtividade ? `<div style="font-size:13px">${fmtDate(ultimaAtividade.date)}${ultimaAtividade.time?' às '+ultimaAtividade.time:''} · #${ultimaAtividade.ticketNumber||'—'} · ${fmtBRL(ultimaAtividade.stake)}</div>` : '<div class="empty">Nenhuma aposta registrada ainda.</div>'}
    </div>
    <div class="card">
      <h3>Histórico recente</h3>
      ${recentes.length===0 ? '<div class="empty">Nenhuma aposta ainda.</div>' : recentes.map(t=>{
        const r = ticketResult(t);
        const profit = ticketProfit(t);
        return `
          <div class="match-row">
            <div class="match-desc">
              <span class="teams">#${t.ticketNumber||'—'} · ${fmtDate(t.date)}${t.time?' '+t.time:''}</span>
              <span class="meta">${fmtBRL(t.stake)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              ${resultChip(r)}
              <span style="font-family:var(--font-mono);font-size:12.5px;font-weight:700" class="${r==='pending'?'':(profit>=0?'profit-pos':'profit-neg')}">${r==='pending'?'—':fmtBRL(profit)}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}
function renderClientWeeksList(cl){
  const weeksSet = new Set(STATE.tickets.filter(t=>t.clientId===cl.id).map(t=>mondayOf(ticketDate(t))));
  const weeks = Array.from(weeksSet).sort().reverse();
  if(weeks.length===0) return '<div class="card"><div class="empty">Esse cliente ainda não tem apostas registradas.</div></div>';

  return weeks.map(wk=>{
    const tickets = STATE.tickets.filter(t=>t.clientId===cl.id && mondayOf(ticketDate(t))===wk);
    const greenCount = tickets.filter(t=>ticketResult(t)==='green').length;
    const redCount = tickets.filter(t=>ticketResult(t)==='red').length;
    const pendingCount = tickets.filter(t=>ticketResult(t)==='pending').length;
    const volume = tickets.reduce((s,t)=>s+t.stake,0);
    const resultado = tickets.reduce((s,t)=>s+ticketProfit(t),0);
    const descontoPct = getWeekDiscount(cl, wk);
    const desconto = computeDescontoAmount(cl, resultado, wk);
    const liquido = applyDescontoSign(cl, resultado, desconto);
    const activeCommissioners = getActiveCommissionersForWeek(cl.id, wk);
    const comissaoTotal = activeCommissioners.reduce((s,c)=>s+computeCommissionAmount(cl.id, c.percent, wk),0);
    const badges = activeCommissioners.map(c=>{
      const cm = STATE.commissioners.find(x=>x.id===c.commissionerId);
      return `<span class="chip" style="background:var(--gold-dim);color:var(--gold)">${cm?cm.name:'?'} ${c.percent}%</span>`;
    }).join(' ') || '<span style="color:var(--text-muted);font-size:12px">Nenhum</span>';

    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <div style="font-weight:600;font-size:14px">Semana de ${weekLabel(wk)}</div>
          <div style="font-size:12px;color:var(--text-muted)">
            ${tickets.length} aposta(s)
            ${greenCount?` · <span class="profit-pos">✓ ${greenCount}</span>`:''}
            ${redCount?` · <span class="profit-neg">✗ ${redCount}</span>`:''}
            ${pendingCount?` · <span class="chip chip-pending" style="padding:1px 7px">${pendingCount} pend.</span>`:''}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(115px,1fr));gap:12px 16px">
          <div>
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.3px">Volume</div>
            <div style="font-family:var(--font-mono);font-size:14px;margin-top:3px">${fmtBRL(volume)}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.3px">Saldo Apostas</div>
            <div style="font-family:var(--font-mono);font-size:14px;margin-top:3px" class="${resultado>=0?'profit-pos':'profit-neg'}">${fmtBRL(resultado)}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.3px">Desconto (${descontoPct}%)</div>
            <div style="display:flex;align-items:center;gap:5px;margin-top:3px">
              <span style="font-family:var(--font-mono);font-size:14px" class="${desconto>0?'profit-pos':''}">${fmtBRL(desconto)}</span>
              <button class="btn-ghost btn-sm" style="padding:1px 6px;font-size:10px" onclick="editWeekDiscount('${cl.id}','${wk}',${descontoPct})" title="Editar desconto só dessa semana">✎</button>
            </div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.3px">Comissão</div>
            <div style="font-family:var(--font-mono);font-size:14px;margin-top:3px;color:var(--gold)">${fmtBRL(comissaoTotal)}</div>
          </div>
          <div style="grid-column:1 / -1">
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.3px">Comissionados dessa semana</div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:5px">
              ${badges}
              <button class="btn-ghost btn-sm" style="padding:1px 6px;font-size:10px" onclick="editWeekCommissioners('${cl.id}','${wk}')" title="Editar comissionados só dessa semana">✎</button>
            </div>
          </div>
          <div style="grid-column:1 / -1;border-top:1px solid var(--line);padding-top:10px;margin-top:2px">
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.3px">Líquido do cliente</div>
            <div style="font-family:var(--font-mono);font-size:17px;font-weight:700;margin-top:3px" class="${liquido>=0?'profit-pos':'profit-neg'}">${fmtBRL(liquido)}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}
async function editWeekDiscount(clientId, weekStart, currentPct){
  const input = prompt('Desconto (%) só pra essa semana — não muda o padrão nem outras semanas:', currentPct);
  if(input===null) return;
  const pct = parseFloat(String(input).replace(',','.'));
  if(isNaN(pct) || pct<0){ alert('Valor inválido.'); return; }
  const existing = STATE.clientWeekDiscounts.find(o=>o.clientId===clientId && o.weekStart===weekStart);
  if(existing){
    const {error} = await supabaseClient.from('client_week_discount').update({discount_percent: pct}).eq('id', existing.id);
    if(error){ alert('Erro ao salvar: '+error.message); return; }
    existing.discountPercent = pct;
  } else {
    const {data, error} = await supabaseClient.from('client_week_discount').insert({client_id: clientId, week_start: weekStart, discount_percent: pct}).select().single();
    if(error){ alert('Erro ao salvar: '+error.message); return; }
    STATE.clientWeekDiscounts.push({id:data.id, clientId:data.client_id, weekStart:data.week_start, discountPercent:parseFloat(data.discount_percent)||0});
  }
  render();
}
let WEEK_COMM_EDIT = null;
function editWeekCommissioners(clientId, weekStart){
  const current = getActiveCommissionersForWeek(clientId, weekStart);
  WEEK_COMM_EDIT = {clientId, weekStart, list: current.map(c=>({commissionerId:c.commissionerId, percent:c.percent}))};
  renderWeekCommEditOverlay();
}
function renderWeekCommEditOverlay(){
  let overlay = document.getElementById('week-comm-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'week-comm-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
    document.body.appendChild(overlay);
  }
  const {weekStart, list} = WEEK_COMM_EDIT;
  const availableToAdd = STATE.commissioners.filter(cm=>!list.some(l=>l.commissionerId===cm.id));
  overlay.innerHTML = `
    <div class="card" style="max-width:380px;width:100%;margin:0;max-height:85vh;overflow-y:auto">
      <h3>Comissionados — semana de ${weekLabel(weekStart)}</h3>
      <p style="font-size:12px;color:var(--text-muted);margin-top:0">Editar aqui afeta só essa semana. Outras semanas não mudam.</p>
      ${list.length===0 ? '<div class="empty">Nenhum comissionado nessa semana.</div>' : list.map((c,idx)=>{
        const cm = STATE.commissioners.find(x=>x.id===c.commissionerId);
        return `
        <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--line)">
          <span style="flex:1;font-size:13px">${cm?cm.name:'?'}</span>
          <input type="number" value="${c.percent}" min="0" max="100" step="0.1" style="width:70px" onchange="WEEK_COMM_EDIT.list[${idx}].percent=parseFloat(this.value)||0">
          <span style="font-size:12px;color:var(--text-muted)">%</span>
          <button class="btn-danger-ghost btn-sm" onclick="WEEK_COMM_EDIT.list.splice(${idx},1);renderWeekCommEditOverlay()">×</button>
        </div>`;
      }).join('')}
      ${availableToAdd.length>0 ? `
      <label>Adicionar comissionado</label>
      <select id="week-comm-add-select">
        <option value="">Selecione…</option>
        ${availableToAdd.map(cm=>`<option value="${cm.id}">${cm.name}</option>`).join('')}
      </select>
      <div style="margin-top:10px"><button class="btn-ghost btn-full" onclick="addToWeekCommEdit()">+ Adicionar</button></div>
      ` : ''}
      <div class="row" style="margin-top:14px">
        <div><button class="btn-ghost btn-full" onclick="cancelWeekCommEdit()">Cancelar</button></div>
        <div><button class="btn-primary btn-full" onclick="saveWeekCommEdit()">Salvar</button></div>
      </div>
    </div>
  `;
}
function addToWeekCommEdit(){
  const sel = document.getElementById('week-comm-add-select');
  const id = sel.value;
  if(!id) return;
  WEEK_COMM_EDIT.list.push({commissionerId:id, percent:0});
  renderWeekCommEditOverlay();
}
function cancelWeekCommEdit(){
  WEEK_COMM_EDIT = null;
  const overlay = document.getElementById('week-comm-overlay');
  if(overlay) document.body.removeChild(overlay);
}
async function saveWeekCommEdit(){
  const {clientId, weekStart, list} = WEEK_COMM_EDIT;
  const {error: delError} = await supabaseClient.from('client_week_commissioners').delete().eq('client_id', clientId).eq('week_start', weekStart);
  if(delError){ alert('Erro ao salvar: '+delError.message); return; }
  STATE.clientWeekCommissioners = STATE.clientWeekCommissioners.filter(o=>!(o.clientId===clientId && o.weekStart===weekStart));
  if(list.length===0){
    const {data, error} = await supabaseClient.from('client_week_commissioners').insert({client_id: clientId, week_start: weekStart, commissioner_id: null, percent: null}).select().single();
    if(error){ alert('Erro ao salvar: '+error.message); return; }
    STATE.clientWeekCommissioners.push({id:data.id, clientId:data.client_id, weekStart:data.week_start, commissionerId:null, percent:null});
  } else {
    for(const item of list){
      const {data, error} = await supabaseClient.from('client_week_commissioners').insert({client_id: clientId, week_start: weekStart, commissioner_id: item.commissionerId, percent: item.percent}).select().single();
      if(error){ alert('Erro ao salvar: '+error.message); return; }
      STATE.clientWeekCommissioners.push({id:data.id, clientId:data.client_id, weekStart:data.week_start, commissionerId:data.commissioner_id, percent:data.percent!=null?parseFloat(data.percent):null});
    }
  }
  cancelWeekCommEdit();
  render();
}
async function saveClientDetail(id){
  const name = document.getElementById('detail-client-name').value.trim();
  const phone = document.getElementById('detail-client-phone').value.trim();
  const discount = Math.max(0, Math.min(100, parseFloat(document.getElementById('detail-client-discount').value)||0));
  const isDescarga = document.getElementById('detail-client-descarga').checked;
  if(!name){ alert('Informe o nome do cliente.'); return; }
  const {error} = await supabaseClient.from('clients').update({name, phone, discount, is_descarga: isDescarga}).eq('id', id);
  if(error){ alert('Erro ao salvar cliente: '+error.message); return; }
  const cl = STATE.clients.find(c=>c.id===id);
  const discountChanged = cl && cl.discount !== discount;
  if(cl){ cl.name=name; cl.phone=phone; cl.discount=discount; cl.isDescarga=isDescarga; }
  if(discountChanged){
    const effectiveFromWeek = mondayOf(todaySP());
    const {data, error: histError} = await supabaseClient.from('client_discount_history').insert({client_id: id, discount_percent: discount, effective_from_week: effectiveFromWeek}).select().single();
    if(histError){ alert('Cliente salvo, mas houve erro ao registrar a mudança de desconto na linha do tempo: '+histError.message); }
    else{
      STATE.clientDiscountHistory.push({id:data.id, clientId:data.client_id, discountPercent:parseFloat(data.discount_percent)||0, effectiveFromWeek:data.effective_from_week||null});
    }
  }
  CLIENT_DETAIL_ID = null;
  render();
}
async function addClient(){
  const name = document.getElementById('new-client-name').value.trim();
  const phone = document.getElementById('new-client-phone').value.trim();
  const discount = parseFloat(document.getElementById('new-client-discount').value) || 0;
  const isDescarga = document.getElementById('new-client-descarga').checked;
  if(!name) return;
  const code = uid()+uid();
  const {data, error} = await supabaseClient.from('clients').insert({name, code, discount, phone, is_descarga: isDescarga}).select().single();
  if(error){ alert('Erro ao salvar cliente: '+error.message); return; }
  STATE.clients.push({id:data.id, name:data.name, code:data.code, discount:data.discount||0, phone:data.phone||'', isDescarga:data.is_descarga||false});
  const {data: histData, error: histError} = await supabaseClient.from('client_discount_history').insert({client_id: data.id, discount_percent: discount, effective_from_week: null}).select().single();
  if(!histError && histData){
    STATE.clientDiscountHistory.push({id:histData.id, clientId:histData.client_id, discountPercent:parseFloat(histData.discount_percent)||0, effectiveFromWeek:histData.effective_from_week||null});
  }
  render();
}
async function setClientDiscount(id, value){
  const discount = Math.max(0, Math.min(100, parseFloat(value)||0));
  const {error} = await supabaseClient.from('clients').update({discount}).eq('id', id);
  if(error){ alert('Erro ao salvar desconto: '+error.message); return; }
  const cl = STATE.clients.find(c=>c.id===id);
  if(cl) cl.discount = discount;
}
async function deleteClient(id){
  const {error} = await supabaseClient.from('clients').delete().eq('id', id);
  if(error){ alert('Erro ao remover cliente: '+error.message); return; }
  STATE.clients = STATE.clients.filter(c=>c.id!==id);
  CLIENT_DETAIL_ID = null;
  CONFIRM_DELETE_CLIENT = false;
  render();
}
function copyLink(id){
  const text = document.getElementById(`link-${id}`).textContent;
  navigator.clipboard?.writeText(text);
}
function copyCommissionerLink(id){
  const text = document.getElementById(`commissioner-link-${id}`).textContent;
  navigator.clipboard?.writeText(text);
}
function filterClientOptions(){
  const input = document.getElementById('new-client-search');
  const box = document.getElementById('client-options');
  const val = input.value.trim().toLowerCase();
  document.getElementById('new-client-id').value = '';
  if(DRAFT) DRAFT.clientId='';
  if(val.length < 2){ box.style.display='none'; box.innerHTML=''; return; }
  const matches = STATE.clients.filter(c=>c.name.toLowerCase().includes(val));
  if(matches.length===0){
    box.innerHTML = '<div class="autocomplete-item" style="cursor:default;color:var(--text-muted)">Nenhum cliente encontrado</div>';
  } else {
    box.innerHTML = matches.map(c=>`<div class="autocomplete-item" onmousedown="selectClientOption('${c.id}')">${c.name}</div>`).join('');
  }
  box.style.display='block';
}
function selectClientOption(id){
  const cl = STATE.clients.find(c=>c.id===id);
  if(!cl) return;
  if(DRAFT){ DRAFT.clientId = id; DRAFT.clientName = cl.name; }
  document.getElementById('new-client-id').value = id;
  document.getElementById('new-client-search').value = cl.name;
  const box = document.getElementById('client-options');
  box.style.display='none'; box.innerHTML='';
}

// ---------- PARCEIROS (COMISSIONADOS) ----------

// Desconto efetivo de um cliente numa semana: sobrescrita manual daquela semana,
// senão o desconto padrão atual do cliente.
