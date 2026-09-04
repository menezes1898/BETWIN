function caixaTotalCalc(){
  const entradasClientes = STATE.settlements.reduce((s,x)=>s+x.amount,0);
  const retiradas = STATE.withdrawals.reduce((s,x)=>s+x.amount,0);
  const receitas = STATE.transactions.filter(t=>t.type==='receita').reduce((s,x)=>s+x.amount,0);
  const despesas = STATE.transactions.filter(t=>t.type==='despesa').reduce((s,x)=>s+x.amount,0);
  return entradasClientes - retiradas + receitas - despesas;
}
function renderFinanceiroTab(){
  const weeks = allWeeksSorted();
  const caixaTotal = caixaTotalCalc();

  if(!FINANCE_WEEK) FINANCE_WEEK = weeks[0] || mondayOf(todaySP());

  // Situação por cliente: saldo CONTÍNUO (todas as semanas), some da lista só quando quitado
  const rows = STATE.clients.map(cl=>{
    const remaining = computeContinuousBalance(cl.id, null);
    if(Math.abs(remaining) < 0.01) return null;
    const totalPaid = getAllSettlementsForClient(cl.id);
    const status = totalPaid>0 ? 'parcial' : 'pendente';
    const openTransactions = STATE.transactions.filter(t=>t.type==='em_aberto' && t.clientId===cl.id);
    const emAbertoAmount = openTransactions.reduce((s,x)=>s+x.amount,0);
    return {id:cl.id, name:cl.name, remaining, totalPaid, status, emAbertoAmount};
  }).filter(Boolean);

  // Resumo: "A receber" é contínuo (soma de tudo que está pendente, de qualquer semana),
  // já que clientes às vezes atrasam. "A pagar" é só da semana selecionada, pois pagamentos
  // pra quem ganha são sempre feitos em dia.
  const receberContinuo = rows.filter(r=>r.remaining>0).reduce((s,r)=>s+r.remaining,0);

  const weekTicketsByClient = {};
  STATE.tickets.filter(t=>mondayOf(ticketDate(t))===FINANCE_WEEK && ticketResult(t)!=='pending' && ticketResult(t)!=='void').forEach(t=>{
    (weekTicketsByClient[t.clientId] = weekTicketsByClient[t.clientId]||[]).push(t);
  });
  let pagarSemana = 0;
  Object.entries(weekTicketsByClient).forEach(([clientId, tks])=>{
    const cl = STATE.clients.find(c=>c.id===clientId);
    const resultadoW = tks.reduce((s,t)=>s+ticketProfit(t),0);
    const descontoW = cl ? computeDescontoAmount(cl, resultadoW, FINANCE_WEEK) : 0;
    const adminAmount = -(cl ? applyDescontoSign(cl, resultadoW, descontoW) : resultadoW);
    if(adminAmount<0) pagarSemana += Math.abs(adminAmount);
  });

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <h3 style="margin:0">Financeiro</h3>
        <div style="display:flex;align-items:center;gap:14px">
          <button class="btn-ghost btn-sm" onclick="changeFinanceWeek(-1)">‹</button>
          <span style="font-family:var(--font-mono);font-size:13px;font-weight:600">${weekLabel(FINANCE_WEEK)}</span>
          <button class="btn-ghost btn-sm" onclick="changeFinanceWeek(1)">›</button>
        </div>
      </div>
      <div class="row" style="gap:22px">
        <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Caixa (total acumulado)</div><div style="font-family:var(--font-mono);font-size:18px;margin-top:4px" class="${caixaTotal>=0?'profit-pos':'profit-neg'}">${fmtBRL(caixaTotal)}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">A receber (total pendente)</div><div style="font-family:var(--font-mono);font-size:18px;margin-top:4px" class="profit-pos">${fmtBRL(receberContinuo)}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">A pagar nessa semana</div><div style="font-family:var(--font-mono);font-size:18px;margin-top:4px" class="profit-neg">${fmtBRL(pagarSemana)}</div></div>
      </div>
    </div>
    <div class="card">
      <h3>Situação por cliente <span style="font-size:12px;color:var(--text-muted);font-weight:400">(saldo contínuo — some só quando quitado)</span></h3>
      ${rows.length===0 ? '<div class="empty">Nenhum saldo pendente no momento.</div>' : rows.map(r=>`
        <div class="match-row" style="flex-wrap:nowrap;gap:10px">
          <div class="match-desc" style="flex:1;min-width:0;overflow:hidden">
            <span class="teams" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.name}</span>
            <span class="meta" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              ${r.remaining>=0?'A receber':'A pagar'}
              ${r.emAbertoAmount ? ` (inclui saldo em aberto de ${fmtBRL(Math.abs(r.emAbertoAmount))})` : ''}
              ${r.status==='parcial' ? ` — já ${r.totalPaid>=0?'recebido':'pago'} ${fmtBRL(Math.abs(r.totalPaid))} no total` : ''}
            </span>
          </div>
          <div class="match-actions" style="flex-shrink:0;flex-wrap:nowrap;white-space:nowrap">
            <span title="Saldo pendente acumulado, considerando todas as semanas e pagamentos já feitos" style="font-family:var(--font-mono);font-size:15px;font-weight:700;cursor:help;border-bottom:1px dotted currentColor" class="${r.remaining>=0?'profit-pos':'profit-neg'}">${fmtBRL(Math.abs(r.remaining))}</span>
            ${r.status==='parcial' ? `<span class="chip chip-pending">PARCIAL</span>` : `<span class="chip chip-pending">PENDENTE</span>`}
            <button class="btn-ghost btn-sm" onclick="darBaixa('${r.id}','${FINANCE_WEEK}',${r.remaining})">Dar baixa</button>
            ${r.status==='parcial' ? `<button class="btn-ghost btn-sm" onclick="desfazerUltimaBaixa('${r.id}')">Desfazer última</button>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
    ${renderBaixasHistoricoSection()}
    ${renderComissoesSection()}
    ${renderRetiradasSection()}
    ${renderLancamentosSection()}
  `;
}
async function darBaixa(clientId, weekStart, remaining){
  const isReceber = remaining>=0;
  const label = isReceber ? 'Valor recebido agora' : 'Valor pago agora';
  const defaultVal = Math.abs(remaining).toFixed(2).replace('.',',');
  const input = prompt(`${label} (falta ${fmtBRL(Math.abs(remaining))}):`, defaultVal);
  if(input===null) return;
  const val = parseFloat(String(input).replace(',','.'));
  if(isNaN(val) || val<=0){ alert('Valor inválido.'); return; }
  const amount = isReceber ? val : -val;
  const {data, error} = await supabaseClient.from('settlements').insert({client_id: clientId, week_start: weekStart, amount}).select().single();
  if(error){ alert('Erro ao dar baixa: '+error.message); return; }
  STATE.settlements.push({id:data.id, clientId:data.client_id, weekStart:data.week_start, amount:parseFloat(data.amount), paidAt:data.paid_at});
  render();
}
async function desfazerUltimaBaixa(clientId){
  const list = STATE.settlements.filter(s=>s.clientId===clientId).sort((a,b)=>a.paidAt.localeCompare(b.paidAt));
  const last = list[list.length-1];
  if(!last) return;
  if(!confirm('Desfazer a última baixa registrada para esse cliente?')) return;
  const {error} = await supabaseClient.from('settlements').delete().eq('id', last.id);
  if(error){ alert('Erro ao desfazer baixa: '+error.message); return; }
  STATE.settlements = STATE.settlements.filter(s=>s.id!==last.id);
  render();
}

// ---------- HISTÓRICO DE BAIXAS ----------
function renderBaixasHistoricoSection(){
  const list = [...STATE.settlements].sort((a,b)=>(b.paidAt||'').localeCompare(a.paidAt||''));
  const totalBaixas = list.reduce((s,x)=>s+x.amount,0);
  return `
    <div class="card" style="cursor:pointer" onclick="SHOW_BAIXAS_HISTORICO=!SHOW_BAIXAS_HISTORICO;render()">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="chip chip-pending">HISTÓRICO DE BAIXAS</span>
        <span style="font-family:var(--font-mono);font-size:14px;color:var(--gold)">${list.length} registro(s)</span>
      </div>
    </div>
    ${SHOW_BAIXAS_HISTORICO ? `
    <div class="card">
      ${list.length===0 ? '<div class="empty">Nenhuma baixa registrada ainda.</div>' : list.map(s=>{
        const cl = STATE.clients.find(c=>c.id===s.clientId);
        const data = s.paidAt ? new Date(s.paidAt).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
        return `
          <div class="match-row">
            <div class="match-desc">
              <span class="teams">${cl?cl.name:'Cliente removido'}</span>
              <span class="meta">${data} · semana de ${weekLabel(s.weekStart)} · ${s.amount>=0?'recebido':'pago ao cliente'}</span>
            </div>
            <div class="match-actions">
              <span style="font-family:var(--font-mono);font-size:13px" class="${s.amount>=0?'profit-pos':'profit-neg'}">${s.amount>=0?'+':'-'}${fmtBRL(Math.abs(s.amount))}</span>
              <button class="btn-danger-ghost btn-sm" onclick="excluirBaixa('${s.id}')">Excluir</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
    ` : ''}
  `;
}
async function excluirBaixa(settlementId){
  if(!confirm('Excluir esse registro de baixa? Isso reabre o valor correspondente como pendente.')) return;
  const {error} = await supabaseClient.from('settlements').delete().eq('id', settlementId);
  if(error){ alert('Erro ao excluir baixa: '+error.message); return; }
  STATE.settlements = STATE.settlements.filter(s=>s.id!==settlementId);
  render();
}

// ---------- RETIRADAS ----------
// ---------- COMISSÕES ----------
function renderComissoesSection(){
  const weekMonday = FINANCE_WEEK || mondayOf(todaySP());
  const totals = {}; // commissionerId -> {amount, count}
  STATE.clients.forEach(cl=>{
    const active = getActiveCommissionersForWeek(cl.id, weekMonday);
    active.forEach(a=>{
      const amount = computeCommissionAmount(cl.id, a.percent, weekMonday);
      if(amount<=0) return;
      if(!totals[a.commissionerId]) totals[a.commissionerId] = {amount:0, count:0};
      totals[a.commissionerId].amount += amount;
      totals[a.commissionerId].count += 1;
    });
  });
  const rows = Object.entries(totals).map(([commissionerId, v])=>{
    const cm = STATE.commissioners.find(c=>c.id===commissionerId);
    return {id:commissionerId, name:cm?cm.name:'Comissionado removido', amount:v.amount, count:v.count};
  });
  const total = rows.reduce((s,r)=>s+r.amount,0);
  return `
    <div class="card" style="cursor:pointer" onclick="SHOW_COMISSOES=!SHOW_COMISSOES;render()">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="chip chip-pending">COMISSÕES DA SEMANA</span>
        <span style="font-family:var(--font-mono);font-size:14px;color:var(--gold)">${fmtBRL(total)}</span>
      </div>
    </div>
    ${SHOW_COMISSOES ? `
    <div class="card">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">Semana de ${weekLabel(weekMonday)} · calculada em cima da perda bruta dos clientes vinculados naquela semana (antes do desconto do cliente)</div>
      ${rows.length===0 ? '<div class="empty">Nenhuma comissão essa semana.</div>' : rows.map(r=>`
        <div class="match-row">
          <div class="match-desc">
            <span class="teams">${r.name}</span>
            <span class="meta">${r.count} cliente(s) com perda essa semana</span>
          </div>
          <div class="match-actions">
            <span style="font-family:var(--font-mono);font-size:13px;font-weight:700;color:var(--gold)">${fmtBRL(r.amount)}</span>
            <button class="btn-ghost btn-sm" onclick="registrarPagamentoComissao('${r.id}','${r.name.replace(/'/g,"\\'")}',${r.amount},'${weekMonday}')">Registrar pagamento</button>
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}
  `;
}
async function registrarPagamentoComissao(commissionerId, name, amount, weekMonday){
  if(amount<=0){ alert('Não há comissão a pagar essa semana pra esse comissionado.'); return; }
  if(!confirm(`Registrar pagamento de ${fmtBRL(amount)} de comissão pra ${name}? Isso entra como uma despesa no seu financeiro.`)) return;
  const description = `Comissão — ${name} (semana ${weekLabel(weekMonday)})`;
  const {data, error} = await supabaseClient.from('transactions').insert({
    type:'despesa', category:'Comissão', description, amount, date: todaySP()
  }).select().single();
  if(error){ alert('Erro ao registrar pagamento: '+error.message); return; }
  STATE.transactions.push({id:data.id, type:data.type, category:data.category||'', description:data.description||'', amount:parseFloat(data.amount), date:data.date, createdAt:data.created_at, clientId:data.client_id||null});
  await pruneTransactions();
  render();
}

function renderRetiradasSection(){
  const caixaTotal = caixaTotalCalc();
  const list = [...STATE.withdrawals].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  const totalRetiradas = STATE.withdrawals.reduce((s,x)=>s+x.amount,0);
  return `
    <div class="card" style="cursor:pointer" onclick="SHOW_RETIRADAS=!SHOW_RETIRADAS;render()">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="chip chip-pending">RETIRADAS</span>
        <span style="font-family:var(--font-mono);font-size:14px;color:var(--gold)">${fmtBRL(totalRetiradas)}</span>
      </div>
    </div>
    ${SHOW_RETIRADAS ? `
    <div class="card">
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Caixa disponível</div>
      <div style="font-family:var(--font-mono);font-size:22px;margin-top:4px" class="${caixaTotal>=0?'profit-pos':'profit-neg'}">${fmtBRL(caixaTotal)}</div>
    </div>
    <div class="card">
      <h3>Nova retirada</h3>
      <label>Valor</label>
      <input type="number" id="new-withdrawal-amount" step="0.01" placeholder="Valor (ex: 500,00)">
      <label>Descrição (opcional)</label>
      <input type="text" id="new-withdrawal-desc" placeholder="Ex: Retirada pessoal">
      <div style="margin-top:14px"><button class="btn-primary" onclick="addWithdrawal()">Registrar retirada</button></div>
    </div>
    <div class="card">
      <h3>Histórico de retiradas</h3>
      ${list.length===0 ? '<div class="empty">Nenhuma retirada registrada ainda.</div>' : list.map(w=>`
        <div class="match-row">
          <div class="match-desc">
            <span class="teams">${fmtBRL(w.amount)}</span>
            <span class="meta">${w.createdAt ? new Date(w.createdAt).toLocaleDateString('pt-BR') : ''}${w.description?' · '+w.description:''}</span>
          </div>
          <button class="btn-danger-ghost btn-sm" onclick="deleteWithdrawal('${w.id}')">Excluir</button>
        </div>
      `).join('')}
    </div>
    ` : ''}
  `;
}
async function addWithdrawal(){
  const amount = parseFloat(document.getElementById('new-withdrawal-amount').value);
  const description = document.getElementById('new-withdrawal-desc').value.trim();
  if(!amount || amount<=0){ alert('Informe o valor da retirada.'); return; }
  const {data, error} = await supabaseClient.from('withdrawals').insert({amount, description}).select().single();
  if(error){ alert('Erro ao registrar retirada: '+error.message); return; }
  STATE.withdrawals.push({id:data.id, amount:parseFloat(data.amount), description:data.description||'', createdAt:data.created_at});
  render();
}
async function deleteWithdrawal(id){
  if(!confirm('Excluir esse registro de retirada?')) return;
  const {error} = await supabaseClient.from('withdrawals').delete().eq('id', id);
  if(error){ alert('Erro ao excluir retirada: '+error.message); return; }
  STATE.withdrawals = STATE.withdrawals.filter(w=>w.id!==id);
  render();
}

// ---------- DESPESAS E RECEITAS ----------
function renderLancamentosSection(){
  const receitas = STATE.transactions.filter(t=>t.type==='receita');
  const despesas = STATE.transactions.filter(t=>t.type==='despesa');
  const emAberto = STATE.transactions.filter(t=>t.type==='em_aberto');
  const totalReceitas = receitas.reduce((s,x)=>s+x.amount,0);
  const totalDespesas = despesas.reduce((s,x)=>s+x.amount,0);
  const totalEmAberto = emAberto.reduce((s,x)=>s+x.amount,0);
  const saldo = totalReceitas - totalDespesas;
  const list = [...STATE.transactions].sort((a,b)=> (b.date+(b.createdAt||'')).localeCompare(a.date+(a.createdAt||'')));

  return `
    <div class="card" style="cursor:pointer" onclick="SHOW_LANCAMENTOS=!SHOW_LANCAMENTOS;render()">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="chip chip-pending">DESPESAS E RECEITAS</span>
        <span style="font-family:var(--font-mono);font-size:14px" class="${saldo>=0?'profit-pos':'profit-neg'}">${fmtBRL(saldo)}</span>
      </div>
    </div>
    ${SHOW_LANCAMENTOS ? `
    <div class="card">
      <div class="row" style="gap:22px">
        <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Receitas</div><div style="font-family:var(--font-mono);font-size:18px;margin-top:4px" class="profit-pos">${fmtBRL(totalReceitas)}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Despesas</div><div style="font-family:var(--font-mono);font-size:18px;margin-top:4px" class="profit-neg">${fmtBRL(totalDespesas)}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Em aberto</div><div style="font-family:var(--font-mono);font-size:18px;margin-top:4px;color:var(--gold)">${fmtBRL(totalEmAberto)}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Saldo (recebido)</div><div style="font-family:var(--font-mono);font-size:18px;margin-top:4px" class="${saldo>=0?'profit-pos':'profit-neg'}">${fmtBRL(saldo)}</div></div>
      </div>
    </div>
    <div class="card">
      <h3>Novo lançamento</h3>
      <div class="row">
        <div><label>Tipo</label>
          <select id="new-transaction-type">
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
            <option value="em_aberto">Em Aberto (saldo pendente do cliente)</option>
          </select>
        </div>
        <div><label>Data</label><input type="date" id="new-transaction-date" value="${todaySP()}"></div>
      </div>
      <label>Categoria (opcional)</label>
      <input type="text" id="new-transaction-category" placeholder="Ex: Sistema, Funcionário, Comissão, Marketing…">
      <label>Vincular a um cliente (opcional)</label>
      <div class="autocomplete-wrap">
        <input type="text" id="new-transaction-client-search" placeholder="Buscar cliente…" autocomplete="off"
          oninput="filterTransactionClientOptions()" onfocus="filterTransactionClientOptions()" onkeydown="handleAutocompleteKeydown(event,'transaction-client-options')"
          onblur="setTimeout(()=>{const b=document.getElementById('transaction-client-options'); if(b) b.style.display='none';},150)">
        <input type="hidden" id="new-transaction-client-id" value="">
        <div id="transaction-client-options" class="autocomplete-list"></div>
      </div>
      <label>Descrição</label>
      <input type="text" id="new-transaction-desc" placeholder="Ex: Saldo antigo, serviço adquirido…">
      <label>Valor</label>
      <input type="number" id="new-transaction-amount" step="0.01" placeholder="Valor (ex: 150,00)">
      <div style="margin-top:14px"><button class="btn-primary" onclick="addTransaction()">Registrar lançamento</button></div>
    </div>
    <div class="card">
      <h3>Histórico <span style="font-size:12px;color:var(--text-muted);font-weight:400">(últimos ${Math.min(list.length,100)} de no máximo 100)</span></h3>
      ${list.length===0 ? '<div class="empty">Nenhum lançamento registrado ainda.</div>' : list.map(t=>{
        const linkedClient = t.clientId ? STATE.clients.find(c=>c.id===t.clientId) : null;
        const registradoEm = t.createdAt ? new Date(t.createdAt).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
        const typeLabel = t.type==='receita' ? 'Receita' : t.type==='despesa' ? 'Despesa' : 'Em Aberto';
        const valueColor = t.type==='receita' ? 'profit-pos' : t.type==='despesa' ? 'profit-neg' : '';
        const valueSign = t.type==='despesa' ? '-' : '+';
        return `
        <div class="match-row">
          <div class="match-desc">
            <span class="teams">${t.description || typeLabel}${linkedClient?' — '+linkedClient.name:''}${t.type==='em_aberto'?' <span class="chip chip-pending" style="margin-left:4px">EM ABERTO</span>':''}</span>
            <span class="meta">${fmtDate(t.date)}${t.category?' · '+t.category:''} · registrado em ${registradoEm}</span>
          </div>
          <div class="match-actions">
            <span style="font-family:var(--font-mono);font-size:13px" class="${valueColor}" ${t.type==='em_aberto'?'style="color:var(--gold)"':''}>${valueSign}${fmtBRL(t.amount)}</span>
            ${t.type==='em_aberto' ? `<button class="btn-ghost btn-sm" onclick="marcarComoRecebido('${t.id}')">Marcar recebido</button>` : ''}
            <button class="btn-danger-ghost btn-sm" onclick="deleteTransaction('${t.id}')">Excluir</button>
          </div>
        </div>
      `;}).join('')}
    </div>
    ` : ''}
  `;
}
function filterTransactionClientOptions(){
  const input = document.getElementById('new-transaction-client-search');
  const box = document.getElementById('transaction-client-options');
  const val = input.value.trim().toLowerCase();
  document.getElementById('new-transaction-client-id').value = '';
  if(val.length < 2){ box.style.display='none'; box.innerHTML=''; return; }
  const matches = STATE.clients.filter(c=>c.name.toLowerCase().includes(val));
  if(matches.length===0){
    box.innerHTML = '<div class="autocomplete-item" style="cursor:default;color:var(--text-muted)">Nenhum cliente encontrado</div>';
  } else {
    box.innerHTML = matches.map(c=>`<div class="autocomplete-item" onmousedown="selectTransactionClientOption('${c.id}')">${c.name}</div>`).join('');
  }
  box.style.display='block';
}
function selectTransactionClientOption(id){
  const cl = STATE.clients.find(c=>c.id===id);
  if(!cl) return;
  document.getElementById('new-transaction-client-id').value = id;
  document.getElementById('new-transaction-client-search').value = cl.name;
  const box = document.getElementById('transaction-client-options');
  box.style.display='none'; box.innerHTML='';
}
async function marcarComoRecebido(id){
  const {error} = await supabaseClient.from('transactions').update({type:'receita'}).eq('id', id);
  if(error){ alert('Erro ao atualizar: '+error.message); return; }
  const t = STATE.transactions.find(x=>x.id===id);
  if(t) t.type = 'receita';
  render();
}
async function addTransaction(){
  const type = document.getElementById('new-transaction-type').value;
  const category = document.getElementById('new-transaction-category').value.trim();
  const clientId = document.getElementById('new-transaction-client-id').value || null;
  const description = document.getElementById('new-transaction-desc').value.trim();
  const amount = parseFloat(document.getElementById('new-transaction-amount').value);
  const date = document.getElementById('new-transaction-date').value;
  if(!date){ alert('Informe a data.'); return; }
  if(!amount || amount<=0){ alert('Informe o valor.'); return; }
  const {data, error} = await supabaseClient.from('transactions').insert({type, category, description, amount, date, client_id: clientId}).select().single();
  if(error){ alert('Erro ao registrar lançamento: '+error.message); return; }
  STATE.transactions.push({id:data.id, type:data.type, category:data.category||'', description:data.description||'', amount:parseFloat(data.amount), date:data.date, createdAt:data.created_at, clientId:data.client_id||null});
  await pruneTransactions();
  render();
}
async function pruneTransactions(){
  const LIMIT = 100;
  if(STATE.transactions.length <= LIMIT) return;
  const sorted = [...STATE.transactions].sort((a,b)=> (a.createdAt||'').localeCompare(b.createdAt||''));
  const toRemove = sorted.slice(0, STATE.transactions.length - LIMIT);
  for(const t of toRemove){
    await supabaseClient.from('transactions').delete().eq('id', t.id);
  }
  const removeIds = new Set(toRemove.map(t=>t.id));
  STATE.transactions = STATE.transactions.filter(t=>!removeIds.has(t.id));
}
async function deleteTransaction(id){
  if(!confirm('Excluir esse lançamento?')) return;
  const {error} = await supabaseClient.from('transactions').delete().eq('id', id);
  if(error){ alert('Erro ao excluir lançamento: '+error.message); return; }
  STATE.transactions = STATE.transactions.filter(t=>t.id!==id);
  render();
}

// ---------- CLIENT VIEW ----------
